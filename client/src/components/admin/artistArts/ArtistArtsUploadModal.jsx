import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { accentPanel, inputBorder as inputBorderTheme } from '../shared/theme.js';
import { ArtistCard } from './ArtistCard.jsx';
import { ArtEditorCard } from './ArtEditorCard.jsx';

const SEARCH_PAGE = 10;
const COMPACT_INPUT = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors';

export function ArtistArtsUploadModal({
  open,
  onClose,
  isNight,
  lang = 'uk',
  showToast,
  onUpdated,
  nightMode = true,
}) {
  const t = useNamespace('artistArts', lang);

  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [search, setSearch] = useState('');
  const [filterWithoutArt, setFilterWithoutArt] = useState(false);
  const [filterDay, setFilterDay] = useState(true);
  const [filterNight, setFilterNight] = useState(true);
  const [searchPage, setSearchPage] = useState(SEARCH_PAGE);

  const searchInputRef = useRef(null);

  const compactInput = COMPACT_INPUT;

  const loadArtists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/artist-arts`, {}, lang);
      setArtists(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, lang]);

  useEffect(() => {
    if (!open) return;
    loadArtists();
    setSelectedArtist(null);
    setSearch('');
    setFilterWithoutArt(false);
    setFilterDay(true);
    setFilterNight(true);
    setSearchPage(SEARCH_PAGE);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [open, loadArtists]);

  useEffect(() => {
    if (!open) return;
    const prev = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow             = 'hidden';
    return () => {
      [document.documentElement.style.overflow, document.body.style.overflow] = prev;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return artists.filter((item) => {
      if (q && !`${item.artist} ${item.artFileName || ''}`.toLowerCase().includes(q)) return false;
      if (filterWithoutArt && item.hasArt) return false;

      const itemModes = item.modes || [];
      if (!nightMode) {
        if (!itemModes.includes('day')) return false;
      } else if (!(filterDay && filterNight)) {
        const wants = new Set([...(filterDay ? ['day'] : []), ...(filterNight ? ['night'] : [])]);
        if (!itemModes.some((m) => wants.has(m))) return false;
      }
      return true;
    });
  }, [artists, search, filterWithoutArt, filterDay, filterNight, nightMode]);

  const visibleItems = filtered.slice(0, searchPage);
  const remaining = filtered.length - visibleItems.length;

  const handleArtistUpdated = useCallback((updatedItem) => {
    setArtists((prev) => prev.map((item) => item.artist === updatedItem.artist ? updatedItem : item));
    setSelectedArtist(updatedItem);
    onUpdated?.();
  }, [onUpdated]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[430] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${accentPanel(isNight)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className={`text-sm font-black uppercase tracking-wider ${isNight ? 'text-red-400' : 'text-blue-400'}`}>
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!selectedArtist && (
            <>
              <div className="flex items-center gap-3">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  className={`${compactInput} ${inputBorderTheme(isNight)}`}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchPage(SEARCH_PAGE); }}
                />
                <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none">
                  <div
                    onClick={() => { setFilterWithoutArt((v) => !v); setSearchPage(SEARCH_PAGE); }}
                    className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
                      filterWithoutArt
                        ? (isNight ? 'bg-red-700' : 'bg-blue-600')
                        : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-0.5 start-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${filterWithoutArt ? 'translate-x-[14px] rtl:-translate-x-[14px]' : ''}`} />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 whitespace-nowrap">{t('filterWithoutArt')}</span>
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
                        onClick={() => { if (active && !other) return; set((v) => !v); setSearchPage(SEARCH_PAGE); }}
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

              <div className="space-y-2">
                {loading ? (
                  <div className="text-xs text-gray-400">{t('loading')}</div>
                ) : visibleItems.length === 0 ? (
                  <div className="text-xs text-gray-400">{artists.length === 0 ? t('noCache') : t('nothingFound')}</div>
                ) : (
                  visibleItems.map((item) => (
                    <ArtistCard
                      key={item.artist}
                      item={item}
                      isNight={isNight}
                      nightMode={nightMode}
                      t={t}
                      onSelect={setSelectedArtist}
                    />
                  ))
                )}

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
              </div>
            </>
          )}

          {selectedArtist && (
            <ArtEditorCard
              artistItem={selectedArtist}
              isNight={isNight}
              lang={lang}
              showToast={showToast}
              onBack={() => setSelectedArtist(null)}
              onSaved={handleArtistUpdated}
              onDeleted={handleArtistUpdated}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ArtistArtsUploadModal;