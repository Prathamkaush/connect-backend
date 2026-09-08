import { Controller, Headers, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

@ApiTags('payments') @Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly razorpay: RazorpayService, private readonly payments: PaymentsService) {}
  @Post('webhook') @ApiExcludeEndpoint()
  async handle(@Req() request: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string, @Headers('x-razorpay-event-id') eventId?: string) {
    if (!signature || !request.rawBody) throw new UnauthorizedException({ code: 'WEBHOOK_SIGNATURE_MISSING', message: 'Webhook signature is required.' });
    this.razorpay.verifyWebhook(request.rawBody, signature);
    return this.payments.processWebhook(eventId, request.body as Record<string, unknown>);
  }
}
