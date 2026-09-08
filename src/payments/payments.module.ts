import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { PAYMENT_GATEWAY } from './payment-gateway.interface';
@Module({ imports: [SubscriptionsModule], controllers: [PaymentsController, PaymentWebhookController], providers: [PaymentsRepository, PaymentsService, RazorpayService, { provide: PAYMENT_GATEWAY, useExisting: RazorpayService }], exports: [PaymentsRepository, PaymentsService] })
export class PaymentsModule {}
