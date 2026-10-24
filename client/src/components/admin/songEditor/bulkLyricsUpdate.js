const STATUS_RANK = { none: 0, plain: 1, synced: 2 };

export function getEntryStatus(entry) {
  if (!entry || entry.notFound || !entry.lines?.length) return 'none';
  return entry.synced ? 'synced' : 'plain';
}

export async function updateSongLyrics(song, force, request) {
  const current = await request(`/lyrics/cache-entry?songId=${encodeURIComponent(song.id)}`);
  const found = await request('/upload-song-lyrics', {
    method: 'POST',
    body: JSON.stringify({ title: song.title, artist: song.artist, album: song.album, duration: song.duration }),
  });
  const status = getEntryStatus(found.lyricsEntry);
  // A failed lookup must never erase existing lyrics, even in forced mode.
  if (status === 'none') return { status: 'none' };
  if (!force && STATUS_RANK[status] <= STATUS_RANK[getEntryStatus(current.entry)]) {
    return { status: 'unchanged' };
  }
  const saved = await request('/song-editor/save', {
    method: 'POST',
    body: JSON.stringify({
      songId: song.id,
      metadata: { title: song.title, artist: song.artist, album: song.album, year: song.year },
      metadataChanged: false,
      lyricsEntry: found.lyricsEntry,
      lyricsChanged: true,
      auditContext: { source: 'bulk', force },
      offsetChanged: false,
    }),
  });
  return { status, savedStatus: getEntryStatus(saved.entry || found.lyricsEntry), key: current.key };
}
