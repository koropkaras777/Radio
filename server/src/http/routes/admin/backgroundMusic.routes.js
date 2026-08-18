import { Router } from 'express';
import express     from 'express';
import { parseBuffer } from 'music-metadata';
import { requireAdmin, getErrorPayload } from '../../../middleware/auth.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { requireCapability } from '../shared/capabilities.js';
import { sanitizeUploadedFilename, ensureMp3Filename } from './songs/songUploadHelpers.js';
import { requireJinglesPrivilege } from '../shared/requireJinglesPrivilege.js';
import { requireAdminBearerOrQuery, absoluteMediaUrl } from '../shared/adminMediaUrl.js';

const BACKGROUND_MUSIC_MIN_REQUIRED = 1;

export function createBackgroundMusicRouter({ io, radioEngine, mediaProvider }) {
  const router = Router();

  const requireBackgroundMusicSupport = requireCapability(
    'backgroundMusic',
    { mediaProvider, dataProvider: radioEngine.dataProvider },
    'upload.backgroundMusicUnavailable',
  );

  router.get('/counts', requireAdmin, requireBackgroundMusicSupport, async (req, res) => {
    try {
      const [dayRes, nightRes, dayUsable, nightUsable] = await Promise.all([
        radioEngine.dataProvider.queryBackgroundMusic({ mode: 'day',   offset: 0, limit: 1 }),
        radioEngine.dataProvider.queryBackgroundMusic({ mode: 'night', offset: 0, limit: 1 }),
        radioEngine.dataProvider.countUsableBackgroundMusic('day'),
        radioEngine.dataProvider.countUsableBackgroundMusic('night'),
      ]);
      res.json({
        ok: true,
        day: dayRes.total,
        night: nightRes.total,
        dayUsable,
        nightUsable,
        minRequired: BACKGROUND_MUSIC_MIN_REQUIRED,
      });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.bgCountFailed'));
    }
  });

  // ── List / search background music (paginated, served straight from cache) ─
  router.get('/', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const mode   = ['day', 'night'].includes(req.query.mode) ? req.query.mode : 'all';
    const search = String(req.query.search || '');
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { items, total } = await radioEngine.dataProvider.queryBackgroundMusic({ mode, search, offset, limit });
    res.json({ ok: true, items, total });
  });

  // ── Pre-upload duplicate check (by filename, global across day/night) ────
  router.post('/upload-check-duplicate', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ ok: false });
    const exists = await radioEngine.dataProvider.backgroundMusicFilenameExists(String(filename));
    res.json({ ok: true, exists });
  });

  router.post(
    '/upload',
    requireAdmin,
    requireJinglesPrivilege,
    requireBackgroundMusicSupport,
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
        if (await radioEngine.dataProvider.backgroundMusicFilenameExists(safeFilename)) {
          return res.status(409).json(getErrorPayload(null, 'upload.bgFilenameExists'));
        }

        const parsed = await parseBuffer(fileBuffer, { mimeType: contentType, path: safeFilename }).catch(() => null);
        const duration = Number.isFinite(Number(parsed?.format?.duration)) ? Number(parsed.format.duration) : null;

        await mediaProvider.uploadBackgroundMusic(mode, safeFilename, fileBuffer, contentType);

        const record = await radioEngine.dataProvider.createBackgroundMusic({
          filename: safeFilename,
          mode,
          duration,
          used: true,
        });

        io.emit('background_music_updated');

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.BACKGROUND_MUSIC_UPLOAD,
          data:          { filename: safeFilename, mode },
        }).catch(() => {});

        res.json({ ok: true, track: record });
      } catch (err) {
        console.error('[BackgroundMusic] upload error:', err);
        await mediaProvider.deleteBackgroundMusic(mode, safeFilename).catch(() => {});
        res.status(400).json(getErrorPayload(err, 'upload.bgUploadFailed'));
      }
    },
  );

  // ── Toggle "used in air" flag ─────────────────────────────────────────────
  router.post('/:id/used', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const { id } = req.params;
    const used = Boolean(req.body?.used);
    try {
      const updated = await radioEngine.dataProvider.updateBackgroundMusicUsed(id, used);
      if (!updated) return res.status(404).json(getErrorPayload(null, 'upload.bgNotFound'));
      io.emit('background_music_updated');
      res.json({ ok: true, track: updated });
    } catch (err) {
      console.error('[BackgroundMusic] toggle used error:', err);
      res.status(400).json(getErrorPayload(err, 'upload.bgUpdateFailed'));
    }
  });

  // ── Raw file, local storage only ──────────────────────────────────────────
  router.get('/file', requireAdminBearerOrQuery, requireBackgroundMusicSupport, (req, res) => {
    if (typeof mediaProvider.getBackgroundMusicReadStream !== 'function') {
      return res.status(404).json(getErrorPayload(null, 'upload.bgNotFound'));
    }

    try {
      const { stream, status, headers } = mediaProvider.getBackgroundMusicReadStream(
        req.query.mode,
        String(req.query.filename || ''),
        req.headers.range || null,
      );

      stream.on('error', (err) => {
        if (res.headersSent) return res.destroy();
        res.status(err.code === 'ENOENT' ? 404 : 500)
          .json(getErrorPayload(err, 'upload.bgNotFound'));
      });

      res.writeHead(status, { ...headers, 'Cache-Control': 'no-store' });
      stream.pipe(res);
    } catch (err) {
      res.status(err.status || 404).json(getErrorPayload(err, 'upload.bgNotFound'));
    }
  });

  // ── Playback URL (presigned in the cloud, a local route otherwise) ────────
  router.get('/:id/audio', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const track = await radioEngine.dataProvider.getBackgroundMusicById(req.params.id);
    if (!track) return res.status(404).json(getErrorPayload(null, 'upload.bgNotFound'));
    try {
      const url = await mediaProvider.getBackgroundMusicUrl(track.mode, track.filename);
      res.json({ ok: true, url: absoluteMediaUrl(req, url) });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.bgUrlFailed'));
    }
  });

  // ── Batch delete ───────────────────────────────────────────────────────────
  router.post('/batch-delete', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }

    const results = [];
    for (const id of ids) {
      const track = await radioEngine.dataProvider.getBackgroundMusicById(id);
      if (!track) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      try {
        await mediaProvider.deleteBackgroundMusic(track.mode, track.filename);
        await radioEngine.dataProvider.deleteBackgroundMusic(track.id);
        results.push({ id, ok: true });

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.BACKGROUND_MUSIC_DELETE,
          data:          { filename: track.filename, mode: track.mode },
        }).catch(() => {});
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('background_music_updated');
    res.json({ ok: true, results });
  });

  // ── Batch move to the other mode ──────────────────────────────────────────
  router.post('/batch-move', requireAdmin, requireJinglesPrivilege, requireBackgroundMusicSupport, async (req, res) => {
    const { ids, targetMode } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }
    if (targetMode !== 'day' && targetMode !== 'night') {
      return res.status(400).json(getErrorPayload(null, 'common.invalidMode'));
    }

    const results = [];
    for (const id of ids) {
      const track = await radioEngine.dataProvider.getBackgroundMusicById(id);
      if (!track) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      if (track.mode === targetMode) { results.push({ id, ok: true }); continue; }

      try {
        const buffer = await mediaProvider.getBackgroundMusicBuffer(track.mode, track.filename);
        await mediaProvider.uploadBackgroundMusic(targetMode, track.filename, buffer, 'audio/mpeg');
        await mediaProvider.deleteBackgroundMusic(track.mode, track.filename);

        await radioEngine.dataProvider.moveBackgroundMusicMode(track.id, targetMode);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('background_music_updated');
    res.json({ ok: true, results });
  });

  return router;
}