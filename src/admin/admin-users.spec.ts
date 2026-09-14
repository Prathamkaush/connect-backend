import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { MastersService } from '../masters/masters.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { SettingsService } from '../settings/settings.service';
import { RegisterDto } from '../auth/dto/register.dto';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));
describe('admin user management', () => {
  const findUniqueOrThrow = jest.fn();
  const create = jest.fn();
  const setAccess = jest.fn();
  const findByEmail = jest.fn();
  const log = jest.fn();
  const service = new AdminService({ user: { findUniqueOrThrow, create }, activityLog: { create: log } } as unknown as PrismaService, { setAccess, findByEmail } as unknown as UsersRepository, {} as MastersService, {} as SubscriptionsRepository, {} as SubscriptionsService, {} as PaymentsRepository, { all: async () => ({}) } as unknown as SettingsService);
  beforeEach(() => { jest.clearAllMocks(); log.mockResolvedValue({}); });
  it.each(['ADMIN', 'SUPER_ADMIN'])('protects %s accounts from accidental blocking', async (role) => {
    findUniqueOrThrow.mockResolvedValue({ role });
    await expect(service.updateUser('operator', 'target', { isActive: false })).rejects.toThrow('Administrative accounts');
    expect(setAccess).not.toHaveBeenCalled();
  });
  it('rejects self-modification and role escalation', async () => {
    findUniqueOrThrow.mockResolvedValue({ role: 'USER' });
    await expect(service.updateUser('same', 'same', { isActive: false })).rejects.toThrow();
    await expect(service.updateUser('operator', 'target', { role: 'SUPER_ADMIN' })).rejects.toThrow();
    expect(setAccess).not.toHaveBeenCalled();
  });
  it('updates ordinary access without returning credential fields', async () => {
    findUniqueOrThrow.mockResolvedValue({ role: 'USER' });
    setAccess.mockResolvedValue({ id: 'target', passwordHash: 'private' });
    expect(await service.updateUser('operator', 'target', { isActive: false })).toEqual({ id: 'target', isActive: false });
    expect(setAccess).toHaveBeenCalledWith('target', false);
    expect(log).toHaveBeenCalled();
  });
  it('creates a regular user with a hashed password and a safe response', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'new', name: 'Customer', email: 'customer@example.test' });
    const result = await service.createUser('operator', { name: ' Customer ', email: 'CUSTOMER@example.test', phone: '+919876543210', city: 'Delhi', postalCode: '110001', password: 'Private12345' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'USER', email: 'customer@example.test', passwordHash: 'hashed-password' }), select: { id: true, name: true, email: true } }));
    expect(result).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(log.mock.calls)).not.toContain('Private12345');
  });
  it('rejects extra privileged create-user fields', async () => {
    const errors = await validate(plainToInstance(RegisterDto, { name: 'Customer', email: 'customer@example.test', phone: '+919876543210', city: 'Delhi', postalCode: '110001', password: 'Private12345', role: 'SUPER_ADMIN', isActive: true }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual(['isActive', 'role']);
  });
});
