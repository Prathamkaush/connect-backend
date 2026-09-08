import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay = require('razorpay');
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class RazorpayService implements PaymentGateway {
  private readonly client: Razorpay | null;
  private readonly keyId?: string;
  private readonly keySecret?: string;
  private readonly webhookSecret?: string;
  constructor(config: ConfigService) {
    this.keyId = config.get<string>('payment.razorpayKeyId');
    this.keySecret = config.get<string>('payment.razorpayKeySecret');
    this.webhookSecret = config.get<string>('payment.razorpayWebhookSecret');
    this.client = this.keyId && this.keySecret ? new Razorpay({ key_id: this.keyId, key_secret: this.keySecret }) : null;
  }
  get publicKey() { return this.keyId; }
  async createOrder(amountPaise: number, currency: string, receipt: string) {
    if (!this.client) throw new ServiceUnavailableException({ code: 'PAYMENTS_NOT_CONFIGURED', message: 'Payment service is not configured.' });
    return this.client.orders.create({ amount: amountPaise, currency, receipt });
  }
  async assertCaptured(paymentId: string, expected: { orderId: string; amount: number; currency: string }) {
    if (!this.client) throw new ServiceUnavailableException({ code: 'PAYMENTS_NOT_CONFIGURED', message: 'Payment service is not configured.' });
    let payment = await this.client.payments.fetch(paymentId);
    if (payment.order_id !== expected.orderId || Number(payment.amount) !== expected.amount || payment.currency !== expected.currency) throw new UnauthorizedException({ code: 'PAYMENT_MISMATCH', message: 'Payment does not match this order.' });
    if (payment.status === 'authorized') payment = await this.client.payments.capture(paymentId, expected.amount, expected.currency);
    if (payment.status !== 'captured') throw new UnauthorizedException({ code: 'PAYMENT_NOT_CAPTURED', message: 'Payment has not been captured. Please retry verification shortly.' });
    return payment;
  }
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
    if (!this.keySecret) throw new ServiceUnavailableException({ code: 'PAYMENTS_NOT_CONFIGURED', message: 'Payment service is not configured.' });
    this.assertHmac(`${orderId}|${paymentId}`, signature, this.keySecret);
  }
  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!this.webhookSecret) throw new ServiceUnavailableException({ code: 'PAYMENTS_NOT_CONFIGURED', message: 'Payment webhook is not configured.' });
    this.assertHmac(rawBody, signature, this.webhookSecret);
  }
  private assertHmac(content: string | Buffer, supplied: string, secret: string) {
    const expected = createHmac('sha256', secret).update(content).digest('hex');
    const left = Buffer.from(expected, 'utf8');
    const right = Buffer.from(supplied, 'utf8');
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException({ code: 'INVALID_PAYMENT_SIGNATURE', message: 'Payment signature is invalid.' });
  }
}
