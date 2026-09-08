import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import Razorpay = require('razorpay');
import { RazorpayService } from './razorpay.service';

jest.mock('razorpay', () => jest.fn());

describe('Razorpay payment verification', () => {
  const expected = { orderId: 'order_123', amount: 49900, currency: 'INR' };
  let service: RazorpayService;
  let fetch: jest.Mock;
  let capture: jest.Mock;
  beforeEach(() => {
    fetch = jest.fn(); capture = jest.fn();
    (Razorpay as unknown as jest.Mock).mockImplementation(() => ({ payments: { fetch, capture } }));
    service = new RazorpayService(new ConfigService({ payment: { razorpayKeyId: 'rzp_test_example', razorpayKeySecret: 'test-secret' } }));
  });
  it('captures an authorized payment before accepting it', async () => {
    const payment = { order_id: expected.orderId, amount: expected.amount, currency: expected.currency };
    fetch.mockResolvedValue({ ...payment, status: 'authorized' });
    capture.mockResolvedValue({ ...payment, status: 'captured' });
    await service.assertCaptured('pay_123', expected);
    expect(capture).toHaveBeenCalledWith('pay_123', 49900, 'INR');
  });
  it.each([{ order_id: 'order_other' }, { amount: 1 }, { currency: 'USD' }])('rejects mismatched payment %p', async (mismatch) => {
    fetch.mockResolvedValue({ order_id: expected.orderId, amount: expected.amount, currency: expected.currency, status: 'captured', ...mismatch });
    await expect(service.assertCaptured('pay_123', expected)).rejects.toThrow('Payment does not match this order.');
    expect(capture).not.toHaveBeenCalled();
  });
  it('rejects failed payments', async () => {
    fetch.mockResolvedValue({ order_id: expected.orderId, amount: expected.amount, currency: expected.currency, status: 'failed' });
    await expect(service.assertCaptured('pay_123', expected)).rejects.toThrow('Payment has not been captured');
  });
  it('verifies the signature and rejects tampering', () => {
    const signature = createHmac('sha256', 'test-secret').update('order_123|pay_123').digest('hex');
    expect(() => service.verifyPaymentSignature('order_123', 'pay_123', signature)).not.toThrow();
    expect(() => service.verifyPaymentSignature('order_other', 'pay_123', signature)).toThrow();
  });
});
