import fs from 'node:fs/promises';

export class ArtistArtsDomain {
  #path;

  constructor(artistArtsPath) {
    this.#path = artistArtsPath;
  }

  async loadArtistArts() {
    try {
      const raw  = await fs.readFile(this.#path, 'utf8');
      const data = JSON.parse(raw);
      return this.#normalizeArtistArts(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[DataProvider:json] Failed to load artist arts:', error.message);
      }
      return [];
    }
  }

  async saveArtistArts(items) {
    const normalized = this.#normalizeArtistArts(Array.isArray(items) ? items : []);
    await fs.writeFile(this.#path, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  }

  async upsertArtistArt(item) {
    const items = await this.loadArtistArts();
    const artist = String(item?.artist || '').trim().toLowerCase();
    if (!artist) throw new Error('Artist is required');

    const next = {
      artist,
      hasArt: Boolean(item?.hasArt),
      artFileName: String(item?.artFileName || '').trim(),
    };

    const idx = items.findIndex((entry) => entry.artist === artist);
    if (idx === -1) items.push(next);
    else items[idx] = next;

    await this.saveArtistArts(items);
    return next;
  }

  async deleteArtistArt(artist) {
    const items = await this.loadArtistArts();
    const normalizedArtist = String(artist || '').trim().toLowerCase();
    if (!normalizedArtist) throw new Error('Artist is required');

    const next = {
      artist: normalizedArtist,
      hasArt: false,
      artFileName: '',
    };

    const idx = items.findIndex((entry) => entry.artist === normalizedArtist);
    if (idx === -1) items.push(next);
    else items[idx] = next;

    await this.saveArtistArts(items);
    return next;
  }

  async ensureArtistArtEntry(artist) {
    const items = await this.loadArtistArts();
    const normalizedArtist = String(artist || '').trim().toLowerCase();
    if (!normalizedArtist) throw new Error('Artist is required');

    const existing = items.find((entry) => entry.artist === normalizedArtist);
    if (existing) return existing;

    const next = { artist: normalizedArtist, hasArt: false, artFileName: '' };
    items.push(next);
    await this.saveArtistArts(items);
    return next;
  }

  #normalizeArtistArts(items) {
    return items
      .map((item) => ({
        artist:      String(item?.artist      || '').trim().toLowerCase(),
        hasArt:      Boolean(item?.hasArt),
        artFileName: String(item?.artFileName || '').trim(),
      }))
      .filter((item) => item.artist)
      .sort((a, b) => a.artist.localeCompare(b.artist));
  }
}