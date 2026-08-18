import { MediaLibraryStore } from '../shared/mediaLibraryStore.js';

export class BackgroundMusicDomain {
  #store;

  constructor(filePath) {
    this.#store = new MediaLibraryStore(filePath, {
      duplicateErrorKey: 'upload.bgFilenameExists',
      kind: 'Background music',
    });
  }

  loadBackgroundMusic()                   { return this.#store.load(); }
  backgroundMusicFilenameExists(filename) { return this.#store.filenameExists(filename); }
  getBackgroundMusicById(id)              { return this.#store.getById(id); }
  createBackgroundMusic(input)            { return this.#store.create(input); }
  updateBackgroundMusicUsed(id, used)     { return this.#store.setUsed(id, used); }
  moveBackgroundMusicMode(id, targetMode) { return this.#store.moveMode(id, targetMode); }
  deleteBackgroundMusic(id)               { return this.#store.remove(id); }
  deleteBackgroundMusicBatch(ids)         { return this.#store.removeMany(ids); }
  queryBackgroundMusic(opts)              { return this.#store.query(opts); }
  getUsableBackgroundMusic(mode)          { return this.#store.getUsable(mode); }
  countUsableBackgroundMusic(mode)        { return this.#store.countUsable(mode); }
  queryUsableBackgroundMusic(opts)        { return this.#store.queryUsable(opts); }
  importBackgroundMusic(records)          { return this.#store.replaceAll(records); }
}
