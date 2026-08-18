import { normalizeLyricsKey, cloneEntry } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';

export class LyricsDomain {
  #db;
  #tracks;
  #cache = new Map();
  #loaded = false;

  constructor(db, tracksDomain) {
    this.#db = db;
    this.#tracks = tracksDomain;
  }

  async loadLyricsCache() {
    await ensureTables(this.#db, 'tracks');

    if (this.#loaded) {
      return new Map([...this.#cache].map(([k, v]) => [k, cloneEntry(v)]));
    }

    await this.#tracks.loadMetadata();

    const result = await this.#db.execute(`
      SELECT id, artist, title, synced, fetched_at, lyrics_payload_json
      FROM tracks
      WHERE lyrics_payload_json IS NOT NULL
      ORDER BY id
    `);

    const cache = new Map();
    for (const row of result.rows || []) {
      const key = normalizeLyricsKey(row.artist, row.title);
      const parsed = this.#parseLyricsPayloadRow(row);
      if (parsed) cache.set(key, parsed);
    }

    this.#cache = cache;
    this.#loaded = true;

    console.log(`[DataProvider:sql] Lyrics cache loaded (${cache.size} entries)`);
    return new Map([...cache].map(([k, v]) => [k, cloneEntry(v)]));
  }

  async saveLyricsCache(cache) {
    await this.#tracks.loadMetadata();

    await this.#db.execute(`
      UPDATE tracks
      SET synced = 0, fetched_at = NULL, lyrics_payload_json = NULL
      WHERE lyrics_payload_json IS NOT NULL
    `);

    let saved = 0;
    let skipped = 0;

    for (const [key, entry] of cache.entries()) {
      const track = this.#tracks.getTrackByKey(String(key).toLowerCase().trim());
      if (!track) {
        skipped++;
        continue;
      }

      const normalized = this.#normalizeLyricsEntry(entry);
      if (!normalized) continue;

      const fetchedAt = Number(normalized.fetchedAt) || Date.now();
      const synced = normalized.synced === true ? 1 : 0;
      const payload = JSON.stringify(this.#buildStoredLyricsEntry(normalized));

      await this.#db.execute({
        sql: `
          UPDATE tracks
          SET synced = ?, fetched_at = ?, lyrics_payload_json = ?
          WHERE id = ?
        `,
        args: [synced, fetchedAt, payload, track.id],
      });

      saved += 1;
    }

    this.#cache = new Map(
      [...cache].map(([k, v]) => [String(k).toLowerCase().trim(), cloneEntry(v)])
    );
    this.#loaded = true;

    console.log(`[DataProvider:sql] Lyrics cache saved (${saved} entries${skipped ? `, skipped: ${skipped}` : ''})`);
    return Object.fromEntries([...this.#cache].map(([k, v]) => [k, cloneEntry(v)]));
  }

  getLyrics(cache, title, artist) {
    return cache.get(normalizeLyricsKey(artist, title)) ?? null;
  }

  setLyrics(cache, title, artist, entry) {
    const key = normalizeLyricsKey(artist, title);
    const normalized = this.#normalizeLyricsEntry(entry);

    if (!normalized) {
      cache.delete(key);
      return null;
    }

    cache.set(key, normalized);
    return normalized;
  }

  deleteLyrics(cache, title, artist) {
    return cache.delete(normalizeLyricsKey(artist, title));
  }

  async upsertLyricsEntry(cache, title, artist, entry) {
    await this.#tracks.loadMetadata();

    const key = normalizeLyricsKey(artist, title);
    const track = this.#tracks.getTrackByKey(key);

    if (!track) {
      throw new Error(`Track not found for lyrics entry: ${artist} - ${title}`);
    }

    const normalized = this.#normalizeLyricsEntry(entry);
    if (!normalized) {
      return this.deleteLyricsEntry(cache, title, artist);
    }

    const fetchedAt = Number(normalized.fetchedAt) || Date.now();
    const synced = normalized.synced === true ? 1 : 0;
    const payload = JSON.stringify(this.#buildStoredLyricsEntry(normalized));

    await this.#db.execute({
      sql: `
        UPDATE tracks
        SET synced = ?, fetched_at = ?, lyrics_payload_json = ?
        WHERE id = ?
      `,
      args: [synced, fetchedAt, payload, track.id],
    });

    cache.set(key, cloneEntry(normalized));
    this.#cache.set(key, cloneEntry(normalized));
    this.#loaded = true;

    return cloneEntry(normalized);
  }

  async deleteLyricsEntry(cache, title, artist) {
    await this.#tracks.loadMetadata();

    const key = normalizeLyricsKey(artist, title);
    const track = this.#tracks.getTrackByKey(key);

    cache.delete(key);
    this.#cache.delete(key);
    this.#loaded = true;

    if (!track) return true;

    await this.#db.execute({
      sql: `
        UPDATE tracks
        SET synced = 0, fetched_at = NULL, lyrics_payload_json = NULL
        WHERE id = ?
      `,
      args: [track.id],
    });

    return true;
  }

  getLyricsCacheIndex(cache) {
    const items = [];

    cache.forEach((entry, key) => {
      const idx = key.indexOf('||');
      const artist = idx === -1 ? key : key.slice(0, idx);
      const title  = idx === -1 ? ''  : key.slice(idx + 2);
      items.push({ key, artist, title, status: this.#lyricsStatus(entry) });
    });

    items.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    return items;
  }

  getLyricsSongsIndex(metadata, cache) {
    const items = [];

    for (const mode of ['day', 'night']) {
      for (const [filename, meta] of Object.entries(metadata?.[mode] || {})) {
        const artist = String(meta?.artist || '').trim() || 'Unknown Artist';
        const title  = String(meta?.title  || '').trim() || filename;
        const key    = normalizeLyricsKey(artist, title);

        items.push({
          id: `${mode}/${filename}`,
          key, artist, title,
          album:  String(meta?.album || ''),
          year:   Number.isFinite(Number(meta?.year)) ? Number(meta.year) : null,
          mode, filename,
          status: this.#lyricsStatus(cache?.get(key) ?? null),
        });
      }
    }

    items.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    return items;
  }

  // ── Cross-domain cache sync (called by the facade when a track is
  //    renamed or deleted in TracksDomain) ─────────────────────────────────
  renameKey(oldKey, newKey) {
    if (!this.#cache.has(oldKey)) return;
    const value = this.#cache.get(oldKey);
    this.#cache.delete(oldKey);
    this.#cache.set(newKey, value);
    this.#loaded = true;
  }

  forgetKey(key) {
    this.#cache.delete(key);
    this.#loaded = true;
  }

  #lyricsStatus(entry) {
    if (!entry || entry.notFound) return 'none';
    return entry.synced ? 'synced' : 'plain';
  }

  #normalizeLines(lines, synced) {
    if (!Array.isArray(lines)) return [];
    if (synced) {
      return lines
        .map((line) => ({
          time: Number.isFinite(Number(line?.time)) ? Number(line.time) : 0,
          text: String(line?.text || '').trim(),
        }))
        .filter((line) => line.text);
    }
    return lines
      .map((line) => String(typeof line === 'string' ? line : (line?.text || '')).replace(/\[[^\]]*\]/g, '').trim())
      .filter(Boolean);
  }

  #buildStoredLyricsEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
      ...(entry.notFound ? { notFound: true } : {}),
      synced: Boolean(entry.synced),
      fetchedAt: Number(entry.fetchedAt) || Date.now(),
      lines: Array.isArray(entry.lines) ? cloneEntry(entry.lines) : [],
    };
  }

  #parseLyricsPayloadRow(row) {
    const payloadRaw = row?.lyrics_payload_json;
    if (!payloadRaw) return null;

    try {
      const parsed = typeof payloadRaw === 'string' ? JSON.parse(payloadRaw) : payloadRaw;
      if (!parsed || typeof parsed !== 'object') return null;

      const fetchedAt = Number(parsed.fetchedAt ?? row?.fetched_at) || Date.now();
      const synced    = Boolean(parsed.synced ?? row?.synced);
      const lines     = Array.isArray(parsed.lines) ? parsed.lines : [];

      if (parsed.notFound) return { notFound: true, fetchedAt };

      return { synced, fetchedAt, lines: this.#normalizeLines(lines, synced) };
    } catch (error) {
      console.warn(`[DataProvider:sql] Failed to parse lyrics payload for track ${row?.id}: ${error.message}`);
      return null;
    }
  }

  #normalizeLyricsEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const normalized = {
      ...cloneEntry(entry),
      fetchedAt: Number(entry.fetchedAt) || Date.now(),
    };

    normalized.lines = this.#normalizeLines(normalized.lines, normalized.synced);

    if (normalized.lines.length > 0) {
      delete normalized.notFound;
      delete normalized.reason;
    } else if (normalized.notFound) {
      normalized.synced = false;
      normalized.lines  = [];
    }

    return normalized;
  }
}