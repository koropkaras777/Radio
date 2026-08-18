import { normalizeLyricsKey } from '../shared/jsonUtils.js';
import { JsonStore } from '../shared/jsonStore.js';

export class MetadataDomain {
  #store;
  #cache = { day: {}, night: {} };
  #loaded = false;

  constructor(metadataCachePath) {
    this.#store = new JsonStore(metadataCachePath, { day: {}, night: {} });
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  async loadMetadata() {
    const data = await this.#store.read();

    this.#cache = {
      day: this.#sanitizeMetadataMode(data?.day),
      night: this.#sanitizeMetadataMode(data?.night),
    };
    this.#loaded = true;

    if (!this.#logged) {
      console.log('[DataProvider:json] Metadata cache loaded.');
      this.#logged = true;
    }

    return this.#cloneCache();
  }

  #logged = false;

  #cloneCache() {
    return {
      day: structuredClone(this.#cache.day),
      night: structuredClone(this.#cache.night),
    };
  }

  async saveMetadata(metadata) {
    const safe = {
      day: this.#sanitizeMetadataMode(metadata?.day),
      night: this.#sanitizeMetadataMode(metadata?.night),
    };

    await this.#store.update(() => ({ value: safe, result: safe }));
    this.#cache = safe;
    this.#loaded = true;
    return safe;
  }

  // ── Per-track operations ────────────────────────────────────────────────────

  getTrackIdByModeFilename(modeFilename) {
    const id = String(modeFilename || '');
    const slash = id.indexOf('/');
    if (slash === -1) return null;

    const mode = id.slice(0, slash);
    const filename = id.slice(slash + 1);
    return this.#cache[mode]?.[filename] ? id : null;
  }

  getTrackRowById(trackId) {
    const id = String(trackId || '');
    const slash = id.indexOf('/');
    if (slash === -1) return null;

    const mode = id.slice(0, slash);
    const filename = id.slice(slash + 1);
    const meta = this.#cache[mode]?.[filename];
    if (!meta) return null;

    return { id, ...meta, mode, filename };
  }

  async addTrack(track) {
    if (!this.#loaded) await this.loadMetadata();

    const mode = track?.mode === 'night' ? 'night' : 'day';
    const filename = String(track?.filename || '').trim();
    if (!filename) throw new Error('Track filename is required');

    const row = {
      artist:   String(track?.artist || '').trim() || 'Unknown Artist',
      title:    String(track?.title || '').trim() || filename.replace(/\.mp3$/i, ''),
      album:    String(track?.album || '').trim(),
      year:     Number.isFinite(Number(track?.year)) ? Number(track.year) : null,
      duration: Number.isFinite(Number(track?.duration)) ? Number(track.duration) : null,
      mode,
      filename,
    };

    const id = `${mode}/${filename}`;

    await this.#store.update((data) => {
      const next = {
        day: this.#sanitizeMetadataMode(data?.day),
        night: this.#sanitizeMetadataMode(data?.night),
      };
      if (next[mode][filename]) throw new Error(`Track already exists: ${id}`);

      next[mode][filename] = row;
      this.#cache = next;
      return { value: next, result: undefined };
    });

    this.#loaded = true;
    return { id, ...row };
  }

  async updateTrackMetadataById(trackId, updates = {}) {
    if (!this.#loaded) await this.loadMetadata();

    const existing = this.getTrackRowById(trackId);
    if (!existing) throw new Error(`Track not found: ${trackId}`);

    const nextMode = updates?.mode === 'night' ? 'night'
      : updates?.mode === 'day' ? 'day'
        : existing.mode;

    const nextFilename = String(updates?.filename ?? existing.filename).trim();
    if (!nextFilename) throw new Error('Track filename is required');

    const nextRow = {
      artist:   String(updates?.artist ?? existing.artist).trim() || 'Unknown Artist',
      title:    String(updates?.title ?? existing.title).trim() || nextFilename.replace(/\.mp3$/i, ''),
      album:    String(updates?.album ?? existing.album ?? '').trim(),
      year:     Number.isFinite(Number(updates?.year)) ? Number(updates.year)
        : (updates?.year === null ? null : existing.year),
      duration: Number.isFinite(Number(updates?.duration)) ? Number(updates.duration) : existing.duration,
      mode:     nextMode,
      filename: nextFilename,
    };

    const nextId = `${nextMode}/${nextFilename}`;

    await this.#store.update((data) => {
      const next = {
        day: this.#sanitizeMetadataMode(data?.day),
        night: this.#sanitizeMetadataMode(data?.night),
      };

      if (nextId !== existing.id && next[nextMode][nextFilename]) {
        throw new Error(`Track already exists: ${nextId}`);
      }

      delete next[existing.mode][existing.filename];
      next[nextMode][nextFilename] = nextRow;

      this.#cache = next;
      return { value: next, result: undefined };
    });

    return {
      track: { id: nextId, ...nextRow },
      previousKey: normalizeLyricsKey(existing.artist, existing.title),
      nextKey: normalizeLyricsKey(nextRow.artist, nextRow.title),
    };
  }

  async deleteTrackById(trackId) {
    if (!this.#loaded) await this.loadMetadata();

    const existing = this.getTrackRowById(trackId);
    if (!existing) return { deleted: false, key: null };

    await this.#store.update((data) => {
      const next = {
        day: this.#sanitizeMetadataMode(data?.day),
        night: this.#sanitizeMetadataMode(data?.night),
      };
      delete next[existing.mode][existing.filename];

      this.#cache = next;
      return { value: next, result: undefined };
    });

    return { deleted: true, key: normalizeLyricsKey(existing.artist, existing.title) };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  #sanitizeMetadataMode(modeData) {
    if (!modeData || typeof modeData !== 'object' || Array.isArray(modeData)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(modeData).map(([filename, meta]) => [
        String(filename),
        {
          artist:   meta?.artist   ?? '',
          title:    meta?.title    ?? '',
          album:    meta?.album    ?? '',
          year:     meta?.year     ?? null,
          duration: Number.isFinite(Number(meta?.duration)) ? Number(meta.duration) : null,
          mode:     meta?.mode     ?? null,
          filename: meta?.filename ?? String(filename),
        },
      ])
    );
  }
}
