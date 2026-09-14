import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

describe('invoice access', () => {
  it('restricts ordinary requests to the owner and only relaxes scope for trusted admin calls', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'invoice' });
    const service = new InvoicesService({ invoice: { findFirst } } as unknown as PrismaService, {} as ConfigService);
    await service.get('customer', 'invoice');
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'invoice', userId: 'customer' } }));
    await service.get('admin', 'invoice', true);
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 'invoice' } }));
    findFirst.mockResolvedValue(null);
    await expect(service.get('customer', 'someone-elses-invoice')).rejects.toThrow();
  });
});
