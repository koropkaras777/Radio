import { randomUUID } from 'node:crypto';
import { makeError } from '../../../../i18n/index.js';
import { cloneEntry, replaceTableRows } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';
import {
  normalizeAll, normalizeMediaLibraryRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class PhrasesDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'phrases');
  }

  #rowToPhrase(row) {
    return {
      id:        String(row.id),
      filename:  String(row.filename),
      mode:      row.mode === 'night' ? 'night' : 'day',
      used:      Number(row.used) === 1,
      duration:  row.duration == null ? null : Number(row.duration),
      createdAt: Number(row.created_at),
    };
  }

  async loadPhrases() {
    if (this.#loaded) return cloneEntry(this.#cache);

    await this.#ensureTable();

    const result = await this.#db.execute(`
      SELECT id, filename, mode, used, duration, created_at
      FROM phrases
      ORDER BY created_at DESC
    `);

    this.#cache = (result.rows || []).map((row) => this.#rowToPhrase(row));
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async phraseFilenameExists(filename) {
    await this.loadPhrases();
    const needle = String(filename || '').trim().toLowerCase();
    if (!needle) return false;
    return this.#cache.some((p) => p.filename.toLowerCase() === needle);
  }

  async getPhraseById(id) {
    await this.loadPhrases();
    return this.#cache.find((p) => p.id === String(id)) || null;
  }

  async createPhrase({ filename, mode, duration = null, used = true }) {
    await this.#ensureTable();

    const safeFilename = String(filename || '').trim();
    const safeMode      = mode === 'night' ? 'night' : 'day';
    if (!safeFilename) throw new Error('Phrase filename is required');

    if (await this.phraseFilenameExists(safeFilename)) {
      throw makeError('upload.phraseFilenameExists');
    }

    const record = {
      id:        randomUUID(),
      filename:  safeFilename,
      mode:      safeMode,
      used:      Boolean(used),
      duration:  Number.isFinite(Number(duration)) ? Number(duration) : null,
      createdAt: Date.now(),
    };

    await this.#db.execute({
      sql: `
        INSERT INTO phrases (id, filename, mode, used, duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [record.id, record.filename, record.mode, record.used ? 1 : 0, record.duration, record.createdAt],
    });

    this.#cache = [record, ...this.#cache];
    this.#loaded = true;
    return cloneEntry(record);
  }

  async updatePhraseUsed(id, used) {
    await this.#ensureTable();
    const phraseId = String(id);

    await this.#db.execute({
      sql: `UPDATE phrases SET used = ? WHERE id = ?`,
      args: [used ? 1 : 0, phraseId],
    });

    const current = await this.loadPhrases();
    const idx = current.findIndex((p) => p.id === phraseId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], used: Boolean(used) };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async movePhraseMode(id, targetMode) {
    await this.#ensureTable();
    const phraseId  = String(id);
    const safeMode  = targetMode === 'night' ? 'night' : 'day';

    await this.#db.execute({
      sql: `UPDATE phrases SET mode = ? WHERE id = ?`,
      args: [safeMode, phraseId],
    });

    const current = await this.loadPhrases();
    const idx = current.findIndex((p) => p.id === phraseId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], mode: safeMode };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async deletePhrase(id) {
    await this.#ensureTable();
    const phraseId = String(id);

    await this.#db.execute({ sql: `DELETE FROM phrases WHERE id = ?`, args: [phraseId] });

    this.#cache = this.#cache.filter((p) => p.id !== phraseId);
    this.#loaded = true;
  }

  async queryPhrases({ mode = 'all', search = '', offset = 0, limit = 10 } = {}) {
    await this.loadPhrases();

    const needle = String(search || '').trim().toLowerCase();
    let items = this.#cache;
    if (mode === 'day' || mode === 'night') {
      items = items.filter((p) => p.mode === mode);
    }
    if (needle) {
      items = items.filter((p) => p.filename.toLowerCase().includes(needle));
    }

    const total = items.length;
    const page  = items.slice(offset, offset + limit);
    return { items: cloneEntry(page), total };
  }

  async deletePhrases(ids) {
    const list = (Array.isArray(ids) ? ids : []).map(String);
    for (const id of list) {
      await this.deletePhrase(id);
    }
  }

  async getUsablePhrases(mode) {
    await this.loadPhrases();
    return cloneEntry(this.#cache.filter((p) => p.mode === mode && p.used));
  }

  async countUsablePhrases(mode) {
    await this.loadPhrases();
    return this.#cache.filter((p) => p.mode === mode && p.used).length;
  }

  async importPhrases(records) {
    await this.#ensureTable();

    const { records: normalized, skipped } = normalizeAll(records, normalizeMediaLibraryRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.filename.toLowerCase());

    await replaceTableRows(this.#db, {
      table: 'phrases',
      columns: ['id', 'filename', 'mode', 'used', 'duration', 'created_at'],
      rows: unique.map((r) => [r.id, r.filename, r.mode, r.used ? 1 : 0, r.duration, r.createdAt]),
    });

    this.#cache = [];
    this.#loaded = false;

    return { imported: unique.length, skipped, duplicates };
  }
}
