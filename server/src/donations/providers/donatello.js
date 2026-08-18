import { DONATELLO_API_TOKEN, DONATELLO_PAGE_URL } from '../../config/env.js';
import { extractMatchCode } from '../matching.js';

const API_BASE = 'https://donatello.to/api/v1';

const parseCreatedAt = (raw) => {
  const iso = String(raw || '').trim().replace(' ', 'T') + 'Z';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : Date.now();
};

export const donatelloProvider = {
  id: 'donatello',
  displayName: 'Donatello',
  flowType: 'matching',
  supportedCurrencies: ['UAH'],
  maxAmountByCurrency: { UAH: 30_000 },

  isConfigured() {
    return Boolean(DONATELLO_API_TOKEN && DONATELLO_PAGE_URL);
  },

  async createPayment() {
    return { pageUrl: DONATELLO_PAGE_URL };
  },

  async pollRecentDonations(sinceMs) {
    const res = await fetch(`${API_BASE}/donates?page=0&size=20`, {
      headers: { 'X-Token': DONATELLO_API_TOKEN },
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`Donatello API responded ${res.status}${bodyText ? `: ${bodyText}` : ''}`);
    }

    const body = await res.json();
    const items = Array.isArray(body) ? body : (body.content || body.data || body.items || body.donates || body.results || []);

    if (!Array.isArray(items) || !items.length) return [];

    const parsed = items.map((item) => ({
      providerRef: String(item.pubId || item.id || ''),
      amount: Number(item.amount),
      currency: String(item.currency || 'UAH').toUpperCase(),
      matchCode: extractMatchCode(item.message),
      paidAt: parseCreatedAt(item.createdAt),
    }));

    return parsed.filter((event) => event.providerRef && event.matchCode && event.paidAt > sinceMs);
  },
};
