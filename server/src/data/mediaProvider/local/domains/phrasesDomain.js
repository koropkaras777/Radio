import { MediaLibraryFiles } from './mediaLibraryFiles.js';

export class PhrasesDomain {
  #files;

  constructor(phrasesDir) {
    this.#files = new MediaLibraryFiles(phrasesDir, 'Phrase');
  }

  getPhraseUrl(mode, filename) {
    const params = new URLSearchParams({ mode: mode === 'night' ? 'night' : 'day', filename });
    return `/api/admin/phrases/file?${params}`;
  }

  getPhraseFilePath(mode, filename) {
    return this.#files.filePath(mode, filename);
  }

  uploadPhrase(mode, filename, buffer) {
    return this.#files.upload(mode, filename, buffer);
  }

  deletePhrase(mode, filename) {
    return this.#files.remove(mode, filename);
  }

  getPhraseBuffer(mode, filename) {
    return this.#files.buffer(mode, filename);
  }

  getPhraseReadStream(mode, filename, rangeHeader = null) {
    return this.#files.readStream(mode, filename, rangeHeader);
  }
}
