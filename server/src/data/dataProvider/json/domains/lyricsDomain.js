import fs from 'node:fs/promises';
import { normalizeLyricsKey, cloneEntry } from '../shared/jsonUtils.js';

export class LyricsDomain {
  #path;

  constructor(lyricsCachePath) {
    this.#path = lyricsCachePath;
  }

  async loadLyricsCache() {
    try {
      const raw = await fs.readFile(this.#path, 'utf8');
      const data = JSON.parse(raw);

      const map = new Map();
      let loaded = 0;
      let cleaned = 0;

      for (const [key, entry] of Object.entries(data || {})) {
        const normalizedKey = String(key || '').toLowerCase().trim();
        if (!normalizedKey) continue;

        if (
          (entry?.lines && entry.lines[0] && typeof entry.lines[0] === 'string' && entry.lines[0].includes('Read More')) ||
          (entry?.notFound && entry?.reason === 'scrape_failed')
        ) {
          cleaned += 1;
          continue;
        }

        const normalizedEntry = this.#normalizeLyricsEntry(entry);
        if (!normalizedEntry) continue;

        map.set(normalizedKey, normalizedEntry);
        loaded += 1;
      }

      console.log(`[DataProvider:json] Lyrics cache loaded (${loaded} entries${cleaned ? `, ${cleaned} stale dropped` : ''})`);
      return map;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[DataProvider:json] lyrics_cache.json not found - will create on first save');
      } else {
        console.error('[DataProvider:json] Failed to load lyrics cache:', error.message);
      }
      return new Map();
    }
  }

  async saveLyricsCache(cache) {
    const payload = this.#mapToObject(cache);
    await fs.writeFile(this.#path, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  getLyrics(cache, title, artist) {
    return cache.get(normalizeLyricsKey(artist, title)) ?? null;
  }

  setLyrics(cache, title, artist, entry) {
    const key = normalizeLyricsKey(artist, title);
    const normalizedEntry = this.#normalizeLyricsEntry(entry);

    if (!normalizedEntry) {
      cache.delete(key);
      return null;
    }

    cache.set(key, normalizedEntry);
    return normalizedEntry;
  }

  deleteLyrics(cache, title, artist) {
    return cache.delete(normalizeLyricsKey(artist, title));
  }

  async upsertLyricsEntry(cache, title, artist, entry) {
    this.setLyrics(cache, title, artist, entry);
    await this.saveLyricsCache(cache);
    return this.getLyrics(cache, title, artist);
  }

  async deleteLyricsEntry(cache, title, artist) {
    this.deleteLyrics(cache, title, artist);
    await this.saveLyricsCache(cache);
    return true;
  }

  getLyricsCacheIndex(cache) {
    const items = [];

    cache.forEach((entry, key) => {
      const idx    = key.indexOf('||');
      const artist = idx === -1 ? key        : key.slice(0, idx);
      const title  = idx === -1 ? ''         : key.slice(idx + 2);
      items.push({ key, artist, title, status: this.#lyricsStatus(entry) });
    });

    return this.#sortByArtistTitle(items);
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

    return this.#sortByArtistTitle(items);
  }

  #normalizeLyricsEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const normalized = {
      ...cloneEntry(entry),
      fetchedAt: Number(entry.fetchedAt) || Date.now(),
    };

    if (Array.isArray(normalized.lines) && !normalized.synced) {
      normalized.lines = normalized.lines
        .map((line) => String(line || '').replace(/\[[^\]]*\]/g, '').trim())
        .filter(Boolean);
    }

    return normalized;
  }

  #lyricsStatus(entry) {
    if (!entry || entry.notFound) return 'none';
    return entry.synced ? 'synced' : 'plain';
  }

  #sortByArtistTitle(items) {
    return items.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  }

  #mapToObject(map) {
    return Object.fromEntries([...map].map(([k, v]) => [k, cloneEntry(v)]));
  }
}