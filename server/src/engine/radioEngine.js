import { NIGHT_MODE, TIME_ZONE, STREAM_MODE, DAY_START_HOUR, NIGHT_START_HOUR, CONFIRM_TRACK_CLEANUP } from '../config/env.js';
import { readdir } from 'fs/promises';
import { join, basename } from 'path';
import { parseFile } from 'music-metadata';
import {
  createDefaultSettings, sanitizeGroupDefs, sanitizeSongGroups,
  sanitizeRadioHostsSettings, DEFAULT_RADIO_HOSTS_SETTINGS,
  sanitizeArtistArtsSettings, DEFAULT_ARTIST_ARTS_SETTINGS,
  sanitizeBrandingSettings,
  DEFAULT_MAX_DAY_DURATION, DEFAULT_MAX_NIGHT_DURATION, DEFAULT_SONGS_PER_SECTION,
  PHRASES_MIN_TIME_S, PHRASES_MAX_TIME_S,
} from './radioSettings.js';
import {
  entryId, shuffleArray, localTimeParts,
  buildArtistIndices, resolveArtist, resolveGroup, foldForArtistMatch,
  getSongIdMode, getSongFilename, createDefaultSongGroupId,
  localizedText, makeLocalizedError,
} from './radioUtils.js';
import { t } from '../i18n/index.js';
import { buildSection, fixGroupRepeats, fixStitches, buildBalancedTrackOrder } from './playlistBuilder.js';
import { fetchLyricsForSong } from './lyricsService.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_DURATION              = 180;
const INJECT_COOLDOWN_S             = 30;
const SONG_GROUP_INJECT_COOLDOWN_S  = 10 * 60;
const TRACK_END_BUFFER_S            = 0.5;
const UNKNOWN_DURATION_MAX_S        = 10 * 60;
const MODE_SWITCH_COOLDOWN_MS       = 30 * 60 * 1000;
const MIN_QUEUE_DURATION_S          = 60 * 60;

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

// ─── RadioEngine ──────────────────────────────────────────────────────────────
export class RadioEngine {
  #radioStream = null;

  setRadioStream(radioStream) {
    this.#radioStream = radioStream;
  }

  constructor(musicPath, options = {}) {
    this.musicPath = musicPath;
    this.musicSource = options.musicSource || 'local';
    this.r2PublicBaseUrl = String(options.r2PublicBaseUrl || '').replace(/\/+$/, '');
    this.dataProvider = options.dataProvider || null;

    if (!this.dataProvider) {
      throw new Error('RadioEngine requires dataProvider');
    }

    this.dayStartHour   = DAY_START_HOUR;
    this.nightStartHour = NIGHT_START_HOUR;

    this.groupDefs = {};
    this.artistIndex = new Map();
    this.artistGroupIndex = new Map();
    this.nightGroupDefs = {};
    this.artistIndexNight = new Map();
    this.artistGroupIndexNight = new Map();
    this.settings = createDefaultSettings({
      groupDefs: {},
      maxDayDuration: DEFAULT_MAX_DAY_DURATION,
      maxNightDuration: DEFAULT_MAX_NIGHT_DURATION,
      songsPerSection: DEFAULT_SONGS_PER_SECTION,
      nightGroupDefs: {},
      nightSongsPerSection: DEFAULT_SONGS_PER_SECTION,
      songGroups: [],
    });
    this.songGroups = [];

    this.playlist             = [];
    this.currentIndex         = 0;
    this.startTime            = null;
    this.isPlaying            = false;
    this.currentTrack         = null;
    this.currentTrackDuration = null;

    this.trackMetadata       = new Map();
    this.fullLibraryMetadata = new Map();
    this.metadataCache       = { day: {}, night: {} };

    this.whisperCachePath   = join(musicPath, 'whisper_cache.json');
    this.lyricsCache        = new Map();
    this.lyricsOffsets      = new Map();
    this.whisperCache       = {};
    this.lyricsCacheTTL     = 30 * 24 * 60 * 60 * 1000;

    this.initialized       = false;
    this.currentMode       = null;
    this.pendingModeSwitch  = null;
    this.adminForcedMode        = null;
    this.adminForcedBoundaryTs  = null;
    this.lastAdminModeSwitchAt  = 0;
    this.isTransitioning        = false;
    this.minTrackPlayTime  = 5000;
    this.lastInjectTime         = 0;
    this.lastSongGroupInjectTime = 0;
    this.lastRemoveTime      = 0;
    this.lastSkipTime        = 0;
  }

  usesCloudMusic() {
    return this.musicSource === 'cloud';
  }

  getTrackPublicUrl(trackId) {
    if (!this.usesCloudMusic()) return null;
    if (!this.r2PublicBaseUrl) return null;
    return `${this.r2PublicBaseUrl}/${String(trackId).replace(/^\/+/, '')}`;
  }

  // ── Mode switching ──────────────────────────────────────────────────────────
  hasDonatedInQueue() {
    for (let i = this.currentIndex + 1; i < this.playlist.length; i++) {
      const entry = this.playlist[i];
      if (entry && typeof entry === 'object' &&
          (entry.orderType === 'donated' || entry.orderType === 'lastinline')) {
        return true;
      }
    }
    return false;
  }

  requestModeSwitch(targetMode, scheduledAtMs = null) {
    if (!NIGHT_MODE) {
      return { ok: false, error: t('radio.nightModeDisabled') };
    }

    const { hour } = localTimeParts(new Date());

    if (this.currentMode === targetMode) {
      return { ok: false, error: t('radio.modeAlreadyActive') };
    }

    if (this.pendingModeSwitch) {
      const secsLeft = Math.ceil((this.pendingModeSwitch.requestedAt + MODE_SWITCH_COOLDOWN_MS - Date.now()) / 1000);
      if (secsLeft > 0) {
        const mins = Math.ceil(secsLeft / 60);
        return { ok: false, error: t('radio.modeSwitchAlreadyScheduled', { mins }) };
      }
    }

    if (this.lastAdminModeSwitchAt && Date.now() - this.lastAdminModeSwitchAt < MODE_SWITCH_COOLDOWN_MS) {
      const secsLeft = Math.ceil((MODE_SWITCH_COOLDOWN_MS - (Date.now() - this.lastAdminModeSwitchAt)) / 1000);
      const mins = Math.ceil(secsLeft / 60);
      return { ok: false, error: t('radio.nextModeSwitchIn', { mins }) };
    }

    const nightLockHour = (this.nightStartHour - 1 + 24) % 24;
    const dayLockHour   = (this.dayStartHour   - 1 + 24) % 24;
    if (hour === nightLockHour || hour === dayLockHour) {
      const nextHour = (hour + 1) % 24;
      return { ok: false, error: t('radio.modeSwitchUnavailable', { hour, nextHour }) };
    }

    if (this.hasDonatedInQueue()) {
      return { ok: false, error: t('radio.cannotSwitchDonated'), donated: true };
    }

    this.pendingModeSwitch = { targetMode, requestedAt: Date.now(), executeAtMs: scheduledAtMs };
    if (scheduledAtMs) {
      const naturalBoundaryHour = targetMode === 'night' ? this.nightStartHour : this.dayStartHour;
      const naturalBoundaryMs   = this._getNextBoundaryTimestamp(naturalBoundaryHour);
      if (scheduledAtMs >= naturalBoundaryMs) {
        this.pendingModeSwitch = null;
        const pad = (n) => String(n).padStart(2, '0');
        const bh  = pad(naturalBoundaryHour);
        return { ok: false, error: t('radio.scheduledBeforeBoundary', { boundary: bh }) };
      }
      const execDate = new Date(scheduledAtMs);
      console.log(`[Radio] Mode switch to '${targetMode}' scheduled at ${execDate.toISOString()}`);
    } else {
      console.log(`[Radio] Mode switch to '${targetMode}' scheduled after current track`);
    }
    return { ok: true };
  }

  _getNaturalMode(date = new Date()) {
    if (!NIGHT_MODE) return 'day';

    const { hour } = localTimeParts(date);
    const n = this.nightStartHour;
    const d = this.dayStartHour;

    let isNight;
    if (n === d) {
      isNight = false;
    } else if (n < d) {
      isNight = hour >= n && hour < d;
    } else {
      isNight = hour >= n || hour < d;
    }

    return isNight ? 'night' : 'day';
  }

  _getNextBoundaryTimestamp(targetHour, fromDate = new Date()) {
    const localNow = new Date(fromDate.toLocaleString('en-US', { timeZone: TIME_ZONE }));
    const boundary = new Date(localNow);
    boundary.setHours(targetHour, 0, 0, 0);
    if (boundary.getTime() <= localNow.getTime()) {
      boundary.setDate(boundary.getDate() + 1);
    }
    const diffMs = boundary.getTime() - localNow.getTime();
    return fromDate.getTime() + diffMs;
  }

  _clearAdminForcedMode(reason = 'cleared') {
    if (this.adminForcedMode) {
      console.log(`[Radio] Admin forced mode '${this.adminForcedMode}' ${reason}`);
    }
    this.adminForcedMode = null;
    this.adminForcedBoundaryTs = null;
  }

  getDesiredMode() {
    const now = Date.now();
    const naturalMode = this._getNaturalMode();

    if (this.adminForcedMode) {
      if (this.adminForcedBoundaryTs && now >= this.adminForcedBoundaryTs) {
        this._clearAdminForcedMode(`expired at natural boundary`);
      } else {
        return this.adminForcedMode;
      }
    }

    return naturalMode;
  }

  getCurrentMode() { return this.currentMode; }

  _buildSongStatItem(folder, file, meta) {
    return {
      file    : `${folder}/${file}`,
      title   : meta.title    || file,
      album   : meta.album    || '',
      year    : meta.year     || null,
      duration: meta.duration || 0,
    };
  }

  _finalizeArtistStats(rawStats, displayNames) {
    for (const songs of Object.values(rawStats)) {
      songs.sort((a, b) => a.title.localeCompare(b.title));
    }

    const namedStats = {};
    for (const key of Object.keys(rawStats)) {
      namedStats[displayNames[key]] = rawStats[key];
    }
    return namedStats;
  }

  _buildArtistStatsForFolder(folder) {
    const rawStats = {};
    const displayNames = {};
    const cache = this.metadataCache[folder] || {};

    for (const [file, meta] of Object.entries(cache)) {
      const rawArtist = meta.artist || 'Unknown Artist';
      const artistKey = rawArtist.toLowerCase();

      if (!displayNames[artistKey]) displayNames[artistKey] = rawArtist;
      if (!rawStats[artistKey]) rawStats[artistKey] = [];

      rawStats[artistKey].push(this._buildSongStatItem(folder, file, meta));
    }

    return this._finalizeArtistStats(rawStats, displayNames);
  }

  _resolveGroupKey(file, mode = 'day') {
    const folded = foldForArtistMatch(file);
    const artistGroupIndex = this._getArtistGroupIndexForMode(mode);
    for (const [artistKey, groupKey] of artistGroupIndex.entries()) {
      if (folded.includes(artistKey)) return groupKey;
    }
    const groupDefs = this._getGroupDefsForMode(mode);
    return Object.keys(groupDefs).at(-1) || 'D2';
  }

  getGenreStats(mode = 'day') {
    const groupDefs = this._getGroupDefsForMode(mode);
    const groupStats = Object.fromEntries(
      Object.keys(groupDefs).map((groupKey) => [groupKey, {}])
    );
    const displayNamesByGroup = Object.fromEntries(
      Object.keys(groupDefs).map((groupKey) => [groupKey, {}])
    );

    for (const [file, meta] of Object.entries(this.metadataCache[mode] || {})) {
      const groupKey = this._resolveGroupKey(file, mode);
      const rawArtist = meta.artist || 'Unknown Artist';
      const artistKey = rawArtist.toLowerCase();

      if (!groupStats[groupKey]) groupStats[groupKey] = {};
      if (!displayNamesByGroup[groupKey]) displayNamesByGroup[groupKey] = {};

      if (!displayNamesByGroup[groupKey][artistKey]) {
        displayNamesByGroup[groupKey][artistKey] = rawArtist;
      }
      if (!groupStats[groupKey][artistKey]) groupStats[groupKey][artistKey] = [];

      groupStats[groupKey][artistKey].push(this._buildSongStatItem(mode, file, meta));
    }

    const finalized = {};
    for (const groupKey of Object.keys(groupStats)) {
      finalized[groupKey] = this._finalizeArtistStats(groupStats[groupKey], displayNamesByGroup[groupKey]);
    }

    return finalized;
  }

  getAdminStats() {
    return {
      day        : this._buildArtistStatsForFolder('day'),
      night      : this._buildArtistStatsForFolder('night'),
      genres     : this.getGenreStats('day'),
      nightGenres: this.getGenreStats('night'),
    };
  }

  _getFolderSongs(folder) {
    return Object.entries(this.metadataCache[folder] || {})
      .filter(([file]) => file.toLowerCase().endsWith('.mp3'));
  }
  
  getLockedTrackIds() {
    const currentId = this.currentTrack ? entryId(this.currentTrack) : null;
    const nextEntry = this.playlist.length > 1 ? this.playlist[(this.currentIndex + 1) % this.playlist.length] : null;
    const nextId = nextEntry ? entryId(nextEntry) : null;
    return {
      current: currentId,
      next: nextId && nextId !== currentId ? nextId : null,
      items: [currentId, nextId].filter(Boolean),
    };
  }

  getTrackEditLock(trackId) {
    const locks = this.getLockedTrackIds();
    if (trackId && locks.current === trackId) {
      return {
        locked: true,
        reason: localizedText('radio.currentlyPlaying'),
      };
    }
    if (trackId && locks.next === trackId) {
      return {
        locked: true,
        reason: localizedText('radio.playsNext'),
      };
    }
    return { locked: false, reason: null };
  }

  _rekeyLyricsAndOffsets(oldMeta, newMeta) {
    const oldTitle = String(oldMeta?.title || '');
    const oldArtist = String(oldMeta?.artist || '');
    const newTitle = String(newMeta?.title || '');
    const newArtist = String(newMeta?.artist || '');

    if (!oldTitle || !oldArtist || !newTitle || !newArtist) return;
    if (oldTitle === newTitle && oldArtist === newArtist) return;

    const oldLyricsKey = `${oldArtist.toLowerCase()}||${oldTitle.toLowerCase()}`;
    const newLyricsKey = `${newArtist.toLowerCase()}||${newTitle.toLowerCase()}`;

    if (this.lyricsCache.has(oldLyricsKey)) {
      const entry = this.lyricsCache.get(oldLyricsKey);
      this.lyricsCache.delete(oldLyricsKey);
      this.lyricsCache.set(newLyricsKey, entry);
    }

    if (this.lyricsOffsets.has(oldLyricsKey)) {
      const value = this.lyricsOffsets.get(oldLyricsKey);
      this.lyricsOffsets.delete(oldLyricsKey);
      this.lyricsOffsets.set(newLyricsKey, value);
    }
  }

  async updateTrackMetadata(trackId, updates = {}) {
    if (!this.dataProvider || typeof this.dataProvider.updateTrackMetadataById !== 'function') {
      throw new Error('The configured data provider cannot edit track metadata');
    }

    const existingMeta = this.fullLibraryMetadata.get(String(trackId));
    if (!existingMeta) {
      throw new Error('Track not found');
    }

    const lock = this.getTrackEditLock(String(trackId));
    if (lock.locked) {
      const err = new Error(lock.reason?.uk || lock.reason?.ua || 'Track is locked');
      err.localized = lock.reason;
      throw err;
    }

    const updated = await this.dataProvider.updateTrackMetadataById(this.dataProvider.getTrackIdByModeFilename(String(trackId)), updates);
    const nextId = `${updated.mode}/${updated.filename}`;

    if (existingMeta.mode && this.metadataCache[existingMeta.mode]) {
      delete this.metadataCache[existingMeta.mode][existingMeta.filename];
    }
    if (!this.metadataCache[updated.mode]) this.metadataCache[updated.mode] = {};
    this.metadataCache[updated.mode][updated.filename] = { ...updated };

    this._rekeyLyricsAndOffsets(existingMeta, updated);

    this.playlist = this.playlist.map((entry) => {
      const songId = entryId(entry);
      if (songId !== String(trackId)) return entry;
      return typeof entry === 'object' ? { ...entry, id: nextId } : nextId;
    });

    if (this.currentTrack === String(trackId)) {
      this.currentTrack = nextId;
      this.currentTrackDuration = updated.duration || this.currentTrackDuration;
    }

    if (this.trackMetadata.has(String(trackId))) {
      this.trackMetadata.delete(String(trackId));
      this.trackMetadata.set(nextId, { ...updated });
    }

    this.fullLibraryMetadata.delete(String(trackId));
    this.fullLibraryMetadata.set(nextId, { ...updated });
    this._buildMetadataMaps();

    return { ...updated, id: nextId };
  }

  async deleteTrack(trackId) {
    if (!this.dataProvider || typeof this.dataProvider.deleteTrackById !== 'function') {
      throw new Error('The configured data provider cannot delete tracks');
    }

    const existingMeta = this.fullLibraryMetadata.get(String(trackId));
    if (!existingMeta) {
      console.warn(
        `[RadioEngine] deleteTrack: "${trackId}" not found in fullLibraryMetadata ` +
        `(size: ${this.fullLibraryMetadata.size}). ` +
        `Sample keys: ${[...this.fullLibraryMetadata.keys()].slice(0, 5).join(', ')}`
      );
      const err = new Error(`Track not found: ${trackId}`);
      err.code = 'TRACK_NOT_FOUND';
      throw err;
    }

    const lock = this.getTrackEditLock(String(trackId));
    if (lock.locked) {
      const err = new Error(lock.reason?.uk || lock.reason?.ua || 'Track is locked');
      err.localized = lock.reason;
      throw err;
    }

    const removedFromQueue = this.playlist.filter((entry) => entryId(entry) === String(trackId)).length;
    const removedCurrent = this.currentTrack === String(trackId);

    this.playlist = this.playlist.filter((entry) => entryId(entry) !== String(trackId));
    if (this.currentIndex >= this.playlist.length) {
      this.currentIndex = Math.max(0, this.playlist.length - 1);
    }

    this.fullLibraryMetadata.delete(String(trackId));
    if (existingMeta.mode && this.metadataCache[existingMeta.mode]) {
      delete this.metadataCache[existingMeta.mode][existingMeta.filename];
    }
    this.trackMetadata.delete(String(trackId));

    this.deleteLyrics(existingMeta.title, existingMeta.artist);
    this.deleteLyricsOffset(existingMeta.title, existingMeta.artist);

    await this.dataProvider.deleteTrackById(this.dataProvider.getTrackIdByModeFilename(String(trackId)));

    if (removedCurrent) {
      this.isPlaying = false;
      this.currentTrack = null;
      this.currentTrackDuration = null;
      this.startTime = null;
      if (this.playlist.length) {
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        await this.nextTrack(true);
      }
    } else {
      this._buildMetadataMaps();
    }

    return { removedFromQueue, removedCurrent };
  }

  _getAvailableSongFiles(folder) {
    return Object.keys(this.metadataCache[folder] || {})
      .filter((file) => file.toLowerCase().endsWith('.mp3'));
  }

  _getAvailableSongIds(folder) {
    return this._getAvailableSongFiles(folder).map((file) => `${folder}/${file}`);
  }

  _getSongMetaByFile(folder, file) {
    return this.metadataCache[folder]?.[file] || null;
  }

  async _generateSimplePlaylist(folder, maxDuration, useAllSongs = false, artistIndex = this.artistIndex) {
    console.log(`[Radio] Generating simple playlist for ${folder}…`);

    const sourceSongs = shuffleArray([...this._getAvailableSongFiles(folder)]);
    const totalLibraryDuration = sourceSongs.reduce((sum, file) => {
      const meta = this._getSongMetaByFile(folder, file);
      return sum + (meta?.duration || DEFAULT_DURATION);
    }, 0);

    if (!sourceSongs.length) {
      this.playlist = [];
      console.warn(`[Radio] No songs found in metadata cache for folder "${folder}"`);
      return;
    }

    if (!useAllSongs && totalLibraryDuration < MIN_QUEUE_DURATION_S) {
      throw makeLocalizedError(
        'settings.libraryTooSmall',
        { folder: folder === 'day' ? { uk: 'денній', en: 'day' } : { uk: 'нічній', en: 'night' } },
        'LIBRARY_TOO_SMALL'
      );
    }

    const limitDuration = useAllSongs ? totalLibraryDuration : Math.min(maxDuration, totalLibraryDuration);

    const playlist = [];
    let totalDuration = 0;
    let prevArtist = null;

    for (const file of sourceSongs) {
      const meta = this._getSongMetaByFile(folder, file);
      const artist = (meta?.artist || resolveArtist(file, artistIndex) || 'Unknown Artist').trim();
      const duration = meta?.duration || DEFAULT_DURATION;

      if (artist === prevArtist) continue;
      if (!useAllSongs && totalDuration + duration > limitDuration) continue;

      playlist.push(`${folder}/${file}`);
      totalDuration += duration;
      prevArtist = artist;
    }

    if (playlist.length < sourceSongs.length) {
      const inPlaylist = new Set(playlist);
      for (const file of sourceSongs) {
        const songId = `${folder}/${file}`;
        if (inPlaylist.has(songId)) continue;

        const meta = this._getSongMetaByFile(folder, file);
        const duration = meta?.duration || DEFAULT_DURATION;

        if (!useAllSongs && totalDuration + duration > limitDuration) continue;

        playlist.push(songId);
        totalDuration += duration;

        if (!useAllSongs && totalDuration >= limitDuration) break;
      }
    }

    this.playlist = playlist;
    this.currentIndex = 0;

    console.log(
      `[Radio] Simple ${folder} playlist ready - ${(totalDuration / 3600).toFixed(2)}h, ${this.playlist.length} tracks`
    );
  }

  _buildDefaultSettings() {
    return createDefaultSettings({
      groupDefs: sanitizeGroupDefs(this.groupDefs),
      maxDayDuration: DEFAULT_MAX_DAY_DURATION,
      maxNightDuration: DEFAULT_MAX_NIGHT_DURATION,
      songsPerSection: DEFAULT_SONGS_PER_SECTION,
      nightGroupDefs: sanitizeGroupDefs(this.nightGroupDefs),
      nightSongsPerSection: DEFAULT_SONGS_PER_SECTION,
      songGroups: [],
    });
  }

  _getBrandingSettings(settings = this.settings) {
    const defaults = this._buildDefaultSettings();
    return sanitizeBrandingSettings(settings?.branding, defaults.branding);
  }

  // ── Radio hosts (RADIO_HOSTS_MODE) ────────────────────────────
  _getRadioHostsSettings(settings = this.settings) {
    return sanitizeRadioHostsSettings(settings?.radioHosts, this.settings?.radioHosts || DEFAULT_RADIO_HOSTS_SETTINGS);
  }

  // ── Artist arts (day/night display toggles) ────────────────────
  _getArtistArtsSettings(settings = this.settings) {
    return sanitizeArtistArtsSettings(settings?.artistArts, this.settings?.artistArts || DEFAULT_ARTIST_ARTS_SETTINGS);
  }

  getPublicUiSettings() {
    return { ...this._getBrandingSettings(), artistArts: this._getArtistArtsSettings() };
  }

  _getTotalDurationForMode(mode) {
    return Object.values(this.metadataCache[mode] || {}).reduce((sum, meta) => sum + (meta.duration || 0), 0);
  }

  _getMinLibraryDuration() {
    let min = null;
    for (const bucket of Object.values(this.metadataCache || {})) {
      for (const meta of Object.values(bucket || {})) {
        const duration = Number(meta?.duration);
        if (Number.isFinite(duration) && duration > 0 && (min == null || duration < min)) min = duration;
      }
    }
    return min;
  }

  _getPhrasesTimeSecondsBounds() {
    const minLibraryDuration = this._getMinLibraryDuration();
    const cappedMax = minLibraryDuration == null
      ? PHRASES_MAX_TIME_S
      : Math.max(PHRASES_MIN_TIME_S, Math.min(PHRASES_MAX_TIME_S, Math.floor(minLibraryDuration)));
    return { min: PHRASES_MIN_TIME_S, max: cappedMax };
  }

  _getValidSongIdsForMode(mode) {
    return new Set(
      Object.keys(this.metadataCache[mode] || {}).map((filename) => `${mode}/${filename}`)
    );
  }

  _getGroupDefsForMode(mode = 'day') {
    return mode === 'night' ? this.nightGroupDefs : this.groupDefs;
  }

  _getArtistGroupIndexForMode(mode = 'day') {
    return mode === 'night' ? this.artistGroupIndexNight : this.artistGroupIndex;
  }

  _getArtistIndexForMode(mode = 'day') {
    return mode === 'night' ? this.artistIndexNight : this.artistIndex;
  }

  _getSectionAlgorithmStatus(groupDefs, mode = 'day') {
    if (!groupDefs) groupDefs = this._getGroupDefsForMode(mode);
    const eligibleGroups = Object.values(this.getGroupSongCounts(groupDefs, mode)).filter((count) => count > 0);
    if (eligibleGroups.length < 2) {
      return {
        canUse: false,
        reason: t('settings.needTwoGroups'),
      };
    }
    return { canUse: true, reason: null };
  }

  _getGroupSectionsAlgorithmStatus(groupDefs, mode = 'day') {
    if (!groupDefs) groupDefs = this._getGroupDefsForMode(mode);
    const counts = this.getGroupSongCounts(groupDefs, mode);
    const nonEmptyGroups = Object.entries(counts).filter(([, c]) => c > 0);
    if (nonEmptyGroups.length < 2) {
      return {
        canUse: false,
        reason: t('settings.needTwoGenreGroups'),
      };
    }
    const minGroupCount = Math.min(...nonEmptyGroups.map(([, c]) => c));
    const totalSections = minGroupCount * nonEmptyGroups.length;
    const avgDuration = this._getAverageSongDuration(mode);
    const maxPossibleDuration = totalSections * avgDuration;
    if (maxPossibleDuration < MIN_QUEUE_DURATION_S) {
      return {
        canUse: false,
        reason: t('settings.notEnoughSongsDuration', { minutes: Math.round(maxPossibleDuration / 60) }),
      };
    }
    return { canUse: true, reason: null, minGroupCount, groupCount: nonEmptyGroups.length, maxPossibleDuration };
  }

  _getAverageSongDuration(folder) {
    const songs = Object.values(this.metadataCache[folder] || {});
    if (!songs.length) return DEFAULT_DURATION;
    return songs.reduce((sum, m) => sum + (m.duration || DEFAULT_DURATION), 0) / songs.length;
  }

  _getGroupSectionsMaxDuration(groupDefs, mode = 'day') {
    if (!groupDefs) groupDefs = this._getGroupDefsForMode(mode);
    const status = this._getGroupSectionsAlgorithmStatus(groupDefs, mode);
    if (!status.canUse) return MIN_QUEUE_DURATION_S;
    return Math.max(MIN_QUEUE_DURATION_S, Math.floor(status.maxPossibleDuration));
  }

  getGroupSongCounts(groupDefs, mode = 'day') {
    if (!groupDefs) groupDefs = this._getGroupDefsForMode(mode);
    const cachedGroupDefs = this._getGroupDefsForMode(mode);
    const cachedArtistGroupIndex = this._getArtistGroupIndexForMode(mode);
    const artistGroupIndex = groupDefs === cachedGroupDefs
      ? cachedArtistGroupIndex
      : buildArtistIndices(groupDefs).artistGroupIndex;
    const counts = Object.fromEntries(Object.keys(groupDefs).map((g) => [g, 0]));
    const fallbackGroup = Object.keys(groupDefs).at(-1) || 'D2';
    for (const file of Object.keys(this.metadataCache[mode] || {})) {
      const group = resolveGroup(file, artistGroupIndex, fallbackGroup);
      counts[group] = (counts[group] || 0) + 1;
    }
    return counts;
  }

  _getSongsPerSectionBounds(groupDefs, mode = 'day') {
    if (!groupDefs) groupDefs = this._getGroupDefsForMode(mode);
    const groupCounts = this.getGroupSongCounts(groupDefs, mode);
    const groupNames = Object.keys(groupDefs);
    const min = Math.max(groupNames.length, 1);
    const nonEmptyCounts = Object.values(groupCounts).filter((count) => count > 0);
    const max = nonEmptyCounts.length ? Math.max(min, Math.min(...nonEmptyCounts)) : min;
    return { min, max };
  }

  async loadSettings() {
    const defaults = this._buildDefaultSettings();
    const loaded = await this.dataProvider.loadSettings(defaults);
    this.applySettings(loaded);
    return this.getSettingsPayload();
  }

  applySettings(settings) {
    const sanitizedGroupDefs = sanitizeGroupDefs(settings?.generation?.GROUP_DEFS, {});
    const sanitizedNightGroupDefs = sanitizeGroupDefs(settings?.generation?.NIGHT_GROUP_DEFS, {});
    const sanitizedSongGroups = sanitizeSongGroups(settings?.songGroups, []);
    this.groupDefs = sanitizedGroupDefs;
    const { artistIndex, artistGroupIndex } = buildArtistIndices(this.groupDefs);
    this.artistIndex = artistIndex;
    this.artistGroupIndex = artistGroupIndex;

    this.nightGroupDefs = sanitizedNightGroupDefs;
    const { artistIndex: artistIndexNight, artistGroupIndex: artistGroupIndexNight } = buildArtistIndices(this.nightGroupDefs);
    this.artistIndexNight = artistIndexNight;
    this.artistGroupIndexNight = artistGroupIndexNight;

    const defaults = this._buildDefaultSettings();
    this.settings = {
      ...defaults,
      ...(settings || {}),
      generation: {
        ...defaults.generation,
        ...(settings?.generation || {}),
        GROUP_DEFS: sanitizedGroupDefs,
        NIGHT_GROUP_DEFS: sanitizedNightGroupDefs,
      },
      radioHosts: sanitizeRadioHostsSettings(settings?.radioHosts, defaults.radioHosts),
      artistArts: sanitizeArtistArtsSettings(settings?.artistArts, defaults.artistArts),
      songGroups: sanitizedSongGroups,
    };
    this.songGroups = sanitizedSongGroups;
  }

  getSettingsPayload() {
    const totalDayDuration = this._getTotalDurationForMode('day');
    const totalNightDuration = this._getTotalDurationForMode('night');
    const dayAlgorithmStatus = this._getSectionAlgorithmStatus(this.groupDefs, 'day');
    const groupSectionsAlgorithmStatus = this._getGroupSectionsAlgorithmStatus(this.groupDefs, 'day');
    const nightAlgorithmStatus = this._getSectionAlgorithmStatus(this.nightGroupDefs, 'night');
    const nightGroupSectionsAlgorithmStatus = this._getGroupSectionsAlgorithmStatus(this.nightGroupDefs, 'night');
    const useGroupSections = Boolean(this.settings?.generation?.GROUP_SECTIONS_ALGORYTM);
    const useNightGroupSections = Boolean(this.settings?.generation?.NIGHT_GROUP_SECTIONS_ALGORYTM);
    const maxDayDuration = useGroupSections
      ? this._getGroupSectionsMaxDuration(this.groupDefs, 'day')
      : Math.max(MIN_QUEUE_DURATION_S, Math.floor(totalDayDuration));
    const maxNightDuration = useNightGroupSections
      ? this._getGroupSectionsMaxDuration(this.nightGroupDefs, 'night')
      : Math.max(MIN_QUEUE_DURATION_S, Math.floor(totalNightDuration));
    return {
      settings: this.settings,
      bounds: {
        totalDayDuration,
        totalNightDuration,
        MAX_DAY_DURATION: { min: MIN_QUEUE_DURATION_S, max: maxDayDuration },
        MAX_NIGHT_DURATION: { min: MIN_QUEUE_DURATION_S, max: maxNightDuration },
        SONGS_PER_SECTION: this._getSongsPerSectionBounds(this.groupDefs, 'day'),
        NIGHT_SONGS_PER_SECTION: this._getSongsPerSectionBounds(this.nightGroupDefs, 'night'),
        PHRASES_TIME_SECONDS: this._getPhrasesTimeSecondsBounds(),
        groupSongCounts: this.getGroupSongCounts(this.groupDefs, 'day'),
        nightGroupSongCounts: this.getGroupSongCounts(this.nightGroupDefs, 'night'),
        dayAlgorithmStatus,
        groupSectionsAlgorithmStatus,
        nightAlgorithmStatus,
        nightGroupSectionsAlgorithmStatus,
      },
      songGroups: this.getSongGroups(),
      insertCooldownSecsLeft: this.getSongGroupInsertCooldownSecsLeft(),
    };
  }

  _validateSongGroup(group, existingId = null) {
    const name = String(group?.name || '').trim();
    if (!name) {
      const error = new Error('Song group name is required');
      error.localized = t('songGroups.nameRequired');
      throw error;
    }

    const mode = group?.mode === 'night' ? 'night' : group?.mode === 'day' ? 'day' : null;
    if (!mode) {
      const error = new Error('Song group mode is invalid');
      error.localized = t('songGroups.modeRequired');
      throw error;
    }

    const songs = Array.isArray(group?.songs)
      ? [...new Set(group.songs.map((songId) => String(songId || '').trim()).filter(Boolean))]
      : [];

    if (!songs.length) {
      const error = new Error('Song group must contain at least one song');
      error.localized = t('songGroups.needAtLeastOneSong');
      throw error;
    }

    const validIds = this._getValidSongIdsForMode(mode);
    songs.forEach((songId) => {
      if (!validIds.has(songId)) {
        const error = new Error('Song group contains invalid song');
        error.localized = t('songGroups.invalidSong');
        throw error;
      }
    });

    const duplicate = this.songGroups.find((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== existingId);
    if (duplicate) {
      const error = new Error('Song group name already exists');
      error.localized = t('songGroups.nameExists');
      throw error;
    }

    return {
      id: existingId || createDefaultSongGroupId(),
      name,
      mode,
      songs,
    };
  }

  _validateSettings(nextSettings) {
    const merged = {
      ...this.settings,
      ...(nextSettings || {}),
      generation: {
        ...this.settings.generation,
        ...(nextSettings?.generation || {}),
      },
      songGroups: this.songGroups,
    };
    
    merged.generation.GROUP_DEFS = sanitizeGroupDefs(merged.generation.GROUP_DEFS, {});
    merged.generation.NIGHT_GROUP_DEFS = sanitizeGroupDefs(merged.generation.NIGHT_GROUP_DEFS, {});
    merged.branding = this._getBrandingSettings(merged);
    merged.artistArts = sanitizeArtistArtsSettings(nextSettings?.artistArts, this._getArtistArtsSettings());

    const RADIO_HOSTS_MIN_MINUTES = 1;
    const RADIO_HOSTS_MAX_MINUTES = 240;
    const rawRadioHosts = nextSettings?.radioHosts || this._getRadioHostsSettings();
    const guestMinutes = Number(rawRadioHosts.guestMaxDurationMinutes);
    if (!Number.isFinite(guestMinutes) || guestMinutes < RADIO_HOSTS_MIN_MINUTES || guestMinutes > RADIO_HOSTS_MAX_MINUTES) {
      const error = new Error('Invalid guestMaxDurationMinutes');
      error.localized = t('settings.guestMaxDuration', { min: RADIO_HOSTS_MIN_MINUTES, max: RADIO_HOSTS_MAX_MINUTES });
      throw error;
    }
    const specialGuestMinutes = Number(rawRadioHosts.specialGuestMaxDurationMinutes);
    if (!Number.isFinite(specialGuestMinutes) || specialGuestMinutes < RADIO_HOSTS_MIN_MINUTES || specialGuestMinutes > RADIO_HOSTS_MAX_MINUTES) {
      const error = new Error('Invalid specialGuestMaxDurationMinutes');
      error.localized = t('settings.specialGuestMaxDuration', { min: RADIO_HOSTS_MIN_MINUTES, max: RADIO_HOSTS_MAX_MINUTES });
      throw error;
    }
    const BACKGROUND_MUSIC_MODES = ['random', 'hostChoice'];
    const rawBackgroundMusicMode = rawRadioHosts.backgroundMusicMode;
    if (!BACKGROUND_MUSIC_MODES.includes(rawBackgroundMusicMode)) {
      const error = new Error('Invalid backgroundMusicMode');
      error.localized = t('settings.backgroundMusicMode');
      throw error;
    }
    merged.radioHosts = {
      guestMaxDurationMinutes: Math.round(guestMinutes),
      specialGuestMaxDurationMinutes: Math.round(specialGuestMinutes),
      backgroundMusicMode: rawBackgroundMusicMode,
    };

    merged.generation.DAY_ALGORYTM = Boolean(merged.generation.DAY_ALGORYTM);
    merged.generation.GROUP_SECTIONS_ALGORYTM = Boolean(merged.generation.GROUP_SECTIONS_ALGORYTM);
    if (merged.generation.DAY_ALGORYTM && merged.generation.GROUP_SECTIONS_ALGORYTM) {
      merged.generation.DAY_ALGORYTM = false;
    }

    merged.generation.NIGHT_ALGORYTM = Boolean(merged.generation.NIGHT_ALGORYTM);
    merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM = Boolean(merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM);
    if (merged.generation.NIGHT_ALGORYTM && merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM) {
      merged.generation.NIGHT_ALGORYTM = false;
    }

    const totalDayDuration = Math.floor(this._getTotalDurationForMode('day'));
    const totalNightDuration = Math.floor(this._getTotalDurationForMode('night'));

    if (totalDayDuration < MIN_QUEUE_DURATION_S) {
      const error = new Error('Day library is too short');
      error.localized = t('settings.dayLibraryTooShort');
      throw error;
    }

    if (totalNightDuration < MIN_QUEUE_DURATION_S) {
      const error = new Error('Night library is too short');
      error.localized = t('settings.nightLibraryTooShort');
      throw error;
    }

    const groupSectionsStatus = this._getGroupSectionsAlgorithmStatus(merged.generation.GROUP_DEFS, 'day');
    const maxDay = merged.generation.GROUP_SECTIONS_ALGORYTM
      ? this._getGroupSectionsMaxDuration(merged.generation.GROUP_DEFS, 'day')
      : Math.max(MIN_QUEUE_DURATION_S, totalDayDuration);

    const nightGroupSectionsStatus = this._getGroupSectionsAlgorithmStatus(merged.generation.NIGHT_GROUP_DEFS, 'night');
    const maxNight = merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM
      ? this._getGroupSectionsMaxDuration(merged.generation.NIGHT_GROUP_DEFS, 'night')
      : Math.max(MIN_QUEUE_DURATION_S, totalNightDuration);

    if (!merged.generation.USE_ALL_DAY_SONGS) {
      const dayDuration = Number(merged.generation.MAX_DAY_DURATION);
      if (!Number.isFinite(dayDuration) || dayDuration < MIN_QUEUE_DURATION_S || dayDuration > maxDay) {
        const error = new Error('Invalid MAX_DAY_DURATION');
        error.localized = t('settings.maxDayDuration', {
          min: Math.round(MIN_QUEUE_DURATION_S / 60),
          max: Math.round(maxDay / 60),
        });
        throw error;
      }
      merged.generation.MAX_DAY_DURATION = Math.floor(dayDuration);
    } else {
      merged.generation.MAX_DAY_DURATION = maxDay;
    }

    if (!merged.generation.USE_ALL_NIGHT_SONGS) {
      const nightDuration = Number(merged.generation.MAX_NIGHT_DURATION);
      if (!Number.isFinite(nightDuration) || nightDuration < MIN_QUEUE_DURATION_S || nightDuration > maxNight) {
        const error = new Error('Invalid MAX_NIGHT_DURATION');
        error.localized = t('settings.maxNightDuration', {
          min: Math.round(MIN_QUEUE_DURATION_S / 60),
          max: Math.round(maxNight / 60),
        });
        throw error;
      }
      merged.generation.MAX_NIGHT_DURATION = Math.floor(nightDuration);
    } else {
      merged.generation.MAX_NIGHT_DURATION = maxNight;
    }

    if (merged.generation.DAY_ALGORYTM) {
      const songsPerSectionBounds = this._getSongsPerSectionBounds(merged.generation.GROUP_DEFS, 'day');
      const songsPerSection = Number(merged.generation.SONGS_PER_SECTION);
      if (!Number.isFinite(songsPerSection) || songsPerSection < songsPerSectionBounds.min || songsPerSection > songsPerSectionBounds.max) {
        const error = new Error('Invalid SONGS_PER_SECTION');
        error.localized = t('settings.songsPerSection', {
          min: songsPerSectionBounds.min,
          max: songsPerSectionBounds.max,
        });
        throw error;
      }
      merged.generation.SONGS_PER_SECTION = Math.floor(songsPerSection);
    }

    if (merged.generation.NIGHT_ALGORYTM) {
      const nightSongsPerSectionBounds = this._getSongsPerSectionBounds(merged.generation.NIGHT_GROUP_DEFS, 'night');
      const nightSongsPerSection = Number(merged.generation.NIGHT_SONGS_PER_SECTION);
      if (!Number.isFinite(nightSongsPerSection) || nightSongsPerSection < nightSongsPerSectionBounds.min || nightSongsPerSection > nightSongsPerSectionBounds.max) {
        const error = new Error('Invalid NIGHT_SONGS_PER_SECTION');
        error.localized = t('settings.nightSongsPerSection', {
          min: nightSongsPerSectionBounds.min,
          max: nightSongsPerSectionBounds.max,
        });
        throw error;
      }
      merged.generation.NIGHT_SONGS_PER_SECTION = Math.floor(nightSongsPerSection);
    }

    const dayAlgorithmStatus = this._getSectionAlgorithmStatus(merged.generation.GROUP_DEFS, 'day');
    if (merged.generation.DAY_ALGORYTM && !dayAlgorithmStatus.canUse) {
      const error = new Error('DAY_ALGORYTM cannot be enabled');
      error.localized = dayAlgorithmStatus.reason;
      throw error;
    }

    if (merged.generation.GROUP_SECTIONS_ALGORYTM && !groupSectionsStatus.canUse) {
      const error = new Error('GROUP_SECTIONS_ALGORYTM cannot be enabled');
      error.localized = groupSectionsStatus.reason;
      throw error;
    }

    const nightAlgorithmStatus = this._getSectionAlgorithmStatus(merged.generation.NIGHT_GROUP_DEFS, 'night');
    if (merged.generation.NIGHT_ALGORYTM && !nightAlgorithmStatus.canUse) {
      const error = new Error('NIGHT_ALGORYTM cannot be enabled');
      error.localized = nightAlgorithmStatus.reason;
      throw error;
    }

    if (merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM && !nightGroupSectionsStatus.canUse) {
      const error = new Error('NIGHT_GROUP_SECTIONS_ALGORYTM cannot be enabled');
      error.localized = nightGroupSectionsStatus.reason;
      throw error;
    }

    return merged;
  }

  async persistSettings() {
    const payload = {
      branding: this._getBrandingSettings(),
      generation: {
        ...this.settings.generation,
        GROUP_DEFS: sanitizeGroupDefs(this.groupDefs),
        NIGHT_GROUP_DEFS: sanitizeGroupDefs(this.nightGroupDefs),
      },
      radioHosts: this._getRadioHostsSettings(),
      artistArts: this._getArtistArtsSettings(),
      songGroups: sanitizeSongGroups(this.songGroups),
    };

    await this.dataProvider.saveSettings(payload);
    return payload;
  }

  getChangedSettingsSections(nextSettings) {
    const candidate = this._validateSettings(nextSettings);
    const current   = this._validateSettings({});

    return ['branding', 'generation', 'radioHosts', 'artistArts'].filter(
      (section) => stableStringify(candidate[section]) !== stableStringify(current[section]),
    );
  }

  async updateSettings(nextSettings) {
    const prevDayAlgo     = Boolean(this.settings?.generation?.DAY_ALGORYTM);
    const prevGroupAlgo   = Boolean(this.settings?.generation?.GROUP_SECTIONS_ALGORYTM);
    const prevNightAlgo      = Boolean(this.settings?.generation?.NIGHT_ALGORYTM);
    const prevNightGroupAlgo = Boolean(this.settings?.generation?.NIGHT_GROUP_SECTIONS_ALGORYTM);
    const merged = this._validateSettings(nextSettings);
    const phrasesTimeBounds = this._getPhrasesTimeSecondsBounds();
    merged.generation.PHRASES_TIME_SECONDS = Math.min(
      phrasesTimeBounds.max,
      Math.max(phrasesTimeBounds.min, Number(merged.generation.PHRASES_TIME_SECONDS) || phrasesTimeBounds.min),
    );
    await this.dataProvider.saveSettings(merged);
    this.applySettings(merged);

    const nextDayAlgo   = Boolean(merged.generation.DAY_ALGORYTM);
    const nextGroupAlgo = Boolean(merged.generation.GROUP_SECTIONS_ALGORYTM);
    const nextNightAlgo      = Boolean(merged.generation.NIGHT_ALGORYTM);
    const nextNightGroupAlgo = Boolean(merged.generation.NIGHT_GROUP_SECTIONS_ALGORYTM);
    const algorithmChanged = prevDayAlgo !== nextDayAlgo || prevGroupAlgo !== nextGroupAlgo
      || prevNightAlgo !== nextNightAlgo || prevNightGroupAlgo !== nextNightGroupAlgo;
    const algorithmNotice = algorithmChanged
      ? t('settings.algorithmDeferred')
      : null;

    return {
      ...this.getSettingsPayload(),
      algorithmNotice,
      message: algorithmNotice || t('settings.changesInEffect'),
    };
  }

  getSongGroups() {
    return this.songGroups.map((group) => ({
      ...group,
      songCount: group.songs.length,
      songsPreview: group.songs.map((songId) => {
        const meta = this.getTrackMetadata(songId);
        return { id: songId, title: meta.title, artist: meta.artist, album: meta.album, year: meta.year };
      }),
    }));
  }

  getSongGroupById(groupId) {
    return this.songGroups.find((group) => group.id === groupId) || null;
  }

  getSongGroupInsertCooldownSecsLeft() {
    const elapsed = (Date.now() - (this.lastSongGroupInjectTime || 0)) / 1000;
    return Math.max(0, Math.ceil(SONG_GROUP_INJECT_COOLDOWN_S - elapsed));
  }

  async createSongGroup(groupData) {
    const nextGroup = this._validateSongGroup(groupData);
    const merged = { ...this.settings, songGroups: [...this.songGroups, nextGroup] };
    await this.dataProvider.saveSettings(merged);
    this.applySettings(merged);
    return {
      group: this.getSongGroupById(nextGroup.id),
      message: t('songGroups.created'),
    };
  }

  async updateSongGroup(groupId, groupData) {
    const index = this.songGroups.findIndex((group) => group.id === groupId);
    if (index === -1) {
      const error = new Error('Song group not found');
      error.localized = t('songGroups.notFound');
      throw error;
    }

    const nextGroup = this._validateSongGroup(groupData, groupId);
    const nextGroups = [...this.songGroups];
    nextGroups[index] = nextGroup;
    const merged = { ...this.settings, songGroups: nextGroups };
    await this.dataProvider.saveSettings(merged);
    this.applySettings(merged);
    return {
      group: this.getSongGroupById(groupId),
      message: t('songGroups.updated'),
    };
  }

  async deleteSongGroup(groupId) {
    const exists = this.songGroups.some((group) => group.id === groupId);
    if (!exists) {
      const error = new Error('Song group not found');
      error.localized = t('songGroups.notFound');
      throw error;
    }

    const merged = { ...this.settings, songGroups: this.songGroups.filter((group) => group.id !== groupId) };
    await this.dataProvider.saveSettings(merged);
    this.applySettings(merged);
    return {
      ok: true,
      message: t('songGroups.deleted'),
    };
  }

  getSongsForMode(mode, { query = '', offset = 0, limit = 5 } = {}) {
    const modeKey = mode === 'night' ? 'night' : 'day';
    const source = Object.entries(this.metadataCache[modeKey] || {})
      .map(([filename, meta]) => ({
        id: `${modeKey}/${filename}`,
        title: meta.title || basename(filename, '.mp3'),
        artist: meta.artist || 'Unknown Artist',
        album: meta.album || '',
        year: meta.year || ''
      }))
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

    const tokens = String(query || '').trim().toLowerCase().split(/[\s\-–—,|]+/).filter(Boolean);
    const filtered = tokens.length
      ? source.filter((song) => {
          const haystack = `${song.artist} ${song.title}`.toLowerCase();
          return tokens.every((tok) => haystack.includes(tok));
        })
      : source;

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
    };
  }

  _getSecondsToTransition(now = new Date()) {
    const { totalSeconds: currentTotalSeconds } = localTimeParts(now);
    const isDayNow = this.currentMode === 'day';
    const targetHour = isDayNow ? this.nightStartHour : this.dayStartHour;
    const targetTotalSeconds = targetHour * 3600;

    const secondsToTransition = targetTotalSeconds > currentTotalSeconds
      ? targetTotalSeconds - currentTotalSeconds
      : 86_400 - currentTotalSeconds + targetTotalSeconds;

    return { secondsToTransition, targetHour };
  }

  _getQueueDurationAheadForAdminEntries() {
    const currentRemaining = Math.max(0, (this.currentTrackDuration || 0) - this.getSeek());
    let queueDuration = currentRemaining;

    for (let i = this.currentIndex + 1; i < this.playlist.length; i++) {
      const entry = this.playlist[i];
      if (!entry || typeof entry !== 'object') continue;

      if (entry.orderType === 'donated' || entry.orderType === 'lastinline') {
        queueDuration += this.getTrackMetadata(entry).duration || DEFAULT_DURATION;
      }
    }

    return queueDuration;
  }

  _getInsertionPosition(orderType = 'lastinline', tier = null) {
    let targetPos = this.currentIndex + 1;
    const newTier = tier ?? 1;
    while (targetPos < this.playlist.length) {
      const entry = this.playlist[targetPos];
      const ot = entry?.orderType;
      if (orderType === 'donated') {
        if (ot === 'donated' && (entry.tier ?? 1) >= newTier) {
          targetPos++;
          continue;
        }
      } else if (ot === 'donated' || ot === 'lastinline') {
        targetPos++;
        continue;
      }
      break;
    }
    return targetPos;
  }

  // ── Is this song already playing, or the very next up? ─────────────────────
  isSongCurrentOrNext(songId) {
    return entryId(this.playlist[this.currentIndex]) === songId
      || entryId(this.playlist[this.currentIndex + 1]) === songId;
  }

  _assertSongModeMatchesCurrent(songId) {
    const mode = getSongIdMode(songId);
    if (!mode || mode !== this.currentMode) {
      const error = new Error('Song mode mismatch');
      error.localized = t(mode === 'night' ? 'songGroups.insertNightOnly' : 'songGroups.insertDayOnly');
      throw error;
    }
  }

  _insertSongIds(songIds, orderType = null, options = {}) {
    const {
      cooldownSeconds = INJECT_COOLDOWN_S,
      cooldownStampKey = 'lastInjectTime',
    } = options;

    const now = new Date();
    const lastInjectStamp = Number(this[cooldownStampKey] || 0);
    const secondsPassed = (now.getTime() - lastInjectStamp) / 1000;
    if (secondsPassed < cooldownSeconds) {
      const error = new Error('Cooldown');
      error.localized = t('radio.waitSeconds', { seconds: Math.ceil(cooldownSeconds - secondsPassed) });
      throw error;
    }

    songIds.forEach((songId) => this._assertSongModeMatchesCurrent(songId));

    if (NIGHT_MODE) {
      const totalAddedDuration = songIds.reduce((sum, songId) => sum + (this.getTrackMetadata(songId).duration || DEFAULT_DURATION), 0);
      const totalNeeded = this._getQueueDurationAheadForAdminEntries() + totalAddedDuration + 10;
      const { secondsToTransition } = this._getSecondsToTransition(now);

      if (totalNeeded > secondsToTransition) {
        const error = new Error('Not enough time before mode transition');
        error.localized = t('radio.notEnoughTime', { minutes: Math.floor(secondsToTransition / 60) });
        throw error;
      }
    }

    let targetPos = this._getInsertionPosition(orderType);
    songIds.forEach((songId, index) => {
      this.playlist.splice(targetPos + index, 0, {
        id: songId,
        orderType,
        uid: `${songId}-${now.getTime()}-${index}`,
      });
    });

    this[cooldownStampKey] = now.getTime();
    this._buildMetadataMaps();
    return true;
  }

  injectSongGroup(groupId) {
    const group = this.getSongGroupById(groupId);
    if (!group) {
      const error = new Error('Song group not found');
      error.localized = t('songGroups.notFound');
      throw error;
    }

    if (group.mode !== this.currentMode) {
      const error = new Error('Song group mode mismatch');
      error.localized = t(group.mode === 'night' ? 'songGroups.insertNightOnly' : 'songGroups.insertDayOnly');
      throw error;
    }

    const orderedSongIds = buildBalancedTrackOrder(group.songs, (songId) => this.getTrackMetadata(songId).artist);
    this._insertSongIds(orderedSongIds, null, {
      cooldownSeconds: SONG_GROUP_INJECT_COOLDOWN_S,
      cooldownStampKey: 'lastSongGroupInjectTime',
    });
    return {
      ok: true,
      insertedCount: orderedSongIds.length,
      message: t('songGroups.inserted'),
    };
  }

  // ── Initialization ──────────────────────────────────────────────────────────
  async initialize(forcedMode = null) {
    try {
      this.currentMode = forcedMode ?? this.getDesiredMode();
      console.log(`[Radio] Initializing ${this.currentMode} mode…`);
      this.#radioStream?.setSelectedBackgroundMusicId?.(null);

      await this._loadMetadataCache();
      await this._loadLyricsCache();
      await this._loadLyricsOffsets();
      await this.loadSettings();

      if (this.currentMode === 'day') {
        await this._generateDayPlaylist();
      } else {
        await this._generateNightPlaylist();
      }

      console.log(`[Radio] Loaded ${this.currentMode} playlist (${this.playlist.length} tracks)`);
      this._buildMetadataMaps();
      this.initialized = true;
    } catch (error) {
      console.error('[Radio] Initialization error:', error);
      throw error;
    }
  }

  async _loadMetadataCache() {
    this.metadataCache = await this.dataProvider.loadMetadata();

    if (this.usesCloudMusic()) {
      const dayCount = Object.keys(this.metadataCache.day || {}).length;
      const nightCount = Object.keys(this.metadataCache.night || {}).length;
      console.log(`[Radio] Cloud music mode enabled. Using metadata cache only (day: ${dayCount}, night: ${nightCount}).`);
      return;
    }

    let needsUpdate = false;
    for (const folder of ['day', 'night']) {
      const folderPath = join(this.musicPath, folder);
      try {
        const files = await readdir(folderPath);
        const mp3Files = new Set(files.filter((f) => f.toLowerCase().endsWith('.mp3')));

        for (const cached of Object.keys(this.metadataCache[folder] || {})) {
          if (mp3Files.has(cached)) continue;
          if (CONFIRM_TRACK_CLEANUP) {
            delete this.metadataCache[folder][cached];
            needsUpdate = true;
            console.log(`[Radio] Removed from cache: ${folder}/${cached}`);
          } else {
            console.warn(`[Radio] Missing file, kept in cache (set CONFIRM_TRACK_CLEANUP=true to remove it): ${folder}/${cached}`);
          }
        }

        for (const file of mp3Files) {
          if (!this.metadataCache[folder]?.[file]) {
            const meta = await parseFile(join(folderPath, file));
            if (!this.metadataCache[folder]) this.metadataCache[folder] = {};
            this.metadataCache[folder][file] = {
              duration : meta.format.duration || DEFAULT_DURATION,
              artist   : meta.common.artist || 'Unknown Artist',
              title    : meta.common.title || basename(file, '.mp3'),
              album    : meta.common.album || 'Unknown Album',
              year     : meta.common.year || null,
              mode     : folder,
            };
            needsUpdate = true;
            console.log(`[Radio] Cached: ${folder}/${file}`);
          }
        }
      } catch (err) {
        console.error(`[Radio] Folder "${folder}" scan error:`, err);
      }
    }

    if (needsUpdate) {
      await this.dataProvider.saveMetadata(this.metadataCache);
      console.log('[Radio] metadata_cache.json updated.');
    }
  }

  // ── Playlist generation ─────────────────────────────────────────────────────
  async _generatePlaylistForMode(mode) {
    console.log(`[Radio] Generating grouped ${mode} playlist…`);

    const settings = this.settings.generation;
    const keys = mode === 'night'
      ? {
          GROUP_DEFS: settings.NIGHT_GROUP_DEFS || {},
          MAX_DURATION: settings.MAX_NIGHT_DURATION,
          SONGS_PER_SECTION: settings.NIGHT_SONGS_PER_SECTION,
          USE_ALL_SONGS: settings.USE_ALL_NIGHT_SONGS,
          ALGORYTM: settings.NIGHT_ALGORYTM,
          GROUP_SECTIONS_ALGORYTM: settings.NIGHT_GROUP_SECTIONS_ALGORYTM,
        }
      : {
          GROUP_DEFS: settings.GROUP_DEFS || {},
          MAX_DURATION: settings.MAX_DAY_DURATION,
          SONGS_PER_SECTION: settings.SONGS_PER_SECTION,
          USE_ALL_SONGS: settings.USE_ALL_DAY_SONGS,
          ALGORYTM: settings.DAY_ALGORYTM,
          GROUP_SECTIONS_ALGORYTM: settings.GROUP_SECTIONS_ALGORYTM,
        };

    const {
      GROUP_DEFS,
      MAX_DURATION,
      SONGS_PER_SECTION,
      USE_ALL_SONGS,
      ALGORYTM,
      GROUP_SECTIONS_ALGORYTM,
    } = keys;

    const artistGroupIndex = this._getArtistGroupIndexForMode(mode);
    const groupDefs = this._getGroupDefsForMode(mode);

    const modeSongs = this._getAvailableSongFiles(mode);
    if (!modeSongs.length) {
      this.playlist = [];
      this.currentIndex = 0;
      console.warn(`[Radio] No ${mode} songs found in metadata cache`);
      return;
    }

    if (!ALGORYTM) {
      await this._generateSimplePlaylist(mode, MAX_DURATION, USE_ALL_SONGS, this._getArtistIndexForMode(mode));
      return;
    }

    if (GROUP_SECTIONS_ALGORYTM) {
      await this._generateGroupedSectionsPlaylist(modeSongs, settings, mode);
      this.currentIndex = 0;
      return;
    }

    const totalLibraryDuration = modeSongs.reduce((sum, file) => {
      const meta = this._getSongMetaByFile(mode, file);
      return sum + (meta?.duration || DEFAULT_DURATION);
    }, 0);

    const maxDuration = USE_ALL_SONGS
      ? totalLibraryDuration
      : Math.min(MAX_DURATION, totalLibraryDuration);

    const songPools = {};
    for (const groupName of Object.keys(GROUP_DEFS || {})) {
      songPools[groupName] = [];
    }

    for (const file of modeSongs) {
      const folded = foldForArtistMatch(file);
      let matchedGroup = null;

      for (const [groupName, artists] of Object.entries(GROUP_DEFS || {})) {
        if (artists.some((artist) => folded.includes(foldForArtistMatch(artist)))) {
          matchedGroup = groupName;
          break;
        }
      }

      if (!matchedGroup) {
        matchedGroup = Object.keys(GROUP_DEFS).at(-1) || 'D2';
        if (!songPools[matchedGroup]) songPools[matchedGroup] = [];
      }

      songPools[matchedGroup].push(file);
    }

    for (const pool of Object.values(songPools)) {
      shuffleArray(pool);
    }

    const groupNames = Object.keys(songPools).filter((group) => songPools[group]?.length > 0);
    if (groupNames.length < 2) {
      console.warn(`[Radio] Not enough non-empty groups for ${mode} algorithm - falling back to simple playlist`);
      await this._generateSimplePlaylist(mode, MAX_DURATION, USE_ALL_SONGS, this._getArtistIndexForMode(mode));
      return;
    }

    const baseCounts = {};
    const totalSongs = groupNames.reduce((sum, group) => sum + songPools[group].length, 0);
    for (const group of groupNames) {
      baseCounts[group] = Math.max(1, Math.round((songPools[group].length / totalSongs) * SONGS_PER_SECTION));
    }

    const sections = [];
    let totalDuration = 0;

    while (true) {
      const hasEnoughSongs = groupNames.some((group) => songPools[group].length > 0);
      if (!hasEnoughSongs) break;

      const section = buildSection(baseCounts, songPools);
      if (!section.length) break;

      const fixedSection = fixGroupRepeats(section, artistGroupIndex);
      const sectionDuration = fixedSection.reduce((sum, file) => {
        const meta = this._getSongMetaByFile(mode, file);
        return sum + (meta?.duration || DEFAULT_DURATION);
      }, 0);

      if (!USE_ALL_SONGS && totalDuration + sectionDuration > maxDuration) break;

      sections.push(fixedSection);
      totalDuration += sectionDuration;
    }

    const flat = sections.flat();
    this.playlist = flat.map((file) => `${mode}/${file}`);
    this.currentIndex = 0;

    console.log(
      `[Radio] Grouped ${mode} playlist ready - ${(totalDuration / 3600).toFixed(2)}h, ${this.playlist.length} tracks`
    );
  }

  async _generateGroupedSectionsPlaylist(modeSongs, settings, mode = 'day') {
    console.log(`[Radio] Generating grouped-sections playlist (${mode})…`);

    const groupDefs = this._getGroupDefsForMode(mode);
    const artistGroupIndex = this._getArtistGroupIndexForMode(mode);
    const maxDurationKey = mode === 'night' ? 'MAX_NIGHT_DURATION' : 'MAX_DAY_DURATION';
    const useAllKey = mode === 'night' ? 'USE_ALL_NIGHT_SONGS' : 'USE_ALL_DAY_SONGS';

    const durationMap = new Map();
    const groupPools = Object.fromEntries(Object.keys(groupDefs).map((g) => [g, []]));
    const fallbackGroup = Object.keys(groupPools).slice(-1)[0];

    for (const file of modeSongs) {
      const cached = this.metadataCache[mode][file];
      if (!cached) continue;
      durationMap.set(file, cached.duration || DEFAULT_DURATION);
      const group = resolveGroup(file, artistGroupIndex, fallbackGroup);
      (groupPools[group] || (groupPools[fallbackGroup] = groupPools[fallbackGroup] || [])).push(file);
    }

    const nonEmptyGroups = Object.entries(groupPools).filter(([, pool]) => pool.length > 0);
    const groupCount = nonEmptyGroups.length;
    if (groupCount < 2) {
      console.warn(`[Radio] Not enough non-empty groups for grouped-sections algorithm (${mode}), falling back to simple.`);
      await this._generateSimplePlaylist(
        mode,
        settings[useAllKey] ? this._getTotalDurationForMode(mode) : settings[maxDurationKey],
        settings[useAllKey],
        this._getArtistIndexForMode(mode)
      );
      return;
    }

    const shuffledPools = Object.fromEntries(
      nonEmptyGroups.map(([g, pool]) => [g, shuffleArray([...pool])])
    );

    const minGroupSize = Math.min(...nonEmptyGroups.map(([, pool]) => pool.length));
    const maxSections = minGroupSize;

    const durationLimit = settings[useAllKey]
      ? this._getTotalDurationForMode(mode)
      : settings[maxDurationKey];

    const sections = [];
    let totalDuration = 0;
    let lastSectionEndGroup = null;

    for (let i = 0; i < maxSections; i++) {
      const groupOrder = shuffleArray(nonEmptyGroups.map(([g]) => g));

      if (lastSectionEndGroup && groupOrder[0] === lastSectionEndGroup && groupOrder.length > 1) {
        const swapIdx = groupOrder.findIndex((g) => g !== lastSectionEndGroup);
        if (swapIdx !== -1) {
          [groupOrder[0], groupOrder[swapIdx]] = [groupOrder[swapIdx], groupOrder[0]];
        }
      }

      const section = [];
      let sectionDur = 0;

      for (const group of groupOrder) {
        const pool = shuffledPools[group];
        if (!pool || pool.length === 0) continue;
        const track = pool[i];
        if (!track) continue;
        const dur = durationMap.get(track) || DEFAULT_DURATION;
        if (totalDuration + sectionDur + dur > durationLimit) {
          break;
        }
        section.push(track);
        sectionDur += dur;
      }

      if (section.length === 0) break;
      sections.push(section);
      totalDuration += sectionDur;
      lastSectionEndGroup = resolveGroup(section[section.length - 1], artistGroupIndex, fallbackGroup);

      if (totalDuration >= durationLimit) break;
    }

    if (sections.length === 0) {
      console.warn(`[Radio] Grouped-sections (${mode}) produced no tracks, falling back to simple.`);
      await this._generateSimplePlaylist(
        mode,
        settings[useAllKey] ? this._getTotalDurationForMode(mode) : settings[maxDurationKey],
        settings[useAllKey],
        this._getArtistIndexForMode(mode)
      );
      return;
    }

    this.playlist = sections.flat().map((file) => `${mode}/${file}`);
    console.log(`[Radio] Grouped-sections (${mode}) playlist ready - ${(totalDuration / 3600).toFixed(2)}h, ${this.playlist.length} tracks (${sections.length} sections × ${groupCount} groups).`);
  }

  async _generateDayPlaylist() {
    return this._generatePlaylistForMode('day');
  }

  async _generateNightPlaylist() {
    return this._generatePlaylistForMode('night');
  }

  _buildMetadataMaps() {
    const trackMetadata       = new Map();
    const fullLibraryMetadata = new Map();

    for (const entry of this.playlist) {
      const songPath = entryId(entry);
      const [folder, filename] = songPath.split('/');
      const meta = this.metadataCache[folder]?.[filename];
      trackMetadata.set(
        songPath,
        meta ?? { title: basename(songPath, '.mp3'), artist: 'Unknown Artist' }
      );
    }

    for (const [folder, files] of Object.entries(this.metadataCache)) {
      for (const [filename, meta] of Object.entries(files)) {
        fullLibraryMetadata.set(`${folder}/${filename}`, meta);
      }
    }

    this.trackMetadata       = trackMetadata;
    this.fullLibraryMetadata = fullLibraryMetadata;
  }

  getTrackMetadata(trackEntry) {
    const filename = entryId(trackEntry);
    if (!filename || typeof filename !== 'string') {
      return { title: 'Unknown', artist: 'Unknown', album: '', duration: DEFAULT_DURATION, orderType: null, tier: null };
    }
    const meta = this.fullLibraryMetadata.get(filename);
    return {
      title     : meta?.title    ?? basename(filename),
      artist    : meta?.artist   ?? 'Unknown Artist',
      album     : meta?.album    ?? '',
      year      : meta?.year     ?? null,
      duration  : meta?.duration ?? DEFAULT_DURATION,
      orderType : (trackEntry && typeof trackEntry === 'object') ? trackEntry.orderType : null,
      tier      : (trackEntry && typeof trackEntry === 'object') ? trackEntry.tier ?? null : null,
    };
  }

  // ── Playback controls ───────────────────────────────────────────────────────
  start() {
    if (!this.initialized || !this.playlist.length) return;
    this.isPlaying    = true;
    this.currentTrack = this.playlist[this.currentIndex];
    this.startTime    = Date.now();
    this._recordHistoryEntry(this.currentTrack);
  }

  _recordHistoryEntry(trackEntry) {
    if (!this.dataProvider?.history?.recordPlay) return;

    const meta = this.getTrackMetadata(trackEntry);
    this.dataProvider.history.recordPlay({
      trackId:  entryId(trackEntry),
      title:    meta.title,
      artist:   meta.artist,
      album:    meta.album,
      mode:     this.currentMode,
      playedAt: Date.now(),
    }).catch((err) => console.error('[History] Failed to record play:', err.message));
  }

  shuffle() {
    shuffleArray(this.playlist);
    this.currentIndex = 0;
  }

  getSeek() {
    if (!this.isPlaying || !this.startTime || !this.currentTrack) return 0;
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (this.currentTrackDuration && elapsed >= this.currentTrackDuration) {
      return this.currentTrackDuration;
    }
    return Math.max(0, elapsed);
  }

  syncPlaybackClock(startedAtMs) {
    if (startedAtMs && this.isPlaying) {
      this.startTime = startedAtMs;
    }
  }

  onTrackEnd(force = false) {
    this.nextTrack(force);
  }

  skipCurrentTrack() {
    const throwError = (key, params = {}) => {
      const localized = t(key, params);
      throw Object.assign(new Error(JSON.stringify(localized)), { localized, code: key });
    };

    const now           = new Date();
    const secondsPassed = (now.getTime() - this.lastSkipTime) / 1000;
    if (secondsPassed < INJECT_COOLDOWN_S) {
      throwError('radio.waitSeconds', { seconds: Math.ceil(INJECT_COOLDOWN_S - secondsPassed) });
    }

    this.lastSkipTime = now.getTime();
    console.log('[Radio] Admin requested track skip');
    this.nextTrack(true);
  }

  async nextTrack(force = false) {
    const now        = Date.now();
    const timePlayed = this.startTime ? now - this.startTime : 0;

    if (!force && this.currentTrack && timePlayed < this.minTrackPlayTime) return;

    const isStuck = !this.currentTrackDuration && timePlayed > 600_000;
    if (force || isStuck) {
      console.log(isStuck ? '[Radio] Safety trigger: stuck track' : '[Radio] Forced track switch');
    }

    if (this.pendingModeSwitch) {
      const { targetMode, executeAtMs } = this.pendingModeSwitch;
      if (executeAtMs && Date.now() < executeAtMs) {
      } else {
      this.pendingModeSwitch = null;
      if (this.currentMode !== targetMode) {
        console.log(`[Radio] Executing scheduled mode switch: ${this.currentMode} → ${targetMode}`);
        this.isTransitioning  = true;
        this.isPlaying        = false;
        this.currentTrack     = null;
        this.lastAdminModeSwitchAt = Date.now();
        const naturalMode = this._getNaturalMode();
        if (targetMode === naturalMode) {
          this._clearAdminForcedMode('cleared because admin returned radio to natural mode');
        } else {
          const boundaryHour = targetMode === 'day' ? this.dayStartHour : this.nightStartHour;
          this.adminForcedMode = targetMode;
          this.adminForcedBoundaryTs = this._getNextBoundaryTimestamp(boundaryHour);
          console.log(`[Radio] Forced mode '${targetMode}' will persist until ${new Date(this.adminForcedBoundaryTs).toISOString()}`);
        }
        try {
          await this.initialize(targetMode);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          console.log(`[Radio] Mode switch to '${targetMode}' complete.`);
        } catch (err) {
          console.error('[Radio] Mode switch error:', err);
        } finally {
          this.isTransitioning = false;
          this.start();
        }
        return;
      }
      }
    }

    const desiredMode = this.getDesiredMode();
    if (this.currentMode !== desiredMode) {
      console.log(`[Radio] Mode transition: ${this.currentMode} → ${desiredMode} - regenerating playlist`);
      this.currentMode = desiredMode;
      this.#radioStream?.setSelectedBackgroundMusicId?.(null);
      try {
        if (this.currentMode === 'day') {
          await this._generateDayPlaylist();
        } else {
          await this._generateNightPlaylist();
        }
        this._buildMetadataMaps();
        this.currentIndex = -1;
      } catch (err) {
        console.error('[Radio] Playlist regeneration error:', err);
      }
    }

    this.currentIndex++;
    if (this.currentIndex >= this.playlist.length) {
      const nextMode = this.getDesiredMode();

      if (nextMode !== this.currentMode) {
        console.log(`[Radio] Playlist exhausted, switching to '${nextMode}' mode`);
        this.currentMode = nextMode;
        this.#radioStream?.setSelectedBackgroundMusicId?.(null);
      } else {
        console.log(`[Radio] Playlist exhausted, regenerating for '${this.currentMode}' mode`);
      }

      try {
        if (this.currentMode === 'day') {
          await this._generateDayPlaylist();
        } else {
          await this._generateNightPlaylist();
        }
        this._buildMetadataMaps();
      } catch (err) {
        console.error('[Radio] Playlist regeneration error:', err);
        this.shuffle();
      }
      this.currentIndex = 0;
    }

    const trackEntry = this.playlist[this.currentIndex];
    this.currentTrack         = entryId(trackEntry);
    this.currentTrackDuration = this.getTrackMetadata(trackEntry).duration || null;
    this.startTime            = Date.now();
    console.log(`[Radio] Playing: ${this.currentTrack}`);
    this._recordHistoryEntry(trackEntry);
  }

  // ── State ───────────────────────────────────────────────────────────────────
  tick() {
    if (STREAM_MODE) return;
    if (!this.isPlaying || this.isTransitioning) return;

    const seek = this.getSeek();

    if (!this.currentTrackDuration) {
      if (seek > UNKNOWN_DURATION_MAX_S) {
        console.log(`[Radio] Safety trigger: unknown duration, played ${Math.round(seek)}s`);
        this.nextTrack(true);
      }
      return;
    }

    if (seek >= this.currentTrackDuration - TRACK_END_BUFFER_S && seek > 5) {
      console.log(`[Radio] Track end (tick): ${seek}/${this.currentTrackDuration}`);
      this.nextTrack();
    }
  }

  searchUpcoming(query) {
    const tokens = query.toLowerCase().trim().split(/[\s\-–—,|]+/).filter(Boolean);
    const total  = this.playlist.length - 1;
    const results = [];
    for (let i = 1; i <= total; i++) {
      const idx   = (this.currentIndex + i) % this.playlist.length;
      const entry = this.playlist[idx];
      const meta  = this.getTrackMetadata(entry);
      const haystack = `${meta.artist} ${meta.title}`.toLowerCase();
      if (!tokens.length || tokens.every((tok) => haystack.includes(tok))) {
        results.push({ id: entryId(entry), title: meta.title, artist: meta.artist, orderType: meta.orderType, tier: meta.tier, position: i });
      }
    }
    return { items: results, total };
  }

  getUpcoming(offset = 0, limit = 10) {
    const total     = this.playlist.length - 1;
    const available = Math.max(0, total - offset);
    const count     = Math.min(limit, available);
    return {
      items: Array.from({ length: count }, (_, i) => {
        const idx   = (this.currentIndex + offset + i + 1) % this.playlist.length;
        const entry = this.playlist[idx];
        const meta  = this.getTrackMetadata(entry);
        return { id: entryId(entry), title: meta.title, artist: meta.artist, orderType: meta.orderType, tier: meta.tier };
      }),
      total,
    };
  }

  getState() {
    if (this.isTransitioning || !this.currentTrack) {
      return {
        track: null,
        seek: 0,
        isPlaying: false,
        playlist: [],
        mode: this.currentMode,
        isPreparing: true,
        uiSettings: this.getPublicUiSettings(),
      };
    }

    const seek            = this.getSeek();
    const currentEntry    = this.playlist[this.currentIndex];
    const currentMetadata = this.getTrackMetadata(this.currentTrack);

    const isJustChatting = Boolean(this.#radioStream?.isQueueIdling);

    const upcoming = Array.from({ length: Math.min(10, this.playlist.length - 1) }, (_, i) => {
      const idx   = (this.currentIndex + i + 1) % this.playlist.length;
      const entry = this.playlist[idx];
      const meta  = this.getTrackMetadata(entry);
      return { id: entryId(entry), filename: entry, title: meta.title, artist: meta.artist, album: meta.album, year: meta.year, orderType: meta.orderType, tier: meta.tier };
    });

    const skipSecsLeft = this.lastSkipTime
      ? Math.max(0, Math.ceil(INJECT_COOLDOWN_S - (Date.now() - this.lastSkipTime) / 1000))
      : 0;

    return {
      track       : entryId(currentEntry),
      title       : isJustChatting ? 'Just chatting' : currentMetadata.title,
      artist      : isJustChatting ? '' : currentMetadata.artist,
      album       : isJustChatting ? '' : currentMetadata.album,
      year        : isJustChatting ? null : currentMetadata.year,
      orderType   : isJustChatting ? null : currentMetadata.orderType,
      tier        : isJustChatting ? null : currentMetadata.tier,
      duration    : isJustChatting ? 0 : currentMetadata.duration,
      seek,
      isPlaying   : this.isPlaying,
      playlist    : upcoming,
      currentIndex: this.currentIndex,
      totalTracks : this.playlist.length,
      mode        : this.currentMode,
      pendingModeSwitch  : this.pendingModeSwitch
        ? { targetMode: this.pendingModeSwitch.targetMode, executeAtMs: this.pendingModeSwitch.executeAtMs || null }
        : null,
      skipCooldownSecsLeft: skipSecsLeft,
      uiSettings   : this.getPublicUiSettings(),
      serverTimeMs : Date.now(),
      dayStartHour : this.dayStartHour,
      nightStartHour: this.nightStartHour,
    };
  }

  // ── Track injection ─────────────────────────────────────────────────────────
  injectTrack(songData) {
    const now             = new Date();
    const secondsPassed   = (now.getTime() - this.lastInjectTime) / 1000;

    const throwError = (key, params = {}) => {
      const localized = t(key, params);
      throw Object.assign(new Error(JSON.stringify(localized)), { localized, code: key });
    };

    if (secondsPassed < INJECT_COOLDOWN_S) {
      throwError('radio.waitSeconds', { seconds: Math.ceil(INJECT_COOLDOWN_S - secondsPassed) });
    }

    if (NIGHT_MODE) {
      const { secondsToTransition, targetHour } = this._getSecondsToTransition(now);
      const queueDuration = this._getQueueDurationAheadForAdminEntries();

      const newSongMeta     = this.fullLibraryMetadata.get(songData.id);
      const newSongDuration = newSongMeta?.duration ?? DEFAULT_DURATION;
      const totalNeeded     = queueDuration + newSongDuration + 10;

      console.log(`[Queue] Target ${targetHour}:00 | transition in ${Math.floor(secondsToTransition / 60)}m | needed ${Math.floor(totalNeeded / 60)}m`);

      if (totalNeeded > secondsToTransition) {
        throwError('radio.notEnoughTime', { minutes: Math.floor(secondsToTransition / 60) });
      }
    }

    let targetPos = this._getInsertionPosition(songData.orderType, songData.tier);

    if (entryId(this.playlist[targetPos - 1]) === songData.id ||
        entryId(this.playlist[targetPos])     === songData.id) {
      throwError('radio.alreadyQueuedNearby');
    }

    this.playlist.splice(targetPos, 0, {
      id       : songData.id,
      orderType: songData.orderType,
      tier     : songData.orderType === 'donated' ? (songData.tier ?? null) : null,
      uid      : `${songData.id}-${now.getTime()}`,
    });

    this.lastInjectTime = now.getTime();
    console.log(`[Queue] Inserted: ${songData.id} at position ${targetPos}`);
    return true;
  }

  removeTrack(position) {
    const throwError = (key, params = {}) => {
      const localized = t(key, params);
      throw Object.assign(new Error(JSON.stringify(localized)), { localized, code: key });
    };

    const now           = new Date();
    const secondsPassed = (now.getTime() - this.lastRemoveTime) / 1000;
    if (secondsPassed < INJECT_COOLDOWN_S) {
      throwError('radio.waitSeconds', { seconds: Math.ceil(INJECT_COOLDOWN_S - secondsPassed) });
    }

    const absIdx = this.currentIndex + position;
    if (position < 1 || absIdx >= this.playlist.length) {
      throwError('radio.trackNotInQueue');
    }

    const realIdx = absIdx % this.playlist.length;
    const entry   = this.playlist[realIdx];
    const meta    = this.getTrackMetadata(entry);
    const isAdminTrack = entry && typeof entry === 'object' &&
      (entry.orderType === 'donated' || entry.orderType === 'lastinline');

    this.playlist.splice(realIdx, 1);
    if (realIdx <= this.currentIndex) this.currentIndex--;

    this.lastRemoveTime = now.getTime();

    if (isAdminTrack) {
      let remaining = 0;
      for (let i = this.currentIndex + 1; i < this.playlist.length; i++) {
        const e = this.playlist[i];
        if (e && typeof e === 'object' && (e.orderType === 'donated' || e.orderType === 'lastinline')) {
          remaining += (this.getTrackMetadata(e).duration || DEFAULT_DURATION);
        }
      }
      console.log(`[Queue] Removed admin track: ${entryId(entry)} (${Math.round(meta.duration || 0)}s) | remaining admin queue: ${Math.round(remaining)}s`);
    } else {
      console.log(`[Queue] Removed: ${entryId(entry)} at position ${position}`);
    }

    return { title: meta.title, artist: meta.artist };
  }

  // ── Lyrics ──────────────────────────────────────────────────────────────────
  _areLyricsEntriesEquivalent(a, b) {
    const normalize = (entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const normalized = {
        notFound: Boolean(entry.notFound),
        synced: Boolean(entry.synced),
        lines: [],
      };

      if (Array.isArray(entry.lines)) {
        if (normalized.synced) {
          normalized.lines = entry.lines.map((line) => ({
            time: Number.isFinite(Number(line?.time)) ? Number(line.time) : null,
            text: String(line?.text || '').trim(),
          }));
        } else {
          normalized.lines = entry.lines.map((line) =>
            String(typeof line === 'string' ? line : (line?.text || '')).trim()
          );
        }
      }

      return normalized;
    };

    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  async _loadLyricsOffsets() {
    this.lyricsOffsets = await this.dataProvider.loadLyricsOffsets();
  }

  async _loadLyricsCache() {
    this.lyricsCache = await this.dataProvider.loadLyricsCache();
  }

  async saveLyricsCache() {
    try {
      await this.dataProvider.saveLyricsCache(this.lyricsCache);
    } catch (err) {
      console.error('[Lyrics] Failed to save cache:', err.message);
    }
  }

  async refreshLibraryState({ preservePlaylist = true } = {}) {
    const previousPlaylist = preservePlaylist ? [...this.playlist] : null;
    const previousIndex = this.currentIndex;

    await this._loadMetadataCache();

    if (preservePlaylist && previousPlaylist) {
      this.playlist = previousPlaylist.filter((entry) => {
        const songId = entryId(entry);
        return this.fullLibraryMetadata.has(songId) || this.metadataCache[String(songId).split('/')[0]]?.[String(songId).split('/').slice(1).join('/')] || (typeof entry === 'object' && entry?.id);
      });
      this.currentIndex = Math.min(previousIndex, Math.max(this.playlist.length - 1, 0));
    }

    this._buildMetadataMaps();
    return {
      day: Object.keys(this.metadataCache.day || {}).length,
      night: Object.keys(this.metadataCache.night || {}).length,
    };
  }

  async registerUploadedTrack(track) {
    if (!this.dataProvider || typeof this.dataProvider.addTrack !== 'function') {
      throw new Error('The configured data provider cannot register uploaded tracks');
    }

    const added = await this.dataProvider.addTrack(track);
    const applied = this._applyTrackToEngineCache(added);

    console.log(`[Radio] Uploaded track registered without full refresh: ${applied.id}`);
    return {
      id: applied.id,
      ...applied.meta,
    };
  }

  getLyrics(title, artist) {
    return this.dataProvider.getLyrics(this.lyricsCache, title, artist);
  }

  setLyrics(title, artist, data) {
    return this.dataProvider.setLyrics(this.lyricsCache, title, artist, data);
  }

  deleteLyrics(title, artist) {
    return this.dataProvider.deleteLyrics(this.lyricsCache, title, artist);
  }

  async persistLyricsEntry(title, artist, data) {
    const current = this.getLyrics(title, artist);
    const entry = {
      ...(data || {}),
      fetchedAt: Number(data?.fetchedAt) || Date.now(),
    };

    if (this._areLyricsEntriesEquivalent(current, entry)) {
      return current;
    }

    const normalized = this.setLyrics(title, artist, entry);

    try {
      if (typeof this.dataProvider.upsertLyricsEntry === 'function') {
        await this.dataProvider.upsertLyricsEntry(this.lyricsCache, title, artist, normalized);
      } else {
        await this.saveLyricsCache();
      }
    } catch (err) {
      console.error('[Lyrics] Failed to persist lyrics entry:', err.message);
      throw err;
    }

    return normalized;
  }

  async removeLyricsEntry(title, artist) {
    const existed = this.deleteLyrics(title, artist);

    if (!existed) return false;

    try {
      if (typeof this.dataProvider.deleteLyricsEntry === 'function') {
        await this.dataProvider.deleteLyricsEntry(this.lyricsCache, title, artist);
      } else {
        await this.saveLyricsCache();
      }
    } catch (err) {
      console.error('[Lyrics] Failed to delete lyrics entry:', err.message);
      throw err;
    }

    return true;
  }

  getLyricsCacheIndex() {
    return this.dataProvider.getLyricsCacheIndex(this.lyricsCache);
  }

  getLyricsCacheObject() {
    return Object.fromEntries(this.lyricsCache);
  }

  getLyricsOffset(title, artist) {
    return this.dataProvider.getLyricsOffset(this.lyricsOffsets, title, artist);
  }

  async saveLyricsOffsets() {
    try {
      await this.dataProvider.saveLyricsOffsets(this.lyricsOffsets);
    } catch (err) {
      console.error('[Lyrics] Failed to save offsets:', err.message);
    }
  }

  setLyricsOffset(title, artist, offset) {
    return this.dataProvider.setLyricsOffset(this.lyricsOffsets, title, artist, offset);
  }

  deleteLyricsOffset(title, artist) {
    return this.dataProvider.deleteLyricsOffset(this.lyricsOffsets, title, artist);
  }

  async persistLyricsOffset(title, artist, offset) {
    const current = this.getLyricsOffset(title, artist);
    const numeric = Number(offset);
    const requested = Number.isFinite(numeric) && Math.abs(numeric) >= 0.001
      ? Math.round(numeric * 100) / 100
      : 0;

    if (requested === current) {
      return current;
    }

    const normalized = this.setLyricsOffset(title, artist, requested);

    try {
      if (typeof this.dataProvider.upsertLyricsOffset === 'function') {
        await this.dataProvider.upsertLyricsOffset(this.lyricsOffsets, title, artist, normalized);
      } else {
        await this.saveLyricsOffsets();
      }
    } catch (err) {
      console.error('[Lyrics] Failed to persist offset:', err.message);
      throw err;
    }

    return normalized;
  }

  getLyricsOffsetsObject() {
    return Object.fromEntries(this.lyricsOffsets);
  }

  getLyricsWithOffset(title, artist) {
    const lyrics = this.getLyrics(title, artist);
    if (!lyrics) return null;

    const offset = this.getLyricsOffset(title, artist);

    return { ...lyrics, offset };
  }

  async prefetchAllLyrics() {
    const songs = [];
    this.fullLibraryMetadata.forEach((meta, id) => {
      if (meta.title && meta.artist) songs.push({ id, ...meta });
    });

    const logStats = () => {
      let synced = 0, plain = 0, notFound = 0;
      this.lyricsCache.forEach((v) => {
        if (v.notFound) notFound++;
        else if (v.synced) synced++;
        else plain++;
      });
      console.log(`[Lyrics] Stats - Karaoke: ${synced} | Plain: ${plain} | Not found: ${notFound} | Total: ${synced + plain + notFound}`);
    };

    const pending = songs.filter((song) => !this.getLyrics(song.title, song.artist));

    if (!pending.length) {
      console.log(`[Lyrics] All cached - ${songs.length} total`);
      logStats();
      return;
    }

    console.log(`[Lyrics] Prefetch: ${pending.length} to fetch (${songs.length - pending.length} already cached)`);

    for (let i = 0; i < pending.length; i++) {
      const { title, artist, album, duration } = pending[i];
      if (this.getLyrics(title, artist)) continue;

      console.log(`[Lyrics] Prefetch [${i + 1}/${pending.length}]: "${title}" by ${artist}`);

      try {
        const result = await fetchLyricsForSong(title, artist, album, duration);
        await this.persistLyricsEntry(title, artist, result);
        if (result.notFound) console.log(`[Lyrics] Prefetch: not found - "${title}"`);
        else console.log(`[Lyrics] Prefetch: ✓ "${title}" - ${result.lines?.length} lines`);
      } catch (err) {
        console.error(`[Lyrics] Prefetch error for "${title}":`, err.message);
        await this.persistLyricsEntry(title, artist, { notFound: true, reason: 'fetch_error', fetchedAt: Date.now() });
      }

      if (i < pending.length - 1) await new Promise((r) => setTimeout(r, 10000));
    }

    console.log('[Lyrics] Prefetch complete');
    logStats();
  }

  _rebuildArtistIndicesFromSettings() {
    this.groupDefs = sanitizeGroupDefs(this.settings?.generation?.GROUP_DEFS || {}, {});
    const { artistIndex, artistGroupIndex } = buildArtistIndices(this.groupDefs);
    this.artistIndex = artistIndex;
    this.artistGroupIndex = artistGroupIndex;

    this.nightGroupDefs = sanitizeGroupDefs(this.settings?.generation?.NIGHT_GROUP_DEFS || {}, {});
    const { artistIndex: artistIndexNight, artistGroupIndex: artistGroupIndexNight } = buildArtistIndices(this.nightGroupDefs);
    this.artistIndexNight = artistIndexNight;
    this.artistGroupIndexNight = artistGroupIndexNight;
  }
  async moveTrackToMode(trackId, targetMode, mediaProvider) {
    if (!this.dataProvider || typeof this.dataProvider.updateTrackMetadataById !== 'function') {
      throw new Error('The configured data provider cannot move tracks between modes');
    }

    const mode = targetMode === 'night' ? 'night' : 'day';
    const existingMeta = this.fullLibraryMetadata.get(String(trackId));
    if (!existingMeta) {
      throw Object.assign(
        new Error('Track not found'),
        { localized: t('radio.trackNotFound') },
      );
    }

    if (existingMeta.mode === mode) {
      return { id: String(trackId), ...existingMeta };
    }

    const lock = this.getTrackEditLock(String(trackId));
    if (lock.locked) {
      const err = new Error(lock.reason?.uk || lock.reason?.ua || 'Track is locked');
      err.localized = lock.reason;
      throw err;
    }

    const filename = existingMeta.filename;
    const newTrackId = `${mode}/${filename}`;

    if (this.fullLibraryMetadata.has(newTrackId)) {
      throw Object.assign(
        new Error(`Track already exists in target mode: ${newTrackId}`),
        { localized: t('radio.filenameExistsInTarget') },
      );
    }

    const removedFromQueue = this.playlist.filter((entry) => entryId(entry) === String(trackId)).length;
    const removedCurrent   = this.currentTrack === String(trackId);

    this.playlist = this.playlist.filter((entry) => entryId(entry) !== String(trackId));
    if (this.currentIndex >= this.playlist.length) {
      this.currentIndex = Math.max(0, this.playlist.length - 1);
    }

    if (typeof mediaProvider?.copyAudio === 'function') {
      await mediaProvider.copyAudio(String(trackId), newTrackId);
    } else {
      const buffer = await mediaProvider.getAudioBuffer(String(trackId));
      await mediaProvider.uploadAudio(newTrackId, buffer, 'audio/mpeg');
    }

    const dbTrackId = this.dataProvider.getTrackIdByModeFilename(String(trackId));
    const updated = await this.dataProvider.updateTrackMetadataById(dbTrackId, { mode });

    try {
      await mediaProvider.deleteAudio(String(trackId));
    } catch (err) {
      console.warn(`[Radio] moveTrackToMode: failed to delete old file "${trackId}":`, err.message);
    }

    if (existingMeta.mode && this.metadataCache[existingMeta.mode]) {
      delete this.metadataCache[existingMeta.mode][filename];
    }
    if (!this.metadataCache[mode]) this.metadataCache[mode] = {};
    this.metadataCache[mode][filename] = { ...updated };

    if (this.trackMetadata.has(String(trackId))) {
      this.trackMetadata.delete(String(trackId));
      this.trackMetadata.set(newTrackId, { ...updated });
    }

    this.fullLibraryMetadata.delete(String(trackId));
    this.fullLibraryMetadata.set(newTrackId, { ...updated });
    this._buildMetadataMaps();

    if (removedCurrent) {
      this.isPlaying = false;
      this.currentTrack = null;
      this.currentTrackDuration = null;
      this.startTime = null;
      if (this.playlist.length) {
        this.currentIndex = Math.max(0, this.currentIndex - 1);
        await this.nextTrack(true);
      }
    }

    console.log(`[Radio] Track moved: "${trackId}" → "${newTrackId}" (removed from queue: ${removedFromQueue}, was current: ${removedCurrent})`);
    return { ...updated, removedFromQueue, removedCurrent, id: newTrackId };
  }

  _applyTrackToEngineCache(track) {
    const mode = track.mode === 'night' ? 'night' : 'day';
    const filename = String(track.filename || '').trim();
    if (!filename) {
      throw new Error('Track filename is required');
    }

    const meta = {
      artist:    track.artist ?? 'Unknown Artist',
      title:     track.title ?? basename(filename, '.mp3'),
      album:     track.album ?? '',
      year:      track.year ?? null,
      duration:  Number.isFinite(Number(track.duration)) ? Number(track.duration) : DEFAULT_DURATION,
      mode,
      filename,
      synced:    Boolean(track.synced),
      fetchedAt: track.fetchedAt ?? null,
    };

    if (!this.metadataCache[mode]) {
      this.metadataCache[mode] = {};
    }

    this.metadataCache[mode][filename] = meta;

    const fullId = `${mode}/${filename}`;
    this.fullLibraryMetadata.set(fullId, meta);

    if (this.playlist.some((entry) => entryId(entry) === fullId)) {
      this.trackMetadata.set(fullId, meta);
    }

    return { id: fullId, meta };
  }
}