import { GeminiProvider } from './gemini.provider';

describe('GeminiProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  const provider = () =>
    new GeminiProvider({
      apiKey: 'test-key',
      defaultModel: 'gemini-3.6-flash',
      timeoutMs: 1_000,
      maxRetries: 0,
    });

  it('reserves tokens for Gemini 3 thinking and uses minimal reasoning', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'A complete answer.' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 6 },
      }),
    } as Response);

    const result = await provider().generate(
      [{ role: 'user', content: 'A question' }],
      { temperature: 0.7, maxOutputTokens: 800 },
    );
    const rawBody = request.mock.calls[0]?.[1]?.body;
    if (typeof rawBody !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(rawBody) as {
      generationConfig: Record<string, unknown>;
    };

    expect(body.generationConfig).toMatchObject({
      maxOutputTokens: 1824,
      thinkingConfig: { thinkingLevel: 'minimal' },
    });
    expect(body.generationConfig).not.toHaveProperty('temperature');
    expect(result.outputTokens).toBe(10);
  });

  it('does not accept a token-limited partial response as complete', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'An unfinished' }] }, finishReason: 'MAX_TOKENS' }],
      }),
    } as Response);

    await expect(
      provider().generate(
        [{ role: 'user', content: 'A question' }],
        { temperature: 0.7, maxOutputTokens: 800 },
      ),
    ).rejects.toMatchObject({
      response: { code: 'AI_RESPONSE_TRUNCATED' },
    });
  });
});
