// Audit values are snapshots, never references to mutable engine state.
export const auditSnapshot = (value) => value == null ? null : JSON.parse(JSON.stringify(value));
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (a, b) => {
  if (object(a) && object(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => equal(a[key], b[key]));
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
};

export function auditChanges(before, after, prefix = '') {
  if (equal(before, after)) return [];
  if (object(before) || object(after)) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return [...keys].flatMap((key) => auditChanges(before?.[key], after?.[key], prefix ? `${prefix}.${key}` : key));
  }
  return [{ field: prefix, before: auditSnapshot(before), after: auditSnapshot(after) }];
}

export function auditDetails(before = {}, after = {}, info = {}) {
  return { version: 1, changes: auditChanges(before, after), info: auditSnapshot(info) };
}

export function lyricsSnapshot(entry, offset) {
  const lines = entry?.notFound ? [] : (entry?.lines || []);
  return {
    lyrics: lines.map((line) => {
      if (!entry.synced) return typeof line === 'string' ? line : line.text || '';
      const time = Math.round(Math.max(0, Number(line.time) || 0) * 100);
      return `[${String(Math.floor(time / 6000)).padStart(2, '0')}:${String(Math.floor(time / 100) % 60).padStart(2, '0')}.${String(time % 100).padStart(2, '0')}] ${line.text || ''}`;
    }).join('\n'),
    lyricsStatus: !lines.length ? 'none' : entry.synced ? 'synced' : 'plain',
    offset: Number(offset) || 0,
  };
}

export const metadataSnapshot = (meta = {}) => ({
  title: meta.title || '', artist: meta.artist || '', album: meta.album || '', year: meta.year ?? null,
});

export const songAuditLabel = (id, engine) => {
  const meta = engine.fullLibraryMetadata.get(String(id));
  return meta ? `${meta.title} — ${meta.artist} [${id}]` : String(id);
};

export const groupSnapshot = (group, engine) => group ? {
  name: group.name, mode: group.mode,
  songs: group.songs.map((id) => songAuditLabel(id, engine)),
} : {};

// Explicit allowlist: adding credentials to settings must not expose them in audit.
const GENERATION_FIELDS = [
  'USE_ALL_DAY_SONGS', 'MAX_DAY_DURATION', 'USE_ALL_NIGHT_SONGS', 'MAX_NIGHT_DURATION',
  'DAY_ALGORYTM', 'GROUP_DEFS', 'SONGS_PER_SECTION', 'GROUP_SECTIONS_ALGORYTM',
  'NIGHT_ALGORYTM', 'NIGHT_GROUP_DEFS', 'NIGHT_SONGS_PER_SECTION', 'NIGHT_GROUP_SECTIONS_ALGORYTM',
  'JINGLES_ENABLED', 'JINGLES_RANDOM', 'JINGLES_FREQUENCY', 'PHRASES_ENABLED', 'PHRASES_RANDOM',
  'PHRASES_DEFAULT_TIME', 'PHRASES_TIME_SECONDS', 'PHRASES_DAY_ID', 'PHRASES_NIGHT_ID',
];
const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, auditSnapshot(source?.[key])]));

export const settingsSnapshot = (settings) => ({
  branding: {
    telegram_url: settings?.branding?.telegram_url || '',
    byLang: Object.fromEntries(Object.entries(settings?.branding?.byLang || {}).map(([lang, values]) =>
      [lang, pick(values, ['dayRadioName', 'nightRadioName', 'telegramLabel'])])),
  },
  generation: pick(settings?.generation, GENERATION_FIELDS),
  radioHosts: pick(settings?.radioHosts, ['guestMaxDurationMinutes', 'specialGuestMaxDurationMinutes', 'backgroundMusicMode']),
  artistArts: pick(settings?.artistArts, ['dayEnabled', 'nightEnabled']),
});

export const donationSettingsSnapshot = (settings) => pick(settings, [
  'currency', 'pricingMode', 'fixedPrice', 'pricePerSecond', 'tiersEnabled', 'tierCeiling', 'blockDonationsWhileChatting',
]);
