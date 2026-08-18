import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { JingleUploadModal } from './JingleUploadModal.jsx';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { SelectionContextMenu } from '../shared/SelectionContextMenu.jsx';
import { JingleWaveform } from './JingleWaveform.jsx';

const PAGE_SIZE = 10;
const API_BASE = { jingle: 'jingles', backgroundMusic: 'background-music', phrase: 'phrases' };
const NAMESPACE_BY_KIND = { jingle: 'jinglesModalJingle', backgroundMusic: 'jinglesModalBackgroundMusic', phrase: 'jinglesModalPhrase' };

const displayName = (filename) => String(filename || '').replace(/\.mp3$/i, '');

// ─── MediaLibraryPane ────────────────────────────────────────────────────────
// Search/list/bulk-select pane shared by the Jingles and Background Music tabs.

export function MediaLibraryPane({ kind, onClose, tabs, isNight, lang = 'uk', showToast, nightMode = true, onSelectionModeChange }) {
  const t = useNamespace(NAMESPACE_BY_KIND[kind] || NAMESPACE_BY_KIND.jingle, lang);
  const apiBase = API_BASE[kind];

  const [search,      setSearch]      = useState('');
  const [filterDay,   setFilterDay]   = useState(true);
  const [filterNight, setFilterNight] = useState(true);
  const [items,       setItems]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [eligibility, setEligibility] = useState(null);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [moveConfirm,   setMoveConfirm]   = useState(null);
  const [bulkWorking,   setBulkWorking]   = useState(false);

  const longPressTimer = useRef(null);
  const isSelectionMode = selectedIds.size > 0;

  useEffect(() => {
    onSelectionModeChange?.(isSelectionMode);
  }, [isSelectionMode, onSelectionModeChange]);
  useEffect(() => () => onSelectionModeChange?.(false), [onSelectionModeChange]);

  const moveTargetMode = useMemo(() => {
    if (!nightMode || !selectedIds.size) return null;
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    if (selectedItems.length !== selectedIds.size) return null;
    const modes = new Set(selectedItems.map((i) => i.mode));
    if (modes.size !== 1) return null;
    return modes.has('night') ? 'day' : 'night';
  }, [nightMode, items, selectedIds]);

  const modeParam = useMemo(() => {
    if (!nightMode) return 'day';
    if (filterDay && filterNight) return 'all';
    if (filterDay) return 'day';
    if (filterNight) return 'night';
    return 'none';
  }, [nightMode, filterDay, filterNight]);

  const fetchPage = useCallback(async (offset, replace) => {
    if (modeParam === 'none') { setItems([]); setTotal(0); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ mode: modeParam, search, offset: String(offset), limit: String(PAGE_SIZE) });
      const data = await apiRequest(`${SERVER_URL}/api/admin/${apiBase}?${qs.toString()}`, {}, lang);
      setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      setTotal(data.total || 0);
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [modeParam, search, lang, showToast]);

  const fetchEligibility = useCallback(async () => {
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/counts`, {}, lang);
      setEligibility({ dayUsable: data.dayUsable || 0, nightUsable: data.nightUsable || 0, minRequired: data.minRequired || 3 });
    } catch { }
  }, [lang, apiBase]);

  useEffect(() => {
    fetchEligibility();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchPage(0, true), search ? 250 : 0);
    return () => clearTimeout(id);
  }, [modeParam, search]);

  const refresh = useCallback(() => { fetchPage(0, true); fetchEligibility(); }, [fetchPage, fetchEligibility]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const cancelSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAllVisible = useCallback(() => setSelectedIds(new Set(items.map((i) => i.id))), [items]);

  const startLongPress = useCallback((item) => {
    if (selectedIds.size > 0) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setSelectedIds(new Set([item.id])), 1000);
  }, [selectedIds]);
  const cancelLongPress = useCallback(() => clearTimeout(longPressTimer.current), []);

  const toggleUsed = useCallback(async (item) => {
    const nextUsed = !item.used;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, used: nextUsed } : i)));
    try {
      await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/${encodeURIComponent(item.id)}/used`, {
        method: 'POST',
        body: JSON.stringify({ used: nextUsed }),
      }, lang);
      fetchEligibility();
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, used: item.used } : i)));
      showToast?.(err.message || t('updateError'), 'error');
    }
  }, [lang, apiBase, showToast, t, fetchEligibility]);

  const requestDeleteSelected = useCallback(() => {
    if (!selectedIds.size) return;
    const ids = [...selectedIds];
    const name = ids.length === 1 ? displayName(items.find((i) => i.id === ids[0])?.filename) : undefined;
    setDeleteConfirm({ ids, name });
  }, [selectedIds, items]);

  const confirmDelete = useCallback(async () => {
    const { ids } = deleteConfirm;
    setBulkWorking(true);
    try {
      await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }, lang);
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      setTotal((prevTotal) => Math.max(0, prevTotal - ids.length));
      setSelectedIds(new Set());
      showToast?.(ids.length === 1 ? t('deleted') : t('deletedMany', { count: ids.length }), 'success');
      fetchEligibility();
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBulkWorking(false);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, lang, apiBase, showToast, t, fetchEligibility]);

  const requestMoveSelected = useCallback((targetMode) => {
    if (!selectedIds.size) return;
    setMoveConfirm({ ids: [...selectedIds], targetMode });
  }, [selectedIds]);

  const confirmMove = useCallback(async () => {
    const { ids, targetMode } = moveConfirm;
    setBulkWorking(true);
    try {
      await apiRequest(`${SERVER_URL}/api/admin/${apiBase}/batch-move`, {
        method: 'POST',
        body: JSON.stringify({ ids, targetMode }),
      }, lang);
      setSelectedIds(new Set());
      showToast?.(t('movedMany', { count: ids.length }), 'success');
      await refresh();
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBulkWorking(false);
      setMoveConfirm(null);
    }
  }, [moveConfirm, lang, apiBase, showToast, t, refresh]);

  const remaining = Math.max(0, total - items.length);
  const accent = isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10';
  const inputBorder = isNight ? 'border-red-900/40 focus:border-red-600' : 'border-white/15 focus:border-blue-500';

  return createPortal(
    <>
      {deleteConfirm && (
        <ConfirmDialog
          isNight={isNight}
          working={bulkWorking}
          zIndex={560}
          yesClassName="bg-red-700 hover:bg-red-600"
          title={deleteConfirm.ids.length === 1 ? t('deleteConfirmTitle') : t('deleteConfirmTitleMany', { count: deleteConfirm.ids.length })}
          body={deleteConfirm.ids.length === 1 ? t('deleteConfirmText', { name: deleteConfirm.name }) : t('deleteConfirmTextMany', { count: deleteConfirm.ids.length })}
          yesLabel={bulkWorking ? t('workingBtn') : t('deleteYes')}
          noLabel={t('deleteNo')}
          onYes={confirmDelete}
          onNo={() => setDeleteConfirm(null)}
        />
      )}

      {moveConfirm && (
        <ConfirmDialog
          isNight={isNight}
          working={bulkWorking}
          zIndex={560}
          yesClassName="bg-red-700 hover:bg-red-600"
          title={t('moveConfirmTitle', { count: moveConfirm.ids.length, modeWord: t(moveConfirm.targetMode === 'night' ? 'modeNightWord' : 'modeDayWord') })}
          body={t('moveConfirmText')}
          yesLabel={bulkWorking ? t('workingBtn') : t('moveYes')}
          noLabel={t('moveNo')}
          onYes={confirmMove}
          onNo={() => setMoveConfirm(null)}
        />
      )}

      {contextMenu && (
        <SelectionContextMenu
          isNight={isNight} t={t} x={contextMenu.x} y={contextMenu.y}
          onSelect={() => { setSelectedIds(new Set([contextMenu.item.id])); setContextMenu(null); }}
          onSelectAll={() => { selectAllVisible(); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      <JingleUploadModal
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        isNight={isNight}
        lang={lang}
        showToast={showToast}
        nightMode={nightMode}
        kind={kind}
        onUploaded={refresh}
      />

      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
        <div
          className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${accent}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            {tabs || (
              <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</h2>
            )}
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  className={`flex-1 rounded-xl border bg-white/5 px-3 py-2 text-xs font-bold text-white placeholder-white/30 outline-none transition-colors ${inputBorder}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  onClick={() => setUploaderOpen(true)}
                  className={`rounded-xl px-4 py-2 text-xs font-black text-white transition-all flex-shrink-0 ${isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                >
                  {t('uploadBtn')}
                </button>
              </div>

              {nightMode && (
                <div className="flex items-center gap-4">
                  {[
                    { key: 'day',   label: t('filterDay'),   active: filterDay,   set: setFilterDay,   other: filterNight },
                    { key: 'night', label: t('filterNight'), active: filterNight, set: setFilterNight, other: filterDay   },
                  ].map(({ key, label, active, set, other }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer group select-none">
                      <div
                        onClick={() => { if (active && !other) return; set((v) => !v); }}
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
                      <span className={`text-[10px] font-black transition-colors ${active ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {eligibility && (eligibility.dayUsable < eligibility.minRequired || (nightMode && eligibility.nightUsable < eligibility.minRequired)) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                {eligibility.dayUsable < eligibility.minRequired && (
                  <div className="text-[11px] font-bold text-amber-300">
                    ⚠ {t('eligibilityDayWarning', { used: eligibility.dayUsable, min: eligibility.minRequired })}
                  </div>
                )}
                {nightMode && eligibility.nightUsable < eligibility.minRequired && (
                  <div className="text-[11px] font-bold text-amber-300">
                    ⚠ {t('eligibilityNightWarning', { used: eligibility.nightUsable, min: eligibility.minRequired })}
                  </div>
                )}
              </div>
            )}

            {isSelectionMode && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex-wrap">
                <div className="text-[11px] font-black text-white/70">{t('selectedCount', { count: selectedIds.size })}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={selectAllVisible} className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[10px] font-black text-white transition-all">
                    {t('selectAllBtn')}
                  </button>
                  {nightMode && (
                    <button
                      onClick={() => moveTargetMode && requestMoveSelected(moveTargetMode)}
                      disabled={!moveTargetMode}
                      title={!moveTargetMode ? t('moveMixedHint') : undefined}
                      className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[10px] font-black text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10"
                    >
                      {t('moveTo', { modeWord: t((moveTargetMode || 'night') === 'night' ? 'modeNightWord' : 'modeDayWord') })}
                    </button>
                  )}
                  <button onClick={requestDeleteSelected} className="rounded-lg bg-red-700 hover:bg-red-600 px-3 py-1.5 text-[10px] font-black text-white transition-all">
                    {t('deleteBtn')}
                  </button>
                  <button onClick={cancelSelection} className="rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[10px] font-black text-white/70 transition-all">
                    {t('cancelSelection')}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {loading && items.length === 0 ? (
                <div className="text-xs text-gray-400">{t('loading')}</div>
              ) : items.length === 0 ? (
                <div className="text-xs text-gray-400">{total === 0 && !search ? t('empty') : t('nothingFound')}</div>
              ) : (
                items.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => { if (isSelectionMode) toggleSelect(item.id); }}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item }); }}
                      onMouseDown={() => startLongPress(item)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={() => startLongPress(item)}
                      onTouchEnd={cancelLongPress}
                      className={`w-full text-start rounded-xl px-3 py-3 border transition-all flex items-center gap-3 ${
                        isChecked
                          ? (isNight ? 'bg-red-950/30 border-red-600' : 'bg-blue-950/30 border-blue-500')
                          : (isNight ? 'bg-red-950/20 border-red-900/20' : 'bg-white/5 border-white/10')
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

                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="flex-shrink-0 max-w-[35%] truncate text-xs font-black text-white" title={displayName(item.filename)}>
                          {displayName(item.filename)}
                        </div>
                        <JingleWaveform jingleId={item.id} isNight={isNight} apiBase={apiBase} />
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {nightMode && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            item.mode === 'night' ? 'bg-indigo-700/40 text-indigo-300' : 'bg-amber-600/40 text-amber-300'
                          }`}>
                            {item.mode === 'night' ? t('filterNight') : t('filterDay')}
                          </span>
                        )}

                        <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                          <div
                            onClick={() => toggleUsed(item)}
                            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                              item.used ? (isNight ? 'bg-red-700' : 'bg-blue-600') : 'bg-white/20'
                            }`}
                          >
                            <div className={`absolute top-0.5 start-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${item.used ? 'translate-x-[14px] rtl:-translate-x-[14px]' : ''}`} />
                          </div>
                        </label>
                      </div>
                    </div>
                  );
                })
              )}

              {remaining > 0 && (
                <button
                  onClick={() => fetchPage(items.length, false)}
                  disabled={loading}
                  className="w-full rounded-xl py-2 text-[11px] font-black uppercase text-gray-300 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  {loading ? t('loading') : t('showMore', { count: remaining })}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}