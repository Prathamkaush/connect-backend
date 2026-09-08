import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
@ApiTags('health') @Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}
  @Get('live') live() { return { status: 'ok', timestamp: new Date().toISOString() }; }
  @Get('ready') async ready() {
    try { await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]); return { status: 'ready', services: { database: 'up', redis: 'up' } }; }
    catch { throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'One or more dependencies are unavailable.' }); }
  }
}
