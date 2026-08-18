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

const PHRASES_MIN_REQUIRED  = 1;
const PHRASE_MAX_DURATION_S = 5;
const PHRASE_DURATION_TOLERANCE_S = 0.25;

export function createPhrasesRouter({ io, radioEngine, mediaProvider }) {
  const router = Router();

  const requirePhrasesSupport = requireCapability(
    'phrases',
    { mediaProvider, dataProvider: radioEngine.dataProvider },
    'upload.phrasesUnavailable',
  );

  router.get('/counts', requireAdmin, requirePhrasesSupport, async (req, res) => {
    try {
      const [dayRes, nightRes, dayUsable, nightUsable] = await Promise.all([
        radioEngine.dataProvider.queryPhrases({ mode: 'day',   offset: 0, limit: 1 }),
        radioEngine.dataProvider.queryPhrases({ mode: 'night', offset: 0, limit: 1 }),
        radioEngine.dataProvider.countUsablePhrases('day'),
        radioEngine.dataProvider.countUsablePhrases('night'),
      ]);
      res.json({
        ok: true,
        day: dayRes.total,
        night: nightRes.total,
        dayUsable,
        nightUsable,
        minRequired: PHRASES_MIN_REQUIRED,
      });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.phraseCountFailed'));
    }
  });

  // ── List / search phrases (paginated, served straight from cache) ────────
  router.get('/', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const mode   = ['day', 'night'].includes(req.query.mode) ? req.query.mode : 'all';
    const search = String(req.query.search || '');
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const { items, total } = await radioEngine.dataProvider.queryPhrases({ mode, search, offset, limit });
    res.json({ ok: true, items, total });
  });

  // ── Pre-upload duplicate check (by filename, global across day/night) ────
  router.post('/upload-check-duplicate', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const { filename } = req.body || {};
    if (!filename) return res.status(400).json({ ok: false });
    const exists = await radioEngine.dataProvider.phraseFilenameExists(String(filename));
    res.json({ ok: true, exists });
  });

  router.post(
    '/upload',
    requireAdmin,
    requireJinglesPrivilege,
    requirePhrasesSupport,
    express.raw({ type: ['audio/mpeg', 'audio/mp3', 'application/octet-stream'], limit: '10mb' }),
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
        if (await radioEngine.dataProvider.phraseFilenameExists(safeFilename)) {
          return res.status(409).json(getErrorPayload(null, 'upload.phraseFilenameExists'));
        }

        const parsed = await parseBuffer(fileBuffer, { mimeType: contentType, path: safeFilename }).catch(() => null);
        const duration = Number.isFinite(Number(parsed?.format?.duration)) ? Number(parsed.format.duration) : null;

        if (duration == null) {
          return res.status(400).json(getErrorPayload(null, 'upload.phraseDurationUnknown'));
        }
        if (duration > PHRASE_MAX_DURATION_S + PHRASE_DURATION_TOLERANCE_S) {
          return res.status(400).json(getErrorPayload(null, 'upload.phraseTooLong'));
        }

        await mediaProvider.uploadPhrase(mode, safeFilename, fileBuffer, contentType);

        const record = await radioEngine.dataProvider.createPhrase({
          filename: safeFilename,
          mode,
          duration,
          used: true,
        });

        io.emit('phrases_updated');

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.PHRASE_UPLOAD,
          data:          { filename: safeFilename, mode },
        }).catch(() => {});

        res.json({ ok: true, phrase: record });
      } catch (err) {
        console.error('[Phrases] upload error:', err);
        await mediaProvider.deletePhrase(mode, safeFilename).catch(() => {});
        res.status(400).json(getErrorPayload(err, 'upload.phraseUploadFailed'));
      }
    },
  );

  // ── Toggle "used in air" flag ─────────────────────────────────────────────
  router.post('/:id/used', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const { id } = req.params;
    const used = Boolean(req.body?.used);
    try {
      const updated = await radioEngine.dataProvider.updatePhraseUsed(id, used);
      if (!updated) return res.status(404).json(getErrorPayload(null, 'upload.phraseNotFound'));
      io.emit('phrases_updated');
      res.json({ ok: true, phrase: updated });
    } catch (err) {
      console.error('[Phrases] toggle used error:', err);
      res.status(400).json(getErrorPayload(err, 'upload.phraseUpdateFailed'));
    }
  });

  // ── Raw file, local storage only ──────────────────────────────────────────
  router.get('/file', requireAdminBearerOrQuery, requirePhrasesSupport, (req, res) => {
    if (typeof mediaProvider.getPhraseReadStream !== 'function') {
      return res.status(404).json(getErrorPayload(null, 'upload.phraseNotFound'));
    }

    try {
      const { stream, status, headers } = mediaProvider.getPhraseReadStream(
        req.query.mode,
        String(req.query.filename || ''),
        req.headers.range || null,
      );

      stream.on('error', (err) => {
        if (res.headersSent) return res.destroy();
        res.status(err.code === 'ENOENT' ? 404 : 500)
          .json(getErrorPayload(err, 'upload.phraseNotFound'));
      });

      res.writeHead(status, { ...headers, 'Cache-Control': 'no-store' });
      stream.pipe(res);
    } catch (err) {
      res.status(err.status || 404).json(getErrorPayload(err, 'upload.phraseNotFound'));
    }
  });

  // ── Playback URL (presigned in the cloud, a local route otherwise) ────────
  router.get('/:id/audio', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const phrase = await radioEngine.dataProvider.getPhraseById(req.params.id);
    if (!phrase) return res.status(404).json(getErrorPayload(null, 'upload.phraseNotFound'));
    try {
      const url = await mediaProvider.getPhraseUrl(phrase.mode, phrase.filename);
      res.json({ ok: true, url: absoluteMediaUrl(req, url) });
    } catch (err) {
      res.status(400).json(getErrorPayload(err, 'upload.phraseUrlFailed'));
    }
  });

  // ── Batch delete ───────────────────────────────────────────────────────────
  router.post('/batch-delete', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }

    const results = [];
    for (const id of ids) {
      const phrase = await radioEngine.dataProvider.getPhraseById(id);
      if (!phrase) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      try {
        await mediaProvider.deletePhrase(phrase.mode, phrase.filename);
        await radioEngine.dataProvider.deletePhrase(phrase.id);
        results.push({ id, ok: true });

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.PHRASE_DELETE,
          data:          { filename: phrase.filename, mode: phrase.mode },
        }).catch(() => {});
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('phrases_updated');
    res.json({ ok: true, results });
  });

  // ── Batch move to the other mode ──────────────────────────────────────────
  router.post('/batch-move', requireAdmin, requireJinglesPrivilege, requirePhrasesSupport, async (req, res) => {
    const { ids, targetMode } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json(getErrorPayload(null, 'common.idsRequired'));
    }
    if (targetMode !== 'day' && targetMode !== 'night') {
      return res.status(400).json(getErrorPayload(null, 'common.invalidMode'));
    }

    const results = [];
    for (const id of ids) {
      const phrase = await radioEngine.dataProvider.getPhraseById(id);
      if (!phrase) { results.push({ id, ok: false, error: 'not_found' }); continue; }
      if (phrase.mode === targetMode) { results.push({ id, ok: true }); continue; }

      try {
        const buffer = await mediaProvider.getPhraseBuffer(phrase.mode, phrase.filename);
        await mediaProvider.uploadPhrase(targetMode, phrase.filename, buffer, 'audio/mpeg');
        await mediaProvider.deletePhrase(phrase.mode, phrase.filename);

        await radioEngine.dataProvider.movePhraseMode(phrase.id, targetMode);
        results.push({ id, ok: true });
      } catch (err) {
        results.push({ id, ok: false, error: err.message });
      }
    }

    io.emit('phrases_updated');
    res.json({ ok: true, results });
  });

  return router;
}
