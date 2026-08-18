import fs from 'node:fs/promises';
import { createReadStream, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class MediaLibraryFiles {
  #root;
  #label;

  constructor(rootDir, label) {
    this.#root = rootDir;
    this.#label = label;
  }

  #safeMode(mode) {
    return mode === 'night' ? 'night' : 'day';
  }

  filePath(mode, filename) {
    const resolved = resolve(join(this.#root, this.#safeMode(mode), String(filename)));

    if (!resolved.startsWith(resolve(this.#root))) {
      const error = new Error(`Invalid ${this.#label} path`);
      error.status = 400;
      throw error;
    }

    return resolved;
  }

  async upload(mode, filename, buffer) {
    const target = this.filePath(mode, filename);
    await fs.mkdir(join(this.#root, this.#safeMode(mode)), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  async remove(mode, filename) {
    try {
      await fs.unlink(this.filePath(mode, filename));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async buffer(mode, filename) {
    try {
      return await fs.readFile(this.filePath(mode, filename));
    } catch (err) {
      if (err.code === 'ENOENT') {
        const error = new Error(`${this.#label} not found: ${mode}/${filename}`);
        error.status = 404;
        error.name = 'NoSuchKey';
        throw error;
      }
      throw err;
    }
  }

  readStream(mode, filename, rangeHeader = null) {
    const filePath = this.filePath(mode, filename);
    const total    = statSync(filePath).size;

    if (rangeHeader) {
      const [startStr, endStr] = String(rangeHeader).replace(/bytes=/, '').split('-');
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
}
