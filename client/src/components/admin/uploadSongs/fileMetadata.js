import { metadataFromFilename, normalizeSongMetadata } from '../../../../../shared/songMetadata.mjs';

const text = (bytes) => new TextDecoder('iso-8859-1').decode(bytes).replace(/\0.*$/s, '').trim();
const syncSafe = (bytes) => bytes.reduce((number, byte) => number * 128 + (byte & 127), 0);
const integer = (bytes) => bytes.reduce((number, byte) => number * 256 + byte, 0);
const unSync = (bytes) => Uint8Array.from(bytes.filter((byte, index) => !(byte === 0 && index && bytes[index - 1] === 255)));
const TAGS = { TPE1: 'artist', TP1: 'artist', TIT2: 'title', TT2: 'title', TALB: 'album', TAL: 'album', TYER: 'year', TYE: 'year', TDRC: 'year' };

function decodeFrame(bytes) {
  const encoding = bytes[0];
  let body = bytes.subarray(1);
  let charset = ['iso-8859-1', 'utf-16le', 'utf-16be', 'utf-8'][encoding];
  if (!charset) return '';
  if (encoding === 1 && body[0] === 254 && body[1] === 255) { charset = 'utf-16be'; body = body.subarray(2); }
  else if (encoding === 1 && body[0] === 255 && body[1] === 254) body = body.subarray(2);
  return new TextDecoder(charset).decode(body).replace(/^\uFEFF/, '').split('\0')[0].trim();
}

// Read only ID3 blocks, never the whole audio file or a network preview upload.
export async function readFileMetadata(file) {
  const result = {};
  if (file.size >= 128) {
    const footer = new Uint8Array(await file.slice(-128).arrayBuffer());
    if (text(footer.subarray(0, 3)) === 'TAG') {
      Object.assign(result, { title: text(footer.subarray(3, 33)), artist: text(footer.subarray(33, 63)), album: text(footer.subarray(63, 93)), year: text(footer.subarray(93, 97)) });
    }
  }
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  const version = header[3];
  if (text(header.subarray(0, 3)) === 'ID3' && [2, 3, 4].includes(version)) {
    const size = syncSafe(header.subarray(6, 10));
    // A malformed file must not cause an unbounded allocation.
    if (size <= 16 * 1024 * 1024 && size + 10 <= file.size && !(version === 2 && (header[5] & 64))) {
      let bytes = new Uint8Array(await file.slice(10, size + 10).arrayBuffer());
      if (version < 4 && (header[5] & 128)) bytes = unSync(bytes);
      let position = 0;
      if (version >= 3 && (header[5] & 64)) position = version === 4 ? syncSafe(bytes.subarray(0, 4)) : integer(bytes.subarray(0, 4)) + 4;
      const headerSize = version === 2 ? 6 : 10;
      while (position + headerSize <= bytes.length) {
        const id = text(bytes.subarray(position, position + (version === 2 ? 3 : 4)));
        if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
        const length = version === 4 ? syncSafe(bytes.subarray(position + 4, position + 8)) : integer(bytes.subarray(position + (version === 2 ? 3 : 4), position + (version === 2 ? 6 : 8)));
        const flags = version === 2 ? 0 : bytes[position + 9];
        position += headerSize;
        if (!length || position + length > bytes.length) break;
        if (TAGS[id] && !(flags & (version === 4 ? 12 : 192))) {
          let payload = bytes.subarray(position, position + length);
          if (version === 4 && ((flags & 2) || (header[5] & 128))) payload = unSync(payload);
          if (flags & (version === 4 ? 64 : 32)) payload = payload.subarray(1);
          if (version === 4 && (flags & 1)) payload = payload.subarray(4);
          const value = decodeFrame(payload);
          if (value) result[TAGS[id]] = TAGS[id] === 'year' ? value.slice(0, 4) : value;
        }
        position += length;
      }
    }
  }
  const fallback = metadataFromFilename(file.name);
  return normalizeSongMetadata({ ...fallback, ...Object.fromEntries(Object.entries(result).filter(([, value]) => value)) });
}
