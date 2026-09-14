import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { MastersService } from '../masters/masters.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { SettingsService } from '../settings/settings.service';
describe('admin conversation review and search', () => {
  const prisma = { conversation: { findUniqueOrThrow: jest.fn(), findMany: jest.fn().mockResolvedValue([]) }, message: { findMany: jest.fn(), count: jest.fn() }, user: { findMany: jest.fn().mockResolvedValue([]) }, master: { findMany: jest.fn().mockResolvedValue([]) }, payment: { findMany: jest.fn().mockResolvedValue([]) }, activityLog: { findMany: jest.fn().mockResolvedValue([]) }, $transaction: (queries: Promise<unknown>[]) => Promise.all(queries) };
  const service = new AdminService(prisma as unknown as PrismaService, {} as UsersRepository, {} as MastersService, {} as SubscriptionsRepository, {} as SubscriptionsService, {} as PaymentsRepository, {} as SettingsService);
  it('paginates the transcript and excludes system and tool messages', async () => {
    prisma.conversation.findUniqueOrThrow.mockResolvedValue({ id: 'chat' });
    prisma.message.findMany.mockResolvedValue([{ id: 'message', content: 'hello' }]);
    prisma.message.count.mockResolvedValue(25);
    const result = await service.conversationDetail('chat', 2, 20);
    expect(result.meta).toEqual({ page: 2, limit: 20, total: 25, pages: 2 });
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { conversationId: 'chat', role: { in: ['USER', 'ASSISTANT'] } }, skip: 20, take: 20 }));
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { conversationId: 'chat', role: { in: ['USER', 'ASSISTANT'] } } });
  });
  it('returns encoded search links with limited public account fields', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'user', name: 'Test', email: 'test+one@example.com' }]);
    const result = await service.search(' Test ');
    expect(result[0].href).toBe('/admin/users?search=test%2Bone%40example.com');
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 5, select: { id: true, name: true, email: true } }));
  });
  it('does not search for empty input', async () => {
    const before = prisma.user.findMany.mock.calls.length;
    expect(await service.search(' ')).toEqual([]);
    expect(prisma.user.findMany.mock.calls.length).toBe(before);
  });
});
