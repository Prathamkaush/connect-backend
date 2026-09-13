import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UsersRepository } from '../users/users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { generateInvoicePdf, InvoicePdfData } from './invoice-pdf';

export const sampleInvoice: InvoicePdfData = {
  invoiceNumber: 'C2I-2026-SAMPLE01', issuedAt: new Date('2026-09-13T06:00:00Z'),
  customer: { name: 'Sample Customer', email: 'sample@example.test', phone: '+919876543210', city: 'New Delhi', postalCode: '110001' },
  plan: { name: 'Starter', description: 'Conversations and voice calls with your masters.', questionQuota: 100, voiceSeconds: 300, startsAt: '2026-09-13', expiresAt: '2026-10-12' },
  subtotal: '499.00', tax: '0.00', total: '499.00', currency: 'INR', paymentId: 'cmexamplepayment000000000001', provider: 'RAZORPAY',
  providerOrderId: 'order_sample123456', providerPaymentId: 'pay_sample123456', status: 'PAID', seller: { name: 'connect2infinity' },
};

describe('invoice PDF downloads', () => {
  let app: INestApplication;
  let url: string;
  const id = 'cmexampleinvoice000000000001';
  const jwt = new JwtService({ secret: 'invoice-test-secret-at-least-32-characters' });
  const findFirst = jest.fn().mockImplementation(({ where }: { where: { userId: string } }) => Promise.resolve(where.userId === 'owner' ? {
    invoiceNumber: sampleInvoice.invoiceNumber, createdAt: sampleInvoice.issuedAt,
    subtotal: new Prisma.Decimal(499), tax: new Prisma.Decimal(0), total: new Prisma.Decimal(499),
    billingDetails: { customer: sampleInvoice.customer, plan: sampleInvoice.plan }, user: { name: 'Changed customer' },
    payment: { id: sampleInvoice.paymentId, currency: 'INR', provider: 'RAZORPAY', providerOrderId: sampleInvoice.providerOrderId, providerPaymentId: sampleInvoice.providerPaymentId, status: 'PAID' },
  } : null));
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PassportModule], controllers: [InvoicesController], providers: [InvoicesService, JwtStrategy,
      { provide: ConfigService, useValue: new ConfigService({ JWT_ACCESS_SECRET: 'invoice-test-secret-at-least-32-characters' }) },
      { provide: UsersRepository, useValue: { findById: (userId: string) => Promise.resolve({ id: userId, isActive: true, role: 'USER' }) } },
      { provide: PrismaService, useValue: { invoice: { findFirst } } },
    ] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.listen(0, '127.0.0.1'); url = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  it('requires authentication and rejects another customer’s invoice', async () => {
    expect((await fetch(`${url}/invoices/${id}/pdf`)).status).toBe(401);
    expect((await fetch(`${url}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${jwt.sign({ sub: 'other' })}` } })).status).toBe(403);
  });
  it('downloads owned records as PDF bytes, outside the JSON response envelope', async () => {
    const response = await fetch(`${url}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${jwt.sign({ sub: 'owner' })}` } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain(`${sampleInvoice.invoiceNumber}.pdf`);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id, userId: 'owner' } }));
  });
  it('keeps a typical invoice on one page and embeds the logo font', async () => {
    const pdf = (await generateInvoicePdf(sampleInvoice)).toString('latin1');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(pdf).toContain('NotoSansDevanagari');
  });
});
