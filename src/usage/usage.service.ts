import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReservationStatus, SubscriptionStatus, UsageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsageRepository } from './usage.repository';

type ReservationResult = { id: string; requestId: string; usageType: UsageType; subscriptionId: string | null; status: ReservationStatus };

class QuotaExhaustedException extends HttpException {
  constructor() {
    super({ code: 'QUOTA_EXHAUSTED', message: 'You have no remaining questions.' }, HttpStatus.PAYMENT_REQUIRED);
  }
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService, private readonly usage: UsageRepository, private readonly config: ConfigService) {}

  async reserve(userId: string, conversationId: string, requestId: string): Promise<ReservationResult> {
    await this.releaseExpired(userId);
    const existing = await this.usage.findReservation(requestId);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const again = await tx.questionReservation.findUnique({ where: { requestId } });
        if (again) return again;
        // Charge the same allowance returned by /subscriptions/current.
        // Free questions are only used when there is no active paid plan.
        const subscription = await tx.userSubscription.findFirst({ where: { userId, status: SubscriptionStatus.ACTIVE, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' } });
        if (subscription) {
          const changed = await tx.$executeRaw`UPDATE "UserSubscription" SET "quotaReserved" = "quotaReserved" + 1 WHERE "id" = ${subscription.id} AND "quotaUsed" + "quotaReserved" < "quotaTotal"`;
          if (!changed) throw new QuotaExhaustedException();
          return tx.questionReservation.create({ data: { requestId, userId, conversationId, subscriptionId: subscription.id, usageType: UsageType.SUBSCRIPTION, expiresAt: new Date(Date.now() + 5 * 60_000) } });
        }
        const freeLimit = this.config.get<number>('app.freeQuestionLimit', 5);
        const freeRows = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "User" SET "freeQuotaReserved" = "freeQuotaReserved" + 1 WHERE "id" = ${userId} AND "freeQuotaUsed" + "freeQuotaReserved" < ${freeLimit} RETURNING "id"`;
        if (!freeRows.length) throw new QuotaExhaustedException();
        return tx.questionReservation.create({ data: { requestId, userId, conversationId, usageType: UsageType.FREE, expiresAt: new Date(Date.now() + 5 * 60_000) } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof QuotaExhaustedException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.usage.findReservation(requestId);
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async confirm(reservationId: string, messageId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.questionReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new ConflictException({ code: 'RESERVATION_MISSING', message: 'Question reservation was not found.' });
      if (reservation.status === ReservationStatus.CONFIRMED) return tx.questionUsage.findUnique({ where: { requestId: reservation.requestId } });
      if (reservation.status !== ReservationStatus.RESERVED) throw new ConflictException({ code: 'RESERVATION_RELEASED', message: 'Question reservation is no longer active.' });
      if (reservation.usageType === UsageType.FREE) await tx.user.update({ where: { id: reservation.userId }, data: { freeQuotaReserved: { decrement: 1 }, freeQuotaUsed: { increment: 1 } } });
      else await tx.userSubscription.update({ where: { id: reservation.subscriptionId! }, data: { quotaReserved: { decrement: 1 }, quotaUsed: { increment: 1 } } });
      const ledger = await tx.questionUsage.create({ data: { userId: reservation.userId, subscriptionId: reservation.subscriptionId, conversationId: reservation.conversationId, messageId, requestId: reservation.requestId, quantity: reservation.quantity, usageType: reservation.usageType } });
      await tx.questionReservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.CONFIRMED, messageId } });
      return ledger;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async release(reservationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.questionReservation.findUnique({ where: { id: reservationId } });
      if (!reservation || reservation.status !== ReservationStatus.RESERVED) return { released: false };
      if (reservation.usageType === UsageType.FREE) await tx.user.update({ where: { id: reservation.userId }, data: { freeQuotaReserved: { decrement: 1 } } });
      else await tx.userSubscription.update({ where: { id: reservation.subscriptionId! }, data: { quotaReserved: { decrement: 1 } } });
      await tx.questionReservation.update({ where: { id: reservation.id }, data: { status: ReservationStatus.RELEASED } });
      return { released: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async releaseExpired(userId: string) {
    const expired = await this.prisma.questionReservation.findMany({ where: { userId, status: ReservationStatus.RESERVED, expiresAt: { lt: new Date() } }, select: { id: true } });
    for (const reservation of expired) await this.release(reservation.id);
  }
}
