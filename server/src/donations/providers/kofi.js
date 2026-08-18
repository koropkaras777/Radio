import { KOFI_VERIFICATION_TOKEN, KOFI_PAGE_URL } from '../../config/env.js';
import { extractMatchCode } from '../matching.js';

export const kofiProvider = {
  id: 'kofi',
  displayName: 'Ko-fi',
  flowType: 'matching',
  supportedCurrencies: ['USD', 'EUR', 'GBP'],
  maxAmountByCurrency: { USD: 500, EUR: 500, GBP: 500 },

  isConfigured() {
    return Boolean(KOFI_VERIFICATION_TOKEN && KOFI_PAGE_URL);
  },

  async createPayment() {
    return { pageUrl: KOFI_PAGE_URL };
  },

  parseWebhookEvent(rawBody) {
    const params = new URLSearchParams(rawBody.toString('utf8'));
    const raw = params.get('data');
    if (!raw) return { valid: false };

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { valid: false };
    }

    if (payload.verification_token !== KOFI_VERIFICATION_TOKEN) return { valid: false };
    if (payload.type !== 'Donation') return { valid: false, ignored: true };

    const matchCode = extractMatchCode(payload.message);
    if (!matchCode) return { valid: false, ignored: true };

    return {
      valid: true,
      event: {
        providerRef: String(payload.kofi_transaction_id || payload.message_id || ''),
        amount: Number(payload.amount),
        currency: String(payload.currency || 'USD').toUpperCase(),
        matchCode,
        paidAt: Date.now(),
      },
    };
  },
};
