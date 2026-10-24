import { useNamespace } from '../../../i18n/index.js';
import { SONG_METADATA_LIMITS } from '../../../../../shared/songMetadata.mjs';

export function UploadMetadataFields({ metadata, readOnly, loading, lang, onChange }) {
  const t = useNamespace('textEditor', lang);
  const labels = { artist: t('metaArtist'), title: t('metaTitle'), album: t('metaAlbum'), year: t('metaYear') };
  if (readOnly) return (
    <div className="min-w-0">
      <div className="truncate text-sm font-black uppercase text-white">{[metadata.artist, metadata.title].filter(Boolean).join(' - ')}</div>
      <div className="truncate text-[11px] font-bold uppercase text-white">{[metadata.album, metadata.year].filter(Boolean).join(' · ') || '-'}</div>
    </div>
  );
  const field = (name) => (
    <input
      type="text"
      value={metadata[name] ?? ''}
      disabled={loading}
      maxLength={SONG_METADATA_LIMITS[name]}
      inputMode={name === 'year' ? 'numeric' : undefined}
      pattern={name === 'year' ? '[1-9][0-9]{3}' : undefined}
      aria-invalid={name === 'year' && Boolean(metadata.year) && !/^[1-9][0-9]{3}$/.test(metadata.year)}
      placeholder={labels[name]}
      aria-label={labels[name]}
      title={labels[name]}
      onChange={(event) => onChange(name, name === 'year' ? event.target.value.replace(/[^0-9]/g, '').slice(0, 4) : event.target.value)}
      className={`min-w-0 w-full rounded-none border-0 border-b border-white/30 bg-transparent px-0 py-1 outline-none placeholder:text-white/30 focus:border-blue-400 aria-[invalid=true]:border-red-400 disabled:opacity-40 ${name === 'artist' || name === 'title' ? 'text-sm font-black text-white' : 'text-[11px] font-bold text-white'} ${name === 'year' ? 'max-w-[4.5rem]' : 'flex-1'}`}
    />
  );
  return (
    <div className="min-w-0 space-y-1" onClick={(event) => event.stopPropagation()}>
      <div className="flex min-w-0 items-center gap-2">{field('artist')}<span className="text-white/30">-</span>{field('title')}</div>
      <div className="flex min-w-0 items-center gap-2">{field('album')}{field('year')}</div>
    </div>
  );
}
