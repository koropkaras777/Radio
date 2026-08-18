import { randomUUID } from 'node:crypto';
import { makeError } from '../../../../i18n/index.js';
import { cloneEntry, replaceTableRows } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';
import {
  normalizeAll, normalizeMediaLibraryRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class BackgroundMusicDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'background_music');
  }

  #rowToBackgroundMusic(row) {
    return {
      id:        String(row.id),
      filename:  String(row.filename),
      mode:      row.mode === 'night' ? 'night' : 'day',
      used:      Number(row.used) === 1,
      duration:  row.duration == null ? null : Number(row.duration),
      createdAt: Number(row.created_at),
    };
  }

  async loadBackgroundMusic() {
    if (this.#loaded) return cloneEntry(this.#cache);

    await this.#ensureTable();

    const result = await this.#db.execute(`
      SELECT id, filename, mode, used, duration, created_at
      FROM background_music
      ORDER BY created_at DESC
    `);

    this.#cache  = (result.rows || []).map((row) => this.#rowToBackgroundMusic(row));
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async backgroundMusicFilenameExists(filename) {
    await this.loadBackgroundMusic();
    const needle = String(filename || '').trim().toLowerCase();
    if (!needle) return false;
    return this.#cache.some((t) => t.filename.toLowerCase() === needle);
  }

  async getBackgroundMusicById(id) {
    await this.loadBackgroundMusic();
    return this.#cache.find((t) => t.id === String(id)) || null;
  }

  async createBackgroundMusic({ filename, mode, duration = null, used = true }) {
    await this.#ensureTable();

    const safeFilename = String(filename || '').trim();
    const safeMode      = mode === 'night' ? 'night' : 'day';
    if (!safeFilename) throw new Error('Background music filename is required');

    if (await this.backgroundMusicFilenameExists(safeFilename)) {
      throw makeError('upload.bgFilenameExists');
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
        INSERT INTO background_music (id, filename, mode, used, duration, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [record.id, record.filename, record.mode, record.used ? 1 : 0, record.duration, record.createdAt],
    });

    this.#cache = [record, ...this.#cache];
    this.#loaded = true;
    return cloneEntry(record);
  }

  async updateBackgroundMusicUsed(id, used) {
    await this.#ensureTable();
    const trackId = String(id);

    await this.#db.execute({
      sql: `UPDATE background_music SET used = ? WHERE id = ?`,
      args: [used ? 1 : 0, trackId],
    });

    const current = await this.loadBackgroundMusic();
    const idx = current.findIndex((t) => t.id === trackId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], used: Boolean(used) };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async moveBackgroundMusicMode(id, targetMode) {
    await this.#ensureTable();
    const trackId   = String(id);
    const safeMode  = targetMode === 'night' ? 'night' : 'day';

    await this.#db.execute({
      sql: `UPDATE background_music SET mode = ? WHERE id = ?`,
      args: [safeMode, trackId],
    });

    const current = await this.loadBackgroundMusic();
    const idx = current.findIndex((t) => t.id === trackId);
    if (idx === -1) return null;
    current[idx] = { ...current[idx], mode: safeMode };
    this.#cache = current;
    return cloneEntry(this.#cache[idx]);
  }

  async deleteBackgroundMusic(id) {
    await this.#ensureTable();
    const trackId = String(id);

    await this.#db.execute({ sql: `DELETE FROM background_music WHERE id = ?`, args: [trackId] });

    this.#cache = this.#cache.filter((t) => t.id !== trackId);
    this.#loaded = true;
  }

  async queryBackgroundMusic({ mode = 'all', search = '', offset = 0, limit = 10 } = {}) {
    await this.loadBackgroundMusic();

    const needle = String(search || '').trim().toLowerCase();
    let items = this.#cache;
    if (mode === 'day' || mode === 'night') {
      items = items.filter((t) => t.mode === mode);
    }
    if (needle) {
      items = items.filter((t) => t.filename.toLowerCase().includes(needle));
    }

    const total = items.length;
    const page  = items.slice(offset, offset + limit);
    return { items: cloneEntry(page), total };
  }

  async deleteBackgroundMusicBatch(ids) {
    const list = (Array.isArray(ids) ? ids : []).map(String);
    for (const id of list) {
      await this.deleteBackgroundMusic(id);
    }
  }

  async getUsableBackgroundMusic(mode) {
    await this.loadBackgroundMusic();
    return cloneEntry(this.#cache.filter((t) => t.mode === mode && t.used));
  }

  async countUsableBackgroundMusic(mode) {
    await this.loadBackgroundMusic();
    return this.#cache.filter((t) => t.mode === mode && t.used).length;
  }

  async queryUsableBackgroundMusic({ mode, offset = 0, limit = 5 } = {}) {
    const usable = await this.getUsableBackgroundMusic(mode);
    const total  = usable.length;
    const page   = usable.slice(offset, offset + limit);
    return { items: page, total };
  }

  async importBackgroundMusic(records) {
    await this.#ensureTable();

    const { records: normalized, skipped } = normalizeAll(records, normalizeMediaLibraryRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.filename.toLowerCase());

    await replaceTableRows(this.#db, {
      table: 'background_music',
      columns: ['id', 'filename', 'mode', 'used', 'duration', 'created_at'],
      rows: unique.map((r) => [r.id, r.filename, r.mode, r.used ? 1 : 0, r.duration, r.createdAt]),
    });

    this.#cache = [];
    this.#loaded = false;

    return { imported: unique.length, skipped, duplicates };
  }
}