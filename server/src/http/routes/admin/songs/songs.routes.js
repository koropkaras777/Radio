import { Router } from 'express';
import express from 'express';
import { parseBuffer } from 'music-metadata';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../../middleware/auth.js';
import { PRIVILEGES } from '../../../../config/privileges.js';
import { t } from '../../../../i18n/index.js';
import { auditLogger, AUDIT_TYPES } from '../../../../audit/auditLogger.js';
import { TIME_ZONE, LOG_PURGE_HOUR, SUPER_ADMIN_LOGIN } from '../../../../config/env.js';
import { sanitizeArtistKey } from '../../shared/artistKey.js';
import { lyricsStatus } from '../../shared/lyricsStatus.js';
import { artistArtsIndexCache, artistArtBinaryCache, cacheArtistArtItem } from '../../shared/artistArtsCache.js';
import { requireCapability } from '../../shared/capabilities.js';
import {
  sanitizeUploadedFilename,
  ensureMp3Filename,
  buildTrackId,
  getLyricsFetchSummary,
  extractArtistKeyFromFilename,
  areMetadataEqual,
} from './songUploadHelpers.js';

// ── Daily bulk-delete quota for non-super-admins ───────────────────────────
const DAILY_DELETE_LIMIT = 30;
const dailyDeleteCounts  = new Map();

const getDeletePeriodKey = (now = new Date()) => {
  const zoned       = new Date(now.toLocaleString('en-US', { timeZone: TIME_ZONE }));
  const periodStart = new Date(zoned);
  periodStart.setHours(LOG_PURGE_HOUR, 0, 0, 0);
  if (periodStart > zoned) periodStart.setDate(periodStart.getDate() - 1);
  return periodStart.getTime();
};

const checkDeleteQuota = (adminId, requestedCount) => {
  const periodKey = getDeletePeriodKey();
  const entry     = dailyDeleteCounts.get(adminId);
  const usedSoFar = (entry && entry.periodKey === periodKey) ? entry.count : 0;
  const remaining = DAILY_DELETE_LIMIT - usedSoFar;
  return { remaining, allowed: requestedCount <= remaining };
};

const recordDeletes = (adminId, actualCount) => {
  if (actualCount <= 0) return;
  const periodKey = getDeletePeriodKey();
  const entry     = dailyDeleteCounts.get(adminId);
  if (!entry || entry.periodKey !== periodKey) {
    dailyDeleteCounts.set(adminId, { periodKey, count: actualCount });
  } else {
    entry.count += actualCount;
  }
};

export function createSongsRouter({ io, radioEngine, mediaProvider, dataProvider, fetchLyricsForSong }) {
  const providers        = { mediaProvider, dataProvider: dataProvider || radioEngine.dataProvider };
  const canUploadTracks  = requireCapability('uploadTracks', providers);
  const canEditTracks    = requireCapability('editTrackMetadata', providers);
  const canMoveTracks    = requireCapability('moveTrackMode', providers);
  const canDeleteTracks  = requireCapability('deleteTracks', providers);

  const router = Router();

  const checkOrphanedArtist = (artistKey) => {
    if (!artistKey) return null;
    const stillHasTracks = [...radioEngine.fullLibraryMetadata.entries()].some(
      ([, meta]) => sanitizeArtistKey(meta.artist || '') === artistKey,
    );
    if (stillHasTracks) return null;
    const artEntry = artistArtsIndexCache.get(artistKey);
    if (!artEntry) return null;
    return { artist: artistKey, hasArt: Boolean(artEntry.hasArt) };
  };

  const removeArtistEntryNoFile = async (artistKey) => {
    if (typeof radioEngine.dataProvider?.deleteArtistArt === 'function') {
      await radioEngine.dataProvider.deleteArtistArt(artistKey);
    }
    artistArtsIndexCache.delete(artistKey);
    artistArtBinaryCache.delete(artistKey);
  };

  // ── Songs list (any authenticated admin) ──────────────────────────────────
  router.get('/songs', requireAdmin, (req, res) => {
    try {
      const requestedMode = String(req.query?.mode || '').toLowerCase();
      const mode = requestedMode === 'day' || requestedMode === 'night'
        ? requestedMode
        : radioEngine.getDesiredMode();
      const songs = [];
      radioEngine.fullLibraryMetadata.forEach((meta, id) => {
        if (id.startsWith(`${mode}/`)) {
          songs.push({
            id,
            title:        meta.title,
            artist:       meta.artist,
            filename:     id,
            lyricsStatus: lyricsStatus(radioEngine.getLyrics(meta.title, meta.artist)),
          });
        }
      });
      songs.sort((a, b) => a.artist.localeCompare(b.artist));
      res.json(songs);
    } catch (err) {
      console.error('[Admin API] Error:', err);
      res.status(500).json({ error: t('common.internalServerError') });
    }
  });

  router.post('/upload-check-duplicate', requireAdmin, requirePrivilege(PRIVILEGES.UPLOAD_SONGS), (req, res) => {
    const { trackId } = req.body || {};
    if (!trackId) return res.status(400).json({ ok: false });
    const exists = radioEngine.fullLibraryMetadata.has(String(trackId));
    res.json({ ok: true, exists });
  });

  // ── Upload MP3 file to storage ───────────────────────────────────
  router.post(
    '/upload-song-file',
    canUploadTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    express.raw({ type: ['audio/mpeg', 'audio/mp3', 'application/octet-stream'], limit: '80mb' }),
    async (req, res) => {
      const mode         = req.query.mode === 'night' ? 'night' : 'day';
      const originalName = decodeURIComponent(String(req.headers['x-file-name'] || ''));
      const contentType  = req.headers['content-type'] || 'audio/mpeg';
      const fileBuffer   = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);

      if (!fileBuffer.length) {
        return res.status(400).json(getErrorPayload(null, 'common.noFilePayload'));
      }

      const safeFilename = ensureMp3Filename(sanitizeUploadedFilename(originalName));
      if (!safeFilename || !/\.mp3$/i.test(safeFilename)) {
        return res.status(400).json(getErrorPayload(null, 'common.mp3Only'));
      }

      try {
        const parsed  = await parseBuffer(fileBuffer, { mimeType: contentType, path: safeFilename });
        const trackId = buildTrackId(mode, safeFilename);

        if (radioEngine.fullLibraryMetadata.has(trackId)) {
          return res.status(409).json(getErrorPayload(null, 'upload.trackFilenameExists'));
        }

        await mediaProvider.uploadAudio(trackId, fileBuffer, contentType);

        const metadata = {
          artist:     parsed.common.artist   || 'Unknown Artist',
          title:      parsed.common.title    || safeFilename.replace(/\.mp3$/i, ''),
          album:      parsed.common.album    || '',
          year:       Number.isFinite(Number(parsed.common.year))     ? Number(parsed.common.year)     : null,
          duration:   Number.isFinite(Number(parsed.format.duration)) ? Number(parsed.format.duration) : null,
          mode,
          filename:   safeFilename,
          storageKey: trackId,
        };

        res.json({ ok: true, metadata, storageKey: trackId });
      } catch (err) {
        console.error('[Upload Song] file step error:', err);
        res.status(400).json(getErrorPayload(err, 'upload.storageUploadFailed'));
      }
    },
  );

  // ── Fetch lyrics for the uploaded track ───────────────────────────
  router.post(
    '/upload-song-lyrics',
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { title, artist, album, duration } = req.body || {};

      if (!title || !artist) {
        return res.status(400).json(getErrorPayload(null, 'upload.titleArtistRequired'));
      }

      try {
        const entry   = await fetchLyricsForSong(String(title), String(artist), album ? String(album) : '', Number(duration) || undefined);
        const summary = getLyricsFetchSummary(entry);
        res.json({
          ok: true,
          lyricsEntry:  entry,
          lyricsStatus: summary.status,
          lyricsFormat: summary.format,
          message:      summary.message,
        });
      } catch (err) {
        console.error('[Upload Song] lyrics step error:', err);
        res.status(500).json({
          ok: false,
          lyricsEntry:  { notFound: true, reason: 'fetch_error', fetchedAt: Date.now() },
          lyricsStatus: 'none',
          lyricsFormat: null,
          ...getErrorPayload(err, 'lyrics.fetchFailed'),
        });
      }
    },
  );

  // ── Commit track to the database ─────────────────────────────────
  router.post(
    '/upload-song-commit',
    canUploadTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { metadata, lyricsEntry } = req.body || {};

      if (!metadata || !metadata.filename || !metadata.mode) {
        return res.status(400).json(getErrorPayload(null, 'upload.notEnoughDataForDb'));
      }

      try {
        const addedTrack = await radioEngine.registerUploadedTrack({
          artist:   metadata.artist,
          title:    metadata.title,
          album:    metadata.album,
          year:     metadata.year,
          duration: metadata.duration,
          mode:     metadata.mode,
          filename: metadata.filename,
        });

        const lyricsSummary = getLyricsFetchSummary(lyricsEntry);
        if (lyricsEntry) {
          await radioEngine.persistLyricsEntry(metadata.title, metadata.artist, lyricsEntry);
        }

        if (typeof radioEngine.dataProvider?.ensureArtistArtEntry === 'function') {
          const artistKey = extractArtistKeyFromFilename(metadata.filename);
          if (artistKey) {
            const artistEntry = await radioEngine.dataProvider.ensureArtistArtEntry(artistKey);
            cacheArtistArtItem(artistEntry);
          }
        }

        io.emit('library_updated');

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.UPLOAD_SONG,
          data:          { title: metadata.title, artist: metadata.artist, mode: metadata.mode },
        }).catch(() => {});

        res.json({
          ok:            true,
          track:         addedTrack,
          lyricsStatus:  lyricsSummary.status,
          lyricsFormat:  lyricsSummary.format,
          lyricsMessage: lyricsSummary.message,
          message:       t('upload.trackUploaded'),
        });
      } catch (err) {
        console.error('[Upload Song] commit step error:', err);
        res.status(400).json(getErrorPayload(err, 'upload.dbSaveFailed'));
      }
    },
  );

  // ── Song editor: save (metadata + lyrics + offset) ────────────────────────
  router.post('/song-editor/save', requireAdmin, canEditTracks, async (req, res) => {
    const { songId, metadata, lyricsEntry, lyricsChanged = false, offset, offsetChanged = false, metadataChanged = false } = req.body || {};

    if (!songId || !metadata) {
      return res.status(400).json(getErrorPayload(null, 'upload.notEnoughDataToSave'));
    }

    const adminPrivs = Array.isArray(req.admin?.privileges) ? req.admin.privileges : [];
    const hasEditorMeta   = adminPrivs.includes(PRIVILEGES.EDITOR_META);
    const hasEditorLyrics = adminPrivs.includes(PRIVILEGES.EDITOR_LYRICS);

    if (metadataChanged && !hasEditorMeta) {
      return res.status(403).json({ error: t('upload.noMetaEditPrivilege') });
    }

    if (!metadataChanged && !hasEditorLyrics && !hasEditorMeta) {
      return res.status(403).json({ error: t('upload.noLyricsEditPrivilege') });
    }

    try {
      const lock = radioEngine.getTrackEditLock(String(songId));
      if (lock.locked) {
        return res.status(409).json({ ok: false, localized: lock.reason });
      }

      const currentMeta = radioEngine.fullLibraryMetadata.get(String(songId));
      if (!currentMeta) {
        return res.status(404).json(getErrorPayload(null, 'common.trackNotFound'));
      }

      const nextMeta = {
        title:  String(metadata.title  || '').trim(),
        artist: String(metadata.artist || '').trim(),
        album:  String(metadata.album  || '').trim(),
        year:   Number.isFinite(Number(metadata.year)) ? Number(metadata.year) : null,
      };

      const actualMetadataChanged = metadataChanged && !areMetadataEqual(currentMeta, nextMeta);
      let updatedTrack = { id: String(songId), ...currentMeta };

      if (actualMetadataChanged) {
        const sourceBuffer = await mediaProvider.getAudioBuffer(String(songId));
        const nodeId3Mod   = await import('node-id3');
        const NodeID3      = nodeId3Mod.default || nodeId3Mod;
        const tags = {
          title:  nextMeta.title,
          artist: nextMeta.artist,
          album:  nextMeta.album,
          year:   nextMeta.year ? String(nextMeta.year) : undefined,
        };
        const srcBuf       = Buffer.from(sourceBuffer);
        let taggedBuffer   = NodeID3.update(tags, srcBuf) || NodeID3.write(tags, srcBuf);

        if (!taggedBuffer) {
          throw Object.assign(new Error('Failed to update MP3 tags'), {
            localized: t('upload.mp3TagsUpdateFailed'),
          });
        }

        await mediaProvider.replaceAudio(String(songId), taggedBuffer, 'audio/mpeg');
        updatedTrack = await radioEngine.updateTrackMetadata(String(songId), nextMeta);
      }

      const effectiveTitle  = actualMetadataChanged ? updatedTrack.title  : currentMeta.title;
      const effectiveArtist = actualMetadataChanged ? updatedTrack.artist : currentMeta.artist;

      let savedLyrics = radioEngine.getLyrics(effectiveTitle, effectiveArtist);
      let savedOffset = radioEngine.getLyricsOffset(effectiveTitle, effectiveArtist);

      if (lyricsChanged) {
        savedLyrics = await radioEngine.persistLyricsEntry(effectiveTitle, effectiveArtist, lyricsEntry || { synced: false, lines: [], fetchedAt: Date.now() });
      }

      if (offsetChanged) {
        savedOffset = await radioEngine.persistLyricsOffset(effectiveTitle, effectiveArtist, offset);
      }

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');

      if (actualMetadataChanged) {
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.EDIT_SONG_META,
          data:          { title: nextMeta.title, artist: nextMeta.artist },
        }).catch(() => {});
      } else if (lyricsChanged || offsetChanged) {
        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.EDIT_SONG_LYRICS,
          data:          { title: effectiveTitle, artist: effectiveArtist },
        }).catch(() => {});
      }

      res.json({
        ok:     true,
        track:  updatedTrack,
        entry:  savedLyrics || { synced: false, lines: [], fetchedAt: Date.now() },
        offset: Number.isFinite(Number(savedOffset)) ? Number(savedOffset) : 0,
        message: t('upload.trackUpdated'),
      });
    } catch (err) {
      console.error('[Song Editor] save error:', err);
      res.status(400).json(getErrorPayload(err, 'upload.trackSaveFailed'));
    }
  });

  router.get('/song-editor/download', requireAdmin, requirePrivilege(PRIVILEGES.EDITOR_META), async (req, res) => {
    const songId = req.query?.songId;
    if (!songId) {
      return res.status(400).json(getErrorPayload(null, 'upload.noSongSpecified'));
    }

    try {
      const meta   = radioEngine.fullLibraryMetadata.get(String(songId));
      const buffer = await mediaProvider.getAudioBuffer(String(songId));

      const niceName = meta
        ? `${meta.artist || 'Unknown Artist'} - ${meta.title || 'Untitled'}`.trim()
        : String(songId).split('/').pop().replace(/\.mp3$/i, '');
      const safeName    = (niceName.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 150) || 'track');
      const asciiFallback = safeName.replace(/[^\x20-\x7E]/g, '').trim() || 'track';

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiFallback}.mp3"; filename*=UTF-8''${encodeURIComponent(safeName)}.mp3`,
      );
      res.send(buffer);
    } catch (err) {
      console.error('[Song Editor] download error:', err);
      const status = err.status === 404 ? 404 : 400;
      res.status(status).json(getErrorPayload(err, 'upload.trackDownloadFailed'));
    }
  });

  // ── Song editor: move track between day/night (cloud only) ───────────────
  router.post('/song-editor/move-mode', requireAdmin, canMoveTracks, requirePrivilege(PRIVILEGES.EDITOR_META), async (req, res) => {
    const { songId, targetMode } = req.body || {};

    if (!songId) {
      return res.status(400).json(getErrorPayload(null, 'common.songIdRequired'));
    }

    if (targetMode !== 'day' && targetMode !== 'night') {
      return res.status(400).json(getErrorPayload(null, 'common.invalidModeDayNight'));
    }

    try {
      const lock = radioEngine.getTrackEditLock(String(songId));
      if (lock.locked) {
        return res.status(409).json({ ok: false, localized: lock.reason });
      }

      const preMeta    = radioEngine.fullLibraryMetadata.get(String(songId));
      const preArtist  = preMeta ? sanitizeArtistKey(preMeta.artist || '') : '';

      const movedTrack = await radioEngine.moveTrackToMode(String(songId), targetMode, mediaProvider);

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');
      if (movedTrack.removedFromQueue > 0 || movedTrack.removedCurrent) {
        io.emit('queue_updated', radioEngine.getQueueState?.() ?? {});
      }

      const orphanedArtist = checkOrphanedArtist(preArtist);
      if (orphanedArtist && !orphanedArtist.hasArt) {
        await removeArtistEntryNoFile(orphanedArtist.artist).catch(() => {});
      }

      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
        adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.EDIT_SONG_META,
        data:          { title: movedTrack.title, artist: movedTrack.artist, movedTo: targetMode },
      }).catch(() => {});

      res.json({
        ok:      true,
        track:   movedTrack,
        removedArtists: orphanedArtist ? [orphanedArtist] : [],
        message: t(targetMode === 'night' ? 'upload.trackMovedNight' : 'upload.trackMovedDay'),
      });
    } catch (err) {
      console.error('[Song Editor] move-mode error:', err);
      const status = err.localized ? 409 : 400;
      res.status(status).json(getErrorPayload(err, 'upload.trackMoveFailed'));
    }
  });

  // ── Song editor: delete ───────────────────────────────────────────────────
  router.delete(
    '/song-editor',
    canDeleteTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.EDITOR_META),
    async (req, res) => {
      const { songId } = req.body || {};

      if (!songId) {
        return res.status(400).json(getErrorPayload(null, 'common.songIdRequired'));
      }

      const isSuperAdmin = req.admin?.role === 'super_admin';
      const adminId      = req.admin?.adminId || req.admin?.login || 'unknown';

      if (!isSuperAdmin) {
        const { remaining, allowed } = checkDeleteQuota(adminId, 1);
        if (!allowed) {
          return res.status(429).json(getErrorPayload(
            null,
            'upload.dailyDeleteLimit',
            { remaining: Math.max(0, remaining), limit: DAILY_DELETE_LIMIT },
          ));
        }
      }

      try {
        const lock = radioEngine.getTrackEditLock(String(songId));
        if (lock.locked) {
          return res.status(409).json({ ok: false, localized: lock.reason });
        }

        const deletedMeta   = radioEngine.fullLibraryMetadata.get(String(songId));
        const deletedArtist = deletedMeta ? sanitizeArtistKey(deletedMeta.artist || '') : '';

        await mediaProvider.deleteAudio(String(songId));
        const result = await radioEngine.deleteTrack(String(songId));
        if (!isSuperAdmin) recordDeletes(adminId, 1);

        const orphanedArtist = checkOrphanedArtist(deletedArtist);
        if (orphanedArtist && !orphanedArtist.hasArt) {
          await removeArtistEntryNoFile(orphanedArtist.artist).catch(() => {});
        }

        io.emit('sync', radioEngine.getState());
        io.emit('library_updated');

        if (result?.removedFromQueue > 0 || result?.removedCurrent) {
          io.emit('queue_updated', radioEngine.getQueueState?.() ?? {});
        }

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.DELETE_SONG,
          data:          { title: deletedMeta?.title || songId, artist: deletedMeta?.artist || '' },
        }).catch(() => {});

        res.json({
          ok: true,
          ...result,
          removedArtists: orphanedArtist ? [orphanedArtist] : [],
          message: t('upload.trackDeleted'),
        });
      } catch (err) {
        console.error('[Song Editor] delete error:', err);
        res.status(400).json(getErrorPayload(err, 'upload.trackDeleteFailed'));
      }
    },
  );

  // ── Batch delete uploaded songs ──────────────────────────────────────────
  router.post(
    '/upload-batch-delete',
    canDeleteTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { songIds } = req.body || {};
      if (!Array.isArray(songIds) || !songIds.length) {
        return res.status(400).json(getErrorPayload(null, 'common.songIdsRequired'));
      }

      const results         = [];
      const orphanedArtists = new Map();

      for (const songId of songIds) {
        const preMeta   = radioEngine.fullLibraryMetadata.get(String(songId));
        const preArtist = preMeta ? sanitizeArtistKey(preMeta.artist || '') : '';
        try {
          await mediaProvider.deleteAudio(String(songId));
          await radioEngine.deleteTrack(String(songId));
          results.push({ songId, ok: true });

          const orphaned = checkOrphanedArtist(preArtist);
          if (orphaned && !orphanedArtists.has(orphaned.artist)) {
            orphanedArtists.set(orphaned.artist, orphaned);
          }
        } catch (err) {
          results.push({ songId, ok: false, error: err.message });
        }
      }

      for (const [artistKey, entry] of orphanedArtists) {
        if (!entry.hasArt) {
          await removeArtistEntryNoFile(artistKey).catch(() => {});
          orphanedArtists.delete(artistKey);
        }
      }

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');

      res.json({ ok: true, results, removedArtists: [...orphanedArtists.values()] });
    },
  );

  // ── Batch move uploaded songs to another mode ─────────────────────────────
  router.post(
    '/upload-batch-move',
    canMoveTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { songIds, targetMode } = req.body || {};
      if (!Array.isArray(songIds) || !songIds.length) {
        return res.status(400).json(getErrorPayload(null, 'common.songIdsRequired'));
      }
      if (targetMode !== 'day' && targetMode !== 'night') {
        return res.status(400).json(getErrorPayload(null, 'common.invalidMode'));
      }

      const results         = [];
      const orphanedArtists = new Map();

      for (const songId of songIds) {
        const preMeta   = radioEngine.fullLibraryMetadata.get(String(songId));
        const preArtist = preMeta ? sanitizeArtistKey(preMeta.artist || '') : '';
        try {
          const moved = await radioEngine.moveTrackToMode(String(songId), targetMode, mediaProvider);
          results.push({ songId, ok: true, newId: moved.id });

          const orphaned = checkOrphanedArtist(preArtist);
          if (orphaned && !orphanedArtists.has(orphaned.artist)) {
            orphanedArtists.set(orphaned.artist, orphaned);
          }
        } catch (err) {
          results.push({ songId, ok: false, error: err.message });
        }
      }

      for (const [artistKey, entry] of orphanedArtists) {
        if (!entry.hasArt) {
          await removeArtistEntryNoFile(artistKey).catch(() => {});
          orphanedArtists.delete(artistKey);
        }
      }

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');

      res.json({ ok: true, results, removedArtists: [...orphanedArtists.values()] });
    },
  );

  // ── Song editor: bulk delete (checkbox multi-select, EDITOR_META, lock-aware) ─
  router.post(
    '/song-editor/batch-delete',
    canDeleteTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.EDITOR_META),
    async (req, res) => {
      const { songIds } = req.body || {};
      if (!Array.isArray(songIds) || !songIds.length) {
        return res.status(400).json(getErrorPayload(null, 'common.songIdsRequired'));
      }

      const isSuperAdmin     = req.admin?.role === 'super_admin';
      const adminId          = req.admin?.adminId || req.admin?.login || 'unknown';
      const totalLibrarySize = radioEngine.fullLibraryMetadata.size;
      const isDeleteAll      = totalLibrarySize > 0 && songIds.length === totalLibrarySize;

      if (isDeleteAll && !isSuperAdmin) {
        return res.status(403).json(getErrorPayload(null, 'upload.deleteAllSuperAdminOnly'));
      }

      if (!isSuperAdmin) {
        const { remaining, allowed } = checkDeleteQuota(adminId, songIds.length);
        if (!allowed) {
          return res.status(429).json(getErrorPayload(
            null,
            'upload.dailyDeleteLimit',
            { remaining: Math.max(0, remaining), limit: DAILY_DELETE_LIMIT },
          ));
        }
      }

      const results         = [];
      const orphanedArtists = new Map();

      for (const songId of songIds) {
        const lock = radioEngine.getTrackEditLock(String(songId));
        if (lock.locked) {
          results.push({ songId, ok: false, error: lock.reason?.uk || lock.reason?.ua || lock.reason?.en || 'locked' });
          continue;
        }

        const preMeta   = radioEngine.fullLibraryMetadata.get(String(songId));
        const preArtist = preMeta ? sanitizeArtistKey(preMeta.artist || '') : '';

        try {
          await mediaProvider.deleteAudio(String(songId));
          await radioEngine.deleteTrack(String(songId));
          results.push({ songId, ok: true });

          auditLogger.log({
            adminId:       req.admin.adminId || 'super',
            adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
            operationType: AUDIT_TYPES.DELETE_SONG,
            data:          { title: preMeta?.title || songId, artist: preMeta?.artist || '' },
          }).catch(() => {});

          const orphaned = checkOrphanedArtist(preArtist);
          if (orphaned && !orphanedArtists.has(orphaned.artist)) {
            orphanedArtists.set(orphaned.artist, orphaned);
          }
        } catch (err) {
          results.push({ songId, ok: false, error: err.message });
        }
      }

      for (const [artistKey, entry] of orphanedArtists) {
        if (!entry.hasArt) {
          await removeArtistEntryNoFile(artistKey).catch(() => {});
          orphanedArtists.delete(artistKey);
        }
      }

      if (!isSuperAdmin) {
        const okCount = results.filter((r) => r.ok).length;
        recordDeletes(adminId, okCount);
      }

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');

      res.json({ ok: true, results, removedArtists: [...orphanedArtists.values()] });
    },
  );

  // ── Song editor: bulk move between day/night (checkbox multi-select) ─────
  router.post(
    '/song-editor/batch-move',
    canMoveTracks,
    requireAdmin,
    requirePrivilege(PRIVILEGES.EDITOR_META),
    async (req, res) => {
      const { songIds, targetMode } = req.body || {};
      if (!Array.isArray(songIds) || !songIds.length) {
        return res.status(400).json(getErrorPayload(null, 'common.songIdsRequired'));
      }
      if (targetMode !== 'day' && targetMode !== 'night') {
        return res.status(400).json(getErrorPayload(null, 'common.invalidModeDayNight'));
      }

      const results         = [];
      const orphanedArtists = new Map();

      for (const songId of songIds) {
        const lock = radioEngine.getTrackEditLock(String(songId));
        if (lock.locked) {
          results.push({ songId, ok: false, error: lock.reason?.uk || lock.reason?.ua || lock.reason?.en || 'locked' });
          continue;
        }

        const preMeta   = radioEngine.fullLibraryMetadata.get(String(songId));
        const preArtist = preMeta ? sanitizeArtistKey(preMeta.artist || '') : '';

        try {
          const moved = await radioEngine.moveTrackToMode(String(songId), targetMode, mediaProvider);
          results.push({ songId, ok: true, newId: moved.id, track: moved });

          auditLogger.log({
            adminId:       req.admin.adminId || 'super',
            adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
            operationType: AUDIT_TYPES.EDIT_SONG_META,
            data:          { title: moved.title, artist: moved.artist, movedTo: targetMode },
          }).catch(() => {});

          const orphaned = checkOrphanedArtist(preArtist);
          if (orphaned && !orphanedArtists.has(orphaned.artist)) {
            orphanedArtists.set(orphaned.artist, orphaned);
          }
        } catch (err) {
          results.push({ songId, ok: false, error: err.message });
        }
      }

      for (const [artistKey, entry] of orphanedArtists) {
        if (!entry.hasArt) {
          await removeArtistEntryNoFile(artistKey).catch(() => {});
          orphanedArtists.delete(artistKey);
        }
      }

      io.emit('sync', radioEngine.getState());
      io.emit('library_updated');
      if (results.some((r) => r.ok)) {
        io.emit('queue_updated', radioEngine.getQueueState?.() ?? {});
      }

      res.json({ ok: true, results, removedArtists: [...orphanedArtists.values()] });
    },
  );

  return router;
}