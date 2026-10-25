import { createHmac, timingSafeEqual } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import type { Env } from './env.ts';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface PaymentGateway {
  configured: boolean;
  keyId: string;
  createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder>;
  /** Checks the signature Checkout hands the browser after a successful payment. */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean;
  /** Checks the X-Razorpay-Signature header against the raw webhook body. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}

export function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function razorpayGateway({ keyId, keySecret, webhookSecret }: Env['razorpay']): PaymentGateway {
  return {
    configured: Boolean(keyId && keySecret),
    keyId,
    async createOrder({ amount, receipt, notes }) {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
        },
        body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      if (!res.ok) {
        console.error('Razorpay order failed', res.status, data.error);
        throw new HTTPException(502, { message: 'Could not start the payment. Please try again.' });
      }
      return { id: data.id, amount: data.amount, currency: data.currency };
    },
    verifyPaymentSignature(orderId, paymentId, signature) {
      return Boolean(keySecret) && safeEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      return Boolean(webhookSecret) && safeEqual(hmacHex(webhookSecret, rawBody), signature);
    },
  };
}
