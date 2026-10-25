import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { transaction, type DB } from '../db.ts';
import type { PaymentGateway } from '../razorpay.ts';

/**
 * Marks a Razorpay order paid, and its booking with it. Safe to call more than
 * once for the same order: Checkout and the webhook both report each payment.
 */
export function markOrderPaid(db: DB, orderId: string, paymentId: string, amount?: number): boolean {
  return transaction(db, () => {
    const payment = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ?').get(orderId);
    if (!payment) return false;
    if (payment.status === 'paid') return true;
    if (amount !== undefined && amount !== payment.amount) {
      console.error(`Razorpay amount mismatch for ${orderId}: got ${amount}, expected ${payment.amount}`);
      return false;
    }
    const now = new Date().toISOString();
    db.prepare(`UPDATE payments SET status = 'paid', razorpay_payment_id = ?, paid_at = ? WHERE id = ?`).run(
      paymentId,
      now,
      payment.id as number,
    );
    db.prepare(`UPDATE bookings SET payment_status = 'paid', paid_at = ? WHERE id = ? AND payment_status = 'unpaid'`).run(
      now,
      payment.booking_id as number,
    );
    return true;
  });
}

export function paymentRoutes(db: DB, gateway: PaymentGateway) {
  const r = new Hono();

  r.post('/razorpay/webhook', async (c) => {
    const body = await c.req.text();
    if (!gateway.verifyWebhookSignature(body, c.req.header('x-razorpay-signature') ?? '')) {
      throw new HTTPException(400, { message: 'Invalid signature' });
    }
    const event = JSON.parse(body) as { event: string; payload?: { payment?: { entity?: Record<string, any> } } };
    const entity = event.payload?.payment?.entity;
    if (!entity?.order_id) return c.json({ ok: true });

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      markOrderPaid(db, entity.order_id, entity.id, entity.amount);
    } else if (event.event === 'payment.failed') {
      db.prepare(
        `UPDATE payments SET status = 'failed', razorpay_payment_id = ? WHERE razorpay_order_id = ? AND status = 'created'`,
      ).run(entity.id, entity.order_id);
    }
    // Razorpay retries anything that isn't a 2xx, so unknown orders are acknowledged too.
    return c.json({ ok: true });
  });

  return r;
}
