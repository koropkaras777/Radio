import { sanitizeArtistKey } from './artistKey.js';

export const artistArtsIndexCache  = new Map();
export const artistArtBinaryCache  = new Map();

let cacheReady   = false;
let cachePromise = null;

export const cacheArtistArtItem = (item) => {
  const normalizedArtist = sanitizeArtistKey(item?.artist);
  if (!normalizedArtist) return null;
  const normalized = {
    artist:      normalizedArtist,
    hasArt:      Boolean(item?.hasArt),
    artFileName: String(item?.artFileName || '').trim(),
  };
  artistArtsIndexCache.set(normalizedArtist, normalized);
  return normalized;
};

export const warmArtistArtsCache = async (radioEngine) => {
  try {
    const providerItems = typeof radioEngine.dataProvider?.loadArtistArts === 'function'
      ? await radioEngine.dataProvider.loadArtistArts()
      : [];

    artistArtsIndexCache.clear();
    for (const item of providerItems || []) cacheArtistArtItem(item);
    console.log(`[ArtistArts] Index cache warmed (${artistArtsIndexCache.size} artists)`);
  } catch (err) {
    console.warn('[ArtistArts] Cache warmup failed:', err.message);
  } finally {
    cacheReady   = true;
    cachePromise = null;
  }
};

export const initArtistArtsCache = (radioEngine) => {
  cachePromise = warmArtistArtsCache(radioEngine);
  return cachePromise;
};

export const isArtistArtsCacheReady = () => cacheReady;
export const getArtistArtsCachePromise = () => cachePromise;