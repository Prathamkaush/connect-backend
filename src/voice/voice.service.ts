import { ConflictException, HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { VoiceCall } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { CreateVoiceCallDto } from './voice.dto';
import { RealtimeProvider, VoiceControl, ProviderEvent } from './realtime.provider';
import { VoiceRepository } from './voice.repository';
import { TERMINAL, validateAudioOffer, voiceInstructions } from './voice.policy';

@Injectable()
export class VoiceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoiceService.name);
  private readonly controls = new Map<string, VoiceControl>();
  private readonly providerIds = new Map<string, string>();
  private readonly deadlines = new Map<string, ReturnType<typeof setTimeout>>();
  private timer?: ReturnType<typeof setInterval>;
  private working = false;
  private lastReconciliationErrorAt?: number;
  constructor(private readonly repo: VoiceRepository, private readonly provider: RealtimeProvider, private readonly config: ConfigService, private readonly redis: RedisService) {}

  enabled() { return this.config.get<string>('VOICE_ENABLED', 'false') === 'true'; }
  private assertEnabled() {
    if (!this.enabled()) throw new ServiceUnavailableException({ code: 'VOICE_DISABLED', message: 'Voice calls are not available yet.' });
  }
  onModuleInit() {
    // Run even with feature disabled: outstanding sessions still need terminating.
    this.timer = setInterval(() => { void this.reconcile(); }, 1000);
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.controls.keys()].map((id) => this.stop(id, 'SERVER_SHUTDOWN')));
    for (const control of this.controls.values()) control.close();
    for (const timer of this.deadlines.values()) clearTimeout(timer);
  }

  async allowance(userId: string) {
    const subscription = await this.repo.prisma.userSubscription.findFirst({ where: { userId, status: 'ACTIVE', startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' } });
    const active = await this.repo.prisma.voiceCall.findUnique({ where: { activeUserId: userId } });
    return { enabled: this.enabled(), totalSeconds: subscription?.voiceSecondsTotal ?? 0, usedSeconds: subscription?.voiceSecondsUsed ?? 0,
      reservedSeconds: subscription?.voiceSecondsReserved ?? 0,
      remainingSeconds: subscription ? Math.max(0, subscription.voiceSecondsTotal - subscription.voiceSecondsUsed - subscription.voiceSecondsReserved) : 0,
      expiresAt: subscription?.expiresAt ?? null, activeCall: active ? this.repo.publicCall(active) : null };
  }

  async create(userId: string, ip: string, dto: CreateVoiceCallDto, isAdminTest = false) {
    this.assertEnabled();
    validateAudioOffer(dto.sdp);
    const [userCount, ipCount] = await Promise.all([
      this.redis.incrementWindow(`voice:create:user:${userId}`, 60), this.redis.incrementWindow(`voice:create:ip:${ip}`, 60),
    ]);
    if (userCount > 5 || ipCount > 20) throw new HttpException({ code: 'VOICE_RATE_LIMIT', message: 'Too many call attempts. Please wait a minute.' }, 429);
    const master = await this.repo.prisma.master.findUniqueOrThrow({ where: { id: dto.masterId } });
    const { conversationLanguage } = await this.repo.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { conversationLanguage: true } });
    let summary: string | null = null;
    if (dto.conversationId) {
      const conversation = await this.repo.prisma.conversation.findFirst({ where: { id: dto.conversationId, userId, masterId: master.id, status: 'ACTIVE' }, select: { summary: true } });
      if (!conversation) throw new ConflictException('The conversation is unavailable for this teacher and account.');
      summary = conversation.summary;
    }
    const model = this.config.get<string>('VOICE_REALTIME_MODEL', 'gpt-realtime-2.1-mini');
    const maxSeconds = Math.min(Number(this.config.get('VOICE_MAX_CALL_SECONDS', '180')), isAdminTest ? 180 : 3600);
    const call = await this.repo.reserve(userId, master.id, dto.requestId, model, maxSeconds, isAdminTest);
    let providerId: string | undefined;
    try {
      const result = await this.provider.create(dto.sdp, model, master.voice, voiceInstructions(master, summary, conversationLanguage), userId);
      providerId = result.callId;
      this.providerIds.set(call.id, providerId);
      // Persist the remote ID before sending SDP to the browser. Setup timeout and
      // late responses cannot resurrect a finalized call.
      const saved = await this.repo.prisma.voiceCall.updateMany({ where: { id: call.id, status: 'CONNECTING' }, data: { providerCallId: providerId } });
      if (!saved.count) { await this.provider.hangup(providerId); throw new Error('Call setup expired.'); }
      const control = await this.attach(call.id, providerId);
      this.controls.set(call.id, control);
      const ready = await this.repo.prisma.voiceCall.updateMany({ where: { id: call.id, status: 'CONNECTING', deadlineAt: { gt: new Date() } }, data: { status: 'READY', controlHeartbeatAt: new Date() } });
      if (!ready.count) throw new Error('Call setup expired.');
      return { ...this.repo.publicCall(await this.repo.owned(userId, call.id)), sdp: result.sdp };
    } catch {
      // Best-effort compensation also covers a DB failure while saving provider ID.
      if (providerId) { try { await this.provider.hangup(providerId); } catch { this.logger.error(`Voice setup compensation pending: ${call.id}`); } }
      await this.stop(call.id, 'SETUP_FAILED');
      throw new ServiceUnavailableException({ code: 'VOICE_SETUP_FAILED', message: 'Could not connect the voice call. No setup time is deducted. Please try again.' });
    }
  }

  private async attach(id: string, providerCallId: string) {
    this.providerIds.set(id, providerCallId);
    return this.provider.attach(providerCallId, (event) => { void this.event(id, event); }, () => {
      void this.stop(id, 'CONTROL_CONNECTION_LOST').catch(() => this.logger.error(`Voice control lost: ${id}`));
    });
  }

  private async event(id: string, event: ProviderEvent) {
    try {
      if (event.type === 'response.done' && event.response?.usage) {
        const transcript = this.config.get('VOICE_RETAIN_ASSISTANT_TRANSCRIPTS', 'false') === 'true'
          ? event.response.output?.flatMap((item) => item.content?.map((part) => part.transcript ?? '') ?? []).join('\n').slice(0, 20000) : undefined;
        await this.repo.recordUsage(id, event.response.id, event.response.usage, transcript);
      }
      if (event.type === 'error') await this.stop(id, 'PROVIDER_ERROR');
    } catch { this.logger.error(`Voice event persistence failed: ${id}`); await this.stop(id, 'ACCOUNTING_UNAVAILABLE').catch(() => undefined); }
  }

  async activate(userId: string, id: string) {
    this.assertEnabled();
    await this.repo.owned(userId, id);
    return this.locked(id, async () => {
      const prior = await this.repo.owned(userId, id);
      if (prior.status === 'ACTIVE') return this.repo.publicCall(prior);
      if (!prior.providerCallId) throw new ConflictException('Call is not ready.');
      let control = this.controls.get(id);
      if (!control) { control = await this.attach(id, prior.providerCallId); this.controls.set(id, control); }
      const active = await this.repo.activate(id);
      this.schedule(active);
      try {
        await control.enable();
        const confirmed = await this.repo.prisma.voiceCall.updateMany({ where: { id, status: 'ACTIVE', deadlineAt: { gt: new Date() } }, data: { connectedAt: new Date(), heartbeatAt: new Date() } });
        if (!confirmed.count) throw new Error('Voice deadline reached during activation.');
      } catch {
        // Caller will end the call; reconciliation handles lost HTTP responses.
        await this.repo.prisma.voiceCall.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'STOPPING', endReason: 'SETUP_FAILED', endRequestedAt: new Date() } });
        throw new ServiceUnavailableException('Voice audio activation failed.');
      }
      return this.repo.publicCall(await this.repo.owned(userId, id));
    });
  }

  async heartbeat(userId: string, id: string) {
    await this.repo.owned(userId, id);
    // A heartbeat never changes connectedAt, deadline or reservation.
    await this.repo.prisma.voiceCall.updateMany({ where: { id, status: { in: ['READY', 'ACTIVE'] } }, data: { heartbeatAt: new Date() } });
    return this.repo.publicCall(await this.repo.owned(userId, id));
  }
  async end(userId: string, id: string, reason = 'USER_ENDED') {
    await this.repo.owned(userId, id);
    // Client may request termination, but cannot submit duration or backdate it.
    await this.stop(id, reason === 'NETWORK_DISCONNECTED' ? reason : 'USER_ENDED');
    return this.repo.publicCall(await this.repo.owned(userId, id));
  }

  private schedule(call: VoiceCall) {
    const previous = this.deadlines.get(call.id);
    if (previous) clearTimeout(previous);
    this.deadlines.set(call.id, setTimeout(() => {
      // Terminate independently of DB/Redis and of an in-flight activation lock.
      // The durable reconciler retries and finalizes the same call afterward.
      const terminate = call.providerCallId ? this.provider.hangup(call.providerCallId) : Promise.resolve();
      void terminate.catch(() => this.logger.error(`Voice deadline provider hang-up pending: ${call.id}`))
        .then(() => this.stop(call.id, 'TIME_LIMIT')).catch(() => this.logger.error(`Voice deadline finalization pending: ${call.id}`));
    }, Math.max(0, call.deadlineAt.getTime() - Date.now())));
  }

  async stop(id: string, reason: string) {
    return this.locked(id, async () => {
      const call = await this.repo.prisma.voiceCall.findUniqueOrThrow({ where: { id } });
      if (TERMINAL.includes(call.status)) return;
      await this.repo.prisma.voiceCall.update({ where: { id }, data: { status: 'STOPPING', endReason: call.endReason ?? reason,
        endRequestedAt: call.endRequestedAt ?? new Date(), terminationAttempts: { increment: 1 } } });
      try {
        if (call.providerCallId) await this.provider.hangup(call.providerCallId);
      } catch {
        await this.repo.prisma.voiceCall.update({ where: { id }, data: { lastTerminationError: 'Provider hang-up not confirmed; retry pending.' } });
        this.logger.error(`Voice termination not confirmed: ${id}`);
        return; // Keep the reservation and active-user slot until confirmed.
      }
      await this.repo.finalize(id, new Date());
      this.controls.get(id)?.close(); this.controls.delete(id);
      const timer = this.deadlines.get(id); if (timer) clearTimeout(timer); this.deadlines.delete(id);
      this.providerIds.delete(id);
    });
  }

  private async locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    const token = randomUUID();
    const key = `voice:control:${id}`;
    let acquired: boolean;
    try { acquired = await this.redis.acquireLock(key, token, 15); }
    catch (error) {
      const providerId = this.providerIds.get(id);
      if (providerId) await this.provider.hangup(providerId).catch(() => this.logger.error(`Emergency voice termination pending: ${id}`));
      throw error;
    }
    if (!acquired) throw new ConflictException('Call update in progress. Please retry.');
    try { return await work(); } finally { await this.redis.releaseLock(key, token); }
  }

  async reconcile() {
    if (this.working) return;
    this.working = true;
    try {
      const now = new Date();
      for (const [id, control] of this.controls) {
        if (control.healthy()) await this.repo.prisma.voiceCall.updateMany({ where: { id, endedAt: null }, data: { controlHeartbeatAt: now } });
      }
      const calls = await this.repo.prisma.voiceCall.findMany({ where: { endedAt: null }, include: {
        subscription: { select: { status: true, expiresAt: true } }, user: { select: { isActive: true } }, master: { select: { isActive: true, voiceEnabled: true } },
      } });
      await Promise.allSettled(calls.map(async (call) => {
        let reason: string | undefined;
        if (call.status === 'STOPPING') reason = call.endReason ?? 'RECOVERY';
        else if (!this.enabled()) reason = 'FEATURE_DISABLED';
        else if (!call.user.isActive || !call.master.isActive || !call.master.voiceEnabled) reason = 'ACCESS_REVOKED';
        else if (call.subscription && (call.subscription.status !== 'ACTIVE' || call.subscription.expiresAt <= now)) reason = 'SUBSCRIPTION_ENDED';
        else if (call.deadlineAt <= now) reason = call.connectedAt ? 'TIME_LIMIT' : 'SETUP_TIMEOUT';
        else if (call.status === 'ACTIVE' && now.getTime() - call.heartbeatAt.getTime() > 10000) reason = 'CLIENT_ABANDONED';
        else if (['READY', 'ACTIVE'].includes(call.status) && now.getTime() - call.controlHeartbeatAt.getTime() > 10000) reason = 'CONTROL_LEASE_EXPIRED';
        if (reason) await this.stop(call.id, reason);
        else if (call.status === 'ACTIVE' && !this.deadlines.has(call.id)) this.schedule(call);
      }));
      for (const [id, control] of this.controls) {
        if (!calls.some((call) => call.id === id)) { control.close(); this.controls.delete(id); }
      }
      if (this.lastReconciliationErrorAt !== undefined) this.logger.log('Voice reconciliation recovered.');
      this.lastReconciliationErrorAt = undefined;
    } catch (error) {
      if (this.lastReconciliationErrorAt === undefined || Date.now() - this.lastReconciliationErrorAt >= 60000) {
        this.lastReconciliationErrorAt = Date.now();
        this.logger.error('Voice reconciliation unavailable; closing locally controlled provider calls.', error instanceof Error ? error.stack : String(error));
      }
      // DB/Redis outage must not leave audio deliberately running. Durable rows are
      // kept for reconciliation once infrastructure recovers.
      await Promise.allSettled([...this.providerIds.values()].map((providerId) => this.provider.hangup(providerId)));
    } finally { this.working = false; }
  }
}
