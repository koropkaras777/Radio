import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { pickLocalized } from '../../../i18n/serverMessage.js';
import { t as translate, useNamespace } from '../../../i18n/index.js';
import { accentPanel } from '../shared/theme.js';
import { PrivilegeGate } from '../shared/PrivilegeGate.jsx';
import { WINDOWS, WINDOW_MS, CATEGORIES, CATEGORY_BY_TYPE, formatOpLabel } from './auditLabels.js';
import { formatDateHeader, formatTime, isSameDay } from './auditDateHelpers.js';
import { WindowSelect } from './WindowSelect.jsx';
import { CategoryFilter } from './CategoryFilter.jsx';

const PAGE_SIZE = 30;

export function AuditLogModal({ open, onClose, isNight, lang = 'uk', socketRef, streamMode = false, radioHostsMode = false, canViewHistory = false }) {
  const [activeTab,     setActiveTab]     = useState('actions');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErrorMsg, setHistoryErrorMsg] = useState('');
  const [historyWindow, setHistoryWindow] = useState('24h');

  const [window_,      setWindow]       = useState('24h');
  const [entries,      setEntries]      = useState([]);
  const [total,        setTotal]        = useState(0);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [loading,      setLoading]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [pendingNew,   setPendingNew]   = useState([]);
  const listRef  = useRef(null);

  const visibleCategories = useMemo(() => CATEGORIES.filter((cat) => {
    if (cat.key === 'jingles' && !streamMode) return false;
    if (cat.key === 'radioHosts' && !radioHostsMode) return false;
    if (cat.key === 'backgroundMusic' && (!streamMode || !radioHostsMode)) return false;
    return true;
  }), [streamMode, radioHostsMode]);
  const visibleCategoryKeys = useMemo(() => visibleCategories.map((cat) => cat.key), [visibleCategories]);
  const hiddenTypeKeys = useMemo(() => {
    const hidden = new Set();
    for (const cat of CATEGORIES) {
      if (!visibleCategoryKeys.includes(cat.key)) for (const type of cat.types) hidden.add(type);
    }
    return hidden;
  }, [visibleCategoryKeys]);

  const [activeCategories, setActiveCategories] = useState(new Set(visibleCategoryKeys));
  useEffect(() => {
    setActiveCategories(new Set(visibleCategoryKeys));
  }, [streamMode, radioHostsMode]);

  const t = useNamespace('auditLog', lang);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');

  const fetchEntries = useCallback(async (win, currentLimit, isLoadMore = false) => {
    if (!isLoadMore) setLoading(true); else setLoadingMore(true);
    setLoadErrorMsg('');
    try {
      const res  = await fetch(
        `${SERVER_URL}/api/admin/audit?window=${win}&limit=${currentLimit}&offset=0`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries);
        const realTotal = data.entries.length < currentLimit
          ? data.entries.length
          : data.total;
        setTotal(realTotal);
        setDisplayLimit(currentLimit);
      } else {
        setLoadErrorMsg(pickLocalized(data.localized || data.message || data.error, lang) || translate('auditLog.loadError', {}, lang));
      }
    } catch {
      setLoadErrorMsg(translate('common.connectionError', {}, lang));
    }
    if (!isLoadMore) setLoading(false); else setLoadingMore(false);
  }, [lang]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryErrorMsg('');
    try {
      const res  = await fetch(`${SERVER_URL}/api/admin/history`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setHistoryEntries(data.entries);
      } else {
        setHistoryErrorMsg(pickLocalized(data.localized || data.message || data.error, lang) || translate('auditLog.historyLoadError', {}, lang));
      }
    } catch {
      setHistoryErrorMsg(translate('common.connectionError', {}, lang));
    }
    setHistoryLoading(false);
  }, [lang]);

  useEffect(() => {
    if (!open || activeTab !== 'history' || !canViewHistory) return;
    fetchHistory();
  }, [open, activeTab, canViewHistory, fetchHistory]);

  useEffect(() => {
    if (!open || !socketRef?.current) return;
    const socket = socketRef.current;

    const handleNewEntry = (entry) => {
      const windowMs = WINDOWS.find((w) => w.key === window_) ? WINDOW_MS[window_] : WINDOW_MS['24h'];
      const since = Date.now() - windowMs;
      if (entry.createdAt >= since) {
        setPendingNew((prev) => [...prev, entry]);
      }
    };
    socket.on('audit_new_entry', handleNewEntry);

    return () => socket.off('audit_new_entry', handleNewEntry);
  }, [open, window_, socketRef]);

  const toggleCategory = useCallback((key) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.size === visibleCategoryKeys.length) {
        next.clear();
        next.add(key);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next.size === 0 ? new Set(visibleCategoryKeys) : next;
    });
  }, [visibleCategoryKeys]);

  const resetCategories = useCallback(() => {
    setActiveCategories(new Set(visibleCategoryKeys));
  }, [visibleCategoryKeys]);

  const applyPending = useCallback(async () => {
    setPendingNew([]);
    setDisplayLimit(PAGE_SIZE);
    await fetchEntries(window_, PAGE_SIZE, false);
  }, [window_, fetchEntries]);

  useEffect(() => {
    if (!open) return;
    setPendingNew([]);
    setDisplayLimit(PAGE_SIZE);
    fetchEntries(window_, PAGE_SIZE, false);
  }, [open, window_, fetchEntries]);

  useEffect(() => {
    if (!open || loading || loadingMore) return;
    if (activeCategories.size === visibleCategoryKeys.length) return;
    if (entries.length >= total) return;

    const hasVisibleMatch = entries.some((entry) => {
      if (hiddenTypeKeys.has(entry.operationType)) return false;
      const catKey = CATEGORY_BY_TYPE.get(entry.operationType);
      return !catKey || activeCategories.has(catKey);
    });
    if (hasVisibleMatch) return;

    fetchEntries(window_, total, true);
  }, [open, activeCategories, visibleCategoryKeys, hiddenTypeKeys, entries, total, loading, loadingMore, window_, fetchEntries]);

  useEffect(() => {
    if (!loading && entries.length > 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [loading]);

  if (!open) return null;

  const reversed    = [...entries].reverse();
  const modeVisible = reversed.filter((entry) => !hiddenTypeKeys.has(entry.operationType));
  const filtered    = activeCategories.size === visibleCategoryKeys.length
    ? modeVisible
    : modeVisible.filter((entry) => {
        const catKey = CATEGORY_BY_TYPE.get(entry.operationType);
        return !catKey || activeCategories.has(catKey);
      });
  const hasMore    = entries.length < total;

  const historySince    = Date.now() - (WINDOW_MS[historyWindow] ?? WINDOW_MS['24h']);
  const historyFiltered = historyEntries.filter((entry) => entry.playedAt >= historySince);

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col max-h-[85vh] ${accentPanel(isNight)}`} onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
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

        {canViewHistory && (
          <div className="flex gap-1.5 px-6 pt-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('actions')}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-black transition-colors ${activeTab === 'actions' ? (isNight ? 'bg-red-700/40 border-red-600 text-white' : 'bg-blue-600/30 border-blue-500 text-white') : (isNight ? 'bg-white/5 border-red-900/40 text-white/60 hover:bg-red-900/20' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10')}`}
            >
              {t('tabActions')}
            </button>
            <PrivilegeGate locked={!canViewHistory} lang={lang} inline>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-black transition-colors ${activeTab === 'history' ? (isNight ? 'bg-red-700/40 border-red-600 text-white' : 'bg-blue-600/30 border-blue-500 text-white') : (isNight ? 'bg-white/5 border-red-900/40 text-white/60 hover:bg-red-900/20' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10')}`}
              >
                {t('tabHistory')}
              </button>
            </PrivilegeGate>
          </div>
        )}

        {activeTab === 'actions' ? (
          <>
            {loadErrorMsg && (
              <div className={`mx-6 mt-3 shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${isNight ? 'bg-red-900/20 border-red-700/50 text-red-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                {loadErrorMsg}
              </div>
            )}

            <div className="px-6 py-3 border-b border-white/10 shrink-0 space-y-2.5">
              <WindowSelect
                value={window_}
                onChange={(w) => { setWindow(w); }}
                windows={WINDOWS}
                t={t}
                isNight={isNight}
              />
              <CategoryFilter
                active={activeCategories}
                onToggle={toggleCategory}
                onReset={resetCategories}
                categories={visibleCategories}
                t={t}
                isNight={isNight}
              />
            </div>

            {pendingNew.length > 0 && (
              <div className="px-6 pt-3 shrink-0">
                <button
                  onClick={applyPending}
                  className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    isNight
                      ? 'bg-red-700/30 hover:bg-red-700/50 border border-red-700/60 text-red-300'
                      : 'bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-5.17"/>
                  </svg>
                  {t('newEntriesButton', { count: pendingNew.length })}
                </button>
              </div>
            )}

            <div ref={listRef} className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1 min-h-0">

              {hasMore && !loading && (
                <button
                  onClick={() => fetchEntries(window_, displayLimit + PAGE_SIZE, true)}
                  disabled={loadingMore}
                  className={`w-full py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 mb-3 ${
                    isNight ? 'border-red-900/40 text-red-700 hover:bg-red-900/10' : 'border-white/20 text-white/50 hover:bg-white/5'
                  } disabled:opacity-30`}
                >
                  {loadingMore ? t('loading') : t('loadMore', { count: total - entries.length })}
                </button>
              )}

              {loading ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <span className="text-xs text-white/30 font-black uppercase">{t('loading')}</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <span className="text-xs text-white/30 font-black uppercase">{t('empty')}</span>
                </div>
              ) : (
                filtered.map((entry, idx) => {
                  const prevEntry   = filtered[idx - 1] || null;
                  const showDayHeader = !prevEntry || !isSameDay(prevEntry.createdAt, entry.createdAt);
                  const label = formatOpLabel(entry.operationType, entry.data, t);
                  const adminName = entry.adminId === 'super'
                    ? t('superAdmin')
                    : (entry.adminLogin || entry.adminId);

                  return (
                    <div key={entry.id}>
                      {showDayHeader && (
                        <div className={`text-[10px] font-black uppercase tracking-widest mt-4 mb-2 first:mt-0 ${isNight ? 'text-red-900/80' : 'text-white/25'}`}>
                          {formatDateHeader(entry.createdAt, t)}
                        </div>
                      )}
                      <div className={`flex gap-2 items-baseline text-[12px] leading-relaxed py-0.5 rounded px-2 transition-colors ${isNight ? 'hover:bg-red-900/10' : 'hover:bg-white/5'}`}>
                        <span className="shrink-0 font-mono text-white/30 text-[10px] w-10">
                          {formatTime(entry.createdAt)}
                        </span>
                        <span className="text-white/70">
                          {label}
                          <span className={`ms-1.5 text-[10px] font-black ${isNight ? 'text-red-700/70' : 'text-white/30'}`}>
                            ({adminName})
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {historyErrorMsg && (
              <div className={`mx-6 mt-3 shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${isNight ? 'bg-red-900/20 border-red-700/50 text-red-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                {historyErrorMsg}
              </div>
            )}

            <div className="px-6 py-3 border-b border-white/10 shrink-0">
              <WindowSelect
                value={historyWindow}
                onChange={(w) => { setHistoryWindow(w); }}
                windows={WINDOWS}
                t={t}
                isNight={isNight}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1 min-h-0">
              {historyLoading ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <span className="text-xs text-white/30 font-black uppercase">{t('loading')}</span>
                </div>
              ) : historyFiltered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <span className="text-xs text-white/30 font-black uppercase">{t('empty')}</span>
                </div>
              ) : (
                historyFiltered.map((entry, idx) => {
                  const prevEntry     = historyFiltered[idx - 1] || null;
                  const showDayHeader = !prevEntry || !isSameDay(prevEntry.playedAt, entry.playedAt);

                  return (
                    <div key={entry.id}>
                      {showDayHeader && (
                        <div className={`text-[10px] font-black uppercase tracking-widest mt-4 mb-2 first:mt-0 ${isNight ? 'text-red-900/80' : 'text-white/25'}`}>
                          {formatDateHeader(entry.playedAt, t)}
                        </div>
                      )}
                      <div className={`flex gap-2 items-baseline text-[12px] leading-relaxed py-0.5 rounded px-2 transition-colors ${isNight ? 'hover:bg-red-900/10' : 'hover:bg-white/5'}`}>
                        <span className="shrink-0 font-mono text-white/30 text-[10px] w-10">
                          {formatTime(entry.playedAt)}
                        </span>
                        <span className="text-white/70">
                          {t('historyEntry', { title: entry.title, artist: entry.artist })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}