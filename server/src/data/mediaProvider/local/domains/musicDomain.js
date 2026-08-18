import { createReadStream, statSync } from 'node:fs';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class MusicDomain {
  #musicPath;

  constructor(musicPath) {
    this.#musicPath = musicPath;
  }

  getAudioUrl(trackId, tokens = {}) {
    const params = new URLSearchParams({ track: trackId });
    if (tokens.audioToken) params.set('audioToken', tokens.audioToken);
    return `/api/audio/stream?${params}`;
  }

  getAudioReadStream(trackId, rangeHeader = null) {
    const filePath = this.#resolveTrackPath(trackId);
    const total    = statSync(filePath).size;

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = Number.parseInt(startStr, 10);
      const end   = endStr ? Number.parseInt(endStr, 10) : total - 1;

      if (
        !Number.isFinite(start) || !Number.isFinite(end) ||
        start < 0 || end < start || start >= total || end >= total
      ) {
        const err = new Error('Range Not Satisfiable');
        err.status = 416;
        throw err;
      }

      return {
        stream : createReadStream(filePath, { start, end }),
        status : 206,
        headers: {
          'Content-Type'  : 'audio/mpeg',
          'Accept-Ranges' : 'bytes',
          'Content-Range' : `bytes ${start}-${end}/${total}`,
          'Content-Length': String(end - start + 1),
        },
      };
    }

    return {
      stream : createReadStream(filePath),
      status : 200,
      headers: {
        'Content-Type'  : 'audio/mpeg',
        'Accept-Ranges' : 'bytes',
        'Content-Length': String(total),
      },
    };
  }

  async uploadAudio(trackId, buffer, _contentType) {
    const filePath = this.#resolveTrackPath(trackId);
    const dir      = join(filePath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, buffer);
  }

  async replaceAudio(trackId, buffer, contentType) {
    await this.deleteAudio(trackId);
    await this.uploadAudio(trackId, buffer, contentType);
  }

  async deleteAudio(trackId) {
    const filePath = this.#resolveTrackPath(trackId);
    await unlink(filePath).catch(() => {});
  }

  async getAudioBuffer(trackId) {
    try {
      return await readFile(this.#resolveTrackPath(trackId));
    } catch {
      const e = new Error(`Track file not found locally: ${trackId}`);
      e.status = 404;
      throw e;
    }
  }

  getAudioFilePath(trackId) {
    return this.#resolveTrackPath(trackId);
  }

  #resolveTrackPath(trackId) {
    const resolved = join(this.#musicPath, String(trackId));
    if (!resolved.startsWith(this.#musicPath)) {
      const e = new Error('Invalid track path');
      e.status = 400;
      throw e;
    }
    return resolved;
  }
}