import { useCallback, useEffect, useMemo, useState } from 'react';
import { SERVER_URL } from '../../../../config/constants.js';
import { apiRequest } from '../../../../i18n/serverMessage.js';
import { DragCtx } from './DragCtx.js';
import { GroupEntry } from './GroupEntry.jsx';
import { UnassignedPanel } from './UnassignedPanel.jsx';

// ─── GroupDefsEditor ─────────────────────────────────────────────────────────
export function GroupDefsEditor({ value, onChange, t, inputBorder, isNight, groupStats, lang, mode = 'day' }) {
  const entries = useMemo(() => Object.entries(value || {}), [value]);
  const accentBtn = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';
  const idPrefix = `${mode}/`;
  const unassignedHint = mode === 'night' ? t('groupDefsUnassignedHintNight') : t('groupDefsUnassignedHint');

  // ── Fetch all mode-specific artists once via /api/admin/songs (no pagination) ──
  const [allModeArtists, setAllModeArtists] = useState([]);
  const [loadingArtists, setLoadingArtists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingArtists(true);
    apiRequest(`${SERVER_URL}/api/admin/songs?mode=${mode}`, {}, lang)
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : (data.items || []);
        const seen = new Map();
        for (const s of items) {
          if (typeof s.id === 'string' && !s.id.startsWith(idPrefix)) continue;
          const raw = (s.artist || '').trim();
          if (!raw) continue;
          const lc = raw.toLowerCase();
          if (!seen.has(lc)) seen.set(lc, raw);
        }
        const artists = [...seen.values()].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        setAllModeArtists(artists);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingArtists(false); });
    return () => { cancelled = true; };
  }, [lang, mode, idPrefix]);

  // ── Compute unassigned ────────────────────────────────────────────────────
  const assignedSet = useMemo(() => {
    const s = new Set();
    for (const artists of Object.values(value || {})) {
      for (const a of artists) s.add(a.trim().toLowerCase());
    }
    return s;
  }, [value]);

  const unassigned = useMemo(
    () => allModeArtists.filter((a) => !assignedSet.has(a.toLowerCase())),
    [allModeArtists, assignedSet]
  );

  // ── Drag state ────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(null);

  const handleDropToGroup = useCallback((targetGroup, { artist, sourceGroup }) => {
    const lc = artist.toLowerCase();
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      let filtered = k === sourceGroup
        ? v.filter((a) => a.trim().toLowerCase() !== lc)
        : [...v];
      if (k === targetGroup) {
        filtered = filtered.filter((a) => a.trim().toLowerCase() !== lc);
      }
      next[k] = filtered;
    }
    next[targetGroup] = [...next[targetGroup], artist];
    onChange(next);
  }, [value, onChange]);

  const handleDropToUnassigned = useCallback(({ artist, sourceGroup }) => {
    if (sourceGroup === '__unassigned__') return;
    const lc = artist.toLowerCase();
    const next = { ...value };
    next[sourceGroup] = (next[sourceGroup] || []).filter(
      (a) => a.trim().toLowerCase() !== lc
    );
    onChange(next);
  }, [value, onChange]);

  // ── Key / group management ────────────────────────────────────────────────
  const updateKey = (oldKey, newKey) => {
    if (!newKey.trim() || newKey === oldKey) return;
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const removeGroup = (key) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const addGroup = () => {
    let i = 1;
    while (value[`G${i}`]) i++;
    onChange({ ...value, [`G${i}`]: [] });
  };

  const dragCtxValue = useMemo(() => ({
    dragging,
    setDragging,
    onDropToUnassigned: handleDropToUnassigned,
  }), [dragging, handleDropToUnassigned]);

  return (
    <DragCtx.Provider value={dragCtxValue}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <div className="text-[11px] text-gray-500">{t('groupDefsHint')}</div>
          {entries.map(([key, artists]) => (
            <GroupEntry
              key={key}
              groupKey={key}
              artists={artists}
              groupStats={groupStats}
              onRemove={removeGroup}
              onKeyChange={updateKey}
              onDrop={(drag) => handleDropToGroup(key, drag)}
              isNight={isNight}
              t={t}
              inputBorder={inputBorder}
            />
          ))}
          <button
            onClick={addGroup}
            className={`w-full rounded-lg py-2 text-[11px] font-black ${accentBtn} text-white`}
          >
            + {t('groupDefsAddGroup')}
          </button>
        </div>

        <div className="lg:sticky lg:top-0 lg:self-start lg:max-h-[60vh]">
          <UnassignedPanel
            unassigned={unassigned}
            loadingArtists={loadingArtists}
            t={t}
            isNight={isNight}
            hint={unassignedHint}
          />
        </div>
      </div>
    </DragCtx.Provider>
  );
}