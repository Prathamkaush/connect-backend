import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VoiceRepository } from './voice.repository';
import { VoiceService } from './voice.service';
import { RealtimeProvider } from './realtime.provider';
import { PaymentsService } from '../payments/payments.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';

// Explicit isolated DB only. This suite never reads the project's .env or calls OpenAI.
const databaseUrl = process.env.VOICE_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite('voice PostgreSQL integration (mocked provider)', () => {
  const schema = `voice_test_${randomUUID().replaceAll('-', '')}`;
  let db: PrismaClient;
  let root: PrismaClient;
  let repo: VoiceRepository;
  let voice: VoiceService;
  let userId: string;
  let masterId: string;
  let secondMasterId: string;
  let subscriptionId: string;
  const gateway = { create: jest.fn(), hangup: jest.fn(), attach: jest.fn() };
  const locks = new Set<string>();
  const redis = {
    incrementWindow: jest.fn().mockResolvedValue(1),
    acquireLock: jest.fn().mockImplementation((key: string) => { if (locks.has(key)) return Promise.resolve(false); locks.add(key); return Promise.resolve(true); }),
    releaseLock: jest.fn().mockImplementation((key: string) => { locks.delete(key); return Promise.resolve(1); }),
  };
  const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 AA\r\n';
  const masterData = { name: 'Buddha', slug: 'buddha', shortDescription: 'reflection', description: 'reflect gently', systemPrompt: 'teacher persona', personalityPrompt: 'gentle and concise', allowedTopics: ['reflection'], restrictedTopics: ['coding'], responseStyle: 'concise', fallbackMessage: 'redirect', greetingMessage: 'hello', model: 'provider-default', voiceEnabled: true };
  const config = new ConfigService({ VOICE_ENABLED: 'true', VOICE_MAX_CALL_SECONDS: '1200' });

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/voice_test') throw new Error('VOICE_TEST_DATABASE_URL must target a local database named voice_test.');
    root = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('schema', schema);
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    for (const migration of ['20260905000100_init', '20260906000100_master_guides', '20260906000200_articles']) {
      const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8');
      for (const statement of sql.split(';').filter((part) => part.trim())) await db.$executeRawUnsafe(statement);
    }
    // Legacy rows exist before the new migration, so defaults are tested on upgrade.
    await db.$executeRawUnsafe(`INSERT INTO "User" (id,name,email,"passwordHash","updatedAt","freeQuotaUsed") VALUES ('legacy','Legacy','legacy@example.test','hash',NOW(),3)`);
    await db.$executeRawUnsafe(`INSERT INTO "SubscriptionPlan" (id,name,description,price,"questionQuota","validityDays","updatedAt") VALUES ('legacy','Legacy','Legacy plan',499,100,30,NOW())`);
    await db.$executeRawUnsafe(`INSERT INTO "UserSubscription" (id,"userId","planId",status,"quotaTotal","quotaUsed","startsAt","expiresAt","updatedAt") VALUES ('legacy','legacy','legacy','ACTIVE',100,30,NOW(),NOW()+INTERVAL '30 days',NOW())`);
    const migration = readFileSync('prisma/migrations/20260912000100_voice_calls/migration.sql', 'utf8').replace(/^--.*$/gm, '');
    for (const statement of migration.split(';').filter((part) => part.trim())) await db.$executeRawUnsafe(statement);
    repo = new VoiceRepository(db as PrismaService);
  }, 30000);

  beforeEach(async () => {
    gateway.create.mockReset().mockImplementation(() => Promise.resolve({ callId: `rtc_${randomUUID()}`, sdp: 'answer' }));
    gateway.hangup.mockReset().mockResolvedValue(undefined);
    gateway.attach.mockReset().mockResolvedValue({ enable: jest.fn().mockResolvedValue(undefined), close: jest.fn(), healthy: () => true });
    locks.clear(); redis.incrementWindow.mockResolvedValue(1);
    voice = new VoiceService(repo, gateway as unknown as RealtimeProvider, config, redis as unknown as RedisService);
    const suffix = randomUUID();
    userId = (await db.user.create({ data: { name: 'Seeker', email: `${suffix}@example.test`, passwordHash: 'test' } })).id;
    masterId = (await db.master.create({ data: { ...masterData, slug: `buddha-${suffix}` } })).id;
    secondMasterId = (await db.master.create({ data: { ...masterData, name: 'Krishna', slug: `krishna-${suffix}` } })).id;
    const plan = await db.subscriptionPlan.create({ data: { name: suffix, description: 'Medium', price: 499, questionQuota: 100, voiceEnabled: true, voiceSeconds: 1200, validityDays: 30 } });
    subscriptionId = (await db.userSubscription.create({ data: { userId, planId: plan.id, status: 'ACTIVE', quotaTotal: 100, quotaUsed: 50, voiceSecondsTotal: 1200, startsAt: new Date(), expiresAt: new Date(Date.now() + 30 * 86400000) } })).id;
  });
  afterEach(async () => { await voice.onModuleDestroy(); });
  afterAll(async () => {
    await db?.$disconnect();
    if (root) { await root.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await root.$disconnect(); }
  });

  const create = () => voice.create(userId, '127.0.0.1', { masterId, requestId: randomUUID(), sdp });
  async function simulateElapsed(id: string, seconds: number) {
    const start = new Date(Date.now() - seconds * 1000);
    await db.voiceCall.update({ where: { id }, data: { status: 'ACTIVE', connectedAt: start, deadlineAt: new Date(start.getTime() + 1200000), endReason: 'USER_ENDED' } });
    return repo.finalize(id, new Date(start.getTime() + seconds * 1000));
  }

  it('preserves legacy prices, text use and zero voice entitlements through migration', async () => {
    const legacy = await db.userSubscription.findUniqueOrThrow({ where: { id: 'legacy' }, include: { plan: true, user: true } });
    expect(legacy.voiceSecondsTotal).toBe(0); expect(legacy.plan.voiceEnabled).toBe(false); expect(legacy.plan.voiceSeconds).toBe(0);
    expect(legacy.quotaUsed).toBe(30); expect(legacy.user.freeQuotaUsed).toBe(3); expect(legacy.plan.price.toNumber()).toBe(499);
  });
  it('shares 1200 seconds across teachers while leaving 50 remaining text questions untouched', async () => {
    const first = await repo.reserve(userId, masterId, randomUUID(), 'model', 1200, false);
    await simulateElapsed(first.id, 420);
    const second = await repo.reserve(userId, secondMasterId, randomUUID(), 'model', 1200, false);
    expect(second.reservedSeconds).toBe(780); await simulateElapsed(second.id, 300);
    const subscription = await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(subscription.voiceSecondsTotal - subscription.voiceSecondsUsed).toBe(480);
    expect(subscription.voiceSecondsReserved).toBe(0); expect(subscription.quotaTotal - subscription.quotaUsed).toBe(50);
    expect(await db.questionUsage.count({ where: { userId } })).toBe(0);
  });
  it('atomically admits one of concurrent calls across tabs/devices and rejects duplicate requests', async () => {
    const requestId = randomUUID();
    const results = await Promise.allSettled([repo.reserve(userId, masterId, requestId, 'model', 1200, false), repo.reserve(userId, secondMasterId, randomUUID(), 'model', 1200, false)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } })).voiceSecondsReserved).toBe(1200);
    await expect(repo.reserve(userId, masterId, requestId, 'model', 1200, false)).rejects.toThrow();
  });
  it('failed setup releases the entire reservation without deducting customer time', async () => {
    gateway.create.mockRejectedValueOnce(new Error('offline'));
    await expect(create()).rejects.toThrow();
    const subscription = await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(subscription.voiceSecondsUsed).toBe(0); expect(subscription.voiceSecondsReserved).toBe(0);
    expect(await db.voiceCall.count({ where: { activeUserId: userId } })).toBe(0);
  });
  it('duplicate end events cannot double deduct and only release after confirmed remote hang-up', async () => {
    const call = await create(); await voice.activate(userId, call.id);
    gateway.hangup.mockRejectedValueOnce(new Error('network'));
    await voice.end(userId, call.id);
    expect((await repo.owned(userId, call.id)).status).toBe('STOPPING');
    expect((await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } })).voiceSecondsReserved).toBe(1200);
    await voice.end(userId, call.id); const finalized = await repo.owned(userId, call.id);
    await voice.end(userId, call.id);
    const subscription = await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(subscription.voiceSecondsUsed).toBe(finalized.billableSeconds); expect(subscription.voiceSecondsReserved).toBe(0);
    expect(gateway.hangup).toHaveBeenCalledTimes(2);
  });
  it('quota deadline triggers provider hang-up without a browser countdown or heartbeat', async () => {
    await db.userSubscription.update({ where: { id: subscriptionId }, data: { voiceSecondsTotal: 1 } });
    const call = await create(); await voice.activate(userId, call.id);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(gateway.hangup).toHaveBeenCalled();
    expect((await repo.owned(userId, call.id)).billableSeconds).toBe(1);
  });
  it('subscription expiry caps the durable deadline and reconciler terminates expired calls', async () => {
    const expiry = new Date(Date.now() + 4000);
    await db.userSubscription.update({ where: { id: subscriptionId }, data: { expiresAt: expiry } });
    const call = await create(); const active = await voice.activate(userId, call.id);
    expect(new Date(active.deadlineAt).getTime()).toBeLessThanOrEqual(expiry.getTime());
    await db.userSubscription.update({ where: { id: subscriptionId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await voice.reconcile(); expect((await repo.owned(userId, call.id)).endedAt).not.toBeNull();
  });
  it('disconnect confirmation ends the provider session; reconnect keeps the used period balance', async () => {
    const call = await create(); await voice.activate(userId, call.id); await voice.end(userId, call.id, 'NETWORK_DISCONNECTED');
    const used = (await repo.owned(userId, call.id)).billableSeconds;
    const next = await create(); expect(next.reservedSeconds).toBe(1200 - used);
    expect((await repo.owned(userId, next.id)).subscriptionId).toBe(subscriptionId);
  });
  it('recovers stale sessions after backend restart and abandoned clients without resetting usage', async () => {
    const call = await create(); await voice.activate(userId, call.id);
    await db.voiceCall.update({ where: { id: call.id }, data: { heartbeatAt: new Date(Date.now() - 20000), controlHeartbeatAt: new Date(Date.now() - 20000) } });
    const restarted = new VoiceService(repo, gateway as unknown as RealtimeProvider, config, redis as unknown as RedisService);
    await restarted.reconcile(); await restarted.onModuleDestroy();
    expect(gateway.hangup).toHaveBeenCalled(); expect((await repo.owned(userId, call.id)).activeUserId).toBeNull();
  });
  it('checks ownership, teacher access, active subscription, and isolates prior conversation context', async () => {
    const call = await create(); await expect(voice.end('someone-else', call.id)).rejects.toThrow(); await voice.end(userId, call.id);
    await expect(voice.create(userId, '127.0.0.1', { masterId, sdp, requestId: randomUUID(), conversationId: 'not-owned' })).rejects.toThrow();
    await db.master.update({ where: { id: masterId }, data: { voiceEnabled: false } }); await expect(create()).rejects.toThrow();
    await db.master.update({ where: { id: masterId }, data: { voiceEnabled: true } });
    await db.userSubscription.update({ where: { id: subscriptionId }, data: { status: 'EXPIRED' } }); await expect(create()).rejects.toThrow();
  });
  it('a heartbeat or duplicate activation never extends the deadline or reserves again', async () => {
    const call = await create(); const first = await voice.activate(userId, call.id);
    await voice.heartbeat(userId, call.id); const duplicate = await voice.activate(userId, call.id);
    expect(duplicate.deadlineAt).toEqual(first.deadlineAt); expect(duplicate.connectedAt).toEqual(first.connectedAt);
    expect((await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } })).voiceSecondsReserved).toBe(1200);
  });
  it('abandoned setup is terminated without voice deduction and a stale control lease fails closed', async () => {
    const call = await create();
    await db.voiceCall.update({ where: { id: call.id }, data: { deadlineAt: new Date(Date.now() - 1) } });
    await voice.reconcile(); expect((await repo.owned(userId, call.id)).billableSeconds).toBe(0);
    const next = await create(); await voice.activate(userId, next.id);
    await db.voiceCall.update({ where: { id: next.id }, data: { controlHeartbeatAt: new Date(Date.now() - 20000) } });
    const recovery = new VoiceService(repo, gateway as unknown as RealtimeProvider, config, redis as unknown as RedisService);
    await recovery.reconcile(); await recovery.onModuleDestroy();
    expect((await repo.owned(userId, next.id)).endReason).toBe('CONTROL_LEASE_EXPIRED');
  });
  it('rate limits and disabled feature reject calls without invoking the provider', async () => {
    const disabled = new VoiceService(repo, gateway as unknown as RealtimeProvider, new ConfigService({ VOICE_ENABLED: 'false' }), redis as unknown as RedisService);
    await expect(disabled.create(userId, '127.0.0.1', { masterId, requestId: randomUUID(), sdp })).rejects.toThrow();
    redis.incrementWindow.mockResolvedValue(21); await expect(create()).rejects.toThrow();
    expect(gateway.create).not.toHaveBeenCalled();
  });
  it('admin tests require an admin and track usage without touching the customer allowance', async () => {
    await expect(voice.create(userId, '127.0.0.1', { masterId, sdp, requestId: randomUUID() }, true)).rejects.toThrow();
    await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    const call = await voice.create(userId, '127.0.0.1', { masterId, sdp, requestId: randomUUID() }, true);
    expect(call.reservedSeconds).toBe(180); expect((await repo.owned(userId, call.id)).subscriptionId).toBeNull();
    await repo.recordUsage(call.id, 'response-1', { input_tokens: 50, output_tokens: 100 });
    await repo.recordUsage(call.id, 'response-1', { input_tokens: 50, output_tokens: 100 });
    expect(await db.voiceResponseUsage.count({ where: { callId: call.id } })).toBe(1);
    expect((await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } })).voiceSecondsReserved).toBe(0);
  });
  it('verified payment snapshots purchased voice time and keeps existing text/invoice behavior', async () => {
    const paymentGateway = { publicKey: 'test', createOrder: jest.fn().mockResolvedValue({ id: randomUUID(), amount: 49900, currency: 'INR' }), verifyPaymentSignature: jest.fn(), assertCaptured: jest.fn().mockResolvedValue(undefined) };
    const payments = new PaymentsService(db as PrismaService, new PaymentsRepository(db as PrismaService), new SubscriptionsRepository(db as PrismaService), paymentGateway);
    const subscription = await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const order = await payments.createOrder(userId, { planId: subscription.planId });
    await db.subscriptionPlan.update({ where: { id: subscription.planId }, data: { voiceSeconds: 9999, voiceEnabled: false } });
    const dto = { razorpayOrderId: order.orderId, razorpayPaymentId: randomUUID(), razorpaySignature: 'mocked' };
    await payments.verify(userId, dto); await payments.verify(userId, dto);
    const paid = await db.payment.findUniqueOrThrow({ where: { id: order.paymentId }, include: { subscription: true, invoice: true } });
    expect(paid.subscription?.voiceSecondsTotal).toBe(1200); expect(paid.subscription?.quotaTotal).toBe(100);
    expect(paid.invoice).not.toBeNull(); expect(await db.invoice.count({ where: { paymentId: paid.id } })).toBe(1);
    expect((await db.userSubscription.findUniqueOrThrow({ where: { id: subscriptionId } })).status).toBe('CANCELLED');
  });
});
