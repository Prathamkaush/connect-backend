import { ConfigService } from '@nestjs/config';
import { ReservationStatus, UsageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsageRepository } from './usage.repository';
import { UsageService } from './usage.service';

describe('Question allowance selection', () => {
  function setup(paid = true) {
    const subscription = { id: 'plan-1', plan: { name: '100 questions' }, quotaTotal: 100, quotaUsed: 0, quotaReserved: 0 };
    const reservations = new Map<string, any>();
    const tx = {
      questionReservation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(async ({ where }) => reservations.get(where.id ?? where.requestId) ?? null),
        create: jest.fn(async ({ data }) => {
          const row = { ...data, id: data.requestId, status: ReservationStatus.RESERVED, quantity: 1 };
          reservations.set(row.id, row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => Object.assign(reservations.get(where.id), data)),
      },
      userSubscription: {
        findFirst: jest.fn().mockResolvedValue(paid ? subscription : null),
        update: jest.fn(async () => { subscription.quotaReserved--; subscription.quotaUsed++; }),
      },
      user: { update: jest.fn() },
      questionUsage: { create: jest.fn(async ({ data }) => data), findUnique: jest.fn() },
      $executeRaw: jest.fn(async () => {
        if (subscription.quotaUsed + subscription.quotaReserved >= subscription.quotaTotal) return 0;
        subscription.quotaReserved++;
        return 1;
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'user' }]),
    };
    const prisma = { ...tx, $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } as unknown as PrismaService;
    const config = new ConfigService();
    return {
      tx, subscription,
      usage: new UsageService(prisma, new UsageRepository(prisma), config),
      subscriptions: new SubscriptionsService(new SubscriptionsRepository(prisma), prisma, config),
    };
  }

  it('shows 97 after three completed paid questions even when free questions remain', async () => {
    const { usage, subscriptions, tx } = setup();
    for (let index = 0; index < 3; index++) {
      const reservation = await usage.reserve('user', 'conversation', `request-${index}`);
      expect(reservation.usageType).toBe(UsageType.SUBSCRIPTION);
      await usage.confirm(reservation.id, `message-${index}`);
    }
    expect(await subscriptions.current('user')).toMatchObject({ totalQuestions: 100, usedQuestions: 3, remainingQuestions: 97 });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    // Replaying a completed request cannot deduct a second question.
    const replay = await usage.reserve('user', 'conversation', 'request-0');
    await usage.confirm(replay.id, 'message-0');
    expect((await subscriptions.current('user')).remainingQuestions).toBe(97);
  });

  it('uses the free allowance without an active subscription', async () => {
    const { usage, tx } = setup(false);
    expect(await usage.reserve('user', 'conversation', 'request')).toMatchObject({ usageType: UsageType.FREE });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects an exhausted paid allowance instead of charging a hidden free balance', async () => {
    const { usage, tx, subscription } = setup();
    subscription.quotaUsed = 100;
    await expect(usage.reserve('user', 'conversation', 'request')).rejects.toThrow('You have no remaining questions.');
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.questionReservation.create).not.toHaveBeenCalled();
  });
});
