import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class ArtsDomain {
  #artsPath;

  constructor(artsPath) {
    this.#artsPath = artsPath;
  }

  /** @param {string} artistKey - normalised lowercase artist key */
  getArtUrl(artistKey) {
    return `/api/artist-art/${encodeURIComponent(artistKey)}`;
  }

  /**
   * @param {string} artistKey
   * @param {string} [_artFileName]  - unused in local mode (derived from artistKey)
   * @returns {Promise<{ buffer: Buffer, mime: string }>}
   */
  async getArtBuffer(artistKey, _artFileName) {
    const filename = `${artistKey}.jpg`;
    const filePath = join(this.#artsPath, filename);
    try {
      const buffer = await readFile(filePath);
      return { buffer, mime: 'image/jpeg' };
    } catch (err) {
      const e = new Error(`Art not found: ${artistKey}`);
      e.status = 404;
      e.code   = err.code;
      throw e;
    }
  }

  /**
   * @param {string} artistKey
   * @param {Buffer} buffer
   */
  async uploadArt(artistKey, buffer) {
    await mkdir(this.#artsPath, { recursive: true });
    await writeFile(join(this.#artsPath, `${artistKey}.jpg`), buffer);
  }

  /** @param {string} artistKey */
  async deleteArt(artistKey) {
    await unlink(join(this.#artsPath, `${artistKey}.jpg`)).catch(() => {});
  }
}