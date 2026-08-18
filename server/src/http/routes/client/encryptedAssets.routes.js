import { Router }       from 'express';
import { join }         from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { PUBLIC_ROOT }  from '../../../config/paths.js';
import { issueAudioKey } from '../../../tokens/audioToken.js';
import { requireArtTokenOnly } from '../shared/requireMediaTokens.js';
import { sendEncrypted }       from '../shared/sendEncrypted.js';
import { sanitizeArtistKey }   from '../shared/artistKey.js';
import {
  artistArtsIndexCache,
  artistArtBinaryCache,
  isArtistArtsCacheReady,
  getArtistArtsCachePromise,
} from '../shared/artistArtsCache.js';

export function createEncryptedAssetsRouter({ mediaProvider }) {
  const router = Router();

  // ── Encrypted avatar serving ──────────────────────────────────────────────
  router.get('/avatar/:filename', requireArtTokenOnly, (req, res) => {
    const filename = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return res.status(400).json({ error: 'Invalid filename' });

    const filePath = join(PUBLIC_ROOT, 'avatars', filename);
    try { statSync(filePath); } catch { return res.status(404).json({ error: 'Avatar not found' }); }

    try {
      const raw  = readFileSync(filePath);
      const ext  = filename.split('.').pop().toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp' : 'image/png';
      sendEncrypted(res, req.artKey, raw, { mime });
    } catch (err) {
      console.error('[Avatar] Serve error:', err.message);
      res.status(500).json({ error: 'Failed to serve avatar' });
    }
  });

  // ── Encrypted artist art serving ──────────────────────────────────────────
  router.get('/artist-art/:artist', requireArtTokenOnly, async (req, res) => {
    const artistName = sanitizeArtistKey(req.params.artist);
    if (!artistName || artistName.includes('/') || artistName.includes('..') || artistName.includes('\\\\')) {
      return res.status(400).json({ error: 'Invalid artist name' });
    }

    if (!isArtistArtsCacheReady()) {
      await (getArtistArtsCachePromise() || Promise.resolve()).catch(() => {});
    }

    const cachedIndex = artistArtsIndexCache.get(artistName);

    if (cachedIndex && !cachedIndex.hasArt) {
      return res.status(404).json({ error: 'Art not found' });
    }

    const fileName = cachedIndex?.artFileName || '';

    if (mediaProvider.isCloud && !fileName) {
      return res.status(404).json({ error: 'Art not found' });
    }

    try {
      let art = artistArtBinaryCache.get(artistName);
      if (!art) {
        art = await mediaProvider.getArtBuffer(artistName, fileName);
        artistArtBinaryCache.set(artistName, art);
      }

      sendEncrypted(res, req.artKey, art.buffer, { mime: art.mime || 'image/jpeg' });
    } catch (err) {
      const is404 = err?.name === 'NoSuchKey' || err?.code === 'ENOENT' || err?.status === 404;
      if (is404) {
        artistArtBinaryCache.delete(artistName);
        const current = artistArtsIndexCache.get(artistName);
        if (current?.hasArt) {
          artistArtsIndexCache.set(artistName, { ...current, hasArt: false, artFileName: '' });
        }
      } else {
        console.error('[ArtToken] Serve error for', artistName, ':', err.message, err.stack);
      }
      res.status(is404 ? 404 : 500).json({ error: is404 ? 'Art not found' : 'Failed to serve art' });
    }
  });

  // ── Audio key endpoint ────────────────────────────────────────────────────
  router.get('/audio-key', requireArtTokenOnly, (req, res) => {
    const uid = req.headers['x-listener-uid'];
    if (!uid) return res.status(400).json({ error: 'Missing listener UID' });

    const { token, expiresIn } = issueAudioKey(uid);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ token, expiresIn });
  });

  return router;
}