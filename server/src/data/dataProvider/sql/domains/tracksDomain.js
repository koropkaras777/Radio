import { normalizeLyricsKey, cloneEntry } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';

export class TracksDomain {
  #db;
  #metadataCache = { day: {}, night: {} };
  #metadataLoaded = false;
  #trackById = new Map();
  #trackByKey = new Map();
  #trackIdByModeFilename = new Map();

  constructor(db) {
    this.#db = db;
  }

  // ── Cross-domain accessors (used by lyrics/offsets domains) ──────────────
  getTrackByKey(key) {
    return this.#trackByKey.get(key) || null;
  }

  getTrackById(id) {
    return this.#trackById.get(Number(id)) || null;
  }

  getTrackIdByModeFilename(modeFilename) {
    return this.#trackIdByModeFilename.get(modeFilename) ?? null;
  }
  
  async loadMetadata() {
    await ensureTables(this.#db, 'tracks', 'offsets');

    if (this.#metadataLoaded) {
      return {
        day: this.#cloneMetadataMode(this.#metadataCache.day),
        night: this.#cloneMetadataMode(this.#metadataCache.night),
      };
    }

    const result = await this.#db.execute(`
      SELECT id, artist, title, album, year, duration, mode, filename, synced, fetched_at, lyrics_payload_json
      FROM tracks
      ORDER BY mode, artist, title
    `);

    const day = {};
    const night = {};
    this.#trackById.clear();
    this.#trackByKey.clear();
    this.#trackIdByModeFilename.clear();

    for (const row of result.rows || []) {
      const meta = this.#rowToMeta(row);
      const mode = meta.mode === 'night' ? 'night' : 'day';
      const filename = String(meta.filename || '').trim();
      if (!filename) continue;

      if (mode === 'night') night[filename] = meta;
      else day[filename] = meta;

      const normalizedRow = {
        id: Number(row.id),
        artist: meta.artist,
        title: meta.title,
        album: meta.album,
        year: meta.year,
        duration: meta.duration,
        mode,
        filename,
      };

      this.#trackById.set(normalizedRow.id, normalizedRow);
      this.#trackByKey.set(normalizeLyricsKey(normalizedRow.artist, normalizedRow.title), normalizedRow);
      this.#trackIdByModeFilename.set(`${mode}/${filename}`, normalizedRow.id);
    }

    this.#metadataCache = { day, night };
    this.#metadataLoaded = true;

    console.log(
      `[DataProvider:sql] Metadata cache loaded (day: ${Object.keys(day).length}, night: ${Object.keys(night).length})`
    );

    return {
      day: this.#cloneMetadataMode(day),
      night: this.#cloneMetadataMode(night),
    };
  }

  async saveMetadata(metadata) {
    await this.loadMetadata();

    const desiredRows = [];
    for (const mode of ['day', 'night']) {
      for (const [filename, meta] of Object.entries(metadata?.[mode] || {})) {
        desiredRows.push({
          mode,
          filename: String(filename),
          artist: meta?.artist ?? '',
          title: meta?.title ?? '',
          album: meta?.album ?? '',
          year: meta?.year ?? null,
          duration: Number.isFinite(Number(meta?.duration)) ? Number(meta.duration) : null,
        });
      }
    }

    const desiredKeys = new Set(desiredRows.map((row) => `${row.mode}/${row.filename}`));
    const existingKeys = new Set(this.#trackIdByModeFilename.keys());

    for (const row of desiredRows) {
      const modeFilename = `${row.mode}/${row.filename}`;
      const existingId = this.#trackIdByModeFilename.get(modeFilename);

      if (existingId) {
        const existing = this.#trackById.get(existingId);
        const changed = !existing ||
          existing.artist !== row.artist ||
          existing.title !== row.title ||
          existing.album !== row.album ||
          existing.year !== row.year ||
          existing.duration !== row.duration ||
          existing.mode !== row.mode ||
          existing.filename !== row.filename;

        if (changed) {
          await this.#db.execute({
            sql: `
              UPDATE tracks
              SET artist = ?, title = ?, album = ?, year = ?, duration = ?, mode = ?, filename = ?
              WHERE id = ?
            `,
            args: [row.artist, row.title, row.album, row.year, row.duration, row.mode, row.filename, existingId],
          });
        }
      } else {
        await this.#db.execute({
          sql: `
            INSERT INTO tracks (artist, title, album, year, duration, mode, filename)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          args: [row.artist, row.title, row.album, row.year, row.duration, row.mode, row.filename],
        });
      }
    }

    for (const existingKey of existingKeys) {
      if (desiredKeys.has(existingKey)) continue;

      const trackId = this.#trackIdByModeFilename.get(existingKey);
      if (!trackId) continue;

      await this.#db.execute({ sql: `DELETE FROM offsets WHERE track_id = ?`, args: [trackId] });
      await this.#db.execute({ sql: `DELETE FROM tracks WHERE id = ?`, args: [trackId] });
    }

    this.#metadataLoaded = false;
    return this.loadMetadata();
  }

  async addTrack(track) {
    await this.loadMetadata();

    const mode = track?.mode === 'night' ? 'night' : 'day';
    const filename = String(track?.filename || '').trim();
    if (!filename) {
      throw new Error('Track filename is required');
    }

    const artist = String(track?.artist || '').trim() || 'Unknown Artist';
    const title = String(track?.title || '').trim() || filename.replace(/\.mp3$/i, '');
    const album = String(track?.album || '').trim();
    const year = Number.isFinite(Number(track?.year)) ? Number(track.year) : null;
    const duration = Number.isFinite(Number(track?.duration)) ? Number(track.duration) : null;

    const modeFilename = `${mode}/${filename}`;
    if (this.#trackIdByModeFilename.has(modeFilename)) {
      throw new Error(`Track already exists: ${modeFilename}`);
    }

    const insertRes = await this.#db.execute({
      sql: `
        INSERT INTO tracks (artist, title, album, year, duration, mode, filename)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [artist, title, album, year, duration, mode, filename],
    });

    const rowId = Number(insertRes?.lastInsertRowid);
    const normalizedRow = { id: rowId, artist, title, album, year, duration, mode, filename };

    if (!this.#metadataCache[mode]) this.#metadataCache[mode] = {};
    this.#metadataCache[mode][filename] = { artist, title, album, year, duration, mode, filename };
    this.#metadataLoaded = true;

    this.#trackById.set(rowId, normalizedRow);
    this.#trackByKey.set(normalizeLyricsKey(artist, title), normalizedRow);
    this.#trackIdByModeFilename.set(modeFilename, rowId);

    return cloneEntry(normalizedRow);
  }

  async updateTrackMetadataById(trackId, updates = {}) {
    await this.loadMetadata();

    const numericId = Number(trackId);
    const existing = this.#trackById.get(numericId);
    if (!existing) {
      throw new Error(`Track not found: ${trackId}`);
    }

    const nextMode = updates?.mode === 'night' ? 'night' : (updates?.mode === 'day' ? 'day' : existing.mode);
    const nextFilename = String(updates?.filename ?? existing.filename).trim();
    if (!nextFilename) {
      throw new Error('Track filename is required');
    }

    const nextArtist = String(updates?.artist ?? existing.artist).trim() || 'Unknown Artist';
    const nextTitle = String(updates?.title ?? existing.title).trim() || nextFilename.replace(/\.mp3$/i, '');
    const nextAlbum = String(updates?.album ?? existing.album ?? '').trim();
    const nextYear = Number.isFinite(Number(updates?.year)) ? Number(updates.year) : (updates?.year === null ? null : existing.year);
    const nextDuration = Number.isFinite(Number(updates?.duration)) ? Number(updates.duration) : existing.duration;

    const previousModeFilename = `${existing.mode}/${existing.filename}`;
    const nextModeFilename = `${nextMode}/${nextFilename}`;
    const conflictingId = this.#trackIdByModeFilename.get(nextModeFilename);
    if (conflictingId && conflictingId !== numericId) {
      throw new Error(`Track already exists: ${nextModeFilename}`);
    }

    await this.#db.execute({
      sql: `
        UPDATE tracks
        SET artist = ?, title = ?, album = ?, year = ?, duration = ?, mode = ?, filename = ?
        WHERE id = ?
      `,
      args: [nextArtist, nextTitle, nextAlbum, nextYear, nextDuration, nextMode, nextFilename, numericId],
    });

    if (this.#metadataCache[existing.mode]) {
      delete this.#metadataCache[existing.mode][existing.filename];
    }
    if (!this.#metadataCache[nextMode]) this.#metadataCache[nextMode] = {};
    this.#metadataCache[nextMode][nextFilename] = {
      artist: nextArtist, title: nextTitle, album: nextAlbum, year: nextYear,
      duration: nextDuration, mode: nextMode, filename: nextFilename,
    };
    this.#metadataLoaded = true;

    this.#trackIdByModeFilename.delete(previousModeFilename);
    const previousKey = normalizeLyricsKey(existing.artist, existing.title);
    const nextKey = normalizeLyricsKey(nextArtist, nextTitle);
    this.#trackByKey.delete(previousKey);

    const normalizedRow = {
      id: numericId, artist: nextArtist, title: nextTitle, album: nextAlbum,
      year: nextYear, duration: nextDuration, mode: nextMode, filename: nextFilename,
    };

    this.#trackById.set(numericId, normalizedRow);
    this.#trackByKey.set(nextKey, normalizedRow);
    this.#trackIdByModeFilename.set(nextModeFilename, numericId);

    return { track: cloneEntry(normalizedRow), previousKey, nextKey };
  }

  async deleteTrackById(trackId) {
    await this.loadMetadata();

    const numericId = Number(trackId);
    const existing = this.#trackById.get(numericId);
    if (!existing) return { deleted: false, key: null };

    await this.#db.execute({
      sql: `
        UPDATE tracks
        SET synced = 0, fetched_at = NULL, lyrics_payload_json = NULL
        WHERE id = ?
      `,
      args: [numericId],
    });
    await this.#db.execute({ sql: `DELETE FROM tracks WHERE id = ?`, args: [numericId] });

    if (this.#metadataCache[existing.mode]) {
      delete this.#metadataCache[existing.mode][existing.filename];
    }

    const key = normalizeLyricsKey(existing.artist, existing.title);
    this.#trackById.delete(numericId);
    this.#trackByKey.delete(key);
    this.#trackIdByModeFilename.delete(`${existing.mode}/${existing.filename}`);
    this.#metadataLoaded = true;

    return { deleted: true, key, trackId: numericId };
  }

  getTrackRowById(trackId) {
    const existing = this.#trackById.get(Number(trackId));
    return existing ? cloneEntry(existing) : null;
  }

  #cloneMetadataMode(modeData) {
    return JSON.parse(JSON.stringify(modeData || {}));
  }

  #rowToMeta(row) {
    return {
      artist:   row?.artist   ?? '',
      title:    row?.title    ?? '',
      album:    row?.album    ?? '',
      year:     row?.year     ?? null,
      duration: Number.isFinite(Number(row?.duration)) ? Number(row.duration) : null,
      mode:     row?.mode === 'night' ? 'night' : 'day',
      filename: row?.filename ?? '',
    };
  }
}