import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const BULK_PAGE           = 10;
const BULK_LAZY_THRESHOLD = 20;
const BULK_ALL_TIMER_SECS = 15;

// ─── BulkConfirmModal ────────────────────────────────────────────────────────
export function BulkConfirmModal({ isNight, lang, t, action, targetMode, songs, allSelected, working, onConfirm, onCancel }) {
  const [visibleCount, setVisibleCount] = useState(BULK_PAGE);
  const [countdown, setCountdown] = useState(
    action === 'delete' && allSelected ? BULK_ALL_TIMER_SECS : 0
  );

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const showList     = !(action === 'delete' && allSelected);
  const useLazyList  = songs.length > BULK_LAZY_THRESHOLD;
  const visibleSongs = useLazyList ? songs.slice(0, visibleCount) : songs;
  const remaining    = songs.length - visibleSongs.length;

  const title    = action === 'delete' ? t('bulkDeleteTitle') : t('bulkMoveTitle');
  const body     = action === 'delete'
    ? t('bulkDeleteBody', { count: songs.length })
    : t('bulkMoveBody', { count: songs.length, modeWord: t(targetMode === 'night' ? 'modeNightGen' : 'modeDayGen') });
  const yesLabel = action === 'delete' ? t('bulkDeleteYes') : t('bulkMoveYes');
  const yesBtn   = action === 'delete' ? 'bg-red-700 hover:bg-red-600' : (isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500');
  const disabled = working || countdown > 0;

  return createPortal(
    <div className="fixed inset-0 z-[510] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl flex flex-col gap-3 ${
          isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-black text-white">{title}</div>
        <div className="text-xs text-gray-300 leading-relaxed">{body}</div>

        {action === 'delete' && allSelected && (
          <div className="text-xs font-black text-red-400 leading-relaxed">{t('bulkDeleteAllWarn')}</div>
        )}

        {showList && (
          <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-white/10 bg-black/20 p-2">
            {visibleSongs.map((s) => (
              <div key={s.id} className="text-[11px] text-gray-300 truncate">
                <span className="font-black text-white">{s.title}</span>
                {s.artist ? <span className="text-gray-500"> · {s.artist}</span> : null}
              </div>
            ))}
            {remaining > 0 && (
              <button
                onClick={() => setVisibleCount((v) => v + BULK_PAGE)}
                className="w-full mt-1 rounded-lg py-1.5 text-[10px] font-black uppercase text-gray-300 bg-white/5 hover:bg-white/10 transition-all"
              >
                {t('bulkShowMore', { count: remaining })}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={working}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/20 disabled:opacity-40"
          >
            {t('bulkCancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className={`rounded-lg px-3 py-2 text-xs font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${yesBtn}`}
          >
            {working ? t('bulkWorking') : countdown > 0 ? t('bulkWaitSeconds', { count: countdown }) : yesLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}