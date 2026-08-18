import { Router } from 'express';

export function createLibraryRouter({ radioEngine }) {
  const router = Router();

  // ── Public library listing ────────────────────────────────────────────────
  router.get('/library', (req, res) => {
    try {
      const mode  = radioEngine.getDesiredMode();
      const songs = [];
      radioEngine.fullLibraryMetadata.forEach((meta, id) => {
        if (id.startsWith(`${mode}/`)) {
          songs.push({ id, title: meta.title, artist: meta.artist });
        }
      });
      songs.sort((a, b) => a.artist.localeCompare(b.artist));
      res.json(songs);
    } catch (err) {
      console.error('[Library API] Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}