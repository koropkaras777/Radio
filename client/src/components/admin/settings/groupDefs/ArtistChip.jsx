import { useContext } from 'react';
import { DragCtx } from './DragCtx.js';

// ─── ArtistChip ──────────────────────────────────────────────────────────────
export function ArtistChip({ artist, sourceGroup, isNight }) {
  const drag = useContext(DragCtx);
  const isSelf = drag.dragging?.artist === artist && drag.dragging?.sourceGroup === sourceGroup;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ artist, sourceGroup }));
        drag.setDragging({ artist, sourceGroup });
      }}
      onDragEnd={() => drag.setDragging(null)}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold text-white cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isSelf ? 'opacity-30' : 'opacity-100'
      } border-white/15 bg-white/8 hover:bg-white/15`}
    >
      <span className="truncate max-w-[140px]">{artist}</span>
    </div>
  );
}