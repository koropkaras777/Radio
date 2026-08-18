import { SUPER_ADMIN_LOGIN } from '../../../config/env.js';
import { Router }  from 'express';
import express     from 'express';
import { requireAdmin, requirePrivilege, getErrorPayload } from '../../../middleware/auth.js';
import { auditLogger, AUDIT_TYPES } from '../../../audit/auditLogger.js';
import { requireAnyPrivilege } from '../shared/requireAnyPrivilege.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';
import { requireCapability } from '../shared/capabilities.js';
import {
  sanitizeArtistKey,
  getArtistArtFilename,
  isJpegBuffer,
  readJpegSize,
} from '../helpers.js';
import {
  cacheArtistArtItem,
  artistArtsIndexCache,
  artistArtBinaryCache,
} from '../shared/artistArtsCache.js';

const canManageArtistArts = requireAnyPrivilege(PRIVILEGES.ARTIST_ARTS, PRIVILEGES.EDITOR_META);

// ── Which broadcast(s) each artist currently has tracks in ─────────────────
function buildArtistModesMap(radioEngine) {
  const modes = new Map();
  for (const [id, meta] of radioEngine.fullLibraryMetadata) {
    const artistKey = sanitizeArtistKey(meta.artist || '');
    if (!artistKey) continue;
    const mode = id.startsWith('night/') ? 'night' : 'day';
    const entry = modes.get(artistKey);
    if (entry) entry.add(mode);
    else modes.set(artistKey, new Set([mode]));
  }
  return modes;
}

export function createArtistArtsRouter({ radioEngine, mediaProvider, dataProvider }) {
  const artworkPersists = requireCapability('artistArts', {
    mediaProvider,
    dataProvider: dataProvider || radioEngine.dataProvider,
  });

  const router = Router();

  // ── GET / — index list ──────────────────────────────────────────────────
  router.get('/', requireAdmin, requirePrivilege(PRIVILEGES.ARTIST_ARTS), async (_req, res) => {
    try {
      let items;
      if (artistArtsIndexCache.size) {
        items = [...artistArtsIndexCache.values()];
      } else if (typeof radioEngine.dataProvider?.loadArtistArts === 'function') {
        items = await radioEngine.dataProvider.loadArtistArts();
        for (const item of items) cacheArtistArtItem(item);
      } else {
        items = [];
      }

      const artistModes = buildArtistModesMap(radioEngine);
      const withModes = items.map((item) => ({
        ...item,
        modes: [...(artistModes.get(item.artist) || [])].sort(),
      }));

      res.json({ items: withModes });
    } catch (err) {
      console.error('[ArtistArts] list error:', err);
      res.status(500).json(getErrorPayload(err, 'artistArts.loadFailed'));
    }
  });

  // ── GET /file/:artist — raw file (admin preview, no encryption) ──────────
  router.get('/file/:artist', requireAdmin, requirePrivilege(PRIVILEGES.ARTIST_ARTS), async (req, res) => {
    const artist = sanitizeArtistKey(req.params.artist);
    if (!artist) {
      return res.status(400).json(getErrorPayload(null, 'artistArts.invalidArtist'));
    }

    try {
      const indexItem = artistArtsIndexCache.get(artist);
      if (!indexItem?.hasArt) {
        return res.status(404).json(getErrorPayload(null, 'artistArts.notFound'));
      }

      let art = artistArtBinaryCache.get(artist);
      if (!art) {
        art = await mediaProvider.getArtBuffer(artist, indexItem.artFileName);
        artistArtBinaryCache.set(artist, art);
      }

      res.setHeader('Content-Type', art.mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.end(art.buffer);
    } catch (err) {
      const status = err?.name === 'NoSuchKey' || err?.code === 'ENOENT' ? 404 : 500;
      if (status === 404) artistArtBinaryCache.delete(artist);
      else console.error('[ArtistArts] file error:', err);
      res.status(status).json(getErrorPayload(
        err,
        status === 404 ? 'artistArts.notFound' : 'artistArts.serveFailed',
      ));
    }
  });

  // ── POST /upload ────────────────────────────────────────────────────────
  router.post(
    '/upload',
    requireAdmin,
    requirePrivilege(PRIVILEGES.ARTIST_ARTS),
    artworkPersists,
    express.raw({ type: ['image/jpeg', 'image/jpg'], limit: '10mb' }),
    async (req, res) => {
      const artist     = String(req.query.artist || '').trim().toLowerCase();
      const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

      if (!artist)            return res.status(400).json({ error: t('common.artistRequired') });
      if (!fileBuffer.length) return res.status(400).json({ error: t('common.fileRequired') });

      try {
        if (!isJpegBuffer(fileBuffer)) {
          return res.status(400).json(getErrorPayload(null, 'artistArts.jpgOnly'));
        }
        const { width, height } = readJpegSize(fileBuffer);
        if (!width || !height || height <= width) {
          return res.status(400).json(getErrorPayload(null, 'artistArts.portraitRequired'));
        }

        const safeArtist  = sanitizeArtistKey(artist);
        const artFileName = getArtistArtFilename(safeArtist);

        await mediaProvider.uploadArt(safeArtist, fileBuffer);

        const item = typeof radioEngine.dataProvider?.upsertArtistArt === 'function'
          ? await radioEngine.dataProvider.upsertArtistArt({ artist: safeArtist, hasArt: true, artFileName })
          : { artist: safeArtist, hasArt: true, artFileName };

        cacheArtistArtItem(item);
        artistArtBinaryCache.set(item.artist, { buffer: fileBuffer, mime: 'image/jpeg', fileName: artFileName });

        auditLogger.log({
          adminId:       req.admin.adminId || 'super',
          adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
          operationType: AUDIT_TYPES.ARTIST_ART_UPLOAD,
          data:          { artist: safeArtist },
        }).catch(() => {});

        res.json({
          ok:      true,
          item,
          message: t('artistArts.saved'),
        });
      } catch (err) {
        console.error('[ArtistArts] upload error:', err);
        res.status(400).json(getErrorPayload(err, 'artistArts.saveFailed'));
      }
    },
  );

  // ── DELETE /:artist ────────────────────────────────────
  router.delete('/:artist', requireAdmin, canManageArtistArts, artworkPersists, async (req, res) => {
    const artist = sanitizeArtistKey(req.params.artist);
    if (!artist) {
      return res.status(400).json(getErrorPayload(null, 'artistArts.artistRequired'));
    }

    try {
      const current = artistArtsIndexCache.get(artist) || { artist, hasArt: false, artFileName: '' };
      if (current.hasArt) await mediaProvider.deleteArt(artist);

      const item = typeof radioEngine.dataProvider?.deleteArtistArt === 'function'
        ? await radioEngine.dataProvider.deleteArtistArt(artist)
        : { artist, hasArt: false, artFileName: '' };

      cacheArtistArtItem(item);
      artistArtBinaryCache.delete(artist);

      auditLogger.log({
        adminId:       req.admin.adminId || 'super',
        adminLogin:    req.admin.login || SUPER_ADMIN_LOGIN,
        operationType: AUDIT_TYPES.ARTIST_ART_DELETE,
        data:          { artist },
      }).catch(() => {});

      res.json({ ok: true, item, message: t('artistArts.deleted') });
    } catch (err) {
      console.error('[ArtistArts] delete error:', err);
      res.status(400).json(getErrorPayload(err, 'artistArts.deleteFailed'));
    }
  });

  return router;
}