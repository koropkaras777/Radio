import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { t as translate } from '../../../i18n/index.js';

export const downloadYoutubeSong = ({ url, mode, lang, signal }) =>
  apiRequest(`${SERVER_URL}/api/admin/upload-song-url`, { method: 'POST', body: JSON.stringify({ url, mode, lang }), signal }, lang)
    .then((data) => ({ metadata: data.metadata, storageKey: data.storageKey }));

export const fetchYoutubeTrackInfo = ({ url, lang, signal }) =>
  apiRequest(`${SERVER_URL}/api/admin/youtube-track-info`, { method: 'POST', body: JSON.stringify({ url, lang }), signal }, lang)
    .then((data) => ({ tracks: data.tracks || [], total: data.total ?? (data.tracks || []).length, truncated: Boolean(data.truncated) }));

export const handleRemovedArtists = async ({ removedArtists = [], lang = 'uk', showToast, onConfirmArtDelete }) => {
  if (!removedArtists.length) return;
  for (const entry of removedArtists) {
    if (!entry.hasArt) {
      const msg = translate('uploadSongs.artistRemovedFromArts', { artist: entry.artist }, lang);
      showToast?.(msg, 'info');
    } else {
      onConfirmArtDelete?.(entry);
    }
  }
};