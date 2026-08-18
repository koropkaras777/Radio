export const normalizeLyricsKey = (artist, title) =>
  `${String(artist || '').toLowerCase()}||${String(title || '').toLowerCase()}`;

export const cloneEntry = (value) => {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
};