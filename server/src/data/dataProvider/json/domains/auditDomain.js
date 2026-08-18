import { JsonStore } from '../shared/jsonStore.js';
import { normalizeAll, normalizeAuditEntry } from '../../shared/importRecords.js';

const MAX_ENTRIES = 10_000;

export class AuditDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, []);
  }

  async loadAuditLog() {
    const entries = await this.#store.read();
    return [...entries].sort((a, b) => a.createdAt - b.createdAt);
  }

  async appendAuditEntry({ adminId, operationType, data = {}, createdAt }) {
    return this.#store.update((entries) => {
      const nextId = entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;

      const entry = {
        id: nextId,
        adminId: String(adminId),
        operationType: String(operationType),
        data,
        createdAt,
      };

      const kept = [...entries, entry].slice(-MAX_ENTRIES);
      return { value: kept, result: entry };
    });
  }

  async importAuditLog(entries) {
    const { records, skipped } = normalizeAll(entries, normalizeAuditEntry);

    const ordered = records.sort((a, b) => a.createdAt - b.createdAt);
    const kept = ordered.slice(-MAX_ENTRIES);
    const numbered = kept.map((entry, index) => ({ id: index + 1, ...entry }));

    await this.#store.update(() => ({ value: numbered, result: undefined }));
    return { imported: numbered.length, skipped, truncated: ordered.length - kept.length };
  }

  async purgeAuditEntries(cutoff) {
    return this.#store.update((entries) => {
      const kept = entries.filter((e) => Number(e.createdAt) >= cutoff);
      return { value: kept, result: entries.length - kept.length };
    });
  }
}
