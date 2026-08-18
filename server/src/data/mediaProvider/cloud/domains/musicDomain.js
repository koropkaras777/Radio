export class MusicDomain {
  #r2;

  constructor(r2Client) {
    this.#r2 = r2Client;
  }

  /** @param {string} trackId - e.g. "day/Artist - Title.mp3" */
  getAudioUrl(trackId) {
    return this.#r2.presign(String(trackId));
  }

  /**
   * @param {string}      trackId
   * @param {string|null} rangeHeader
   * @returns {Promise<{ stream: ReadableStream, status: number, headers: object }>}
   */
  async getAudioReadStream(trackId, rangeHeader = null) {
    const url      = this.getAudioUrl(String(trackId));
    const reqHdrs  = rangeHeader ? { Range: rangeHeader } : {};
    const response = await fetch(url, { headers: reqHdrs });

    if (!response.ok && response.status !== 206) {
      const e = new Error(`R2 audio fetch failed [${response.status}]: ${trackId}`);
      e.status = response.status === 404 ? 404 : 502;
      throw e;
    }

    const resHeaders = { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' };
    const cl = response.headers.get('content-length');
    const cr = response.headers.get('content-range');
    if (cl) resHeaders['Content-Length'] = cl;
    if (cr) resHeaders['Content-Range']  = cr;

    return { stream: response.body, status: response.status, headers: resHeaders };
  }

  /**
   * @param {string} trackId
   * @param {Buffer} buffer
   * @param {string} [contentType]
   */
  async uploadAudio(trackId, buffer, contentType = 'audio/mpeg') {
    await this.#r2.request({ method: 'PUT', key: String(trackId), body: buffer, contentType });
  }

  async replaceAudio(trackId, buffer, contentType = 'audio/mpeg') {
    await this.uploadAudio(trackId, buffer, contentType);
  }

  /** @param {string} trackId */
  async deleteAudio(trackId) {
    await this.#r2.request({ method: 'DELETE', key: String(trackId) });
  }

  /**
   * @param {string} trackId
   * @returns {Promise<Buffer>}
   */
  async getAudioBuffer(trackId) {
    const url      = this.getAudioUrl(String(trackId));
    const response = await fetch(url);

    if (!response.ok) {
      const e = new Error(
        response.status === 404
          ? `Track not found in cloud: ${trackId}`
          : `R2 fetch failed [${response.status}]: ${trackId}`
      );
      e.status = response.status === 404 ? 404 : 502;
      e.name   = response.status === 404 ? 'NoSuchKey' : 'R2Error';
      throw e;
    }

    return Buffer.from(await response.arrayBuffer());
  }
}