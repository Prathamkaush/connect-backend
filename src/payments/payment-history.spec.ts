import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentHistoryDto } from './dto/payment-history.dto';

describe('payment history pagination', () => {
  it('defaults to five and rejects invalid limits and cursors', async () => {
    expect(plainToInstance(PaymentHistoryDto, {}).limit).toBe(5);
    for (const input of [{ limit: 0 }, { limit: 51 }, { limit: 'bad' }, { before: 'bad' }, { beforeId: 'bad' }]) {
      expect((await validate(plainToInstance(PaymentHistoryDto, input))).length).toBeGreaterThan(0);
    }
    expect(await validate(plainToInstance(PaymentHistoryDto, { limit: '5', before: '2026-09-14T00:00:00.000Z', beforeId: 'c123456789012345678901234' }))).toHaveLength(0);
  });
  it('scopes every page to its owner and uses a stable timestamp/id boundary', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repo = new PaymentsRepository({ payment: { findMany } } as unknown as PrismaService);
    await repo.listOwned('owner');
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 'owner' }, take: 5, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
    const before = '2026-09-14T00:00:00.000Z';
    await repo.listOwned('owner', { limit: 5, before, beforeId: 'cursor' });
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 5, where: { userId: 'owner', OR: [{ createdAt: { lt: new Date(before) } }, { createdAt: new Date(before), id: { lt: 'cursor' } }] } }));
  });
});
