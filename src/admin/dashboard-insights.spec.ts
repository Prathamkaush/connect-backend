import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { MastersService } from '../masters/masters.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { SettingsService } from '../settings/settings.service';

describe('dashboard insights', () => {
  it('fills empty months, keeps currencies separate and returns recorded recent data', async () => {
    const createdAt = new Date();
    const payments = jest.fn().mockResolvedValue([{ createdAt, currency: 'INR', amount: 499 }, { createdAt, currency: 'INR', amount: 499 }, { createdAt, currency: 'USD', amount: 20 }]);
    const recent = [{ id: 'real-payment' }];
    const activity = [{ id: 'real-activity' }];
    const service = new AdminService({ payment: { findMany: payments }, activityLog: { findMany: jest.fn().mockResolvedValue(activity) } } as unknown as PrismaService, {} as UsersRepository, {} as MastersService, {} as SubscriptionsRepository, {} as SubscriptionsService, { listAll: jest.fn().mockResolvedValue(recent) } as unknown as PaymentsRepository, {} as SettingsService);
    const result = await service.dashboardInsights();
    expect(payments).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'PAID' }) }));
    const inr = result.revenue.find((row) => row.currency === 'INR')!;
    expect(inr.months).toHaveLength(12);
    expect(inr.months.at(-1)?.amount).toBe(998);
    expect(inr.months[0].amount).toBe(0);
    expect(result.revenue.find((row) => row.currency === 'USD')?.months.at(-1)?.amount).toBe(20);
    expect(result.recentPayments).toEqual(recent);
    expect(result.recentActivity).toEqual(activity);
  });
});
