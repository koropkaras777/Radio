export const SONG_METADATA_LIMITS = Object.freeze({ artist: 150, title: 200, album: 200, year: 4 });

const JUNK = String.raw`(?:\d{4}\s+)?(?:remaster(?:ed)?(?:\s+(?:in\s+)?\d{4})?|(?:deluxe|expanded|anniversary|special|collector'?s?)(?:\s+edition)?|official\s+(?:audio|music\s+video|video|lyric(?:s)?(?:\s+video)?)|(?:mono|stereo|radio|album|single)\s+(?:version|mix|edit)|bonus\s+tracks?|(?:hd|hq|4k))(?:\s+edition)?`;
const MARKER = String.raw`remaster(?:ed)?|deluxe|expanded|anniversary|collector'?s?|special\s+edition|official\s+(?:audio|music\s+video|video|lyrics?)|(?:mono|stereo|radio|album|single)\s+(?:version|mix|edit)|bonus\s+tracks?|\b(?:hd|hq|4k)\b`;
const BRACKET_JUNK = new RegExp(String.raw`\s*[\[(][^\[\]()]*?(?:${MARKER})[^\[\]()]*(?:\)|\])`, 'gi');
const BARE_JUNK = String.raw`(?:\d{4}\s+)?remaster(?:ed)?(?:\s+(?:in\s+)?\d{4})?|(?:deluxe|expanded|anniversary|special|collector'?s?)\s+edition|official\s+(?:audio|music\s+video|video|lyric(?:s)?(?:\s+video)?)|(?:mono|stereo|radio|album|single)\s+(?:version|mix|edit)`;
const SUFFIX_JUNK = new RegExp(String.raw`(?:\s+[-–—:]\s*${JUNK}|\s+(?:${BARE_JUNK}))\s*$`, 'gi');

export function cleanSongMetadataText(value) {
  let text = String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  for (let i = 0; i < 3; i++) text = text.replace(BRACKET_JUNK, '').replace(SUFFIX_JUNK, '');
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeSongMetadata(source = {}) {
  const year = String(source.year ?? '').trim();
  return {
    artist: cleanSongMetadataText(source.artist).slice(0, SONG_METADATA_LIMITS.artist),
    title: cleanSongMetadataText(source.title).slice(0, SONG_METADATA_LIMITS.title),
    album: cleanSongMetadataText(source.album).slice(0, SONG_METADATA_LIMITS.album),
    year: /^[1-9]\d{3}$/.test(year) ? year : '',
  };
}

export function metadataFromFilename(filename = '') {
  const text = String(filename).replace(/\.mp3$/i, '');
  const split = text.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return normalizeSongMetadata(split ? { artist: split[1], title: split[2] } : { title: text });
}
