import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';
import { UsersService } from '../users.service';
import { UsersRepository } from '../users.repository';

describe('profile updates', () => {
  it.each(['auto', 'en', 'hi', 'hinglish'])('accepts conversation language %s', async (conversationLanguage) => {
    expect(await validate(plainToInstance(UpdateProfileDto, { conversationLanguage }))).toHaveLength(0);
  });
  it.each(['fr', '', null, 'ignore safety'])('rejects invalid conversation language %s', async (conversationLanguage) => {
    expect((await validate(plainToInstance(UpdateProfileDto, { conversationLanguage }))).length).toBeGreaterThan(0);
  });
  it('normalizes contact details and preserves postal-code zeros', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: ' Test Customer ', phone: '+91 (98765) 43210', city: ' Delhi ', postalCode: '001234' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ name: 'Test Customer', phone: '+919876543210', city: 'Delhi', postalCode: '001234' });
  });
  it('allows existing users to clear optional contact details', async () => {
    const dto = plainToInstance(UpdateProfileDto, { phone: '', city: ' ', postalCode: '' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ phone: null, city: null, postalCode: null });
  });
  it.each([{ phone: '123' }, { city: 'A' }, { postalCode: '<script>' }, { name: ' ' }])('rejects invalid changes %j', async (data) => {
    expect((await validate(plainToInstance(UpdateProfileDto, data))).length).toBeGreaterThan(0);
  });
  it('rejects changes to privileged fields and login email', async () => {
    const errors = await validate(plainToInstance(UpdateProfileDto, { role: 'ADMIN', email: 'other@example.test' }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property).sort()).toEqual(['email', 'role']);
  });
  it('updates only the authenticated profile and returns safe saved details', async () => {
    const dto = plainToInstance(UpdateProfileDto, { phone: '+919876543210', city: 'Delhi', postalCode: '001234' });
    const update = jest.fn().mockResolvedValue({});
    const findById = jest.fn().mockResolvedValue({ id: 'owner', name: 'Customer', email: 'customer@example.test', ...dto, passwordHash: 'private' });
    const service = new UsersService({ update, findById } as unknown as UsersRepository);
    const result = await service.updateProfile('owner', dto);
    expect(update).toHaveBeenCalledWith('owner', dto);
    expect(result).toMatchObject({ id: 'owner', city: 'Delhi', postalCode: '001234' });
    expect(result).not.toHaveProperty('passwordHash');
  });
});
