import { MediaLibraryStore } from '../shared/mediaLibraryStore.js';

export class PhrasesDomain {
  #store;

  constructor(filePath) {
    this.#store = new MediaLibraryStore(filePath, {
      duplicateErrorKey: 'upload.phraseFilenameExists',
      kind: 'Phrase',
    });
  }

  loadPhrases()                  { return this.#store.load(); }
  phraseFilenameExists(filename) { return this.#store.filenameExists(filename); }
  getPhraseById(id)              { return this.#store.getById(id); }
  createPhrase(input)            { return this.#store.create(input); }
  updatePhraseUsed(id, used)     { return this.#store.setUsed(id, used); }
  movePhraseMode(id, targetMode) { return this.#store.moveMode(id, targetMode); }
  deletePhrase(id)               { return this.#store.remove(id); }
  deletePhrases(ids)             { return this.#store.removeMany(ids); }
  queryPhrases(opts)             { return this.#store.query(opts); }
  getUsablePhrases(mode)         { return this.#store.getUsable(mode); }
  countUsablePhrases(mode)       { return this.#store.countUsable(mode); }
  importPhrases(records)         { return this.#store.replaceAll(records); }
}
