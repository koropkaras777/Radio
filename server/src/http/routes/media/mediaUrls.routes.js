import { Router } from 'express';
import jwt         from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/env.js';
import {
  requireArtAndAudioToken,
  requireArtTokenOnly,
} from '../shared/requireMediaTokens.js';

// ── Admin audio stream ───────────────────────────────────
function requireAdminBearerOrQuery(req, res, next) {
  const token =
    (req.headers.authorization || '').replace('Bearer ', '').trim() ||
    String(req.query.adminToken || '').trim();

  try {
    if (!token) throw new Error('missing');
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function createMediaUrlsRouter({ radioEngine, mediaProvider, artistArtsIndexCache }) {
  const router = Router();

  // ── Resolve audio URL (presigned or local stream URL) ─────────────────────
  router.get('/audio/url', requireArtAndAudioToken, async (req, res) => {
    const track = req.query.track;
    if (!track) return res.status(400).json({ error: 'track required' });

    if (!radioEngine.fullLibraryMetadata.has(String(track))) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (mediaProvider.isCloud) {
      try {
        const url = mediaProvider.getAudioUrl(String(track));
        return res.json({ url, ttl: mediaProvider.ttlSeconds });
      } catch (err) {
        console.error('[AudioURL] Presign error:', err.message);
        return res.status(502).json({ error: 'Failed to generate audio URL' });
      }
    }

    const params = new URLSearchParams({
      track,
      artToken:   req.artToken,
      audioToken: req.audioToken,
    });
    return res.json({ url: `${req.protocol}://${req.get('host')}/api/audio/stream?${params}` });
  });

  // ── HTTP Range audio streaming (local mode only) ──────────────────────────
  router.get('/audio/stream', requireArtAndAudioToken, async (req, res) => {
    const track = req.query.track;
    if (!track) return res.status(400).json({ error: 'track required' });

    if (!radioEngine.fullLibraryMetadata.has(String(track))) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (mediaProvider.isCloud) {
      try {
        const presignedUrl = await mediaProvider.getAudioUrl(String(track));
        return res.redirect(302, presignedUrl);
      } catch (err) {
        console.error('[AudioStream] Presign error:', err.message);
        return res.status(502).json({ error: 'Failed to generate audio URL' });
      }
    }

    try {
      const { stream, status, headers } = mediaProvider.getAudioReadStream(
        String(track),
        req.headers.range || null
      );
      res.setHeader('Cache-Control', 'no-store, no-cache');
      res.setHeader('Vary', 'Range');
      res.writeHead(status, headers);
      stream.pipe(res);
    } catch (err) {
      const status = err.status || 500;
      if (!res.headersSent) res.status(status).json({ error: err.message });
    }
  });

  // ── Admin audio stream (local mode, no art/audio tokens required) ──────────
  router.get('/audio/stream/admin', requireAdminBearerOrQuery, (req, res) => {
    const track = req.query.track;
    if (!track) return res.status(400).json({ error: 'track required' });

    if (!radioEngine.fullLibraryMetadata.has(String(track))) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (mediaProvider.isCloud) {
      try {
        const url = mediaProvider.getAudioUrl(String(track));
        return res.redirect(302, url);
      } catch (err) {
        console.error('[AdminStream] Presign error:', err.message);
        return res.status(502).json({ error: 'Failed to generate audio URL' });
      }
    }

    try {
      const { stream, status, headers } = mediaProvider.getAudioReadStream(
        String(track),
        req.headers.range || null
      );
      res.setHeader('Cache-Control', 'no-store, no-cache');
      res.setHeader('Vary', 'Range');
      res.writeHead(status, headers);
      stream.pipe(res);
    } catch (err) {
      if (!res.headersSent) res.status(err.status || 500).json({ error: err.message });
    }
  });

  // ── Resolve art URL ───────────────────────────────────────────────────────
  router.get('/art/url', requireArtTokenOnly, (req, res) => {
    const artist = String(req.query.artist || '').trim().toLowerCase();
    if (!artist) return res.status(400).json({ error: 'artist required' });

    if (mediaProvider.isCloud) {
      try {
        const entry = artistArtsIndexCache.get(artist);
        if (entry && !entry.hasArt) return res.status(404).json({ error: 'Art not found' });
        const fileName = entry?.artFileName || `${artist}.jpg`;
        const url = mediaProvider.getArtUrl(artist, fileName);
        return res.json({ url, ttl: mediaProvider.ttlSeconds });
      } catch (err) {
        console.error('[ArtURL] Presign error:', err.message);
        return res.status(502).json({ error: 'Failed to generate art URL' });
      }
    }

    return res.json({ url: `${req.protocol}://${req.get('host')}/api/artist-art/${encodeURIComponent(artist)}` });
  });

  return router;
}