import { cloneEntry, replaceTableRows } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';
import {
  normalizeAll, normalizeBannedIpRecord, dedupeBy,
} from '../../shared/importRecords.js';

export class BannedIpsDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'banned_ips');
  }

  #rowToBannedIp(row) {
    return {
      ip:        String(row.ip),
      nickname:  String(row.nickname || ''),
      bannedAt:  Number(row.banned_at),
      bannedBy:  String(row.banned_by || ''),
    };
  }

  async loadBannedIps() {
    if (this.#loaded) return cloneEntry(this.#cache);

    await this.#ensureTable();

    const result = await this.#db.execute(`
      SELECT ip, nickname, banned_at, banned_by
      FROM banned_ips
      ORDER BY banned_at DESC
    `);

    this.#cache  = (result.rows || []).map((row) => this.#rowToBannedIp(row));
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async isIpBanned(ip) {
    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) return false;
    await this.loadBannedIps();
    return this.#cache.some((entry) => entry.ip === normalizedIp);
  }

  async banIp({ ip, nickname = '', bannedBy }) {
    await this.#ensureTable();

    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) throw new Error('IP is required');

    const entry = {
      ip:       normalizedIp,
      nickname: String(nickname || '').trim(),
      bannedAt: Date.now(),
      bannedBy: String(bannedBy || '').trim(),
    };

    await this.#db.execute({
      sql: `
        INSERT INTO banned_ips (ip, nickname, banned_at, banned_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ip) DO UPDATE SET
          nickname  = excluded.nickname,
          banned_at = excluded.banned_at,
          banned_by = excluded.banned_by
      `,
      args: [entry.ip, entry.nickname, entry.bannedAt, entry.bannedBy],
    });

    const current = await this.loadBannedIps();
    const idx = current.findIndex((e) => e.ip === normalizedIp);
    if (idx === -1) current.unshift(entry);
    else current[idx] = entry;
    this.#cache  = current.sort((a, b) => b.bannedAt - a.bannedAt);
    this.#loaded = true;
    return cloneEntry(entry);
  }

  async unbanIp(ip) {
    await this.#ensureTable();

    const normalizedIp = String(ip || '').trim();
    if (!normalizedIp) throw new Error('IP is required');

    await this.#db.execute({ sql: `DELETE FROM banned_ips WHERE ip = ?`, args: [normalizedIp] });

    this.#cache = (this.#cache || []).filter((e) => e.ip !== normalizedIp);
    this.#loaded = true;
    return true;
  }

  async importBannedIps(records) {
    await this.#ensureTable();

    const { records: normalized, skipped } = normalizeAll(records, normalizeBannedIpRecord);
    const { records: unique, duplicates } = dedupeBy(normalized, (r) => r.ip);

    await replaceTableRows(this.#db, {
      table: 'banned_ips',
      columns: ['ip', 'nickname', 'banned_at', 'banned_by'],
      rows: unique.map((r) => [r.ip, r.nickname, r.bannedAt, r.bannedBy]),
    });

    this.#cache = [];
    this.#loaded = false;

    return { imported: unique.length, skipped, duplicates };
  }
}