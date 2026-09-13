import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { generateInvoicePdf, InvoiceCustomer, InvoicePlan } from './invoice-pdf';
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  list(userId: string) { return this.prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { payment: { select: { provider: true, providerPaymentId: true, currency: true } } } }); }
  async get(userId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, userId }, include: {
      user: { select: { name: true, email: true, phone: true, city: true, postalCode: true } },
      payment: { include: { plan: true, subscription: true } },
    } });
    if (!invoice) throw new ForbiddenException({ code: 'INVOICE_UNAVAILABLE', message: 'Invoice not found or not accessible.' });
    return invoice;
  }
  async pdf(userId: string, id: string) {
    const invoice = await this.get(userId, id);
    const snapshot = invoice.billingDetails as { customer?: InvoiceCustomer; plan?: InvoicePlan } | null;
    const payment = invoice.payment;
    const buffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber, issuedAt: invoice.createdAt,
      customer: snapshot?.customer ?? invoice.user,
      plan: snapshot?.plan ?? { name: payment.plan.name, description: payment.plan.description,
        questionQuota: payment.subscription?.quotaTotal ?? payment.plan.questionQuota,
        voiceSeconds: payment.voiceSeconds, startsAt: payment.subscription?.startsAt.toISOString(), expiresAt: payment.subscription?.expiresAt.toISOString() },
      subtotal: invoice.subtotal.toFixed(2), tax: invoice.tax.toFixed(2), total: invoice.total.toFixed(2), currency: payment.currency,
      paymentId: payment.id, provider: payment.provider, providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId, status: payment.status,
      seller: { name: this.config.get<string>('INVOICE_BUSINESS_NAME', 'connect2infinity'),
        address: this.config.get<string>('INVOICE_BUSINESS_ADDRESS'), email: this.config.get<string>('INVOICE_SUPPORT_EMAIL'),
        taxId: this.config.get<string>('INVOICE_TAX_ID') },
    });
    return { buffer, filename: `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
  }
}
