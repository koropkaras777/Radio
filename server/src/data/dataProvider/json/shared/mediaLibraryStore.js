import { randomUUID } from 'node:crypto';
import { makeError } from '../../../../i18n/index.js';
import { JsonStore } from './jsonStore.js';
import {
  normalizeAll, normalizeMediaLibraryRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class MediaLibraryStore {
  #store;
  #duplicateErrorKey;

  constructor(filePath, { duplicateErrorKey, kind }) {
    this.#store = new JsonStore(filePath, []);
    this.#duplicateErrorKey = duplicateErrorKey;
    this.kind = kind;
  }

  #clone(record) {
    return record ? { ...record } : null;
  }

  async load() {
    const records = await this.#store.read();
    return [...records].sort((a, b) => b.createdAt - a.createdAt).map((r) => this.#clone(r));
  }

  async filenameExists(filename) {
    const needle = String(filename || '').trim().toLowerCase();
    if (!needle) return false;
    const records = await this.#store.read();
    return records.some((r) => r.filename.toLowerCase() === needle);
  }

  async getById(id) {
    const records = await this.#store.read();
    return this.#clone(records.find((r) => r.id === String(id)));
  }

  async create({ filename, mode, duration = null, used = true }) {
    const safeFilename = String(filename || '').trim();
    if (!safeFilename) throw new Error(`${this.kind} filename is required`);

    const record = {
      id:        randomUUID(),
      filename:  safeFilename,
      mode:      mode === 'night' ? 'night' : 'day',
      used:      Boolean(used),
      duration:  Number.isFinite(Number(duration)) ? Number(duration) : null,
      createdAt: Date.now(),
    };

    return this.#store.update((records) => {
      const taken = records.some((r) => r.filename.toLowerCase() === safeFilename.toLowerCase());
      if (taken) throw makeError(this.#duplicateErrorKey);

      return { value: [...records, record], result: this.#clone(record) };
    });
  }

  async setUsed(id, used) {
    return this.#patch(id, { used: Boolean(used) });
  }

  async moveMode(id, targetMode) {
    return this.#patch(id, { mode: targetMode === 'night' ? 'night' : 'day' });
  }

  async #patch(id, changes) {
    return this.#store.update((records) => {
      const target = records.find((r) => r.id === String(id));
      if (!target) return { value: records, result: null };

      const updated = { ...target, ...changes };
      return {
        value: records.map((r) => (r.id === String(id) ? updated : r)),
        result: this.#clone(updated),
      };
    });
  }

  async remove(id) {
    await this.#store.update((records) => ({
      value: records.filter((r) => r.id !== String(id)),
      result: undefined,
    }));
  }

  async removeMany(ids) {
    const wanted = new Set((Array.isArray(ids) ? ids : []).map(String));
    if (!wanted.size) return;

    await this.#store.update((records) => ({
      value: records.filter((r) => !wanted.has(r.id)),
      result: undefined,
    }));
  }

  async replaceAll(records) {
    const { records: normalized, skipped } = normalizeAll(records, normalizeMediaLibraryRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.filename.toLowerCase());

    await this.#store.update(() => ({ value: unique, result: undefined }));
    return { imported: unique.length, skipped, duplicates };
  }

  async query({ mode = 'all', search = '', offset = 0, limit = 10 } = {}) {
    const all = await this.load();
    const needle = String(search || '').trim().toLowerCase();

    let items = all;
    if (mode === 'day' || mode === 'night') items = items.filter((r) => r.mode === mode);
    if (needle) items = items.filter((r) => r.filename.toLowerCase().includes(needle));

    return { items: items.slice(offset, offset + limit), total: items.length };
  }

  async getUsable(mode) {
    const all = await this.load();
    return all.filter((r) => r.mode === mode && r.used);
  }

  async countUsable(mode) {
    return (await this.getUsable(mode)).length;
  }

  async queryUsable({ mode, offset = 0, limit = 5 } = {}) {
    const usable = await this.getUsable(mode === 'night' ? 'night' : 'day');
    return { items: usable.slice(offset, offset + limit), total: usable.length };
  }
}
