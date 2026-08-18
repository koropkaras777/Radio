export const sanitizeArtistKey = (value = '') =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');