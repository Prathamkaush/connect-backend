import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(data: Prisma.PaymentUncheckedCreateInput) { return this.prisma.payment.create({ data }); }
  byOrder(providerOrderId: string) { return this.prisma.payment.findUnique({ where: { providerOrderId }, include: { plan: true, invoice: true, subscription: true } }); }
  owned(id: string, userId: string) { return this.prisma.payment.findFirst({ where: { id, userId }, include: { plan: true, invoice: true } }); }
  listOwned(userId: string) { return this.prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { plan: { select: { name: true } }, invoice: true } }); }
  listAll(page: number, limit: number) { return this.prisma.payment.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } }, plan: true, invoice: true } }); }
  failedOlderThan(date: Date) { return this.prisma.payment.updateMany({ where: { status: PaymentStatus.CREATED, createdAt: { lt: date } }, data: { status: PaymentStatus.FAILED } }); }
}
