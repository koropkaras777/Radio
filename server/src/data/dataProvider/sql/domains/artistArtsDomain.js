import { cloneEntry, chunkArray } from '../shared/sqlUtils.js';
import { ensureTables } from '../shared/schema.js';

export class ArtistArtsDomain {
  #db;
  #cache = [];
  #loaded = false;

  constructor(db) {
    this.#db = db;
  }

  async #ensureTable() {
    await ensureTables(this.#db, 'artist_arts');
  }

  async loadArtistArts() {
    if (this.#loaded) return cloneEntry(this.#cache);

    await this.#ensureTable();

    const result = await this.#db.execute(`
      SELECT artist, has_art, art_file
      FROM artist_arts
      ORDER BY artist
    `);

    this.#cache = (result.rows || []).map((row) => ({
      artist: String(row.artist || '').trim().toLowerCase(),
      hasArt: Boolean(row.has_art),
      artFileName: String(row.art_file || '').trim(),
    }))
      .filter((item) => item.artist)
      .sort((a, b) => a.artist.localeCompare(b.artist));
    this.#loaded = true;

    return cloneEntry(this.#cache);
  }

  async saveArtistArts(items) {
    await this.#ensureTable();

    await this.#db.execute(`DELETE FROM artist_arts`);
    const safe = (Array.isArray(items) ? items : [])
      .map((item) => ({
        artist: String(item?.artist || '').trim().toLowerCase(),
        hasArt: Boolean(item?.hasArt),
        artFileName: String(item?.artFileName || '').trim(),
      }))
      .filter((item) => item.artist)
      .sort((a, b) => a.artist.localeCompare(b.artist));

    for (const batch of chunkArray(safe, 300)) {
      const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
      await this.#db.execute({
        sql: `INSERT INTO artist_arts (artist, has_art, art_file) VALUES ${placeholders}`,
        args: batch.flatMap((item) => [item.artist, item.hasArt ? 1 : 0, item.artFileName]),
      });
    }

    this.#cache = safe;
    this.#loaded = true;
    return cloneEntry(this.#cache);
  }

  async upsertArtistArt(item) {
    await this.#ensureTable();

    const artist = String(item?.artist || '').trim().toLowerCase();
    if (!artist) throw new Error('Artist is required');

    const next = {
      artist,
      hasArt: Boolean(item?.hasArt),
      artFileName: String(item?.artFileName || '').trim(),
    };

    await this.#db.execute({
      sql: `
        INSERT INTO artist_arts (artist, has_art, art_file)
        VALUES (?, ?, ?)
        ON CONFLICT(artist) DO UPDATE SET
          has_art = excluded.has_art,
          art_file = excluded.art_file
      `,
      args: [next.artist, next.hasArt ? 1 : 0, next.artFileName],
    });

    const current = await this.loadArtistArts();
    const idx = current.findIndex((entry) => entry.artist === artist);
    if (idx === -1) current.push(next);
    else current[idx] = next;
    this.#cache = current.sort((a, b) => a.artist.localeCompare(b.artist));
    this.#loaded = true;
    return cloneEntry(next);
  }

  async deleteArtistArt(artist) {
    await this.#ensureTable();

    const normalizedArtist = String(artist || '').trim().toLowerCase();
    if (!normalizedArtist) throw new Error('Artist is required');

    await this.#db.execute({
      sql: `
        INSERT INTO artist_arts (artist, has_art, art_file)
        VALUES (?, 0, '')
        ON CONFLICT(artist) DO UPDATE SET
          has_art = 0,
          art_file = ''
      `,
      args: [normalizedArtist],
    });

    const current = await this.loadArtistArts();
    const idx = current.findIndex((entry) => entry.artist === normalizedArtist);
    const next = { artist: normalizedArtist, hasArt: false, artFileName: '' };
    if (idx === -1) current.push(next);
    else current[idx] = next;
    this.#cache = current.sort((a, b) => a.artist.localeCompare(b.artist));
    this.#loaded = true;
    return cloneEntry(next);
  }

  async ensureArtistArtEntry(artist) {
    await this.#ensureTable();

    const normalizedArtist = String(artist || '').trim().toLowerCase();
    if (!normalizedArtist) throw new Error('Artist is required');

    await this.#db.execute({
      sql: `
        INSERT INTO artist_arts (artist, has_art, art_file)
        VALUES (?, 0, '')
        ON CONFLICT(artist) DO NOTHING
      `,
      args: [normalizedArtist],
    });

    const current = await this.loadArtistArts();
    const idx = current.findIndex((entry) => entry.artist === normalizedArtist);
    const next = idx === -1
      ? { artist: normalizedArtist, hasArt: false, artFileName: '' }
      : current[idx];

    if (idx === -1) {
      current.push(next);
      this.#cache = current.sort((a, b) => a.artist.localeCompare(b.artist));
      this.#loaded = true;
    }

    return cloneEntry(next);
  }
}