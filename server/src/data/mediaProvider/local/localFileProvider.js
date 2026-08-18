import { join } from 'node:path';
import { MusicDomain } from './domains/musicDomain.js';
import { ArtsDomain } from './domains/artsDomain.js';
import { JinglesDomain } from './domains/jinglesDomain.js';
import { BackgroundMusicDomain } from './domains/backgroundMusicDomain.js';
import { PhrasesDomain } from './domains/phrasesDomain.js';

export class LocalFileProvider {
  constructor({ musicPath, artsPath, jinglesPath, backgroundMusicPath, phrasesPath }) {
    if (!musicPath) throw new Error('LocalFileProvider requires musicPath');

    this.musicPath           = musicPath;
    this.artsPath            = artsPath            || join(musicPath, '..', 'arts');
    this.jinglesPath         = jinglesPath         || join(musicPath, '..', 'jingles');
    this.backgroundMusicPath = backgroundMusicPath || join(musicPath, '..', 'background');
    this.phrasesPath         = phrasesPath         || join(musicPath, '..', 'phrases');
    this.isCloud             = false;

    this.music           = new MusicDomain(this.musicPath);
    this.arts            = new ArtsDomain(this.artsPath);
    this.jingles         = new JinglesDomain(this.jinglesPath);
    this.backgroundMusic = new BackgroundMusicDomain(this.backgroundMusicPath);
    this.phrases         = new PhrasesDomain(this.phrasesPath);
  }

  // ── Music ────────────────────────────────────────────────────────────
  getAudioUrl(trackId, tokens = {})                { return this.music.getAudioUrl(trackId, tokens); }
  getAudioReadStream(trackId, rangeHeader = null)  { return this.music.getAudioReadStream(trackId, rangeHeader); }
  uploadAudio(trackId, buffer, contentType)        { return this.music.uploadAudio(trackId, buffer, contentType); }
  replaceAudio(trackId, buffer, contentType)       { return this.music.replaceAudio(trackId, buffer, contentType); }
  deleteAudio(trackId)                             { return this.music.deleteAudio(trackId); }
  getAudioBuffer(trackId)                          { return this.music.getAudioBuffer(trackId); }
  getAudioFilePath(trackId)                        { return this.music.getAudioFilePath(trackId); }

  // ── Arts ─────────────────────────────────────────────────────────────
  getArtUrl(artistKey)                 { return this.arts.getArtUrl(artistKey); }
  getArtBuffer(artistKey, artFileName) { return this.arts.getArtBuffer(artistKey, artFileName); }
  uploadArt(artistKey, buffer)         { return this.arts.uploadArt(artistKey, buffer); }
  deleteArt(artistKey)                 { return this.arts.deleteArt(artistKey); }

  // ── Jingles ──────────────────────────────────────────────────────────
  getJingleUrl(mode, filename)                       { return this.jingles.getJingleUrl(mode, filename); }
  getJingleFilePath(mode, filename)                  { return this.jingles.getJingleFilePath(mode, filename); }
  uploadJingle(mode, filename, buffer, _contentType) { return this.jingles.uploadJingle(mode, filename, buffer); }
  deleteJingle(mode, filename)                       { return this.jingles.deleteJingle(mode, filename); }
  getJingleBuffer(mode, filename)                    { return this.jingles.getJingleBuffer(mode, filename); }
  getJingleReadStream(mode, filename, rangeHeader)   { return this.jingles.getJingleReadStream(mode, filename, rangeHeader); }

  // ── Background music ─────────────────────────────────────────────────
  getBackgroundMusicUrl(mode, filename)                       { return this.backgroundMusic.getBackgroundMusicUrl(mode, filename); }
  getBackgroundMusicFilePath(mode, filename)                  { return this.backgroundMusic.getBackgroundMusicFilePath(mode, filename); }
  uploadBackgroundMusic(mode, filename, buffer, _contentType) { return this.backgroundMusic.uploadBackgroundMusic(mode, filename, buffer); }
  deleteBackgroundMusic(mode, filename)                       { return this.backgroundMusic.deleteBackgroundMusic(mode, filename); }
  getBackgroundMusicBuffer(mode, filename)                    { return this.backgroundMusic.getBackgroundMusicBuffer(mode, filename); }
  getBackgroundMusicReadStream(mode, filename, rangeHeader)   { return this.backgroundMusic.getBackgroundMusicReadStream(mode, filename, rangeHeader); }

  // ── Phrases ──────────────────────────────────────────────────────────
  getPhraseUrl(mode, filename)                       { return this.phrases.getPhraseUrl(mode, filename); }
  getPhraseFilePath(mode, filename)                  { return this.phrases.getPhraseFilePath(mode, filename); }
  uploadPhrase(mode, filename, buffer, _contentType) { return this.phrases.uploadPhrase(mode, filename, buffer); }
  deletePhrase(mode, filename)                       { return this.phrases.deletePhrase(mode, filename); }
  getPhraseBuffer(mode, filename)                    { return this.phrases.getPhraseBuffer(mode, filename); }
  getPhraseReadStream(mode, filename, rangeHeader)   { return this.phrases.getPhraseReadStream(mode, filename, rangeHeader); }
}
