import { useContext, useState } from 'react';
import { DragCtx } from './DragCtx.js';
import { ArtistChip } from './ArtistChip.jsx';

// ─── UnassignedPanel ─────────────────────────────────────────────────────────
export function UnassignedPanel({ unassigned, loadingArtists, t, isNight, hint }) {
  const drag = useContext(DragCtx);
  const [isOver, setIsOver] = useState(false);
  const [copyState, setCopyState] = useState('');
  const copyArtists = async () => {
    try {
      await navigator.clipboard.writeText(unassigned.join(', '));
      setCopyState('copied');
    } catch {
      setCopyState('copyFailed');
    }
  };
  const canDrop = drag.dragging && drag.dragging.sourceGroup !== '__unassigned__';
  const highlight = isOver && canDrop;
  const accentBorder = isNight ? 'border-red-500/50 bg-red-900/10' : 'border-blue-500/40 bg-blue-900/10';

  return (
    <div className="flex flex-col h-full max-h-[60vh] rounded-xl border border-white/10 bg-white/3 overflow-hidden">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2 text-[11px] font-black text-gray-300">
          <span>{t('groupDefsUnassigned')}</span>
          <button type="button" onClick={copyArtists} disabled={loadingArtists || !unassigned.length}
            title={t('copyUnassigned')} aria-label={t('copyUnassigned')}
            className="flex shrink-0 items-center justify-center rounded p-1 text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <div role="status" className={`text-[10px] ${copyState === 'copyFailed' ? 'text-red-400' : 'text-green-400'}`}>{copyState && t(copyState)}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">{hint ?? t('groupDefsUnassignedHint')}</div>
      </div>
      <div
        className={`flex-1 overflow-y-auto px-2 pb-2 min-h-[60px] rounded-b-xl transition-all ${
          highlight ? accentBorder : ''
        }`}
        onDragOver={(e) => { if (canDrop) { e.preventDefault(); setIsOver(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            if (data && data.sourceGroup !== '__unassigned__') {
              drag.onDropToUnassigned(data);
            }
          } catch (_) {}
          drag.setDragging(null);
        }}
      >
        {loadingArtists ? (
          <div className="text-[10px] text-gray-500 px-1 py-2">{t('groupDefsLoadingArtists')}</div>
        ) : unassigned.length === 0 ? (
          <div className="text-[10px] text-gray-500 px-1 py-2">{t('groupDefsUnassignedEmpty')}</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {unassigned.map((a) => (
              <ArtistChip key={a} artist={a} sourceGroup="__unassigned__" isNight={isNight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
