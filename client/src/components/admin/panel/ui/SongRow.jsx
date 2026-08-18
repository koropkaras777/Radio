import { PrivilegeGate } from '../../shared/PrivilegeGate.jsx';
import { LyricsBadge } from './LyricsBadge.jsx';

// ─── SongRow ─────────────────────────────────────────────────────────────────
export function SongRow({ song, isNight, onAir, cooldown, addType, t, canManageQueue, lang }) {
  return (
    <div className={`p-4 rounded-xl flex justify-between items-center transition-all border-2 ${
      isNight ? 'bg-red-950/20 border-red-900/30 hover:border-red-600'
              : 'bg-white/10 border-white/10 hover:border-white/40'
    }`}>
      <div className="flex flex-col overflow-hidden mr-4">
        <span className="font-black uppercase text-sm truncate">{song.title}</span>
        <span className="text-[10px] font-bold opacity-60 uppercase truncate">{song.artist}</span>
        <LyricsBadge status={song.lyricsStatus} t={t} />
      </div>
      <PrivilegeGate locked={!canManageQueue} lang={lang} inline>
        <button
          onClick={() => onAir(song)}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90
            ${cooldown > 0 ? 'opacity-20 grayscale' : ''}
            ${addType === 'donated' ? 'ring-2 ring-green-500' : 'ring-2 ring-violet-500'}
            ${isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          {cooldown > 0 ? `${cooldown}s` : t('air')}
        </button>
      </PrivilegeGate>
    </div>
  );
}