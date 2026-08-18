import { useState } from 'react';
import { GroupDropZone } from './GroupDropZone.jsx';

// ─── GroupEntry ──────────────────────────────────────────────────────────────
export function GroupEntry({ groupKey, artists, groupStats, onRemove, onKeyChange, onDrop, isNight, t, inputBorder }) {
  const [isOver, setIsOver] = useState(false);
  const count = groupStats?.find(([k]) => k === groupKey)?.[1] ?? 0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          defaultValue={groupKey}
          onBlur={(e) => onKeyChange(groupKey, e.target.value.trim())}
          className={`w-24 rounded border bg-black/20 px-2 py-1 text-xs font-black text-white outline-none ${inputBorder}`}
          placeholder={t('groupDefsGroupName')}
          title={t('groupDefsKeyHint')}
        />
        <span className="flex-1 text-[11px] text-gray-500">
          {t('artistsCount', { count: artists.length })}
          {count > 0 && <span className="ms-1 text-gray-600">· {t('songsCount', { count })}</span>}
        </span>
        <button
          onClick={() => onRemove(groupKey)}
          className="rounded bg-red-950/60 px-2 py-1 text-[10px] font-black text-red-300 hover:bg-red-900/60"
        >
          ×
        </button>
      </div>
      <GroupDropZone
        groupKey={groupKey}
        artists={artists}
        onDrop={onDrop}
        isOver={isOver}
        setOver={setIsOver}
        isNight={isNight}
      />
    </div>
  );
}