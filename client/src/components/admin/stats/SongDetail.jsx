import { formatDur } from './statsHelpers.js';

export function SongDetail({ song, artist, t, durSuffix, className = 'px-10 py-2' }) {
  return (
    <div className={`${className} text-xs text-gray-500 space-y-0.5`}>
      <div><span className="text-gray-400">{t('statsFieldTitle')}:</span> {song.title}</div>
      <div><span className="text-gray-400">{t('statsFieldArtist')}:</span> {artist}</div>
      {song.album && <div><span className="text-gray-400">{t('statsFieldAlbum')}:</span> {song.album}</div>}
      {song.year  && <div><span className="text-gray-400">{t('statsFieldYear')}:</span> {song.year}</div>}
      <div><span className="text-gray-400">{t('statsFieldDuration')}:</span> {formatDur(song.duration, durSuffix)}</div>
    </div>
  );
}