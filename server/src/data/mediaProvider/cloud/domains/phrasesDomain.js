export class PhrasesDomain {
  #r2;
  #prefix;

  constructor(r2Client, prefix = 'phrases') {
    this.#r2 = r2Client;
    this.#prefix = prefix;
  }

  getPhraseUrl(mode, filename) {
    return this.#r2.presign(`${this.#prefix}/${mode}/${filename}`);
  }

  async uploadPhrase(mode, filename, buffer, contentType = 'audio/mpeg') {
    await this.#r2.request({ method: 'PUT', key: `${this.#prefix}/${mode}/${filename}`, body: buffer, contentType });
  }

  async deletePhrase(mode, filename) {
    await this.#r2.request({ method: 'DELETE', key: `${this.#prefix}/${mode}/${filename}` });
  }

  async getPhraseBuffer(mode, filename) {
    const url      = this.getPhraseUrl(mode, filename);
    const response = await fetch(url);
    if (!response.ok) {
      const e = new Error(
        response.status === 404
          ? `Phrase not found in cloud: ${mode}/${filename}`
          : `R2 phrase fetch failed [${response.status}]: ${mode}/${filename}`
      );
      e.status = response.status === 404 ? 404 : 502;
      e.name   = response.status === 404 ? 'NoSuchKey' : 'R2Error';
      throw e;
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
