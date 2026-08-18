import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  #file;
  #fallback;
  #cache = null;
  #queue = Promise.resolve();

  constructor(file, fallback) {
    this.#file = file;
    this.#fallback = fallback;
  }

  get filePath() {
    return this.#file;
  }

  async read() {
    if (this.#cache !== null) return this.#cache;

    try {
      const raw = await fs.readFile(this.#file, 'utf8');
      this.#cache = JSON.parse(raw.replace(/^﻿/, ''));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[JsonStore] Failed to read ${path.basename(this.#file)}, starting empty:`, err.message);
      }
      this.#cache = structuredClone(this.#fallback);
    }

    return this.#cache;
  }

  async update(mutator) {
    const run = async () => {
      const current = await this.read();
      const { value, result } = await mutator(current);

      await fs.mkdir(path.dirname(this.#file), { recursive: true });
      const tmp = `${this.#file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
      await fs.rename(tmp, this.#file);

      this.#cache = value;
      return result;
    };

    const next = this.#queue.then(run, run);
    this.#queue = next.then(() => undefined, () => undefined);
    return next;
  }
}
