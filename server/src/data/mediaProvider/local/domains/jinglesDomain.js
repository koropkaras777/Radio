import { MediaLibraryFiles } from './mediaLibraryFiles.js';

export class JinglesDomain {
  #files;

  constructor(jinglesDir) {
    this.#files = new MediaLibraryFiles(jinglesDir, 'Jingle');
  }

  getJingleUrl(mode, filename) {
    const params = new URLSearchParams({ mode: mode === 'night' ? 'night' : 'day', filename });
    return `/api/admin/jingles/file?${params}`;
  }

  getJingleFilePath(mode, filename) {
    return this.#files.filePath(mode, filename);
  }

  uploadJingle(mode, filename, buffer) {
    return this.#files.upload(mode, filename, buffer);
  }

  deleteJingle(mode, filename) {
    return this.#files.remove(mode, filename);
  }

  getJingleBuffer(mode, filename) {
    return this.#files.buffer(mode, filename);
  }

  getJingleReadStream(mode, filename, rangeHeader = null) {
    return this.#files.readStream(mode, filename, rangeHeader);
  }
}
