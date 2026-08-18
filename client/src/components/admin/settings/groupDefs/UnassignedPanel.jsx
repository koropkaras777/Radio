import { useContext, useState } from 'react';
import { DragCtx } from './DragCtx.js';
import { ArtistChip } from './ArtistChip.jsx';

// ─── UnassignedPanel ─────────────────────────────────────────────────────────
export function UnassignedPanel({ unassigned, loadingArtists, t, isNight, hint }) {
  const drag = useContext(DragCtx);
  const [isOver, setIsOver] = useState(false);
  const canDrop = drag.dragging && drag.dragging.sourceGroup !== '__unassigned__';
  const highlight = isOver && canDrop;
  const accentBorder = isNight ? 'border-red-500/50 bg-red-900/10' : 'border-blue-500/40 bg-blue-900/10';

  return (
    <div className="flex flex-col h-full max-h-[60vh] rounded-xl border border-white/10 bg-white/3 overflow-hidden">
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="text-[11px] font-black text-gray-300">{t('groupDefsUnassigned')}</div>
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