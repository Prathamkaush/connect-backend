import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MaintenanceGuard } from './maintenance.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('working system settings', () => {
  const upsert = jest.fn().mockResolvedValue({});
  const del = jest.fn();
  const settings = new SettingsService({ systemSetting: { upsert } } as unknown as PrismaService, { del } as unknown as RedisService, new ConfigService({ OPENAI_API_KEY: 'secret-value', 'ai.provider': 'gemini' }));
  beforeEach(() => jest.clearAllMocks());
  it('validates supported settings and invalidates cached values', async () => {
    await settings.update('platform.maintenance', true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: true } }));
    expect(del).toHaveBeenCalledWith('settings:all');
    await expect(settings.update('platform.maintenance', 'true')).rejects.toThrow();
    await expect(settings.update('platform.supportEmail', 'invalid')).rejects.toThrow();
    await expect(settings.update('ai.moderation', false)).rejects.toThrow();
    await expect(settings.update('OPENAI_API_KEY', 'secret')).rejects.toThrow();
  });
  it('returns configuration status without exposing credentials', () => {
    expect(settings.runtime().openaiConfigured).toBe(true);
    expect(JSON.stringify(settings.runtime())).not.toContain('secret-value');
  });
  it('blocks new user activity but permits administrator recovery during maintenance', async () => {
    const findUnique = jest.fn().mockResolvedValue({ isActive: true, role: 'SUPER_ADMIN' });
    const guard = new MaintenanceGuard({ all: async () => ({ 'platform.maintenance': true }) } as unknown as SettingsService, { user: { findUnique } } as unknown as PrismaService);
    const context = (request: object) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
    await expect(guard.canActivate(context({ user: { role: 'USER' } }))).rejects.toThrow('maintenance');
    expect(await guard.canActivate(context({ user: { role: 'ADMIN' } }))).toBe(true);
    expect(await guard.canActivate(context({ route: { path: '/api/v1/auth/login' }, body: { email: 'ADMIN@example.test' } }))).toBe(true);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'admin@example.test' } }));
    findUnique.mockResolvedValue({ isActive: true, role: 'USER' });
    await expect(guard.canActivate(context({ route: { path: '/api/v1/auth/login' }, body: { email: 'user@example.test' } }))).rejects.toThrow();
  });
});
