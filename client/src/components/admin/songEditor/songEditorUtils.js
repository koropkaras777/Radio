// ─── SongEditorModal text/time utilities ────────────────────────────────────
export const SYNCED_RE = /^\[(\d{2}):(\d{2})\.(\d{2,3})\] ?(.*)$/;

const parseMs = (str) => str.length === 2 ? parseInt(str, 10) * 10 : parseInt(str, 10);
const toSecs  = (m1, m2, m3) => parseInt(m1, 10) * 60 + parseInt(m2, 10) + parseMs(m3) / 1000;

export const parseSyncedLine = (line) => {
  const m = line.match(SYNCED_RE);
  if (!m) return null;
  return { time: toSecs(m[1], m[2], m[3]), text: m[4] };
};

export const parseTimecodeOnly = (value) => {
  const m = value.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]$/);
  if (!m) return null;
  if (parseInt(m[2], 10) > 59) return null;
  return toSecs(m[1], m[2], m[3]);
};

export const normalizeText = (text) => (text || '').replace(/\r\n?/g, '\n');

export const isSyncedFormat = (text) =>
  normalizeText(text).trim().split('\n').every((l) => l.trim() === '' || SYNCED_RE.test(l.trim()));

export const stripTimecodes = (text) =>
  normalizeText(text).trim().split('\n').map((l) => {
    const m = l.match(SYNCED_RE);
    return m ? m[4] : l;
  }).join('\n');

export const formatTime = (secs, withMs = false) => {
  if (!Number.isFinite(secs) || secs < 0) return withMs ? '0:00.00' : '0:00';
  const m  = Math.floor(secs / 60);
  const s  = Math.floor(secs % 60);
  const cs = Math.floor((secs % 1) * 100);
  const base = `${m}:${s.toString().padStart(2, '0')}`;
  return withMs ? `${base}.${cs.toString().padStart(2, '0')}` : base;
};

export const splitKey = (key) => {
  const idx = key.indexOf('||');
  if (idx === -1) return { artist: key, title: '' };
  return { artist: key.slice(0, idx), title: key.slice(idx + 2) };
};

export const formatTimecode = (time) => {
  const mins = Math.floor(time / 60);
  const secs = (time % 60).toFixed(2).padStart(5, '0');
  return `[${String(mins).padStart(2, '0')}:${secs}]`;
};

export const lyricsToText = (entry) => {
  if (!entry || entry.notFound) return '';
  if (entry.synced && Array.isArray(entry.lines)) {
    return entry.lines.map((l) => `${formatTimecode(l.time)} ${l.text}`).join('\n');
  }
  return Array.isArray(entry.lines)
    ? entry.lines.map((l) => (typeof l === 'string' ? l : l.text ?? '')).join('\n')
    : (entry.text || '');
};

export const textToEntry = (text, synced, original) => {
  const base = original && typeof original === 'object'
    ? Object.fromEntries(Object.entries(original).filter(([key]) => key !== 'notFound' && key !== 'reason'))
    : {};

  const lines = normalizeText(text).trim().split('\n');
  if (synced) {
    return {
      ...base,
      synced: true,
      lines: lines.filter((l) => l.trim()).map((l) => parseSyncedLine(l.trim())).filter(Boolean),
    };
  }
  return {
    ...base,
    synced: false,
    lines : lines.map((l) => l.trim()).filter(Boolean),
  };
};

export const generateTimecodes = (text) => {
  const lines = normalizeText(text).trim().split('\n').filter((l) => l.trim());
  return lines.map((l, i) => {
    const mins = Math.floor(i / 60);
    const secs = i % 60;
    return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.00] ${l}`;
  }).join('\n');
};

export const parseDownloadFilename = (disposition, fallback) => {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try { return decodeURIComponent(utf8Match[1]); } catch { }
  }
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch ? plainMatch[1] : fallback;
};