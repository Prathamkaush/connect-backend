import OpenAI from 'openai';
import { OpenAiProvider } from './openai.provider';

jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

describe('OpenRouter free-model integration', () => {
  const options = { provider: 'openrouter' as const, apiKey: 'test-key', defaultModel: 'openrouter/free', timeoutMs: 30000, maxRetries: 0 };
  const create = jest.fn();
  beforeEach(() => {
    create.mockReset();
    (OpenAI as unknown as jest.Mock).mockClear().mockImplementation(() => ({ chat: { completions: { create } } }));
  });
  it.each(['provider-default', 'gemini-3.6-flash', 'openai/gpt-4o'])('routes %s to the free router', async (model) => {
    create.mockResolvedValue({ choices: [{ message: { content: 'Hello' } }] });
    await new OpenAiProvider(options).generate([{ role: 'user', content: 'Hello' }], { model, temperature: 0.5, maxOutputTokens: 100 });
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://openrouter.ai/api/v1', apiKey: 'test-key' }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'openrouter/free' }));
  });
  it('rejects a paid default model', () => {
    expect(() => new OpenAiProvider({ ...options, defaultModel: 'openrouter/auto' })).toThrow('requires openrouter/free');
  });
  it('streams content and token usage from a specific free model', async () => {
    create.mockResolvedValue((async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [], usage: { prompt_tokens: 5, completion_tokens: 1 } };
    })());
    const onDelta = jest.fn();
    const result = await new OpenAiProvider(options).stream([{ role: 'user', content: 'Hi' }], { model: 'example/model:free', temperature: 0.5, maxOutputTokens: 100 }, onDelta);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'example/model:free', stream: true }));
    expect(onDelta).toHaveBeenCalledWith('Hello');
    expect(result).toEqual({ content: 'Hello', inputTokens: 5, outputTokens: 1 });
  });
});
