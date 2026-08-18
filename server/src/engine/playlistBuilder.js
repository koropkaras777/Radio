import { shuffleArray, resolveGroup } from './radioUtils.js';

// ─── Section builder ──────────────────────────────────────────────────────────
export const buildSection = (perSection, songPools) => {
  const songs = [];
  for (const [group, count] of Object.entries(perSection)) {
    const pool = songPools[group];
    if (!pool) continue;
    songs.push(...pool.splice(0, Math.min(count, pool.length)));
  }
  shuffleArray(songs);
  return songs;
};

// ─── Group repeat fixer ───────────────────────────────────────────────────────
export const fixGroupRepeats = (songs, artistGroupIndex) => {
  const buckets = {};
  for (const s of songs) {
    const g = resolveGroup(s, artistGroupIndex);
    if (!buckets[g]) buckets[g] = [];
    buckets[g].push(s);
  }
  const result = [];
  let prev = null;
  while (true) {
    const cands = Object.keys(buckets).filter((g) => g !== prev && buckets[g].length > 0);
    if (cands.length === 0) {
      const any = Object.keys(buckets).find((g) => buckets[g].length > 0);
      if (!any) break;
      result.push(...buckets[any]);
      break;
    }
    const pick = cands.reduce((a, b) => (buckets[a].length >= buckets[b].length ? a : b));
    result.push(buckets[pick].shift());
    if (buckets[pick].length === 0) delete buckets[pick];
    prev = pick;
  }
  return result;
};

// ─── Stitch fixer ─────────────────────────────────────────────────────────────
export const fixStitches = (playlist, stitchPositions, sparePool, artistGroupIndex) => {
  for (const si of stitchPositions) {
    if (si >= playlist.length) continue;
    const prevGroup = resolveGroup(playlist[si - 1], artistGroupIndex);
    const currGroup = resolveGroup(playlist[si],     artistGroupIndex);
    if (prevGroup !== currGroup) continue;

    const nextGroup = si + 1 < playlist.length
      ? resolveGroup(playlist[si + 1], artistGroupIndex)
      : null;

    const idx = sparePool.findIndex((s) => {
      const g = resolveGroup(s, artistGroupIndex);
      return g !== prevGroup && g !== nextGroup;
    });

    if (idx !== -1) {
      const displaced = playlist[si];
      playlist[si] = sparePool[idx];
      sparePool.splice(idx, 1);
      sparePool.push(displaced);
    }
  }
  return playlist;
};

// ─── Balanced track order ─────────────────────────────────────────────────────
export const buildBalancedTrackOrder = (songIds, getArtist) => {
  const byArtist = new Map();

  for (const songId of songIds) {
    const artist = (getArtist(songId) || 'Unknown Artist').trim() || 'Unknown Artist';
    if (!byArtist.has(artist)) byArtist.set(artist, []);
    byArtist.get(artist).push(songId);
  }

  for (const list of byArtist.values()) shuffleArray(list);

  const result = [];
  let prevArtist = null;

  while (byArtist.size > 0) {
    let chosenArtist = null;
    let chosenLen = -1;
    for (const [artist, list] of byArtist) {
      if (list.length > chosenLen && artist !== prevArtist) {
        chosenArtist = artist;
        chosenLen = list.length;
      }
    }
    if (!chosenArtist) {
      chosenArtist = byArtist.keys().next().value;
    }

    const list = byArtist.get(chosenArtist);
    result.push(list.shift());
    prevArtist = chosenArtist;
    if (list.length === 0) byArtist.delete(chosenArtist);
  }

  return result;
};  