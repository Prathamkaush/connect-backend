import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  provider: (process.env.AI_PROVIDER ?? 'gemini').toLowerCase(),
  timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 30_000),
  maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    defaultModel: process.env.GEMINI_DEFAULT_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? 'openrouter/free',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4.1-mini',
  },
}));
