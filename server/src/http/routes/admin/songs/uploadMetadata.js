import { normalizeSongMetadata, SONG_METADATA_LIMITS } from '../../../../../../shared/songMetadata.mjs';

export function readMetadataOverrides(raw) {
  const source = typeof raw === 'string' ? JSON.parse(decodeURIComponent(raw)) : raw;
  if (source == null) return {};
  if (typeof source !== 'object' || Array.isArray(source)) throw new Error('Invalid song metadata');
  const result = {};
  for (const [key, limit] of Object.entries(SONG_METADATA_LIMITS)) {
    if (!Object.hasOwn(source, key)) continue;
    const value = String(source[key] ?? '').trim();
    if (value.length > limit || (key === 'year' && value && !/^[1-9][0-9]{3}$/.test(value))) throw new Error(`Invalid song metadata: ${key}`);
    if (['artist', 'title'].includes(key) && !value) throw new Error(`Invalid song metadata: ${key}`);
    result[key] = value;
  }
  return result;
}

export async function prepareSongUpload(buffer, parsed, filename, rawOverrides) {
  const overrides = readMetadataOverrides(rawOverrides);
  const cleaned = normalizeSongMetadata({ ...parsed.common, ...overrides });
  const metadata = {
    ...cleaned, artist: cleaned.artist || 'Unknown Artist', title: cleaned.title || filename.replace(/\.mp3$/i, ''),
    year: cleaned.year ? Number(cleaned.year) : null,
    duration: Number.isFinite(Number(parsed.format.duration)) ? Number(parsed.format.duration) : null,
  };
  const { default: NodeID3 } = await import('node-id3');
  const tags = NodeID3.read(buffer)?.raw || {};
  Object.assign(tags, { TPE1: metadata.artist, TIT2: metadata.title });
  for (const key of ['TALB', 'TYER', 'TDRC', 'TDAT', 'TIME']) delete tags[key];
  if (metadata.album) tags.TALB = metadata.album;
  if (metadata.year) tags.TYER = String(metadata.year);
  const audio = NodeID3.write(tags, buffer);
  if (!audio) throw new Error('Failed to write song metadata');
  return { audio, metadata };
}
