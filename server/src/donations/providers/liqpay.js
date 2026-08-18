import { createHash } from 'node:crypto';
import { LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY, PUBLIC_SERVER_URL } from '../../config/env.js';

const CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

const sign = (data) => createHash('sha1').update(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY).digest('base64');

export const liqpayProvider = {
  id: 'liqpay',
  displayName: 'LiqPay',
  flowType: 'checkout',
  supportedCurrencies: ['UAH', 'USD', 'EUR'],
  maxAmountByCurrency: { UAH: 100_000, USD: 5_000, EUR: 5_000 },

  isConfigured() {
    return Boolean(LIQPAY_PUBLIC_KEY && LIQPAY_PRIVATE_KEY);
  },

  async createPayment({ donationId, amount, currency, description, returnUrl }) {
    const payload = {
      version: 3,
      public_key: LIQPAY_PUBLIC_KEY,
      action: 'pay',
      amount,
      currency,
      description,
      order_id: donationId,
      result_url: returnUrl,
      server_url: `${PUBLIC_SERVER_URL}/webhooks/donations/liqpay`,
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = sign(data);

    return {
      redirectUrl: `${CHECKOUT_URL}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`,
      providerRef: null,
    };
  },

  verifyWebhook(rawBody) {
    const params = new URLSearchParams(rawBody.toString('utf8'));
    const data = params.get('data');
    const signature = params.get('signature');
    if (!data || !signature) return { valid: false };

    if (sign(data) !== signature) return { valid: false };

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    } catch {
      return { valid: false };
    }

    const paid = decoded.status === 'success' || decoded.status === 'sandbox';
    return {
      valid: true,
      donationId: String(decoded.order_id || ''),
      providerRef: String(decoded.payment_id || decoded.transaction_id || ''),
      status: paid ? 'paid' : 'failed',
      amount: Number(decoded.amount),
      currency: String(decoded.currency || ''),
    };
  },
};
