import { Router } from 'express';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { parseBuffer } from 'music-metadata';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../../middleware/auth.js';
import { PRIVILEGES } from '../../../../config/privileges.js';
import {
  sanitizeUploadedFilename,
  ensureMp3Filename,
  buildTrackId,
} from './songUploadHelpers.js';
import {
  findYtbdown,
  getYoutubeToolsStatus,
  isSupportedYoutubeUrl,
  isPlaylistUrl,
  downloadYoutubeTrack,
  listYoutubeTracks,
} from '../../../../tools/ytbdown/ytbDownloader.js';

const MAX_PLAYLIST_TRACKS = 100;

export function createYoutubeRouter({ radioEngine, mediaProvider }) {
  const router = Router();

  router.get(
    '/ytbdown-status',
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const status = await getYoutubeToolsStatus();
      res.json({ ok: true, ...status });
    },
  );

  const LIVE_COOKIES_PATH = path.join(tmpdir(), 'ytb-cookies.txt');

  router.post(
    '/youtube-cookies',
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { cookies } = req.body || {};
      if (!cookies || typeof cookies !== 'string' || !cookies.includes('youtube.com')) {
        return res.status(400).json(getErrorPayload(null, 'upload.cookiesRequired'));
      }
      try {
        await writeFile(LIVE_COOKIES_PATH, cookies, 'utf8');
        res.json({ ok: true, path: LIVE_COOKIES_PATH });
      } catch (err) {
        res.status(500).json(getErrorPayload(err, 'upload.cookiesSaveFailed'));
      }
    },
  );

  router.post(
    '/youtube-track-info',
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { url, lang: cliLang } = req.body || {};

      if (!url || typeof url !== 'string') {
        return res.status(400).json(getErrorPayload(null, 'upload.youtubeLinkRequired'));
      }
      if (!isSupportedYoutubeUrl(url)) {
        return res.status(400).json(getErrorPayload(null, 'upload.notYoutubeLink'));
      }

      const ytbdownPath = await findYtbdown();
      if (!ytbdownPath) {
        return res.status(503).json(getErrorPayload(null, 'upload.ytbdownNotFound'));
      }

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      try {
        const tracks = await listYoutubeTracks(url, {
          lang: cliLang === 'en' ? 'en' : 'uk',
          signal: controller.signal,
        });

        const truncated = tracks.length > MAX_PLAYLIST_TRACKS;
        const limited    = truncated ? tracks.slice(0, MAX_PLAYLIST_TRACKS) : tracks;

        res.json({
          ok: true,
          tracks: limited,
          total: tracks.length,
          truncated,
        });
      } catch (err) {
        if (controller.signal.aborted || err.code === 'YTBDOWN_ABORTED') {
          return;
        }
        console.error('[Upload Song] youtube track info error:', err);
        if (err.code === 'YTBDOWN_NOT_FOUND') {
          return res.status(503).json(getErrorPayload(err, 'upload.ytbdownNotFound'));
        }
        if (err.code === 'YTBDOWN_TIMEOUT') {
          return res.status(504).json(getErrorPayload(err, 'upload.playlistTimeout'));
        }
        res.status(400).json(getErrorPayload(err, 'upload.playlistFetchFailed'));
      }
    },
  );

  router.post(
    '/upload-song-url',
    requireAdmin,
    requirePrivilege(PRIVILEGES.UPLOAD_SONGS),
    async (req, res) => {
      const { url, lang: cliLang } = req.body || {};
      const mode = req.body?.mode === 'night' ? 'night' : 'day';

      if (!url || typeof url !== 'string') {
        return res.status(400).json(getErrorPayload(null, 'upload.youtubeLinkRequired'));
      }
      if (!isSupportedYoutubeUrl(url)) {
        return res.status(400).json(getErrorPayload(null, 'upload.notYoutubeLink'));
      }
      if (isPlaylistUrl(url)) {
        return res.status(400).json(getErrorPayload(null, 'upload.playlistNotSupported'));
      }

      const { ytbdownAvailable, ffmpegAvailable } = await getYoutubeToolsStatus();
      if (!ytbdownAvailable) {
        return res.status(503).json(getErrorPayload(null, 'upload.ytbdownNotFound'));
      }
      if (!ffmpegAvailable) {
        return res.status(503).json(getErrorPayload(null, 'upload.ffmpegNotFound'));
      }

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      try {
        const { buffer, filename } = await downloadYoutubeTrack(url, {
          quality: '128K',
          lang: cliLang === 'en' ? 'en' : 'uk',
          signal: controller.signal,
        });

        const safeFilename = ensureMp3Filename(sanitizeUploadedFilename(filename));
        if (!safeFilename || !/\.mp3$/i.test(safeFilename)) {
          return res.status(500).json(getErrorPayload(null, 'upload.unexpectedDownloadFormat'));
        }

        const parsed  = await parseBuffer(buffer, { mimeType: 'audio/mpeg', path: safeFilename });
        const trackId = buildTrackId(mode, safeFilename);

        if (radioEngine.fullLibraryMetadata.has(trackId)) {
          return res.status(409).json(getErrorPayload(null, 'upload.trackFilenameExists'));
        }

        await mediaProvider.uploadAudio(trackId, buffer, 'audio/mpeg');

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
        if (controller.signal.aborted || err.code === 'YTBDOWN_ABORTED') {
          return;
        }
        console.error('[Upload Song] youtube download error:', err);
        if (err.code === 'YTBDOWN_NOT_FOUND') {
          return res.status(503).json(getErrorPayload(err, 'upload.ytbdownNotFound'));
        }
        if (err.code === 'FFMPEG_NOT_FOUND') {
          return res.status(503).json(getErrorPayload(err, 'upload.ffmpegNotFound'));
        }
        if (err.code === 'YTBDOWN_TIMEOUT') {
          return res.status(504).json(getErrorPayload(err, 'upload.downloadTimeout'));
        }
        res.status(400).json(getErrorPayload(err, 'upload.youtubeDownloadFailed'));
      }
    },
  );

  return router;
}