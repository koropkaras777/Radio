const YOUTUBE_HOST_RE = /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)music\.youtube\.com$/i;

export const isYoutubeTrackUrl = (value) => {
  try {
    const u = new URL(String(value).trim());
    return /^https?:$/.test(u.protocol) && YOUTUBE_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
};

export const isYoutubePlaylistUrl = (value) => {
  try {
    const u = new URL(String(value).trim());
    return u.searchParams.has('list') || u.pathname.startsWith('/browse/VL');
  } catch {
    return false;
  }
};

export const extractYoutubeVideoId = (value) => {
  try {
    const u = new URL(String(value).trim());
    if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split('/')[0] || null;
    if (u.searchParams.has('v')) return u.searchParams.get('v');
    const match = u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/i);
    return match ? match[2] : null;
  } catch {
    return null;
  }
};

// ─── Track de-duplication key ────────────────────────────────────────────────
export const normalizeTrackKey = (name) => {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/\.mp3$/i, '')
    .replace(/[\[({].*?[\])}]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).sort().join(' ');
};

export const getItemTrackKey = (item) => {
  if (item.metadata) {
    const combo = `${item.metadata.artist || ''} ${item.metadata.title || ''}`.trim();
    if (combo) return normalizeTrackKey(combo);
  }
  if (item.sourceType === 'file') return normalizeTrackKey(item.name);
  if (item.hintTitle) return normalizeTrackKey(item.hintTitle);
  return '';
};