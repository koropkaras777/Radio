import { verifyArtToken }   from '../../../tokens/artToken.js';
import { verifyAudioToken } from '../../../tokens/audioToken.js';

// ── Art-token only (avatar, artist-art, lyrics, stream) ────────────────────
export function requireArtTokenOnly(req, res, next) {
  const token  = req.query?.token || req.headers['x-art-token'];
  const keyBuf = token ? verifyArtToken(String(token)) : null;

  if (!keyBuf) {
    return res.status(401).json({ error: 'Invalid or expired art token' });
  }

  req.artKey = keyBuf;
  next();
}

// ── Art-token + audio-token (audio/url, audio/stream) ───────────────────────
export function requireArtAndAudioToken(req, res, next) {
  const artToken   = req.headers['x-art-token']   || req.query?.artToken;
  const audioToken = req.headers['x-audio-token'] || req.query?.audioToken;

  if (!artToken || !verifyArtToken(String(artToken))) {
    return res.status(401).json({ error: 'Invalid or expired art token' });
  }
  if (!audioToken || !verifyAudioToken(String(audioToken))) {
    return res.status(401).json({ error: 'Invalid or expired audio token' });
  }

  req.artToken   = String(artToken);
  req.audioToken = String(audioToken);
  next();
}