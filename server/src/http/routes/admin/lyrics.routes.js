import { Router } from 'express';
import { requireAdmin } from '../../../middleware/auth.js';
import { PRIVILEGES } from '../../../config/privileges.js';
import { t } from '../../../i18n/index.js';
import { requireAnyPrivilege } from '../shared/requireAnyPrivilege.js';

const canEditLyrics = requireAnyPrivilege(PRIVILEGES.EDITOR_LYRICS, PRIVILEGES.EDITOR_META);

export function createLyricsRouter({ radioEngine, mediaProvider }) {
  const router = Router();

  router.get('/songs', requireAdmin, canEditLyrics, (req, res) => {
    try {
      const items = typeof radioEngine.dataProvider?.getLyricsSongsIndex === 'function'
        ? radioEngine.dataProvider.getLyricsSongsIndex(radioEngine.metadataCache, radioEngine.lyricsCache)
        : [];
      res.json({ items });
    } catch (err) {
      console.error('[Lyrics] songs index error:', err);
      res.status(500).json({ error: t('lyrics.songsIndexFailed') });
    }
  });

  router.get('/cache-full', requireAdmin, canEditLyrics, (req, res) => {
    try {
      res.json(radioEngine.getLyricsCacheObject());
    } catch (err) {
      console.error('[Lyrics] cache-full error:', err);
      res.status(500).json({ error: t('lyrics.cacheLoadFailed') });
    }
  });

  router.get('/offsets', requireAdmin, canEditLyrics, (req, res) => {
    try {
      res.json(radioEngine.getLyricsOffsetsObject());
    } catch (err) {
      console.error('[Lyrics] offsets error:', err);
      res.status(500).json({ error: t('lyrics.offsetsLoadFailed') });
    }
  });

  router.get('/audio-preview', requireAdmin, canEditLyrics, async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) return res.status(400).json({ error: t('lyrics.titleArtistRequired') });
    const tLow = title.toLowerCase();
    const aLow = artist.toLowerCase();
    let foundId = null;

    for (const [id, meta] of radioEngine.fullLibraryMetadata) {
      if (meta.title?.toLowerCase() === tLow && meta.artist?.toLowerCase() === aLow) {
        foundId = id;
        break;
      }
    }

    if (!foundId) return res.status(404).json({ error: t('lyrics.trackNotFound') });

    if (mediaProvider.isCloud) {
      try {
        return res.json({ url: await mediaProvider.getAudioUrl(foundId) });
      } catch (err) {
        console.error('[AudioPreview] Presign error:', err.message);
        return res.status(502).json({ error: t('lyrics.previewUrlFailed') });
      }
    }

    const adminToken = (req.headers.authorization || '').replace('Bearer ', '').trim();
    const params     = new URLSearchParams({ track: foundId, adminToken });
    return res.json({ url: `${req.protocol}://${req.get('host')}/api/audio/stream/admin?${params}` });
  });

  router.put('/cache', requireAdmin, canEditLyrics, async (req, res) => {
    const { title, artist, entry } = req.body;
    if (!title || !artist || !entry) {
      return res.status(400).json({ error: t('lyrics.titleArtistEntryRequired') });
    }
    try {
      await radioEngine.persistLyricsEntry(title, artist, { ...entry, fetchedAt: Date.now() });
      console.log(`[Lyrics] Cache updated for "${title}" by ${artist}`);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Lyrics] PUT cache error:', err);
      res.status(500).json({ error: t('lyrics.saveFailed') });
    }
  });

  router.get('/cache-index', requireAdmin, canEditLyrics, (req, res) => {
    try {
      res.json({ items: radioEngine.getLyricsCacheIndex() });
    } catch (err) {
      console.error('[Lyrics] cache-index error:', err);
      res.status(500).json({ error: t('lyrics.cacheIndexFailed') });
    }
  });

  router.get('/cache-entry', requireAdmin, canEditLyrics, (req, res) => {
    try {
      const { songId, title, artist } = req.query;

      let resolvedSongId = null;
      let resolvedTitle  = null;
      let resolvedArtist = null;

      if (songId) {
        const meta = radioEngine.fullLibraryMetadata.get(String(songId));
        if (!meta) return res.status(404).json({ error: t('lyrics.trackNotFound') });
        resolvedSongId = String(songId);
        resolvedTitle  = meta.title;
        resolvedArtist = meta.artist;
      } else {
        if (!title || !artist) {
          return res.status(400).json({ error: t('lyrics.songIdOrTitleArtistRequired') });
        }
        resolvedTitle  = String(title);
        resolvedArtist = String(artist);
        for (const [id, meta] of radioEngine.fullLibraryMetadata) {
          if (
            String(meta?.title  || '').toLowerCase() === resolvedTitle.toLowerCase() &&
            String(meta?.artist || '').toLowerCase() === resolvedArtist.toLowerCase()
          ) {
            resolvedSongId = id;
            break;
          }
        }
      }

      const entry  = radioEngine.getLyrics(resolvedTitle, resolvedArtist);
      const offset = radioEngine.getLyricsOffset(resolvedTitle, resolvedArtist);
      const key    = `${String(resolvedArtist).toLowerCase()}||${String(resolvedTitle).toLowerCase()}`;

      res.json({
        songId: resolvedSongId,
        key,
        offset,
        entry: entry || { synced: false, lines: [], fetchedAt: Date.now() },
      });
    } catch (err) {
      console.error('[Lyrics] cache-entry error:', err);
      res.status(500).json({ error: t('lyrics.entryLoadFailed') });
    }
  });

  router.delete('/cache', requireAdmin, canEditLyrics, async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) return res.status(400).json({ error: t('lyrics.titleArtistRequired') });

    try {
      const existed = Boolean(radioEngine.getLyrics(title, artist));
      if (existed) await radioEngine.removeLyricsEntry(title, artist);
      console.log(`[Lyrics] Cache cleared for: "${title}" by ${artist}`);
      res.json({ ok: true, existed });
    } catch (err) {
      console.error('[Lyrics] DELETE cache error:', err);
      res.status(500).json({ error: t('lyrics.deleteFailed') });
    }
  });

  return router;
}