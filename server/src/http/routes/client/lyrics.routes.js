import { Router } from 'express';
import { requireAdmin } from '../../../middleware/auth.js';
import { requireArtTokenOnly } from '../shared/requireMediaTokens.js';
import { sendEncrypted }       from '../shared/sendEncrypted.js';

export function createLyricsRouter({ radioEngine, fetchLyricsForSong }) {
  const router = Router();

  // ── Public lyrics fetch (XOR-encrypted response) ──────────────────────────
  router.get('/lyrics', requireArtTokenOnly, async (req, res) => {
    const { title, artist, album } = req.query;
    if (!title || !artist) return res.status(400).json({ error: 'title and artist required' });

    const cached = radioEngine.getLyrics(title, artist);
    let result;
    if (cached) {
      result = radioEngine.getLyricsWithOffset(title, artist);
    } else {
      try {
        const fetched = await fetchLyricsForSong(title, artist, album);
        await radioEngine.persistLyricsEntry(title, artist, fetched);
        if (fetched.notFound) console.warn(`[Lyrics] Not found: "${title}" by ${artist}`);
        else console.log(`[Lyrics] ✓ "${title}" by ${artist} - ${fetched.lines?.length} lines`);
        result = radioEngine.getLyricsWithOffset(title, artist);
      } catch (err) {
        console.error(`[Lyrics] Error for "${title}":`, err.message);
        return res.status(500).json({ error: 'fetch_failed' });
      }
    }

    const plain = Buffer.from(JSON.stringify(result), 'utf8');
    sendEncrypted(res, req.artKey, plain);
  });

  // ── Admin: update lyrics offset ───────────────────────────────────────────
  router.post('/lyrics/offset', requireAdmin, async (req, res) => {
    const { title, artist, offset } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist required' });
    }

    try {
      const normalizedOffset = await radioEngine.persistLyricsOffset(title, artist, offset);
      console.log(`[Lyrics] Offset saved for "${title}" by ${artist}: ${normalizedOffset}`);
      res.json({ ok: true, offset: normalizedOffset });
    } catch (err) {
      console.error('[Lyrics] offset save error:', err);
      res.status(500).json({ error: 'Failed to save lyrics offset' });
    }
  });

  return router;
}