import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { accentBtn, accentPanel } from '../shared/theme.js';
import { updateSongLyrics } from './bulkLyricsUpdate.js';

const STATUS_LABELS = {
  searching: ['lyricsSearching', 'text-gray-400'],
  unchanged: ['lyricsUnchanged', 'text-yellow-400'],
  none: ['lyricsNotFound', 'text-red-400'],
  plain: ['lyricsFoundPlain', 'text-purple-400'],
  synced: ['lyricsFoundSynced', 'text-green-400'],
  error: ['saveError', 'text-red-400'],
};

export function BulkLyricsUpdateModal({ songs, isNight, lang, t, onClose, onSongUpdated, showToast }) {
  const [visibleCount, setVisibleCount] = useState(10);
  const [force, setForce] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [finished, setFinished] = useState(false);
  const [statuses, setStatuses] = useState({});
  const running = useRef(false);
  const updateLabel = t('bulkUpdateLyrics', { count: songs.length });

  const startUpdate = async () => {
    if (running.current) return;
    running.current = true;
    setConfirmOpen(false);
    setWorking(true);
    setStatuses(Object.fromEntries(songs.map((song) => [song.id, { status: 'searching' }])));
    try {
      for (const song of songs) {
        try {
          const result = await updateSongLyrics(song, force, (path, options) =>
            apiRequest(`${SERVER_URL}/api/admin${path}`, options, lang));
          if (result.savedStatus) onSongUpdated(song, result);
          setStatuses((prev) => ({ ...prev, [song.id]: result }));
        } catch (err) {
          setStatuses((prev) => ({ ...prev, [song.id]: { status: 'error', error: err.message } }));
          showToast?.(`${song.title}: ${err.message}`, 'error');
        }
      }
      setFinished(true);
    } finally {
      running.current = false;
      setWorking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => e.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-lyrics-title" className={`w-full max-w-xl max-h-[85vh] rounded-2xl border p-5 shadow-2xl flex flex-col gap-4 ${accentPanel(isNight)}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="bulk-lyrics-title" className="text-sm font-black text-white">{updateLabel}</h2>
          <button
            onClick={onClose}
            disabled={working}
            aria-label={t('close')}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto space-y-2 rounded-xl border border-white/10 bg-black/20 p-3" aria-live="polite">
          {songs.slice(0, visibleCount).map((song) => {
            const result = statuses[song.id];
            const label = result && STATUS_LABELS[result.status];
            return (
              <div key={song.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 text-[11px]">
                <div className="min-w-0">
                  <div className="font-black text-white truncate">{song.title}</div>
                  <div className="text-gray-400 truncate">{song.artist}</div>
                </div>
                {label && <span title={result.error} className={`max-w-[50%] text-end font-bold ${label[1]}`}>{t(label[0])}</span>}
              </div>
            );
          })}
          {visibleCount < songs.length && (
            <button onClick={() => setVisibleCount((count) => count + 10)} className="w-full rounded-lg py-2 text-[10px] font-black text-gray-300 bg-white/5 hover:bg-white/10">
              {t('bulkShowMore', { count: songs.length - visibleCount })}
            </button>
          )}
        </div>
        <label className="flex items-start gap-2 text-xs text-white cursor-pointer">
          <input type="checkbox" checked={force} disabled={working || finished} onChange={(e) => setForce(e.target.checked)} className={`mt-0.5 ${isNight ? 'accent-red-600' : 'accent-blue-600'}`} />
          <span><span className="font-black">{t('forceLyricsUpdate')}</span><span className="block mt-1 text-white/60 leading-relaxed">{t('forceLyricsUpdateDescription')}</span></span>
        </label>
        <div className="flex justify-end gap-2">
          {!finished && <button disabled={working} onClick={() => setConfirmOpen(true)} className={`rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-40 ${accentBtn(isNight)}`}>{working ? t('bulkWorking') : updateLabel}</button>}
        </div>
      </div>
      <ConfirmDialog open={confirmOpen} isNight={isNight} title={t('refetchTextTitle')} body={t('bulkLyricsUpdateWarning')} yesLabel={updateLabel} noLabel={t('refetchTextNo')} zIndex={520} onYes={startUpdate} onNo={() => setConfirmOpen(false)} />
    </div>, document.body,
  );
}
