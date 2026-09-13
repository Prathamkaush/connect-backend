import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UsersRepository } from '../users/users.repository';
import { VoiceController, AdminVoiceController } from './voice.controller';
import { VoiceRepository } from './voice.repository';
import { VoiceService } from './voice.service';

describe('voice HTTP authentication and request validation (no provider)', () => {
  let app: INestApplication;
  let url: string;
  const secret = 'voice-test-secret-at-least-32-characters';
  const jwt = new JwtService({ secret });
  const voice = { allowance: jest.fn().mockResolvedValue({ enabled: false }), create: jest.fn(), end: jest.fn() };
  const history = jest.fn().mockResolvedValue([]);
  const users = { findById: jest.fn().mockImplementation((id: string) => Promise.resolve({ id, email: 'test@example.test', isActive: id !== 'disabled', role: id === 'admin' ? 'ADMIN' : 'USER' })) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PassportModule], controllers: [VoiceController, AdminVoiceController], providers: [
      JwtStrategy, { provide: ConfigService, useValue: new ConfigService({ JWT_ACCESS_SECRET: secret }) },
      { provide: UsersRepository, useValue: users }, { provide: VoiceService, useValue: voice },
      { provide: VoiceRepository, useValue: { history } },
    ] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1'); url = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  const token = (sub = 'user') => jwt.sign({ sub }, { expiresIn: '1m' });
  it('validates page size and passes the stable history cursor with the owner', async () => {
    const headers = { Authorization: `Bearer ${token()}` };
    for (const limit of ['0', '51', '-3', 'abc', '1.5']) expect((await fetch(`${url}/voice/calls?limit=${limit}`, { headers })).status).toBe(400);
    const before = '2026-09-13T06:00:00.000Z';
    const beforeId = 'cmexamplehistory000000000001';
    expect((await fetch(`${url}/voice/calls?limit=3&before=${before}&beforeId=${beforeId}`, { headers })).status).toBe(200);
    expect(history).toHaveBeenLastCalledWith('user', before, 3, beforeId);
  });

  it('rejects missing, expired, forged credentials and disabled accounts', async () => {
    expect((await fetch(`${url}/voice/allowance`)).status).toBe(401);
    for (const accessToken of ['invalid', jwt.sign({ sub: 'user' }, { expiresIn: -1 }), token('disabled')]) {
      expect((await fetch(`${url}/voice/allowance`, { headers: { Authorization: `Bearer ${accessToken}` } })).status).toBe(401);
    }
    expect(voice.allowance).not.toHaveBeenCalled();
  });
  it('permits an authenticated user and restricts call records to administrators', async () => {
    expect((await fetch(`${url}/voice/allowance`, { headers: { Authorization: `Bearer ${token()}` } })).status).toBe(200);
    expect((await fetch(`${url}/admin/voice/calls`, { headers: { Authorization: `Bearer ${token()}` } })).status).toBe(403);
    expect((await fetch(`${url}/admin/voice/calls`, { headers: { Authorization: `Bearer ${token('admin')}` } })).status).toBe(200);
  });
  it('rejects client-supplied duration, admin-test flags and provider settings', async () => {
    const response = await fetch(`${url}/voice/calls`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
      masterId: 'teacher', requestId: '7ecfd451-7c23-4a67-8d08-096e938b07ba', sdp: 'x'.repeat(100), isAdminTest: true, reservedSeconds: 99999, instructions: 'bypass',
    }) });
    expect(response.status).toBe(400); expect(voice.create).not.toHaveBeenCalled();
    expect((await fetch(`${url}/admin/voice/test-calls`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
  });
});
