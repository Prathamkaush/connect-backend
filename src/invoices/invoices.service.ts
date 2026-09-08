import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { payment: { select: { provider: true, providerPaymentId: true, currency: true } } } }); }
  async get(userId: string, id: string) { const invoice = await this.prisma.invoice.findFirst({ where: { id, userId }, include: { payment: true } }); if (!invoice) throw new ForbiddenException({ code: 'INVOICE_UNAVAILABLE', message: 'Invoice not found or not accessible.' }); return invoice; }
}
