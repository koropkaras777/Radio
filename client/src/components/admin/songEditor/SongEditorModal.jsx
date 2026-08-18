import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest, getAuthHeaders } from '../../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../../i18n/index.js';
import { SelectionContextMenu } from '../shared/SelectionContextMenu.jsx';
import { handleRemovedArtists } from '../uploadSongs/songUploadApi.js';
import { SongCard } from './SongCard.jsx';
import { BulkConfirmModal } from './BulkConfirmModal.jsx';

const SEARCH_PAGE = 5;
const COMPACT_INPUT = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors';

// ─── SongEditorModal ──────────────────────────────────────────────────────────
export function SongEditorModal({ open, onClose, isNight, lang, showToast, lockedTrackIds = [], onLibraryChanged, capabilities = {}, privileges = [], nightMode = true, initialSongId = null }) {
  const t = useNamespace('textEditor', lang);

  const [songsIndex,    setSongsIndex]    = useState([]);
  const [offsetMap,     setOffsetMap]     = useState({});
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedKey,   setSelectedKey]   = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [selectedSongMeta, setSelectedSongMeta] = useState(null);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [loadingData,   setLoadingData]   = useState(false);
  const [loadingEntry,  setLoadingEntry]  = useState(false);
  const [search,           setSearch]           = useState('');
  const [filterUnsynced,   setFilterUnsynced]   = useState(false);
  const [filterDay,        setFilterDay]        = useState(true);
  const [filterNight,      setFilterNight]      = useState(true);
  const [searchPage,       setSearchPage]       = useState(SEARCH_PAGE);
  const [artDeleteConfirm, setArtDeleteConfirm] = useState(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [bulkAction,  setBulkAction]  = useState(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [moveHint,    setMoveHint]    = useState(false);

  const searchInputRef = useRef(null);
  const longPressTimer = useRef(null);

  const accent      = isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10';
  const inputBorder  = isNight ? 'border-red-900/40 focus:border-red-600' : 'border-white/15 focus:border-blue-500';
  const compactInput = COMPACT_INPUT;

  const canEditMeta = Boolean(capabilities.editTrackMetadata) && privileges.includes('editor_meta');
  const canDelete   = privileges.includes('editor_meta');
  const canDownload = privileges.includes('editor_meta');

  const loadSongsIndex = useCallback(async () => {
    setLoadingData(true);
    try {
      const headers = getAuthHeaders();
      const [songsRes, offsetsRes] = await Promise.all([
        fetch(`${SERVER_URL}/api/admin/lyrics/songs`, { credentials: 'include', headers }),
        fetch(`${SERVER_URL}/api/admin/lyrics/offsets`,     { credentials: 'include', headers }),
      ]);

      if (!songsRes.ok) {
        throw new Error(`Failed to load songs index (${songsRes.status})`);
      }

      const songsData = await songsRes.json();
      const items = songsData.items || [];
      setSongsIndex(items);

      if (offsetsRes.ok) {
        const data = await offsetsRes.json();
        setOffsetMap(data || {});
      }
      return items;
    } catch (err) {
      console.error('[TextEditor] Load songs index error:', err);
      return [];
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadSelectedEntry = useCallback(async (songId, songKey = null) => {
    if (!songId) return;

    setLoadingEntry(true);
    setSelectedEntry(null);
    try {
      const headers = getAuthHeaders();

      const res = await fetch(
        `${SERVER_URL}/api/admin/lyrics/cache-entry?songId=${encodeURIComponent(songId)}`,
        { credentials: 'include', headers }
      );

      if (!res.ok) {
        throw new Error('Failed to load lyrics entry');
      }

      const data = await res.json();
      if (data?.key) {
        setSelectedKey(data.key);
      } else if (songKey) {
        setSelectedKey(songKey);
      }
      setSelectedOffset(Number.isFinite(Number(data?.offset)) ? Number(data.offset) : 0);
      setSelectedEntry(data.entry || { synced: false, lines: [], fetchedAt: Date.now() });
    } catch (err) {
      console.error('[TextEditor] Load entry error:', err);
      setSelectedEntry(null);
      showToast?.(t('saveError') + ': ' + err.message, 'error');
    } finally {
      setLoadingEntry(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (!open) return;

    setSearch('');
    setFilterUnsynced(false);
    setFilterDay(true);
    setFilterNight(true);
    setSelectedEntry(null);
    setSelectedSongMeta(null);
    setSelectedOffset(0);
    setSearchPage(SEARCH_PAGE);
    setSelectedIds(new Set());
    setContextMenu(null);
    setBulkAction(null);

    let cancelled = false;
    (async () => {
      const items = await loadSongsIndex();
      if (cancelled) return;

      if (initialSongId) {
        const match = items.find((i) => i.id === initialSongId);
        setSelectedSongId(initialSongId);
        setSelectedKey(match?.key || null);
        setSelectedSongMeta(match || null);
        await loadSelectedEntry(initialSongId, match?.key || null);
      } else {
        setSelectedSongId(null);
        setSelectedKey(null);
      }
    })();

    setTimeout(() => searchInputRef.current?.focus(), 100);
    return () => { cancelled = true; };
  }, [open, loadSongsIndex, loadSelectedEntry, initialSongId]);

  const { visibleItems, remaining, filteredAll } = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/[\s\-–—,|]+/).filter(Boolean);

    const filtered = songsIndex.filter((item) => {
      if (!nightMode && item.mode === 'night') return false;

      if (nightMode && !(filterDay && filterNight)) {
        if (filterDay  && item.mode !== 'day')   return false;
        if (filterNight && item.mode !== 'night') return false;
      }

      if (filterUnsynced && item.status === 'synced') return false;

      if (tokens.length > 0) {
        const haystack = `${item.artist} ${item.title}`.toLowerCase();
        if (!tokens.every((tok) => haystack.includes(tok))) return false;
      }

      return true;
    });

    return {
      visibleItems: filtered.slice(0, searchPage),
      remaining:    filtered.length - Math.min(filtered.length, searchPage),
      filteredAll:  filtered,
    };
  }, [songsIndex, search, filterUnsynced, filterDay, filterNight, searchPage, nightMode]);

  // ── Bulk selection derived state & handlers ───────────────────────────────
  const isSelectionMode = selectedIds.size > 0;

  const selectedSongsData = useMemo(
    () => songsIndex.filter((s) => selectedIds.has(s.id)),
    [songsIndex, selectedIds]
  );
  const selectedModesArr = useMemo(
    () => [...new Set(selectedSongsData.map((s) => s.mode))],
    [selectedSongsData]
  );
  const moveDisabled   = nightMode && selectedModesArr.length > 1;
  const moveTargetMode = selectedModesArr.length === 1
    ? (selectedModesArr[0] === 'night' ? 'day' : 'night')
    : null;

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const cancelSelection   = useCallback(() => setSelectedIds(new Set()), []);
  const selectAllFiltered = useCallback(
    () => setSelectedIds(new Set(filteredAll.map((i) => i.id))),
    [filteredAll]
  );

  const startLongPress = useCallback((item) => {
    if (selectedIds.size > 0) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setSelectedIds(new Set([item.id]));
    }, 1000);
  }, [selectedIds]);

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const requestBulkDelete = useCallback(() => {
    if (!selectedSongsData.length) return;
    const allLibrarySelected = songsIndex.length > 0 && selectedIds.size === songsIndex.length;
    setBulkAction({ type: 'delete', songs: selectedSongsData, allSelected: allLibrarySelected });
  }, [selectedSongsData, selectedIds, songsIndex.length]);

  const requestBulkMove = useCallback(() => {
    if (!selectedSongsData.length || moveDisabled || !moveTargetMode) return;
    setBulkAction({ type: 'move', targetMode: moveTargetMode, songs: selectedSongsData, allSelected: false });
  }, [selectedSongsData, moveDisabled, moveTargetMode]);

  const confirmBulkAction = useCallback(async () => {
    if (!bulkAction) return;
    const songIds = bulkAction.songs.map((s) => s.id);
    setBulkWorking(true);
    try {
      if (bulkAction.type === 'delete') {
        const res = await apiRequest(`${SERVER_URL}/api/admin/song-editor/batch-delete`, {
          method: 'POST',
          body: JSON.stringify({ songIds }),
        }, lang);
        const okIds     = new Set((res.results || []).filter((r) => r.ok).map((r) => r.songId));
        const failCount = songIds.length - okIds.size;

        setSongsIndex((prev) => prev.filter((s) => !okIds.has(s.id)));
        if (selectedSongId && okIds.has(selectedSongId)) {
          setSelectedSongId(null);
          setSelectedKey(null);
          setSelectedEntry(null);
          setSelectedSongMeta(null);
          setSelectedOffset(0);
        }
        await handleRemovedArtists({
          removedArtists: res.removedArtists || [],
          lang, showToast,
          onConfirmArtDelete: (entry) => setArtDeleteConfirm(entry),
        });
        showToast?.(t('bulkDeleteDone', { count: okIds.size }), 'success');
        if (failCount > 0) showToast?.(t('bulkPartialFail', { count: failCount }), 'error');
      } else {
        const res = await apiRequest(`${SERVER_URL}/api/admin/song-editor/batch-move`, {
          method: 'POST',
          body: JSON.stringify({ songIds, targetMode: bulkAction.targetMode }),
        }, lang);
        const results = res.results || [];
        const okMap    = new Map(results.filter((r) => r.ok).map((r) => [r.songId, r]));
        const failCount = songIds.length - okMap.size;

        setSongsIndex((prev) => prev.map((s) => {
          const r = okMap.get(s.id);
          if (!r) return s;
          return { ...s, id: r.newId || s.id, mode: bulkAction.targetMode };
        }));
        if (selectedSongId && okMap.has(selectedSongId)) {
          setSelectedSongId(okMap.get(selectedSongId).newId || selectedSongId);
        }
        await handleRemovedArtists({
          removedArtists: res.removedArtists || [],
          lang, showToast,
          onConfirmArtDelete: (entry) => setArtDeleteConfirm(entry),
        });
        showToast?.(t('bulkMoveDone', { count: okMap.size }), 'success');
        if (failCount > 0) showToast?.(t('bulkPartialFail', { count: failCount }), 'error');
      }
      onLibraryChanged?.();
      setSelectedIds(new Set());
      setBulkAction(null);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBulkWorking(false);
    }
  }, [bulkAction, lang, showToast, t, selectedSongId, onLibraryChanged]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${accent}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>  

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('searchPlaceholder')}
                className={`${compactInput} ${inputBorder}`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchPage(SEARCH_PAGE); }}
              />
              <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none">
                <div
                  onClick={() => { setFilterUnsynced((v) => !v); setSearchPage(SEARCH_PAGE); }}
                  className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                    filterUnsynced
                      ? (isNight ? 'bg-red-700' : 'bg-blue-600')
                      : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-0.5 start-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${filterUnsynced ? 'translate-x-[14px] rtl:-translate-x-[14px]' : ''}`} />
                </div>
                <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">{t('filterUnsynced')}</span>
              </label>
            </div>
            {nightMode && (
              <div className="flex items-center gap-4">
                {[
                  { key: 'day',   label: t('filterDay'),   active: filterDay,   set: setFilterDay,   other: filterNight },
                  { key: 'night', label: t('filterNight'), active: filterNight, set: setFilterNight, other: filterDay   },
                ].map(({ key, label, active, set, other }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer group select-none">
                    <div
                      onClick={() => {
                        if (active && !other) return;
                        set((v) => !v);
                        setSearchPage(SEARCH_PAGE);
                      }}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                        active
                          ? (isNight ? 'bg-red-700 border-red-600' : 'bg-blue-600 border-blue-500')
                          : 'border-gray-500 bg-transparent'
                      } ${active && !other ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {active && (
                        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-black transition-colors ${active ? 'text-gray-200' : 'text-gray-500'}`}
                      onClick={() => {
                        if (active && !other) return;
                        set((v) => !v);
                        setSearchPage(SEARCH_PAGE);
                      }}
                    >
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {!selectedKey && (
            <div className="space-y-2">
              {loadingData ? (
                <div className="text-xs text-gray-400">{t('loading')}</div>
              ) : visibleItems.length === 0 ? (
                <div className="text-xs text-gray-400">{songsIndex.length === 0 ? t('noCache') : t('nothingFound')}</div>
              ) : visibleItems.map((item) => {
                const key = item.key;
                const status = item.status;
                const sb = { synced: 'bg-green-700/40 text-green-300', plain: 'bg-blue-700/40 text-blue-300', none: 'bg-gray-700/40 text-gray-400' }[status];
                const sl = { synced: t('statusSynced'), plain: t('statusPlain'), none: t('statusNone') }[status];
                const isChecked = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id || key}
                    onClick={async () => {
                      if (isSelectionMode) { toggleSelect(item.id); return; }
                      setSelectedSongId(item.id);
                      setSelectedKey(key);
                      setSelectedSongMeta(item);
                      await loadSelectedEntry(item.id, key);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    onMouseDown={() => startLongPress(item)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onTouchStart={() => startLongPress(item)}
                    onTouchEnd={cancelLongPress}
                    className={`w-full text-start rounded-xl px-4 py-3 border transition-all flex items-center gap-3 ${
                      isChecked
                        ? (isNight ? 'bg-red-950/30 border-red-600' : 'bg-blue-950/30 border-blue-500')
                        : (isNight ? 'bg-red-950/20 border-red-900/20 hover:border-red-600' : 'bg-white/5 border-white/10 hover:border-white/30')
                    }`}
                  >
                    {isSelectionMode && (
                      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                        isChecked
                          ? (isNight ? 'bg-red-700 border-red-600' : 'bg-blue-600 border-blue-500')
                          : 'border-gray-500 bg-transparent'
                      }`}>
                        {isChecked && (
                          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 justify-between flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="font-black text-sm truncate capitalize text-white">{item.title}</div>
                        <div className="text-[10px] text-gray-400 truncate capitalize">{[item.artist, item.album ? `${item.album}${item.year ? ` (${item.year})` : ''}` : item.year ? `(${item.year})` : ''].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {nightMode && item.mode && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            item.mode === 'night' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-amber-900/40 text-amber-300'
                          }`}>
                            {item.mode === 'night' ? t('broadcastNight') : t('broadcastDay')}
                          </span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${sb}`}>{sl}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {remaining > 0 && (
                <button
                  onClick={() => setSearchPage((p) => p + SEARCH_PAGE)}
                  className={`w-full mt-1 rounded-lg py-2 text-[10px] font-black uppercase transition-all ${
                    isNight ? 'bg-red-950/30 hover:bg-red-950/50 text-red-300' : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  {t('showMore', { count: remaining })}
                </button>
              )}

              {isSelectionMode && (
                <div className="flex items-center gap-2 flex-wrap pt-3 mt-2 border-t border-white/10">
                  <button
                    onClick={cancelSelection}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white/60 bg-white/10 hover:bg-white/15 transition-all"
                  >
                    {t('bulkCancel')}
                  </button>
                  <button
                    onClick={selectAllFiltered}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white/60 bg-white/10 hover:bg-white/15 transition-all"
                  >
                    {t('selectAllBtn')}
                  </button>
                  {nightMode && canEditMeta && (
                    <div
                      className="relative"
                      onMouseEnter={() => moveDisabled && setMoveHint(true)}
                      onMouseLeave={() => setMoveHint(false)}
                    >
                      <button
                        onClick={requestBulkMove}
                        disabled={moveDisabled}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                      >
                        {t('moveSelectedBtn')} <span className="rtl:-scale-x-100 inline-block">→</span> {moveTargetMode === 'night' ? t('broadcastNight') : moveTargetMode === 'day' ? t('broadcastDay') : `${t('broadcastDay')}/${t('broadcastNight')}`}
                      </button>
                      {moveHint && moveDisabled && (
                        <div className="absolute bottom-full start-0 mb-1 z-20 w-56 whitespace-normal rounded-lg bg-gray-900/95 border border-white/10 px-3 py-1.5 text-[10px] font-bold text-white shadow-xl">
                          {t('moveMixedHint')}
                        </div>
                      )}
                    </div>
                  )}
                  {canDelete && (
                    <button
                      onClick={requestBulkDelete}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white bg-red-700 hover:bg-red-600 transition-all"
                    >
                      {t('deleteSelectedBtn')} ({selectedIds.size})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedSongId && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedSongId(null);
                  setSelectedKey(null);
                  setSelectedEntry(null);
                  setSelectedSongMeta(null);
                  setSelectedOffset(0);
                }}
                className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5">
                  <polygon points="8,1 2,5 8,9"/>
                </svg>
                {t('searchPlaceholder')}
              </button>
              {loadingEntry ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                  {t('loading')}
                </div>
              ) : selectedEntry ? (
                <SongCard
                  key={selectedSongId || selectedKey}
                  songId={selectedSongId}
                  songKey={selectedKey}
                  songMeta={selectedSongMeta}
                  entry={selectedEntry}
                  initialOffset={selectedOffset}
                  isNight={isNight}
                  lang={lang}
                  canEditMeta={canEditMeta}
                  canDelete={canDelete}
                  canDownload={canDownload}
                  capabilities={capabilities}
                  nightMode={nightMode}
                  lockedReason={lockedTrackIds.includes(selectedSongId) ? (lockedTrackIds[0] === selectedSongId ? t('lockedCurrent') : t('lockedNext')) : ''}
                  showToast={showToast}
                  onSaved={({ songId, songKey, songMeta, entry, offset, newMode, reloadEntry }) => {
                    setSelectedSongId(songId || selectedSongId);
                    setSelectedKey(songKey || selectedKey);
                    setSelectedSongMeta(songMeta || selectedSongMeta);
                    setSelectedEntry(entry || { synced: false, lines: [], fetchedAt: Date.now() });
                    setSelectedOffset(Number.isFinite(Number(offset)) ? Number(offset) : 0);
                    onLibraryChanged?.();

                    if (reloadEntry && songId) {
                      loadSelectedEntry(songId, songKey).catch(() => {});
                    }

                    if (songKey) {
                      setOffsetMap((prev) => ({
                        ...prev,
                        [songKey]: Number.isFinite(Number(offset)) ? Number(offset) : 0,
                      }));

                      const prevSongId = selectedSongId;
                      setSongsIndex((prev) => prev.map((item) => {
                        if (item.id !== prevSongId && item.id !== songId) return item;
                        const status = !entry
                          ? 'none'
                          : entry.notFound
                            ? 'none'
                            : entry.synced
                              ? 'synced'
                              : 'plain';
                        return {
                          ...item,
                          id:     songId     || item.id,
                          key:    songKey    || item.key,
                          title:  songMeta?.title  || item.title,
                          artist: songMeta?.artist || item.artist,
                          album:  songMeta?.album  || item.album,
                          year:   songMeta?.year   ?? item.year,
                          mode:   newMode          || item.mode,
                          status,
                        };
                      }));
                    }
                  }}
                  onDeleted={({ songId }) => {
                    setSongsIndex((prev) => prev.filter((item) => item.id !== songId));
                    setSelectedSongId(null);
                    setSelectedKey(null);
                    setSelectedSongMeta(null);
                    setSelectedEntry(null);
                    setSelectedOffset(0);
                    onLibraryChanged?.();
                  }}
                  onRemovedArtists={(removedArtists) => handleRemovedArtists({
                    removedArtists,
                    lang,
                    showToast,
                    onConfirmArtDelete: (entry) => setArtDeleteConfirm(entry),
                  })}
                  onConfirmArtDelete={(entry) => setArtDeleteConfirm(entry)}
                />

              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                  {t('nothingFound')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {artDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl flex flex-col gap-4 ${
              isNight ? 'border-red-900/40 bg-[#1a0505]' : 'border-white/10 bg-gray-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-black text-white">
              {translate('uploadSongs.artDeleteTitle', {}, lang)}
            </div>
            <div className="text-xs text-white/60 leading-relaxed">
              {translate('uploadSongs.artDeleteText', { artist: artDeleteConfirm.artist }, lang)}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArtDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-white/10 hover:bg-white/15 transition-all"
              >
                {translate('uploadSongs.artDeleteNo', {}, lang)}
              </button>
              <button
                onClick={async () => {
                  const artist = artDeleteConfirm.artist;
                  setArtDeleteConfirm(null);
                  try {
                    await apiRequest(`${SERVER_URL}/api/admin/artist-arts/${encodeURIComponent(artist)}`, { method: 'DELETE' }, lang);
                    showToast?.(translate('uploadSongs.artDeletedToast', { artist }, lang), 'success');
                  } catch (err) {
                    showToast?.(err.message, 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-red-700 hover:bg-red-600 transition-all"
              >
                {translate('uploadSongs.artDeleteYes', {}, lang)}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {contextMenu && (
        <SelectionContextMenu
          isNight={isNight}
          t={t}
          x={contextMenu.x}
          y={contextMenu.y}
          onSelect={() => { setSelectedIds(new Set([contextMenu.item.id])); setContextMenu(null); }}
          onSelectAll={() => { setSelectedIds(new Set(filteredAll.map((i) => i.id))); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {bulkAction && (
        <BulkConfirmModal
          isNight={isNight}
          lang={lang}
          action={bulkAction.type}
          targetMode={bulkAction.targetMode}
          songs={bulkAction.songs}
          allSelected={bulkAction.allSelected}
          working={bulkWorking}
          t={t}
          onConfirm={confirmBulkAction}
          onCancel={() => !bulkWorking && setBulkAction(null)}
        />
      )}
    </div>,
    document.body
  );
}

export default SongEditorModal;