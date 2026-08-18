export class ArtsDomain {
  #r2;
  #prefix;

  constructor(r2Client, prefix = 'arts') {
    this.#r2 = r2Client;
    this.#prefix = prefix;
  }

  /**
   * @param {string} artistKey
   * @param {string} [artFileName]
   */
  getArtUrl(artistKey, artFileName) {
    const filename = artFileName || `${artistKey}.jpg`;
    return this.#r2.presign(`${this.#prefix}/${filename}`);
  }

  /**
   * @param {string} artistKey
   * @param {string} [artFileName]
   * @returns {Promise<{ buffer: Buffer, mime: string }>}
   */
  async getArtBuffer(artistKey, artFileName) {
    const filename = artFileName || `${artistKey}.jpg`;
    const url      = this.getArtUrl(artistKey, filename);
    const response = await fetch(url);

    if (!response.ok) {
      const e = new Error(
        response.status === 404
          ? `Art not found in cloud: ${artistKey}`
          : `R2 art fetch failed [${response.status}]: ${artistKey}`
      );
      e.status = response.status === 404 ? 404 : 502;
      e.name   = response.status === 404 ? 'NoSuchKey' : 'R2Error';
      throw e;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext    = filename.split('.').pop().toLowerCase();
    const mime   = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';

    return { buffer, mime };
  }

  /**
   * @param {string} artistKey
   * @param {Buffer} buffer
   */
  async uploadArt(artistKey, buffer) {
    await this.#r2.request({
      method     : 'PUT',
      key        : `${this.#prefix}/${artistKey}.jpg`,
      body       : buffer,
      contentType: 'image/jpeg',
    });
  }

  /** @param {string} artistKey */
  async deleteArt(artistKey) {
    await this.#r2.request({ method: 'DELETE', key: `${this.#prefix}/${artistKey}.jpg` });
  }
}