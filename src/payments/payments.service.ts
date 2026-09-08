import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsRepository } from './payments.repository';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentsRepository, private readonly subscriptions: SubscriptionsRepository, @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}
  async createOrder(userId: string, dto: CreateOrderDto) {
    const plan = await this.subscriptions.planById(dto.planId);
    if (!plan || plan.price.lte(0)) throw new NotFoundException({ code: 'PAID_PLAN_NOT_FOUND', message: 'Paid subscription plan not found.' });
    const receipt = `c2i-${Date.now()}-${userId.slice(-6)}`.slice(0, 40);
    const order = await this.gateway.createOrder(plan.price.mul(100).toNumber(), plan.currency, receipt);
    const payment = await this.payments.create({ userId, planId: plan.id, provider: PaymentProvider.RAZORPAY, providerOrderId: order.id, amount: plan.price, currency: plan.currency });
    return { paymentId: payment.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: this.gateway.publicKey };
  }
  async verify(userId: string, dto: VerifyPaymentDto) {
    const payment = await this.payments.byOrder(dto.razorpayOrderId);
    if (!payment || payment.userId !== userId) throw new ForbiddenException({ code: 'PAYMENT_UNAVAILABLE', message: 'Payment not found or not accessible.' });
    this.gateway.verifyPaymentSignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
    await this.gateway.assertCaptured(dto.razorpayPaymentId, { orderId: payment.providerOrderId, amount: payment.amount.mul(100).toNumber(), currency: payment.currency });
    return this.activate(dto.razorpayOrderId, dto.razorpayPaymentId);
  }
  async processWebhook(eventId: string | undefined, payload: Record<string, any>) {
    if (payload.event !== 'payment.captured' && payload.event !== 'order.paid') return { accepted: true, processed: false };
    const entity = payload.payload?.payment?.entity;
    if (!entity?.order_id || !entity?.id) return { accepted: true, processed: false };
    const payment = await this.payments.byOrder(String(entity.order_id));
    if (!payment) return { accepted: true, processed: false };
    await this.gateway.assertCaptured(String(entity.id), { orderId: payment.providerOrderId, amount: payment.amount.mul(100).toNumber(), currency: payment.currency });
    return this.activate(String(entity.order_id), String(entity.id), eventId);
  }
  list(userId: string) { return this.payments.listOwned(userId); }
  async get(userId: string, id: string) { const payment = await this.payments.owned(id, userId); if (!payment) throw new ForbiddenException({ code: 'PAYMENT_UNAVAILABLE', message: 'Payment not found or not accessible.' }); return payment; }

  private async activate(providerOrderId: string, providerPaymentId: string, providerEventId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { providerOrderId }, include: { plan: true, invoice: true, subscription: true } });
      if (!payment) throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' });
      if (payment.status === PaymentStatus.PAID) return payment;
      if (providerEventId) {
        const duplicate = await tx.payment.findFirst({ where: { providerEventId } });
        if (duplicate) return duplicate;
      }
      const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: { not: PaymentStatus.PAID } }, data: { status: PaymentStatus.AUTHORIZED } });
      if (!claimed.count) return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { plan: true, subscription: true, invoice: true } });
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + payment.plan.validityDays * 86_400_000);
      await tx.userSubscription.updateMany({ where: { userId: payment.userId, status: SubscriptionStatus.ACTIVE }, data: { status: SubscriptionStatus.CANCELLED } });
      const subscription = await tx.userSubscription.create({ data: { userId: payment.userId, planId: payment.planId, status: SubscriptionStatus.ACTIVE, quotaTotal: payment.plan.questionQuota, startsAt, expiresAt } });
      const invoiceNumber = `C2I-${new Date().getUTCFullYear()}-${payment.id.slice(-8).toUpperCase()}`;
      await tx.invoice.create({ data: { userId: payment.userId, paymentId: payment.id, invoiceNumber, subtotal: payment.amount, tax: 0, total: payment.amount } });
      return tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.PAID, providerPaymentId, providerEventId, subscriptionId: subscription.id }, include: { plan: true, subscription: true, invoice: true } });
    });
  }
}
