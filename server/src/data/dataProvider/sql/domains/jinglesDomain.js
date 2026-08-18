import { randomUUID } from 'node:crypto';
import { makeError } from '../../../../i18n/index.js';
import { cloneEntry, replaceTableRows } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';
import {
  normalizeAll, normalizeMediaLibraryRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class JinglesDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'jingles');
  }

  #rowToJingle(row) {
    return {
      id:        String(row.id),
      filename:  String(row.filename),
      mode:      row.mode === 'night' ? 'night' : 'day',
      used:      Number(row.used) === 1,
      duration:  row.duration == null ? null : Number(row.duration),
      createdAt: Number(row.created_at),
    };
  }

  async loadJingles() {
    if (this.#loaded) return cloneEntry(this.#cache);

    await this.#ensureTable();

    const result = await this.#db.execute(`
      SELECT id, filename, mode, used, duration, created_at
      FROM jingles
      ORDER BY created_at DESC
    `);

    this.#cache = (result.rows || []).map((row) => this.#rowToJingle(row));
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async jingleFilenameExists(filename) {
    await this.loadJingles();
    const needle = String(filename || '').trim().toLowerCase();
    if (!needle) return false;
    return this.#cache.some((j) => j.filename.toLowerCase() === needle);
  }

  async getJingleById(id) {
    await this.loadJingles();
    return this.#cache.find((j) => j.id === String(id)) || null;
  }

  async createJingle({ filename, mode, duration = null, used = true }) {
    await this.#ensureTable();

    const safeFilename = String(filename || '').trim();
    const safeMode      = mode === 'night' ? 'night' : 'day';
    if (!safeFilename) throw new Error('Jingle filename is required');

    if (await this.jingleFilenameExists(safeFilename)) {
      throw makeError('upload.jingleFilenameExists');
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
        INSERT INTO jingles (id, filename, mode, used, duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [record.id, record.filename, record.mode, record.used ? 1 : 0, record.duration, record.createdAt],
    });

    this.#cache = [record, ...this.#cache];
    this.#loaded = true;
    return cloneEntry(record);
  }

  async updateJingleUsed(id, used) {
    await this.#ensureTable();
    const jingleId = String(id);

    await this.#db.execute({
      sql: `UPDATE jingles SET used = ? WHERE id = ?`,
      args: [used ? 1 : 0, jingleId],
    });

    const current = await this.loadJingles();
    const idx = current.findIndex((j) => j.id === jingleId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], used: Boolean(used) };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async moveJingleMode(id, targetMode) {
    await this.#ensureTable();
    const jingleId  = String(id);
    const safeMode  = targetMode === 'night' ? 'night' : 'day';

    await this.#db.execute({
      sql: `UPDATE jingles SET mode = ? WHERE id = ?`,
      args: [safeMode, jingleId],
    });

    const current = await this.loadJingles();
    const idx = current.findIndex((j) => j.id === jingleId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], mode: safeMode };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async deleteJingle(id) {
    await this.#ensureTable();
    const jingleId = String(id);

    await this.#db.execute({ sql: `DELETE FROM jingles WHERE id = ?`, args: [jingleId] });

    this.#cache = this.#cache.filter((j) => j.id !== jingleId);
    this.#loaded = true;
  }

  async queryJingles({ mode = 'all', search = '', offset = 0, limit = 10 } = {}) {
    await this.loadJingles();

    const needle = String(search || '').trim().toLowerCase();
    let items = this.#cache;
    if (mode === 'day' || mode === 'night') {
      items = items.filter((j) => j.mode === mode);
    }
    if (needle) {
      items = items.filter((j) => j.filename.toLowerCase().includes(needle));
    }

    const total = items.length;
    const page  = items.slice(offset, offset + limit);
    return { items: cloneEntry(page), total };
  }

  async deleteJingles(ids) {
    const list = (Array.isArray(ids) ? ids : []).map(String);
    for (const id of list) {
      await this.deleteJingle(id);
    }
  }

  async getUsableJingles(mode) {
    await this.loadJingles();
    return cloneEntry(this.#cache.filter((j) => j.mode === mode && j.used));
  }

  async countUsableJingles(mode) {
    await this.loadJingles();
    return this.#cache.filter((j) => j.mode === mode && j.used).length;
  }

  async importJingles(records) {
    await this.#ensureTable();

    const { records: normalized, skipped } = normalizeAll(records, normalizeMediaLibraryRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.filename.toLowerCase());

    await replaceTableRows(this.#db, {
      table: 'jingles',
      columns: ['id', 'filename', 'mode', 'used', 'duration', 'created_at'],
      rows: unique.map((r) => [r.id, r.filename, r.mode, r.used ? 1 : 0, r.duration, r.createdAt]),
    });

    this.#cache = [];
    this.#loaded = false;

    return { imported: unique.length, skipped, duplicates };
  }
}