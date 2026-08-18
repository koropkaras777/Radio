import { randomUUID } from 'node:crypto';
import { JsonStore } from '../shared/jsonStore.js';

const MAX_ENTRIES = 20_000;

export class DonationsDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, []);
  }

  async createDonation({ uid, songId, songTitle, songArtist, provider, currency, amount, tier, createdAt, matchCode = null, expiresAt = null }) {
    return this.#store.update((entries) => {
      const entry = {
        id: randomUUID(),
        uid: String(uid || ''),
        songId: String(songId),
        songTitle: String(songTitle || ''),
        songArtist: String(songArtist || ''),
        provider: String(provider),
        currency: String(currency),
        amount: Number(amount),
        tier: tier == null ? null : Number(tier),
        status: 'pending',
        providerRef: null,
        matchCode,
        expiresAt,
        createdAt,
        paidAt: null,
      };

      const kept = [...entries, entry].slice(-MAX_ENTRIES);
      return { value: kept, result: entry };
    });
  }

  async findById(id) {
    const entries = await this.#store.read();
    return entries.find((e) => e.id === id) || null;
  }

  async findByProviderRef(providerRef) {
    const entries = await this.#store.read();
    return entries.find((e) => e.providerRef === providerRef) || null;
  }

  async findByMatchCode(matchCode) {
    const entries = await this.#store.read();
    return entries.find((e) => e.matchCode === matchCode && e.status === 'pending') || null;
  }

  async expirePendingMatches(cutoff) {
    return this.#store.update((entries) => {
      let count = 0;
      const value = entries.map((e) => {
        if (e.status === 'pending' && e.expiresAt && e.expiresAt <= cutoff) {
          count++;
          return { ...e, status: 'expired' };
        }
        return e;
      });
      return { value, result: count };
    });
  }

  async markStatus(id, status, { providerRef = null, paidAt = null, expectedStatus = null } = {}) {
    return this.#store.update((entries) => {
      const index = entries.findIndex((e) => e.id === id);
      if (index === -1) return { value: entries, result: null };
      if (expectedStatus !== null && entries[index].status !== expectedStatus) return { value: entries, result: null };

      const updated = { ...entries[index], status };
      if (providerRef !== null) updated.providerRef = providerRef;
      if (paidAt !== null) updated.paidAt = paidAt;

      const value = [...entries];
      value[index] = updated;
      return { value, result: updated };
    });
  }

  async loadDonationHistory({ since = 0, limit = 30, offset = 0 } = {}) {
    const entries = await this.#store.read();
    const filtered = entries
      .filter((e) => e.createdAt >= since)
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      entries: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  async listCurrencies() {
    const entries = await this.#store.read();
    return [...new Set(entries.map((e) => e.currency).filter(Boolean))].sort();
  }

  async purgeDonations(cutoff) {
    return this.#store.update((entries) => {
      const kept = entries.filter((e) => Number(e.createdAt) >= cutoff);
      return { value: kept, result: entries.length - kept.length };
    });
  }
}
