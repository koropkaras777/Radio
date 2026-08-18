export const getPercentLabel = (count, total) => {
  if (!total) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
};

export const getStatsSongCount = (artists = {}) =>
  Object.values(artists).reduce((sum, songs) => sum + songs.length, 0);

export const sortStatsEntries = (artists = {}, statsSort = 'alpha') =>
  Object.entries(artists).sort(([a, sa], [b, sb]) => {
    if (statsSort === 'alpha')      return a.localeCompare(b);
    if (statsSort === 'count-desc') return sb.length - sa.length;
    if (statsSort === 'count-asc')  return sa.length - sb.length;
    return 0;
  });

export const sortYearEntries = (yearEntries = [], statsSort = 'alpha', yearDir = 'asc') =>
  [...yearEntries].sort(([ya, sa], [yb, sb]) => {
    if (statsSort === 'count-desc') return sb.length - sa.length;
    if (statsSort === 'count-asc')  return sa.length - sb.length;
    const cmp = Number(ya) - Number(yb);
    return yearDir === 'asc' ? cmp : -cmp;
  });

export const buildYearMap = (statsData, nightMode) => {
  const yearMap = {};
  const folders = nightMode ? ['day', 'night'] : ['day'];
  folders.forEach((folder) => {
    const artists = statsData?.[folder] || {};
    Object.entries(artists).forEach(([artist, songs]) => {
      songs.forEach((song) => {
        const year = song.year ? String(song.year) : '-';
        if (!yearMap[year]) yearMap[year] = [];
        yearMap[year].push({ ...song, artist, folder });
      });
    });
  });
  return yearMap;
};

export const matchesTokenSearch = (artist, title, query) => {
  const tokens = query.toLowerCase().trim().split(/[\s\-–—,|]+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = `${artist} ${title}`.toLowerCase();
  return tokens.every((tok) => haystack.includes(tok));
};

export const buildStatsSearchResults = (statsData, query, labels) => {
  if (!statsData || !query.trim()) return [];
  const results = [];
  Object.entries(labels).forEach(([folderKey, folderLabel]) => {
    const artists = statsData[folderKey] || {};
    Object.entries(artists).forEach(([artist, songs]) => {
      songs.forEach((song) => {
        if (matchesTokenSearch(artist, song.title, query)) {
          results.push({ ...song, artist, folderKey, folderLabel, searchId: `${folderKey}:${song.file}` });
        }
      });
    });
  });
  return results.sort((a, b) => {
    const cmp = a.artist.localeCompare(b.artist);
    return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
  });
};

export const formatDur = (s, suffix = '') => {
  if (!s) return '-';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}${suffix}`;
};