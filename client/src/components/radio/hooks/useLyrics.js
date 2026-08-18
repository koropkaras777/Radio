import { useEffect, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { xorDecrypt } from '../utils/xorDecrypt.js';

export function useLyrics({ artToken, currentTitle, currentArtist, currentAlbum }) {
  const [lyrics,        setLyrics]        = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  useEffect(() => {
    if (!artToken || !currentTitle || !currentArtist) return;

    const params = new URLSearchParams({ title: currentTitle, artist: currentArtist });
    if (currentAlbum) params.set('album', currentAlbum);

    let cancelled = false;

    const fetchLyrics = async () => {
      setLyricsLoading(true);
      try {
        const resp = await fetch(`${SERVER_URL}/api/lyrics?${params}`, {
          headers: { 'X-Art-Token': artToken },
        });
        if (!resp.ok) throw new Error('fetch_failed');

        const buf  = await resp.arrayBuffer();
        const dec  = xorDecrypt(buf, artToken);
        const data = JSON.parse(new TextDecoder().decode(dec));
        if (!cancelled) setLyrics(data);
      } catch {
        if (!cancelled) setLyrics({ notFound: true });
      } finally {
        if (!cancelled) setLyricsLoading(false);
      }
    };

    fetchLyrics();
    return () => { cancelled = true; };
  }, [artToken, currentTitle, currentArtist, currentAlbum]);

  return { lyrics, lyricsLoading };
}