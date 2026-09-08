import { registerAs } from '@nestjs/config';
export default registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  masterCacheTtl: Number(process.env.MASTER_CACHE_TTL_SECONDS ?? 900),
  requestLockTtl: Number(process.env.REQUEST_LOCK_TTL_SECONDS ?? 90),
  userRateLimit: Number(process.env.CHAT_RATE_LIMIT_USER ?? 10),
  ipRateLimit: Number(process.env.CHAT_RATE_LIMIT_IP ?? 30),
  rateWindowSeconds: Number(process.env.CHAT_RATE_WINDOW_SECONDS ?? 60),
}));
