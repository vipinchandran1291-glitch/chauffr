import type { PaymentOrder } from '@chauffr/shared';

interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (res: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout. Resolves with the signed result on success, null if
 * the customer closes it. Failed attempts stay inside Checkout so they can retry.
 */
export async function openCheckout(order: PaymentOrder, description: string): Promise<CheckoutSuccess | null> {
  await loadCheckout();
  return new Promise((resolve) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Chauffr',
      description,
      prefill: order.prefill,
      theme: { color: '#1d4ed8' },
      handler: (res: CheckoutSuccess) => resolve(res),
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.open();
  });
}
