const coverCache = new Map();

export async function fetchCover(artist, album, title, year) {
  const cacheKey = `${artist}::${album}::${year ?? ''}`;
  if (coverCache.has(cacheKey)) return coverCache.get(cacheKey);

  const search = async (term, entity, limit = 5) => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=${limit}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const { results } = await res.json();
    if (!results?.length) return null;
    const artistLower = artist.toLowerCase();
    const albumLower  = album.toLowerCase();

    const exactBoth = results.find((r) => {
      const ra = (r.artistName || r.collectionArtistName || '').toLowerCase();
      const rc = (r.collectionName || '').toLowerCase();
      const artistMatch = ra === artistLower || ra.includes(artistLower) || artistLower.includes(ra);
      const albumMatch  = rc === albumLower  || rc.includes(albumLower)  || albumLower.includes(rc);
      return artistMatch && albumMatch;
    });

    const exactArtist = results.find((r) => {
      const ra = (r.artistName || r.collectionArtistName || '').toLowerCase();
      return ra === artistLower || ra.includes(artistLower) || artistLower.includes(ra);
    });
    const best = exactBoth ?? exactArtist ?? results[0];
    return best?.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null;
  };

  try {
    let url = null;

    if (year) {
      url = await search(`${artist} ${title} ${album} ${year}`, 'song');
    }

    if (!url) {
      url = await search(`${artist} ${album}`, 'album');
    }

    if (!url) {
      url = await search(`${artist} ${title}`, 'song');
    }

    coverCache.set(cacheKey, url);
    return url;
  } catch (e) {
    console.error('Cover search error', e);
    return null;
  }
}
