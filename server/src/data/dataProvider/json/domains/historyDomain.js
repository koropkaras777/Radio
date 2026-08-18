import { JsonStore } from '../shared/jsonStore.js';
import { normalizeAll, normalizeHistoryEntry } from '../../shared/importRecords.js';

const MAX_ENTRIES = 10_000;

export class HistoryDomain {
  #store;

  constructor(filePath) {
    this.#store = new JsonStore(filePath, []);
  }

  async loadHistory() {
    const entries = await this.#store.read();
    return [...entries].sort((a, b) => b.playedAt - a.playedAt);
  }

  async getRecentPlays(limit) {
    const entries = await this.loadHistory();
    return entries.slice(0, limit);
  }

  async recordPlay({ trackId, title, artist, album = '', mode, playedAt }) {
    return this.#store.update((entries) => {
      const nextId = entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;

      const entry = {
        id: nextId,
        trackId: String(trackId),
        title: String(title),
        artist: String(artist),
        album: String(album),
        mode: mode === 'night' ? 'night' : 'day',
        playedAt,
      };

      const kept = [...entries, entry].slice(-MAX_ENTRIES);
      return { value: kept, result: entry };
    });
  }

  async importHistory(entries) {
    const { records, skipped } = normalizeAll(entries, normalizeHistoryEntry);

    const ordered = records.sort((a, b) => a.playedAt - b.playedAt);
    const kept = ordered.slice(-MAX_ENTRIES);
    const numbered = kept.map((entry, index) => ({ id: index + 1, ...entry }));

    await this.#store.update(() => ({ value: numbered, result: undefined }));
    return { imported: numbered.length, skipped, truncated: ordered.length - kept.length };
  }

  async purgeHistory(cutoff) {
    return this.#store.update((entries) => {
      const kept = entries.filter((e) => Number(e.playedAt) >= cutoff);
      return { value: kept, result: entries.length - kept.length };
    });
  }
}
