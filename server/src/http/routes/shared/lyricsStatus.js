export const lyricsStatus = (entry) => {
  if (!entry || entry.notFound) return 'none';
  return entry.synced ? 'synced' : 'plain';
};