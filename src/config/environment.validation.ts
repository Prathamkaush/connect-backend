const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL'] as const;

export function validateEnvironment(values: Record<string, unknown>) {
  const missing = required.filter((key) => typeof values[key] !== 'string' || !String(values[key]).trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (String(values[key]).length < 32) throw new Error(`${key} must contain at least 32 characters.`);
  }
  try { new URL(String(values.FRONTEND_URL)); } catch { throw new Error('FRONTEND_URL must be a valid URL.'); }
  const provider = typeof values.AI_PROVIDER === 'string' ? values.AI_PROVIDER.toLowerCase() : 'gemini';
  if (!['gemini', 'openai', 'openrouter'].includes(provider)) throw new Error('AI_PROVIDER must be gemini, openai, or openrouter.');
  const providerKey = provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY';
  if (typeof values[providerKey] !== 'string' || !String(values[providerKey]).trim()) {
    throw new Error(`${providerKey} is required when AI_PROVIDER=${provider}.`);
  }
  return values;
}
