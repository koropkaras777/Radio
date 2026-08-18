import { ensureTables } from '../shared/schema.js';
import { replaceTableRows } from '../shared/sqlUtils.js';
import { normalizeAll, normalizeHistoryEntry } from '../../shared/importRecords.js';

export class HistoryDomain {
  #db;

  constructor(db) {
    this.#db = db;
  }

  #rowToEntry(row) {
    return {
      id:       Number(row.id),
      trackId:  String(row.track_id),
      title:    String(row.title),
      artist:   String(row.artist),
      album:    String(row.album || ''),
      mode:     row.mode === 'night' ? 'night' : 'day',
      playedAt: Number(row.played_at),
    };
  }

  async loadHistory() {
    await ensureTables(this.#db, 'play_history');

    const result = await this.#db.execute(`
      SELECT id, track_id, title, artist, album, mode, played_at
      FROM play_history
      ORDER BY played_at DESC
    `);

    return (result.rows || []).map((row) => this.#rowToEntry(row));
  }

  async getRecentPlays(limit) {
    await ensureTables(this.#db, 'play_history');

    const result = await this.#db.execute({
      sql: `SELECT id, track_id, title, artist, album, mode, played_at
            FROM play_history
            ORDER BY played_at DESC
            LIMIT ?`,
      args: [limit],
    });

    return (result.rows || []).map((row) => this.#rowToEntry(row));
  }

  async recordPlay({ trackId, title, artist, album = '', mode, playedAt }) {
    await ensureTables(this.#db, 'play_history');

    const normalizedMode = mode === 'night' ? 'night' : 'day';

    const result = await this.#db.execute({
      sql: `INSERT INTO play_history (track_id, title, artist, album, mode, played_at)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [String(trackId), String(title), String(artist), String(album), normalizedMode, playedAt],
    });

    return {
      id: Number(result.rows?.[0]?.id ?? 0),
      trackId: String(trackId),
      title: String(title),
      artist: String(artist),
      album: String(album),
      mode: normalizedMode,
      playedAt,
    };
  }

  async importHistory(entries) {
    await ensureTables(this.#db, 'play_history');

    const { records, skipped } = normalizeAll(entries, normalizeHistoryEntry);
    const ordered = records.sort((a, b) => a.playedAt - b.playedAt);

    await replaceTableRows(this.#db, {
      table: 'play_history',
      columns: ['track_id', 'title', 'artist', 'album', 'mode', 'played_at'],
      rows: ordered.map((e) => [e.trackId, e.title, e.artist, e.album, e.mode, e.playedAt]),
    });

    return { imported: ordered.length, skipped, truncated: 0 };
  }

  async purgeHistory(cutoff) {
    await ensureTables(this.#db, 'play_history');

    const result = await this.#db.execute({
      sql:  `DELETE FROM play_history WHERE played_at < ? RETURNING id`,
      args: [cutoff],
    });

    return (result.rows || []).length;
  }
}
