import { MediaLibraryFiles } from './mediaLibraryFiles.js';

export class BackgroundMusicDomain {
  #files;

  constructor(backgroundDir) {
    this.#files = new MediaLibraryFiles(backgroundDir, 'Background music');
  }

  getBackgroundMusicUrl(mode, filename) {
    const params = new URLSearchParams({ mode: mode === 'night' ? 'night' : 'day', filename });
    return `/api/admin/background-music/file?${params}`;
  }

  getBackgroundMusicFilePath(mode, filename) {
    return this.#files.filePath(mode, filename);
  }

  uploadBackgroundMusic(mode, filename, buffer) {
    return this.#files.upload(mode, filename, buffer);
  }

  deleteBackgroundMusic(mode, filename) {
    return this.#files.remove(mode, filename);
  }

  getBackgroundMusicBuffer(mode, filename) {
    return this.#files.buffer(mode, filename);
  }

  getBackgroundMusicReadStream(mode, filename, rangeHeader = null) {
    return this.#files.readStream(mode, filename, rangeHeader);
  }
}
