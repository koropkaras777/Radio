// ─── LRC parser ───────────────────────────────────────────────────────────────
const parseLrc = (lrc) => {
  const lines = [];

  for (const line of lrc.split('\n')) {
    const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (!m) continue;

    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3, '0')) / 1000;
    const text = m[4].trim();

    if (text) lines.push({ time: Math.round(time * 100) / 100, text });
  }

  return lines.length > 0 ? lines : null;
};

// ─── LRCLIB fetcher ───────────────────────────────────────────────────────────
const fetchFromLrclib = async (title, artist, album, duration) => {
  try {
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (album)    params.set('album_name', album);
    if (duration) params.set('duration',   Math.round(duration));

    const resp = await fetch(`https://lrclib.net/api/get?${params}`, {
      headers: { 'User-Agent': 'RadioSMIHUN/1.0' }
    });

    if (!resp.ok) return null;
    const data = await resp.json();

    if (data.syncedLyrics) {
      const lines = parseLrc(data.syncedLyrics);
      if (lines) {
        console.log(`[Lyrics] LRCLIB synced: "${title}" by ${artist} - ${lines.length} lines`);
        return { synced: true, lines, fetchedAt: Date.now() };
      }
    }

    if (data.plainLyrics) {
      const lines = data.plainLyrics.split('\n').map(l => l.trim()).filter(Boolean);
      console.log(`[Lyrics] LRCLIB plain: "${title}" by ${artist} - ${lines.length} lines`);
      return { synced: false, lines, fetchedAt: Date.now() };
    }

    return null;
  } catch (err) {
    console.warn(`[Lyrics] LRCLIB error: ${err.message}`);
    return null;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────
export const fetchLyricsForSong = async (title, artist, album, duration) => {
  const lyrics = await fetchFromLrclib(title, artist, album, duration);
  if (lyrics) return lyrics;

  console.log(`[Lyrics] Not found: "${title}" by ${artist}`);
  return { notFound: true, reason: 'track_not_found', fetchedAt: Date.now() };
};
