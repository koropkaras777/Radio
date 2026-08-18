import { MediaLibraryStore } from '../shared/mediaLibraryStore.js';

export class JinglesDomain {
  #store;

  constructor(filePath) {
    this.#store = new MediaLibraryStore(filePath, {
      duplicateErrorKey: 'upload.jingleFilenameExists',
      kind: 'Jingle',
    });
  }

  loadJingles()                  { return this.#store.load(); }
  jingleFilenameExists(filename) { return this.#store.filenameExists(filename); }
  getJingleById(id)              { return this.#store.getById(id); }
  createJingle(input)            { return this.#store.create(input); }
  updateJingleUsed(id, used)     { return this.#store.setUsed(id, used); }
  moveJingleMode(id, targetMode) { return this.#store.moveMode(id, targetMode); }
  deleteJingle(id)               { return this.#store.remove(id); }
  deleteJingles(ids)             { return this.#store.removeMany(ids); }
  queryJingles(opts)             { return this.#store.query(opts); }
  getUsableJingles(mode)         { return this.#store.getUsable(mode); }
  countUsableJingles(mode)       { return this.#store.countUsable(mode); }
  importJingles(records)         { return this.#store.replaceAll(records); }
}
