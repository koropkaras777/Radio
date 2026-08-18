import { JsonStore } from '../shared/jsonStore.js';
import {
  normalizeAll, normalizeBannedIpRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class BannedIpsDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, []);
  }

  #clone(entry) {
    return entry ? { ...entry } : null;
  }

  async loadBannedIps() {
    const entries = await this.#store.read();
    return [...entries].sort((a, b) => b.bannedAt - a.bannedAt).map((e) => this.#clone(e));
  }

  async isIpBanned(ip) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) return false;

    const entries = await this.#store.read();
    return entries.some((e) => e.ip === normalizedIp);
  }

  async banIp({ ip, nickname = '', bannedBy }) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) throw new Error('IP is required');

    const entry = {
      ip:       normalizedIp,
      nickname: String(nickname || '').trim(),
      bannedAt: Date.now(),
      bannedBy: String(bannedBy || '').trim(),
    };

    return this.#store.update((entries) => {
      const others = entries.filter((e) => e.ip !== normalizedIp);
      return { value: [...others, entry], result: this.#clone(entry) };
    });
  }

  async unbanIp(ip) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) throw new Error('IP is required');

    return this.#store.update((entries) => ({
      value: entries.filter((e) => e.ip !== normalizedIp),
      result: true,
    }));
  }

  async importBannedIps(records) {
    const { records: normalized, skipped } = normalizeAll(records, normalizeBannedIpRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.ip);

    await this.#store.update(() => ({ value: unique, result: undefined }));
    return { imported: unique.length, skipped, duplicates };
  }
}
