import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';

@Injectable()
export class SettingsService {
  private readonly cacheKey = 'settings:all';
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService, private readonly config: ConfigService) {}
  runtime() {
    return {
      aiProvider: this.config.get<string>('ai.provider', 'gemini'),
      openrouterConfigured: !!this.config.get<string>('ai.openrouter.apiKey'),
      openaiConfigured: !!this.config.get<string>('OPENAI_API_KEY'),
      geminiConfigured: !!this.config.get<string>('GEMINI_API_KEY'),
      paymentsConfigured: !!this.config.get<string>('RAZORPAY_KEY_ID') && !!this.config.get<string>('RAZORPAY_KEY_SECRET'),
      paymentWebhookConfigured: !!this.config.get<string>('RAZORPAY_WEBHOOK_SECRET'),
      voiceEnabled: this.config.get<string>('VOICE_ENABLED', 'false') === 'true',
      voiceModel: this.config.get<string>('VOICE_REALTIME_MODEL', 'gpt-realtime-2.1-mini'),
      accessTokenLifetime: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
      refreshTokenDays: this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30),
      emailNotificationsAvailable: false,
    };
  }
  async all() {
    const cached = await this.redis.getJson<Record<string, unknown>>(this.cacheKey);
    if (cached) return cached;
    const rows = await this.prisma.systemSetting.findMany();
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    await this.redis.setJson(this.cacheKey, settings, 300);
    return settings;
  }
  async update(key: string, value: unknown) {
    const valid = key === 'platform.name' ? typeof value === 'string' && value.trim().length >= 2 && value.length <= 80
      : key === 'platform.supportEmail' ? typeof value === 'string' && isEmail(value)
      : key === 'platform.language' ? ['English', 'Hindi', 'Hinglish', 'Auto'].includes(String(value))
      : key === 'platform.maintenance' ? typeof value === 'boolean' : false;
    if (!valid) throw new BadRequestException({ code: 'INVALID_SETTING', message: 'This setting is unsupported or its value is invalid.' });
    if (!/^[a-z][a-z0-9_.-]{1,79}$/i.test(key)) throw new BadRequestException({ code: 'INVALID_SETTING_KEY', message: 'Setting key is invalid.' });
    const row = await this.prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
    await this.redis.del(this.cacheKey);
    return row;
  }
}
