import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  freeQuestionLimit: Number(process.env.FREE_QUESTION_LIMIT ?? 5),
  contextRecentMessages: Number(process.env.CONTEXT_RECENT_MESSAGES ?? 14),
  contextSummaryThreshold: Number(process.env.CONTEXT_SUMMARY_THRESHOLD ?? 24),
}));
