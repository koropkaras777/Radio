export class BackgroundMusicDomain {
  #r2;
  #prefix;

  constructor(r2Client, prefix = 'background') {
    this.#r2 = r2Client;
    this.#prefix = prefix;
  }

  /**
   * @param {'day'|'night'} mode
   * @param {string} filename
   * @returns {string}
   */
  getBackgroundMusicUrl(mode, filename) {
    return this.#r2.presign(`${this.#prefix}/${mode}/${filename}`);
  }

  /**
   * @param {'day'|'night'} mode
   * @param {string} filename
   * @param {Buffer} buffer
   * @param {string} [contentType]
   */
  async uploadBackgroundMusic(mode, filename, buffer, contentType = 'audio/mpeg') {
    await this.#r2.request({ method: 'PUT', key: `${this.#prefix}/${mode}/${filename}`, body: buffer, contentType });
  }

  /**
   * @param {'day'|'night'} mode
   * @param {string} filename
   */
  async deleteBackgroundMusic(mode, filename) {
    await this.#r2.request({ method: 'DELETE', key: `${this.#prefix}/${mode}/${filename}` });
  }

  /**
   * @param {'day'|'night'} mode
   * @param {string} filename
   * @returns {Promise<Buffer>}
   */
  async getBackgroundMusicBuffer(mode, filename) {
    const url      = this.getBackgroundMusicUrl(mode, filename);
    const response = await fetch(url);

    if (!response.ok) {
      const e = new Error(
        response.status === 404
          ? `Background music not found in cloud: ${mode}/${filename}`
          : `R2 background-music fetch failed [${response.status}]: ${mode}/${filename}`
      );
      e.status = response.status === 404 ? 404 : 502;
      e.name   = response.status === 404 ? 'NoSuchKey' : 'R2Error';
      throw e;
    }

    return Buffer.from(await response.arrayBuffer());
  }
}