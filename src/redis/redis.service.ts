import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('redis.url'), { lazyConnect: true, maxRetriesPerRequest: 2, enableOfflineQueue: false });
    this.client.on('error', () => undefined);
  }
  async connect() { if (this.client.status === 'wait') await this.client.connect(); }
  async onModuleInit() { await this.connect(); }
  async getJson<T>(key: string): Promise<T | null> { const value = await this.client.get(key); return value ? JSON.parse(value) as T : null; }
  async setJson(key: string, value: unknown, ttlSeconds: number) { await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds); }
  async del(key: string) { await this.client.del(key); }
  async acquireLock(key: string, token: string, ttlSeconds: number) { return (await this.client.set(key, token, 'EX', ttlSeconds, 'NX')) === 'OK'; }
  async releaseLock(key: string, token: string) { return this.client.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, token); }
  async incrementWindow(key: string, ttlSeconds: number) {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);
    return count;
  }
  async ping() { return this.client.ping(); }
  async onModuleDestroy() { if (this.client.status !== 'end') await this.client.quit(); }
}
