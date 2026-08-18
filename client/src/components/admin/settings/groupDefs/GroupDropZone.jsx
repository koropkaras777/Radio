import { useContext } from 'react';
import { DragCtx } from './DragCtx.js';
import { ArtistChip } from './ArtistChip.jsx';

// ─── GroupDropZone ───────────────────────────────────────────────────────────
export function GroupDropZone({ groupKey, artists, onDrop, isOver, setOver, isNight }) {
  const drag = useContext(DragCtx);
  const canDrop = drag.dragging && drag.dragging.sourceGroup !== groupKey;
  const highlight = isOver && canDrop;
  const accentBorder = isNight ? 'border-red-500/50 bg-red-900/10' : 'border-blue-500/40 bg-blue-900/10';

  return (
    <div
      className={`min-h-[36px] rounded-md border transition-all ${
        highlight ? accentBorder : 'border-white/10 bg-transparent'
      }`}
      onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data && data.sourceGroup !== groupKey) {
            onDrop(data);
          }
        } catch (_) {}
        drag.setDragging(null);
      }}
    >
      <div className="flex flex-wrap gap-1.5 p-1.5">
        {artists.map((a) => (
          <ArtistChip key={a} artist={a} sourceGroup={groupKey} isNight={isNight} />
        ))}
        {artists.length === 0 && (
          <span className="text-[10px] text-gray-600 px-1 py-0.5">-</span>
        )}
      </div>
    </div>
  );
}