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

const JINGLES_MIN_REQUIRED = 3;

export function createJinglesRouter({ io, radioEngine, mediaProvider }) {
  const router = Router();

  const requireJinglesSupport = requireCapability(
    'jingles',
    { mediaProvider, dataProvider: radioEngine.dataProvider },
    'upload.jinglesUnavailable',
  );

  router.get('/counts', requireAdmin, requireJinglesSupport, async (req, res) => {
    try {
      const [dayRes, nightRes, dayUsable, nightUsable] = await Promise.all([
        radioEngine.dataProvider.queryJingles({ mode: 'day',   offset: 0, limit: 1 }),
        radioEngine.dataProvider.queryJingles({ mode: 'night', offset: 0, limit: 1 }),
        radioEngine.dataProvider.countUsableJingles('day'),
        radioEngine.dataProvider.countUsableJingles('night'),
      ]);
      res.json({
        ok: true,
        day: dayRes.total,
        night: nightRes.total,
        dayUsable,
        nightUsable,
        minRequired: JINGLES_MIN_REQUIRED,
      });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.jingleCountFailed'));
    }
  });

  // ── List / search jingles (paginated, served straight from cache) ────────
  router.get('/', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const mode   = ['day', 'night'].includes(req.query.mode) ? req.query.mode : 'all';
    const search = String(req.query.search || '');
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { items, total } = await radioEngine.dataProvider.queryJingles({ mode, search, offset, limit });
    res.json({ ok: true, items, total });
  });

  // ── Pre-upload duplicate check (by filename, global across day/night) ────
  router.post('/upload-check-duplicate', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ ok: false });
    const exists = await radioEngine.dataProvider.jingleFilenameExists(String(filename));
    res.json({ ok: true, exists });
  });

  router.post(
    '/upload',
    requireAdmin,
    requireJinglesPrivilege,
    requireJinglesSupport,
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
        if (await radioEngine.dataProvider.jingleFilenameExists(safeFilename)) {
          return res.status(409).json(getErrorPayload(null, 'upload.jingleFilenameExists'));
        }

        const parsed = await parseBuffer(fileBuffer, { mimeType: contentType, path: safeFilename }).catch(() => null);
        const duration = Number.isFinite(Number(parsed?.format?.duration)) ? Number(parsed.format.duration) : null;

        await mediaProvider.uploadJingle(mode, safeFilename, fileBuffer, contentType);

        const record = await radioEngine.dataProvider.createJingle({
          filename: safeFilename,
          mode,
          duration,
          used: true,
        });

        io.emit('jingles_updated');

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.JINGLE_UPLOAD,
          data:          { filename: safeFilename, mode },
        }).catch(() => {});

        res.json({ ok: true, jingle: record });
      } catch (err) {
        console.error('[Jingles] upload error:', err);
        await mediaProvider.deleteJingle(mode, safeFilename).catch(() => {});
        res.status(400).json(getErrorPayload(err, 'upload.jingleUploadFailed'));
      }
    },
  );

  // ── Toggle "used in air" flag ─────────────────────────────────────────────
  router.post('/:id/used', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const { id } = req.params;
    const used = Boolean(req.body?.used);
    try {
      const updated = await radioEngine.dataProvider.updateJingleUsed(id, used);
      if (!updated) return res.status(404).json(getErrorPayload(null, 'upload.jingleNotFound'));
      io.emit('jingles_updated');
      res.json({ ok: true, jingle: updated });
    } catch (err) {
      console.error('[Jingles] toggle used error:', err);
      res.status(400).json(getErrorPayload(err, 'upload.jingleUpdateFailed'));
    }
  });

  // ── Raw file, local storage only ──────────────────────────────────────────
  router.get('/file', requireAdminBearerOrQuery, requireJinglesSupport, (req, res) => {
    if (typeof mediaProvider.getJingleReadStream !== 'function') {
      return res.status(404).json(getErrorPayload(null, 'upload.jingleNotFound'));
    }

    try {
      const { stream, status, headers } = mediaProvider.getJingleReadStream(
        req.query.mode,
        String(req.query.filename || ''),
        req.headers.range || null,
      );

      stream.on('error', (err) => {
        if (res.headersSent) return res.destroy();
        res.status(err.code === 'ENOENT' ? 404 : 500)
          .json(getErrorPayload(err, 'upload.jingleNotFound'));
      });

      res.writeHead(status, { ...headers, 'Cache-Control': 'no-store' });
      stream.pipe(res);
    } catch (err) {
      res.status(err.status || 404).json(getErrorPayload(err, 'upload.jingleNotFound'));
    }
  });

  // ── Playback URL (presigned in the cloud, a local route otherwise) ────────
  router.get('/:id/audio', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const jingle = await radioEngine.dataProvider.getJingleById(req.params.id);
    if (!jingle) return res.status(404).json(getErrorPayload(null, 'upload.jingleNotFound'));
    try {
      const url = await mediaProvider.getJingleUrl(jingle.mode, jingle.filename);
      res.json({ ok: true, url: absoluteMediaUrl(req, url) });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.jingleUrlFailed'));
    }
  });

  // ── Batch delete ───────────────────────────────────────────────────────────
  router.post('/batch-delete', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }

    const results = [];
    for (const id of ids) {
      const jingle = await radioEngine.dataProvider.getJingleById(id);
      if (!jingle) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      try {
        await mediaProvider.deleteJingle(jingle.mode, jingle.filename);
        await radioEngine.dataProvider.deleteJingle(jingle.id);
        results.push({ id, ok: true });

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.JINGLE_DELETE,
          data:          { filename: jingle.filename, mode: jingle.mode },
        }).catch(() => {});
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('jingles_updated');
    res.json({ ok: true, results });
  });

  // ── Batch move to the other mode ──────────────────────────────────────────
  router.post('/batch-move', requireAdmin, requireJinglesPrivilege, requireJinglesSupport, async (req, res) => {
    const { ids, targetMode } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }
    if (targetMode !== 'day' && targetMode !== 'night') {
      return res.status(400).json(getErrorPayload(null, 'common.invalidMode'));
    }

    const results = [];
    for (const id of ids) {
      const jingle = await radioEngine.dataProvider.getJingleById(id);
      if (!jingle) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      if (jingle.mode === targetMode) { results.push({ id, ok: true }); continue; }

      try {
        const buffer = await mediaProvider.getJingleBuffer(jingle.mode, jingle.filename);
        await mediaProvider.uploadJingle(targetMode, jingle.filename, buffer, 'audio/mpeg');
        await mediaProvider.deleteJingle(jingle.mode, jingle.filename);

        await radioEngine.dataProvider.moveJingleMode(jingle.id, targetMode);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('jingles_updated');
    res.json({ ok: true, results });
  });

  return router;
}