import fs from 'node:fs/promises';
import { normalizeLyricsKey } from '../shared/jsonUtils.js';

export class LyricsOffsetsDomain {
  #path;

  constructor(lyricsOffsetsPath) {
    this.#path = lyricsOffsetsPath;
  }

  async loadLyricsOffsets() {
    try {
      const raw = await fs.readFile(this.#path, 'utf8');
      const data = JSON.parse(raw);

      const map = new Map();

      for (const [key, value] of Object.entries(data || {})) {
        const num = Number(value);
        if (Number.isFinite(num)) {
          map.set(String(key || '').toLowerCase().trim(), num);
        }
      }

      console.log(`[DataProvider:json] Lyrics offsets loaded (${map.size} entries)`);
      return map;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[DataProvider:json] lyrics_offset.json not found - using empty offsets map');
      } else {
        console.error('[DataProvider:json] Failed to load offsets:', error.message);
      }
      return new Map();
    }
  }

  async saveLyricsOffsets(offsets) {
    const payload = {};

    offsets.forEach((value, key) => {
      const num = Number(value);
      if (Number.isFinite(num)) {
        payload[String(key || '').toLowerCase().trim()] = num;
      }
    });

    await fs.writeFile(this.#path, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
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
    const normalized = this.setLyricsOffset(offsets, title, artist, offset);
    await this.saveLyricsOffsets(offsets);
    return normalized;
  }
}