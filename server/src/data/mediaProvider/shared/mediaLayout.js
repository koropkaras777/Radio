/**
 * @typedef {object} MediaCategory
 * @property {string}   name         label used in reports
 * @property {string}   localPrefix  path under the media root, with a trailing slash
 * @property {string}   cloudPrefix  object key prefix, empty for music
 * @property {string[]} listPrefixes prefixes to enumerate in the bucket
 */

/** @type {MediaCategory[]} */
export const MEDIA_CATEGORIES = [
  {
    name: 'music',
    localPrefix: 'music/',
    cloudPrefix: '',
    listPrefixes: ['day/', 'night/'],
  },
  {
    name: 'jingles',
    localPrefix: 'jingles/',
    cloudPrefix: 'jingles/',
    listPrefixes: ['jingles/'],
  },
  {
    name: 'background',
    localPrefix: 'background/',
    cloudPrefix: 'background/',
    listPrefixes: ['background/'],
  },
  {
    name: 'phrases',
    localPrefix: 'phrases/',
    cloudPrefix: 'phrases/',
    listPrefixes: ['phrases/'],
  },
  {
    name: 'arts',
    localPrefix: 'arts/',
    cloudPrefix: 'arts/',
    listPrefixes: ['arts/'],
  },
];

/**
 * @param {MediaCategory} category
 * @param {string} localRelativePath e.g. `music/day/Artist - Title.mp3`
 * @returns {string} e.g. `day/Artist - Title.mp3`
 */
export function toCloudKey(category, localRelativePath) {
  const normalized = String(localRelativePath).replace(/\\/g, '/');
  const rest = normalized.startsWith(category.localPrefix)
    ? normalized.slice(category.localPrefix.length)
    : normalized;

  return `${category.cloudPrefix}${rest}`;
}

/**
 * @param {MediaCategory} category
 * @param {string} cloudKey
 * @returns {string}
 */
export function toLocalRelativePath(category, cloudKey) {
  const normalized = String(cloudKey).replace(/\\/g, '/');
  const rest = category.cloudPrefix && normalized.startsWith(category.cloudPrefix)
    ? normalized.slice(category.cloudPrefix.length)
    : normalized;

  return `${category.localPrefix}${rest}`;
}

/**
 * @param {string} cloudKey
 * @returns {MediaCategory|null}
 */
export function categoryForCloudKey(cloudKey) {
  const normalized = String(cloudKey).replace(/\\/g, '/');

  for (const category of MEDIA_CATEGORIES) {
    if (category.cloudPrefix && normalized.startsWith(category.cloudPrefix)) return category;
  }

  const music = MEDIA_CATEGORIES.find((c) => c.name === 'music');
  return music.listPrefixes.some((prefix) => normalized.startsWith(prefix)) ? music : null;
}
