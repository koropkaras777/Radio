import { useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { xorDecrypt } from '../utils/xorDecrypt.js';

export function useArtistArt({ currentTrack, hideArts, isNight, artToken, musicSource, artistArtsSettings }) {
  const [artistArt, setArtistArt] = useState(null);
  const cacheRef = useRef({});

  const modeEnabled = isNight ? artistArtsSettings?.nightEnabled : artistArtsSettings?.dayEnabled;

  useEffect(() => {
    if (hideArts || !modeEnabled) { setArtistArt(null); return; }
    if (!currentTrack)       { setArtistArt(null); return; }
    if (!artToken)           { setArtistArt(null); return; }

    const filename     = currentTrack.split('/').pop() || '';
    const rawArtistKey = filename.includes(' - ') ? filename.split(' - ')[0] : '';
    const key          = rawArtistKey.trim().toLowerCase();

    if (!key) { setArtistArt(null); return; }

    if (key in cacheRef.current) {
      setArtistArt(cacheRef.current[key]);
      return;
    }

    setArtistArt(null);
    let cancelled = false;

    const fetchArt = async () => {
      try {
        if (musicSource === 'cloud') {
          const resp = await fetch(
            `${SERVER_URL}/api/art/url?${new URLSearchParams({ artist: key })}`,
            { headers: { 'X-Art-Token': artToken } }
          );
          if (!resp.ok) { cacheRef.current[key] = false; if (!cancelled) setArtistArt(false); return; }
          const { url } = await resp.json();
          if (!url)     { cacheRef.current[key] = false; if (!cancelled) setArtistArt(false); return; }
          if (cancelled) return;
          cacheRef.current[key] = url;
          setArtistArt(url);
        } else {
          const resp = await fetch(
            `${SERVER_URL}/api/artist-art/${encodeURIComponent(key)}`,
            { headers: { 'X-Art-Token': artToken } }
          );
          if (!resp.ok) { cacheRef.current[key] = false; if (!cancelled) setArtistArt(false); return; }

          const mime     = resp.headers.get('X-Art-Mime') || 'image/jpeg';
          const arrayBuf = await resp.arrayBuffer();
          const dec      = xorDecrypt(arrayBuf, artToken);

          if (cancelled) return;
          const objUrl = URL.createObjectURL(new Blob([dec], { type: mime }));
          cacheRef.current[key] = objUrl;
          setArtistArt(objUrl);
        }
      } catch {
        if (!cancelled) { cacheRef.current[key] = false; setArtistArt(false); }
      }
    };

    fetchArt();
    return () => { cancelled = true; };
  }, [currentTrack, hideArts, modeEnabled, artToken, musicSource]);

  return artistArt;
}