import { R2Client } from './shared/R2Client.js';
import { MusicDomain } from './domains/musicDomain.js';
import { ArtsDomain } from './domains/artsDomain.js';
import { JinglesDomain } from './domains/jinglesDomain.js';
import { BackgroundMusicDomain } from './domains/backgroundMusicDomain.js';
import { PhrasesDomain } from './domains/phrasesDomain.js';

export class CloudProvider {
  /**
   * @param {{
   *   r2Endpoint:         string,
   *   r2Bucket:           string,
   *   r2AccessKeyId:      string,
   *   r2SecretAccessKey:  string,
   *   r2Region?:          string,
   *   r2PublicBaseUrl?:   string,
   *   presignTtlS?:       number,
   *   artsPrefix?:        string,
   *   jinglesPrefix?:     string,
   *   backgroundMusicPrefix?: string,
   *   phrasesPrefix?:     string,
   * }} options
   */
  constructor(options = {}) {
    this.publicBase = (options.r2PublicBaseUrl || '').replace(/\/+$/, '');
    this.isCloud = true;

    const r2 = new R2Client(options);

    this.music = new MusicDomain(r2);
    this.arts = new ArtsDomain(r2, options.artsPrefix || 'arts');
    this.jingles = new JinglesDomain(r2, options.jinglesPrefix || 'jingles');
    this.backgroundMusic = new BackgroundMusicDomain(r2, options.backgroundMusicPrefix || 'background');
    this.phrases = new PhrasesDomain(r2, options.phrasesPrefix || 'phrases');
  }

  // ── Music ────────────────────────────────────────────────────────────
  getAudioUrl(trackId)                          { return this.music.getAudioUrl(trackId); }
  getAudioReadStream(trackId, rangeHeader = null) { return this.music.getAudioReadStream(trackId, rangeHeader); }
  uploadAudio(trackId, buffer, contentType)     { return this.music.uploadAudio(trackId, buffer, contentType); }
  replaceAudio(trackId, buffer, contentType)    { return this.music.replaceAudio(trackId, buffer, contentType); }
  deleteAudio(trackId)                          { return this.music.deleteAudio(trackId); }
  getAudioBuffer(trackId)                       { return this.music.getAudioBuffer(trackId); }

  // ── Arts ─────────────────────────────────────────────────────────────
  getArtUrl(artistKey, artFileName)   { return this.arts.getArtUrl(artistKey, artFileName); }
  getArtBuffer(artistKey, artFileName) { return this.arts.getArtBuffer(artistKey, artFileName); }
  uploadArt(artistKey, buffer)        { return this.arts.uploadArt(artistKey, buffer); }
  deleteArt(artistKey)                { return this.arts.deleteArt(artistKey); }

  // ── Jingles ──────────────────────────────────────────────────────────
  getJingleUrl(mode, filename)                       { return this.jingles.getJingleUrl(mode, filename); }
  uploadJingle(mode, filename, buffer, contentType)  { return this.jingles.uploadJingle(mode, filename, buffer, contentType); }
  deleteJingle(mode, filename)                       { return this.jingles.deleteJingle(mode, filename); }
  getJingleBuffer(mode, filename)                    { return this.jingles.getJingleBuffer(mode, filename); }

  // ── Background music ─────────────────────────────────────────────────
  getBackgroundMusicUrl(mode, filename)                      { return this.backgroundMusic.getBackgroundMusicUrl(mode, filename); }
  uploadBackgroundMusic(mode, filename, buffer, contentType) { return this.backgroundMusic.uploadBackgroundMusic(mode, filename, buffer, contentType); }
  deleteBackgroundMusic(mode, filename)                      { return this.backgroundMusic.deleteBackgroundMusic(mode, filename); }
  getBackgroundMusicBuffer(mode, filename)                   { return this.backgroundMusic.getBackgroundMusicBuffer(mode, filename); }

  // ── Phrases ──────────────────────────────────────────────────────────
  getPhraseUrl(mode, filename)                       { return this.phrases.getPhraseUrl(mode, filename); }
  uploadPhrase(mode, filename, buffer, contentType)  { return this.phrases.uploadPhrase(mode, filename, buffer, contentType); }
  deletePhrase(mode, filename)                       { return this.phrases.deletePhrase(mode, filename); }
  getPhraseBuffer(mode, filename)                    { return this.phrases.getPhraseBuffer(mode, filename); }
}