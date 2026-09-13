import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VoiceCall } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { billableSeconds, callDeadline } from './voice.policy';

@Injectable()
export class VoiceRepository {
  constructor(readonly prisma: PrismaService) {}
  async reserve(userId: string, masterId: string, requestId: string, model: string, maxSeconds: number, isAdminTest: boolean) {
    return this.prisma.$transaction(async (tx) => {
      // Same user lock is used by payment activation. It serializes across replicas.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const previous = await tx.voiceCall.findUnique({ where: { userId_requestId: { userId, requestId } } });
      if (previous) throw new ConflictException({ code: 'VOICE_DUPLICATE_REQUEST', message: 'This call request was already processed. Check call history before trying again.' });
      const active = await tx.voiceCall.findUnique({ where: { activeUserId: userId } });
      if (active) throw new ConflictException({ code: 'VOICE_CALL_ACTIVE', message: 'You already have an active or ending call. End it before calling again.' });
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.isActive || (isAdminTest && user.role === 'USER')) throw new ForbiddenException('Voice access is unavailable.');
      const master = await tx.master.findFirst({ where: { id: masterId, isActive: true, voiceEnabled: true } });
      if (!master) throw new NotFoundException({ code: 'VOICE_TEACHER_DISABLED', message: 'Calling is unavailable for this teacher.' });
      const now = new Date();
      const subscription = isAdminTest ? null : await tx.userSubscription.findFirst({ where: {
        userId, status: 'ACTIVE', startsAt: { lte: now }, expiresAt: { gt: now },
      }, orderBy: { expiresAt: 'desc' } });
      if (!isAdminTest && !subscription) throw new ForbiddenException({ code: 'VOICE_SUBSCRIPTION_REQUIRED', message: 'An active subscription with voice time is required.' });
      const periodEndsAt = subscription?.expiresAt ?? new Date(now.getTime() + maxSeconds * 1000 + 30000);
      const remaining = subscription ? subscription.voiceSecondsTotal - subscription.voiceSecondsUsed - subscription.voiceSecondsReserved : maxSeconds;
      const reservedSeconds = Math.min(maxSeconds, remaining, Math.floor((periodEndsAt.getTime() - now.getTime()) / 1000));
      if (reservedSeconds < 1) throw new ForbiddenException({ code: 'VOICE_ALLOWANCE_EXHAUSTED', message: 'No voice time remains in this subscription period.' });
      if (subscription) await tx.userSubscription.update({ where: { id: subscription.id }, data: { voiceSecondsReserved: { increment: reservedSeconds } } });
      return tx.voiceCall.create({ data: {
        userId, masterId, requestId, model, isAdminTest, subscriptionId: subscription?.id,
        activeUserId: userId, reservedSeconds, periodEndsAt, deadlineAt: new Date(Math.min(now.getTime() + 30000, periodEndsAt.getTime())),
      } });
    });
  }

  async owned(userId: string, id: string) {
    const call = await this.prisma.voiceCall.findFirst({ where: { id, userId } });
    if (!call) throw new NotFoundException({ code: 'VOICE_CALL_NOT_FOUND', message: 'Call not found.' });
    return call;
  }

  async activate(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id = ${id} FOR UPDATE`;
      const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
      if (call.status === 'ACTIVE') return call;
      const now = new Date();
      if (call.status !== 'READY' || call.deadlineAt <= now) throw new ConflictException('Call setup expired. Please start a new call.');
      if (call.subscriptionId) {
        const subscription = await tx.userSubscription.findUniqueOrThrow({ where: { id: call.subscriptionId } });
        if (subscription.status !== 'ACTIVE' || subscription.expiresAt <= now) throw new ForbiddenException('Your subscription has ended.');
      }
      // Persist the hard deadline before enabling audio. Billing starts only after
      // the provider acknowledges activation, and never extends this deadline.
      return tx.voiceCall.update({ where: { id }, data: { status: 'ACTIVE', heartbeatAt: now, deadlineAt: callDeadline(now, call.reservedSeconds, call.periodEndsAt) } });
    });
  }

  async finalize(id: string, confirmedEnd: Date) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "VoiceCall" WHERE id = ${id} FOR UPDATE`;
      const call = await tx.voiceCall.findUniqueOrThrow({ where: { id } });
      if (call.endedAt) return call;
      const seconds = call.endReason === 'SETUP_FAILED' ? 0 : billableSeconds(call, confirmedEnd);
      if (call.subscriptionId) await tx.userSubscription.update({ where: { id: call.subscriptionId }, data: {
        voiceSecondsReserved: { decrement: call.reservedSeconds }, voiceSecondsUsed: { increment: seconds },
      } });
      return tx.voiceCall.update({ where: { id }, data: { status: call.connectedAt && call.endReason !== 'SETUP_FAILED' ? 'ENDED' : 'FAILED',
        endedAt: confirmedEnd, billableSeconds: seconds, activeUserId: null, lastTerminationError: null } });
    });
  }

  async history(userId?: string, before?: string, limit = 50, beforeId?: string) {
    return this.prisma.voiceCall.findMany({ where: { ...(userId ? { userId, isAdminTest: false } : {}), ...(before ? { OR: [
      { createdAt: { lt: new Date(before) } },
      ...(beforeId ? [{ createdAt: new Date(before), id: { lt: beforeId } }] : []),
    ] } : {}) },
      take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { master: { select: { name: true, imageUrl: true, slug: true } },
        ...(!userId ? { user: { select: { name: true, email: true } }, responses: { select: { responseId: true, usage: true } } } : {}),
      } });
  }

  recordUsage(callId: string, responseId: string, usage: Record<string, unknown>, transcript?: string) {
    return this.prisma.voiceResponseUsage.upsert({ where: { callId_responseId: { callId, responseId } },
      create: { callId, responseId, usage: usage as Prisma.InputJsonObject, transcript }, update: {} });
  }

  publicCall(call: VoiceCall) {
    return { id: call.id, masterId: call.masterId, status: call.status, isAdminTest: call.isAdminTest, connectedAt: call.connectedAt,
      deadlineAt: call.deadlineAt, endedAt: call.endedAt, billableSeconds: call.billableSeconds, reservedSeconds: call.reservedSeconds,
      endReason: call.endReason, serverNow: new Date() };
  }
}
