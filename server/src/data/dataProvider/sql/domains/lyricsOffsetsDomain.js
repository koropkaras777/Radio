import { normalizeLyricsKey, chunkArray } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';

export class LyricsOffsetsDomain {
  #db;
  #tracks;
  #cache = new Map();
  #loaded = false;

  constructor(db, tracksDomain) {
    this.#db = db;
    this.#tracks = tracksDomain;
  }

  async loadLyricsOffsets() {
    await ensureTables(this.#db, 'offsets', 'tracks');

    if (this.#loaded) {
      return new Map(this.#cache);
    }

    await this.#tracks.loadMetadata();

    const result = await this.#db.execute(`
      SELECT o.track_id, o.offset, t.artist, t.title
      FROM offsets o
      JOIN tracks t ON t.id = o.track_id
    `);

    const map = new Map();
    for (const row of result.rows || []) {
      const key = normalizeLyricsKey(row.artist, row.title);
      const num = Number(row.offset);
      if (Number.isFinite(num)) map.set(key, num);
    }

    this.#cache = map;
    this.#loaded = true;

    console.log(`[DataProvider:sql] Lyrics offsets loaded (${map.size} entries)`);
    return new Map(map);
  }

  async saveLyricsOffsets(offsets) {
    await this.#tracks.loadMetadata();
    await this.#db.execute(`DELETE FROM offsets`);

    const rows = [];
    const nextCache = new Map();
    let skipped = 0;

    offsets.forEach((value, key) => {
      const track = this.#tracks.getTrackByKey(String(key).toLowerCase().trim());
      const num = Number(value);

      if (!track || !Number.isFinite(num)) {
        skipped++;
        return;
      }
      if (Math.abs(num) < 0.001) return;

      const rounded = Math.round(num * 100) / 100;
      rows.push({ trackId: track.id, offset: rounded });
      nextCache.set(String(key).toLowerCase().trim(), rounded);
    });

    for (const batch of chunkArray(rows, 300)) {
      if (!batch.length) continue;
      const placeholders = batch.map(() => '(?, ?)').join(', ');
      const args = batch.flatMap((row) => [row.trackId, row.offset]);
      await this.#db.execute({
        sql: `INSERT INTO offsets (track_id, offset) VALUES ${placeholders}`,
        args,
      });
    }

    this.#cache = nextCache;
    this.#loaded = true;

    console.log(`[DataProvider:sql] Lyrics offsets saved (${this.#cache.size} entries${skipped ? `, skipped: ${skipped}` : ''})`);
    return Object.fromEntries(this.#cache);
  }

  getLyricsOffset(offsets, title, artist) {
    return offsets.get(normalizeLyricsKey(artist, title)) ?? 0;
  }

  setLyricsOffset(offsets, title, artist, offset) {
    const key = normalizeLyricsKey(artist, title);
    const num = Number(offset);

    if (!Number.isFinite(num)) return 0;

    if (Math.abs(num) < 0.001) {
      offsets.delete(key);
      return 0;
    }

    const rounded = Math.round(num * 100) / 100;
    offsets.set(key, rounded);
    return rounded;
  }

  deleteLyricsOffset(offsets, title, artist) {
    return offsets.delete(normalizeLyricsKey(artist, title));
  }

  async upsertLyricsOffset(offsets, title, artist, offset) {
    await this.#tracks.loadMetadata();

    const key = normalizeLyricsKey(artist, title);
    const track = this.#tracks.getTrackByKey(key);

    if (!track) {
      throw new Error(`Track not found for lyrics offset: ${artist} - ${title}`);
    }

    const num = Number(offset);

    if (!Number.isFinite(num) || Math.abs(num) < 0.001) {
      offsets.delete(key);
      this.#cache.delete(key);
      this.#loaded = true;

      await this.#db.execute({ sql: `DELETE FROM offsets WHERE track_id = ?`, args: [track.id] });
      return 0;
    }

    const rounded = Math.round(num * 100) / 100;

    await this.#db.execute({
      sql: `
        INSERT INTO offsets (track_id, offset) VALUES (?, ?)
        ON CONFLICT(track_id) DO UPDATE SET offset = excluded.offset
      `,
      args: [track.id, rounded],
    });

    offsets.set(key, rounded);
    this.#cache.set(key, rounded);
    this.#loaded = true;

    return rounded;
  }

  // ── Cross-domain cache sync (called by the facade) ───────────────────────
  renameKey(oldKey, newKey) {
    if (!this.#cache.has(oldKey)) return;
    const value = this.#cache.get(oldKey);
    this.#cache.delete(oldKey);
    this.#cache.set(newKey, value);
    this.#loaded = true;
  }

  async deleteByTrackId(trackId, key) {
    await this.#db.execute({ sql: `DELETE FROM offsets WHERE track_id = ?`, args: [trackId] });
    if (key) this.#cache.delete(key);
    this.#loaded = true;
  }
}