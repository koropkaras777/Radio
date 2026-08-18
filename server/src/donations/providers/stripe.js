import { createHmac, timingSafeEqual } from 'node:crypto';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../../config/env.js';

const API_BASE = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_S = 5 * 60;

// Currencies without minor units (whole-unit amounts, no "cents" multiplier).
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK']);

const toMinorUnits = (amount, currency) =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);

const fromMinorUnits = (amount, currency) =>
  ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? amount : amount / 100;

export const stripeProvider = {
  id: 'stripe',
  displayName: 'Stripe',
  flowType: 'checkout',
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'PLN', 'CAD', 'AUD'],
  maxAmountByCurrency: { USD: 10_000, EUR: 10_000, GBP: 10_000, PLN: 40_000, CAD: 14_000, AUD: 15_000 },

  isConfigured() {
    return Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
  },

  async createPayment({ donationId, amount, currency, description, returnUrl }) {
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: returnUrl,
      cancel_url: returnUrl,
      client_reference_id: donationId,
      'metadata[donationId]': donationId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(toMinorUnits(amount, currency)),
      'line_items[0][price_data][product_data][name]': description,
    });

    const res = await fetch(`${API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const session = await res.json();
    if (!res.ok) throw new Error(session?.error?.message || 'Stripe checkout session creation failed');

    return { redirectUrl: session.url, providerRef: session.id };
  },

  verifyWebhook(rawBody, headers) {
    const signatureHeader = headers['stripe-signature'] || '';
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => p.split('=')).filter((p) => p.length === 2)
    );
    const timestamp = parts.t;
    const expectedSig = parts.v1;
    if (!timestamp || !expectedSig) return { valid: false };

    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_S) return { valid: false };

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const computedSig = createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(payload).digest('hex');

    const a = Buffer.from(computedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { valid: false };
    }

    if (event.type !== 'checkout.session.completed') return { valid: false, ignored: true };

    const session = event.data?.object || {};
    const currency = String(session.currency || '').toUpperCase();
    const paid = session.payment_status === 'paid';

    return {
      valid: true,
      donationId: String(session.client_reference_id || session.metadata?.donationId || ''),
      providerRef: String(session.id || ''),
      status: paid ? 'paid' : 'failed',
      amount: fromMinorUnits(Number(session.amount_total), currency),
      currency,
    };
  },
};
