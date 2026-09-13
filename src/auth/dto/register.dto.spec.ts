import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('registration contact details', () => {
  const valid = { name: 'Test Customer', email: 'customer@example.test', password: 'StrongPassword123', phone: '+91 (98765) 43210', city: ' New Delhi ', postalCode: ' 001234 ' };
  it('normalizes phone and city while preserving leading postal-code zeros', async () => {
    const dto = plainToInstance(RegisterDto, valid);
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ phone: '+919876543210', city: 'New Delhi', postalCode: '001234' });
  });
  it.each(['phone', 'city', 'postalCode'])('requires %s for new registrations', async (field) => {
    const dto = plainToInstance(RegisterDto, { ...valid, [field]: undefined });
    expect((await validate(dto)).some((error) => error.property === field)).toBe(true);
  });
  it.each([{ phone: '123' }, { phone: 'letters' }, { city: '  ' }, { postalCode: '<script>' }, { postalCode: 'A'.repeat(13) }])('rejects invalid details %j', async (override) => {
    expect((await validate(plainToInstance(RegisterDto, { ...valid, ...override }))).length).toBeGreaterThan(0);
  });
  it('accepts international alphanumeric postal codes', async () => {
    expect(await validate(plainToInstance(RegisterDto, { ...valid, postalCode: 'sw1a 1aa' }))).toHaveLength(0);
  });
});
