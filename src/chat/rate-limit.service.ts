import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService, private readonly config: ConfigService) {}
  async assertAllowed(userId: string, ip: string) {
    const windowSeconds = this.config.get<number>('redis.rateWindowSeconds', 60);
    const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
    const [userCount, ipCount] = await Promise.all([this.redis.incrementWindow(`rate:chat:user:${userId}:${windowId}`, windowSeconds + 2), this.redis.incrementWindow(`rate:chat:ip:${ip}:${windowId}`, windowSeconds + 2)]);
    if (userCount > this.config.get<number>('redis.userRateLimit', 10) || ipCount > this.config.get<number>('redis.ipRateLimit', 30)) throw new HttpException({ code: 'CHAT_RATE_LIMITED', message: 'Too many chat requests. Please wait before trying again.' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
