export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export interface PaymentGateway {
  readonly publicKey?: string;
  createOrder(amountMinor: number, currency: string, receipt: string): Promise<{ id: string; amount: string | number; currency: string }>;
  assertCaptured(paymentId: string, expected: { orderId: string; amount: number; currency: string }): Promise<unknown>;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): void;
}
