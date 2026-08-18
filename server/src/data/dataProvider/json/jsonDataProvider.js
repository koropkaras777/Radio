import path from 'node:path';
import { MetadataDomain } from './domains/metadataDomain.js';
import { LyricsDomain } from './domains/lyricsDomain.js';
import { LyricsOffsetsDomain } from './domains/lyricsOffsetsDomain.js';
import { ArtistArtsDomain } from './domains/artistArtsDomain.js';
import { SettingsDomain } from './domains/settingsDomain.js';
import { AdminsDomain } from './domains/adminsDomain.js';
import { JinglesDomain } from './domains/jinglesDomain.js';
import { BackgroundMusicDomain } from './domains/backgroundMusicDomain.js';
import { PhrasesDomain } from './domains/phrasesDomain.js';
import { BannedIpsDomain } from './domains/bannedIpsDomain.js';
import { AuditDomain } from './domains/auditDomain.js';
import { HistoryDomain } from './domains/historyDomain.js';
import { DonationSettingsDomain } from './domains/donationSettingsDomain.js';
import { DonationsDomain } from './domains/donationsDomain.js';

export class JsonDataProvider {
  constructor(options = {}) {
    this.rootDir = path.join(options.rootDir, 'data', 'json');

    if (!this.rootDir) {
      throw new Error('JsonDataProvider requires rootDir');
    }

    this.paths = {
      settings: path.join(this.rootDir, 'settings.json'),
      lyricsCache: path.join(this.rootDir, 'lyrics_cache.json'),
      lyricsOffsets: path.join(this.rootDir, 'lyrics_offset.json'),
      metadataCache: path.join(this.rootDir, 'metadata_cache.json'),
      artistArts: path.join(this.rootDir, 'artist_arts.json'),
      admins: path.join(this.rootDir, 'admins.json'),
      jingles: path.join(this.rootDir, 'jingles.json'),
      backgroundMusic: path.join(this.rootDir, 'background_music.json'),
      phrases: path.join(this.rootDir, 'phrases.json'),
      bannedIps: path.join(this.rootDir, 'banned_ips.json'),
      audit: path.join(this.rootDir, 'audit_log.json'),
      history: path.join(this.rootDir, 'play_history.json'),
      donationSettings: path.join(this.rootDir, 'donation_settings.json'),
      donations: path.join(this.rootDir, 'donations.json'),
    };

    this.metadata = new MetadataDomain(this.paths.metadataCache);
    this.lyrics = new LyricsDomain(this.paths.lyricsCache);
    this.offsets = new LyricsOffsetsDomain(this.paths.lyricsOffsets);
    this.artistArts = new ArtistArtsDomain(this.paths.artistArts);
    this.settings = new SettingsDomain(this.rootDir);
    this.admins = new AdminsDomain(this.paths.admins);
    this.jingles = new JinglesDomain(this.paths.jingles);
    this.backgroundMusic = new BackgroundMusicDomain(this.paths.backgroundMusic);
    this.phrases = new PhrasesDomain(this.paths.phrases);
    this.bannedIps = new BannedIpsDomain(this.paths.bannedIps);
    this.audit = new AuditDomain(this.paths.audit);
    this.history = new HistoryDomain(this.paths.history);
    this.donationSettings = new DonationSettingsDomain(this.paths.donationSettings);
    this.donations = new DonationsDomain(this.paths.donations);
  }

  // ── Jingles ──────────────────────────────────────────────────────────
  loadJingles()                  { return this.jingles.loadJingles(); }
  jingleFilenameExists(filename) { return this.jingles.jingleFilenameExists(filename); }
  getJingleById(id)              { return this.jingles.getJingleById(id); }
  createJingle(input)            { return this.jingles.createJingle(input); }
  updateJingleUsed(id, used)     { return this.jingles.updateJingleUsed(id, used); }
  moveJingleMode(id, targetMode) { return this.jingles.moveJingleMode(id, targetMode); }
  deleteJingle(id)               { return this.jingles.deleteJingle(id); }
  deleteJingles(ids)             { return this.jingles.deleteJingles(ids); }
  queryJingles(opts)             { return this.jingles.queryJingles(opts); }
  getUsableJingles(mode)         { return this.jingles.getUsableJingles(mode); }
  countUsableJingles(mode)       { return this.jingles.countUsableJingles(mode); }

  // ── Background music ─────────────────────────────────────────────────
  loadBackgroundMusic()                   { return this.backgroundMusic.loadBackgroundMusic(); }
  backgroundMusicFilenameExists(filename) { return this.backgroundMusic.backgroundMusicFilenameExists(filename); }
  getBackgroundMusicById(id)              { return this.backgroundMusic.getBackgroundMusicById(id); }
  createBackgroundMusic(input)            { return this.backgroundMusic.createBackgroundMusic(input); }
  updateBackgroundMusicUsed(id, used)     { return this.backgroundMusic.updateBackgroundMusicUsed(id, used); }
  moveBackgroundMusicMode(id, targetMode) { return this.backgroundMusic.moveBackgroundMusicMode(id, targetMode); }
  deleteBackgroundMusic(id)               { return this.backgroundMusic.deleteBackgroundMusic(id); }
  deleteBackgroundMusicBatch(ids)         { return this.backgroundMusic.deleteBackgroundMusicBatch(ids); }
  queryBackgroundMusic(opts)              { return this.backgroundMusic.queryBackgroundMusic(opts); }
  getUsableBackgroundMusic(mode)          { return this.backgroundMusic.getUsableBackgroundMusic(mode); }
  countUsableBackgroundMusic(mode)        { return this.backgroundMusic.countUsableBackgroundMusic(mode); }
  queryUsableBackgroundMusic(opts)        { return this.backgroundMusic.queryUsableBackgroundMusic(opts); }

  // ── Phrases ──────────────────────────────────────────────────────────
  loadPhrases()                  { return this.phrases.loadPhrases(); }
  phraseFilenameExists(filename) { return this.phrases.phraseFilenameExists(filename); }
  getPhraseById(id)              { return this.phrases.getPhraseById(id); }
  createPhrase(input)            { return this.phrases.createPhrase(input); }
  updatePhraseUsed(id, used)     { return this.phrases.updatePhraseUsed(id, used); }
  movePhraseMode(id, targetMode) { return this.phrases.movePhraseMode(id, targetMode); }
  deletePhrase(id)               { return this.phrases.deletePhrase(id); }
  deletePhrases(ids)             { return this.phrases.deletePhrases(ids); }
  queryPhrases(opts)             { return this.phrases.queryPhrases(opts); }
  getUsablePhrases(mode)         { return this.phrases.getUsablePhrases(mode); }
  countUsablePhrases(mode)       { return this.phrases.countUsablePhrases(mode); }

  // ── Banned IPs ───────────────────────────────────────────────────────
  loadBannedIps()      { return this.bannedIps.loadBannedIps(); }
  isIpBanned(ip)       { return this.bannedIps.isIpBanned(ip); }
  banIp(params)        { return this.bannedIps.banIp(params); }
  unbanIp(ip)          { return this.bannedIps.unbanIp(ip); }

  // ── Admins ───────────────────────────────────────────────────────────
  validatePassword(password)                                { return this.admins.validatePassword(password); }
  loadAdmins()                                              { return this.admins.loadAdmins(); }
  getAdminById(adminId)                                     { return this.admins.getAdminById(adminId); }
  getAdminByLogin(login)                                    { return this.admins.getAdminByLogin(login); }
  createAdmin(input)                                        { return this.admins.createAdmin(input); }
  updateAdminPrivileges(adminId, privileges)                { return this.admins.updateAdminPrivileges(adminId, privileges); }
  deleteAdmin(adminId)                                      { return this.admins.deleteAdmin(adminId); }
  activateAdmin(adminId, tempPassword, newPlainPassword)    { return this.admins.activateAdmin(adminId, tempPassword, newPlainPassword); }
  changeAdminLogin(adminId, newLogin, currentPlainPassword) { return this.admins.changeAdminLogin(adminId, newLogin, currentPlainPassword); }
  changeAdminPassword(adminId, currentPlainPassword, newPlainPassword) { return this.admins.changeAdminPassword(adminId, currentPlainPassword, newPlainPassword); }
  resetAdminPassword(adminId, newPlainPassword)             { return this.admins.resetAdminPassword(adminId, newPlainPassword); }
  purgeExpiredAdmins()                                      { return this.admins.purgeExpiredAdmins(); }

  // ── Tracks / metadata ────────────────────────────────────────────────
  loadMetadata()          { return this.metadata.loadMetadata(); }
  saveMetadata(metadata)  { return this.metadata.saveMetadata(metadata); }
  addTrack(track)         { return this.metadata.addTrack(track); }
  getTrackRowById(trackId) { return this.metadata.getTrackRowById(trackId); }
  getTrackIdByModeFilename(modeFilename) { return this.metadata.getTrackIdByModeFilename(modeFilename); }

  async updateTrackMetadataById(trackId, updates = {}) {
    const { track } = await this.metadata.updateTrackMetadataById(trackId, updates);
    return track;
  }

  async deleteTrackById(trackId) {
    const { deleted } = await this.metadata.deleteTrackById(trackId);
    return deleted;
  }

  // ── Lyrics ───────────────────────────────────────────────────────────
  loadLyricsCache()                              { return this.lyrics.loadLyricsCache(); }
  saveLyricsCache(cache)                         { return this.lyrics.saveLyricsCache(cache); }
  getLyrics(cache, title, artist)                { return this.lyrics.getLyrics(cache, title, artist); }
  setLyrics(cache, title, artist, entry)         { return this.lyrics.setLyrics(cache, title, artist, entry); }
  deleteLyrics(cache, title, artist)             { return this.lyrics.deleteLyrics(cache, title, artist); }
  upsertLyricsEntry(cache, title, artist, entry) { return this.lyrics.upsertLyricsEntry(cache, title, artist, entry); }
  deleteLyricsEntry(cache, title, artist)        { return this.lyrics.deleteLyricsEntry(cache, title, artist); }
  getLyricsCacheIndex(cache)                     { return this.lyrics.getLyricsCacheIndex(cache); }
  getLyricsSongsIndex(metadata, cache)           { return this.lyrics.getLyricsSongsIndex(metadata, cache); }

  // ── Lyrics offsets ───────────────────────────────────────────────────
  loadLyricsOffsets()                                 { return this.offsets.loadLyricsOffsets(); }
  saveLyricsOffsets(offsets)                          { return this.offsets.saveLyricsOffsets(offsets); }
  getLyricsOffset(offsets, title, artist)             { return this.offsets.getLyricsOffset(offsets, title, artist); }
  setLyricsOffset(offsets, title, artist, offset)     { return this.offsets.setLyricsOffset(offsets, title, artist, offset); }
  deleteLyricsOffset(offsets, title, artist)          { return this.offsets.deleteLyricsOffset(offsets, title, artist); }
  upsertLyricsOffset(offsets, title, artist, offset)  { return this.offsets.upsertLyricsOffset(offsets, title, artist, offset); }

  // ── Artist arts ──────────────────────────────────────────────────────
  loadArtistArts()              { return this.artistArts.loadArtistArts(); }
  saveArtistArts(items)         { return this.artistArts.saveArtistArts(items); }
  upsertArtistArt(item)         { return this.artistArts.upsertArtistArt(item); }
  deleteArtistArt(artist)       { return this.artistArts.deleteArtistArt(artist); }
  ensureArtistArtEntry(artist)  { return this.artistArts.ensureArtistArtEntry(artist); }

  // ── Settings ─────────────────────────────────────────────────────────
  loadSettings(defaults)              { return this.settings.loadSettings(defaults); }
  saveSettings(settings)              { return this.settings.saveSettings(settings); }
  getSongGroupsFromSettings(settings) { return this.settings.getSongGroupsFromSettings(settings); }

  // ── Donations ────────────────────────────────────────────────────────
  loadDonationSettings()          { return this.donationSettings.loadDonationSettings(); }
  saveDonationSettings(settings)  { return this.donationSettings.saveDonationSettings(settings); }
  createDonation(input)           { return this.donations.createDonation(input); }
  findDonationById(id)            { return this.donations.findById(id); }
  findDonationByProviderRef(ref)  { return this.donations.findByProviderRef(ref); }
  findDonationByMatchCode(code)   { return this.donations.findByMatchCode(code); }
  expirePendingDonationMatches(cutoff) { return this.donations.expirePendingMatches(cutoff); }
  markDonationStatus(id, status, extra) { return this.donations.markStatus(id, status, extra); }
  loadDonationHistory(opts)       { return this.donations.loadDonationHistory(opts); }
  listDonationCurrencies()        { return this.donations.listCurrencies(); }
  purgeDonations(cutoff)          { return this.donations.purgeDonations(cutoff); }

  // ── Bulk import (migration CLI only) ─────────────────────────────────
  loadAuditLog()                  { return this.audit.loadAuditLog(); }
  loadHistory()                   { return this.history.loadHistory(); }
  importJingles(records)          { return this.jingles.importJingles(records); }
  importBackgroundMusic(records)  { return this.backgroundMusic.importBackgroundMusic(records); }
  importPhrases(records)          { return this.phrases.importPhrases(records); }
  importBannedIps(records)        { return this.bannedIps.importBannedIps(records); }
  importAdmins(records)           { return this.admins.importAdmins(records); }
  importAuditLog(entries)         { return this.audit.importAuditLog(entries); }
  importHistory(entries)          { return this.history.importHistory(entries); }
}