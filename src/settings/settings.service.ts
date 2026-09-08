import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SettingsService {
  private readonly cacheKey = 'settings:all';
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  async all() {
    const cached = await this.redis.getJson<Record<string, unknown>>(this.cacheKey);
    if (cached) return cached;
    const rows = await this.prisma.systemSetting.findMany();
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    await this.redis.setJson(this.cacheKey, settings, 300);
    return settings;
  }
  async update(key: string, value: unknown) {
    if (!/^[a-z][a-z0-9_.-]{1,79}$/i.test(key)) throw new BadRequestException({ code: 'INVALID_SETTING_KEY', message: 'Setting key is invalid.' });
    const row = await this.prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
    await this.redis.del(this.cacheKey);
    return row;
  }
}
