import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { MastersService } from '../masters/masters.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { SettingsService } from '../settings/settings.service';
describe('revenue reports', () => {
  const findMany = jest.fn();
  const service = new AdminService({ payment: { findMany } } as unknown as PrismaService, {} as UsersRepository, {} as MastersService, {} as SubscriptionsRepository, {} as SubscriptionsService, {} as PaymentsRepository, {} as SettingsService);
  it('uses real monthly payments and plan names without mixing currencies', async () => {
    findMany.mockResolvedValue([{ createdAt: new Date('2026-09-10T00:00:00Z'), amount: 499, currency: 'INR', planId: 'starter', plan: { name: 'Starter' } }, { createdAt: new Date('2026-09-11T00:00:00Z'), amount: 10, currency: 'USD', planId: 'starter', plan: { name: 'Starter' } }]);
    const result = await service.revenueDetail('2026-08-01T00:00:00Z', '2026-09-30T23:59:59Z');
    const inr = result.currencies.find((item) => item.currency === 'INR')!;
    expect(inr.total).toBe(499); expect(inr.count).toBe(1);
    expect(inr.months.map((month) => month.amount)).toEqual([0, 499]);
    expect(inr.plans[0].name).toBe('Starter');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PAID', createdAt: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-09-30T23:59:59Z') } } }));
  });
  it('rejects reversed and oversized date ranges', async () => {
    await expect(service.revenueDetail('2026-09-01', '2026-08-01')).rejects.toThrow();
    await expect(service.revenueDetail('2020-01-01', '2026-01-01')).rejects.toThrow();
  });
});
