import { useMemo, useState } from 'react';
import { useNamespace } from '../../../i18n/index.js';
import {
  getPercentLabel,
  getStatsSongCount,
  sortStatsEntries,
  sortYearEntries,
  buildYearMap,
  buildStatsSearchResults,
  formatDur,
} from './statsHelpers.js';
import {
  buildExportFilename,
  collectExportSongs,
  buildTxtExport,
  buildJsonExport,
  buildCsvExport,
  downloadTextFile,
  downloadXlsxExport,
} from './statsExport.js';
import { SongDetail } from './SongDetail.jsx';

const PAGE_SIZE = 10;

// ─── StatsModal ───────────────────────────────────────────────────────────────
export function StatsModal({ open, onClose, isNight, lang, statsData, statsLoading, nightMode = true }) {
  const t = useNamespace('adminPanel', lang);

  const [statsExpanded,    setStatsExpanded]    = useState({ day: false, night: false, genres: false, nightGenres: false });
  const [statsArtist,      setStatsArtist]      = useState({ day: null, night: null });
  const [statsSong,        setStatsSong]        = useState({ day: null, night: null });
  const [statsGenreGroup,  setStatsGenreGroup]  = useState({ day: null, night: null });
  const [statsGenreArtist, setStatsGenreArtist] = useState({ day: {}, night: {} });
  const [statsGenreSong,   setStatsGenreSong]   = useState({ day: {}, night: {} });
  const [statsSort,        setStatsSort]        = useState('alpha');
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsSearchVisibleCount, setStatsSearchVisibleCount] = useState(PAGE_SIZE);

  const [yearsExpanded,  setYearsExpanded]  = useState(false);
  const [yearsSubFolder, setYearsSubFolder] = useState(null);   // 'day' | 'night' | null
  const [yearsOpenYear,  setYearsOpenYear]  = useState(null);
  const [yearsOpenSong,  setYearsOpenSong]  = useState(null);
  const [yearDir,        setYearDir]        = useState('asc');  // 'asc' | 'desc'

  const [exportOpen,   setExportOpen]   = useState(false);
  const [exportFormat, setExportFormat] = useState('json');     // 'json' | 'txt'
  const [exportFields, setExportFields] = useState({ album: false, year: false, duration: false });
  const [exportModes,  setExportModes]  = useState({ day: true, night: true });

  const durSuffix = t('statsMinutes');

  const statsSearchResults = useMemo(() => buildStatsSearchResults(statsData, statsSearchQuery, {
    day:   t('statsSearchDay'),
    night: t('statsSearchNight'),
  }), [statsData, statsSearchQuery, t]);

  const { statsSearchToShow, hasMoreStatsSearch } = useMemo(() => ({
    statsSearchToShow:  statsSearchResults.slice(0, statsSearchVisibleCount),
    hasMoreStatsSearch: statsSearchVisibleCount < statsSearchResults.length,
  }), [statsSearchResults, statsSearchVisibleCount]);

  const { genreKeys, genreArtists, nightGenreKeys, nightGenreArtists } = useMemo(() => {
    const genreArtists = statsData?.genres || {};
    const nightGenreArtists = statsData?.nightGenres || {};
    return {
      genreKeys: Object.keys(genreArtists),
      genreArtists,
      nightGenreKeys: Object.keys(nightGenreArtists),
      nightGenreArtists,
    };
  }, [statsData]);

  const yearMap = useMemo(() => {
    if (!statsData) return {};
    if (yearsSubFolder) {
      const artists = statsData[yearsSubFolder] || {};
      const map = {};
      Object.entries(artists).forEach(([artist, songs]) => {
        songs.forEach((song) => {
          const year = song.year ? String(song.year) : '-';
          if (!map[year]) map[year] = [];
          map[year].push({ ...song, artist, folder: yearsSubFolder });
        });
      });
      return map;
    }
    return buildYearMap(statsData, nightMode);
  }, [statsData, nightMode, yearsSubFolder]);

  const yearEntries = useMemo(() => sortYearEntries(Object.entries(yearMap), statsSort, yearDir), [yearMap, statsSort, yearDir]);
  const totalYearSongs = yearEntries.reduce((sum, [, songs]) => sum + songs.length, 0);

  const collapseAll = () => {
    setStatsExpanded({ day: false, night: false, genres: false, nightGenres: false });
    setStatsArtist({ day: null, night: null });
    setStatsSong({ day: null, night: null });
    setStatsGenreGroup({ day: null, night: null });
    setStatsGenreArtist({ day: {}, night: {} });
    setStatsGenreSong({ day: {}, night: {} });
    setYearsExpanded(false);
    setYearsSubFolder(null);
    setYearsOpenYear(null);
    setYearsOpenSong(null);
  };

  const handleExport = () => {
    const folders = nightMode
      ? Object.entries(exportModes).filter(([, v]) => v).map(([k]) => k)
      : ['day'];
    const activeFolders = folders.length ? folders : ['day'];
    const songs    = collectExportSongs(statsData, activeFolders);
    const showMode = nightMode && activeFolders.length > 1;

    if (exportFormat === 'xlsx') {
      downloadXlsxExport(buildExportFilename('xlsx'), songs, exportFields, showMode);
      setExportOpen(false);
      return;
    }

    const content =
      exportFormat === 'json' ? buildJsonExport(songs, exportFields, showMode) :
      exportFormat === 'csv'  ? buildCsvExport(songs, exportFields, showMode)  :
                                 buildTxtExport(songs, exportFields, showMode);

    const mime =
      exportFormat === 'json' ? 'application/json' :
      exportFormat === 'csv'  ? 'text/csv'          :
                                 'text/plain';

    downloadTextFile(
      buildExportFilename(exportFormat),
      content,
      mime,
      exportFormat === 'csv'
    );
    setExportOpen(false);
  };

  const totalGenreSongs = genreKeys.reduce((sum, k) => sum + getStatsSongCount(genreArtists[k] || {}), 0);
  const totalNightGenreSongs = nightGenreKeys.reduce((sum, k) => sum + getStatsSongCount(nightGenreArtists[k] || {}), 0);

  const anyExpanded = statsExpanded.day || statsExpanded.night || statsExpanded.genres || statsExpanded.nightGenres || yearsExpanded;

  const renderGenreSection = (modeKey, expandedKey, title, keys, artistsMap, total) => {
    const groupState  = statsGenreGroup[modeKey];
    const artistState = statsGenreArtist[modeKey] || {};
    const songState   = statsGenreSong[modeKey]   || {};

    return (
      <div className={`rounded-xl border ${isNight ? 'border-red-900/30' : 'border-white/10'}`}>
        <button
          onClick={() => setStatsExpanded((prev) => ({ ...prev, [expandedKey]: !prev[expandedKey] }))}
          className="w-full flex justify-between items-center px-4 py-3 text-start hover:bg-white/5 rounded-xl transition-all"
        >
          <span className="font-black text-white">{title}</span>
          <span className="text-sm text-gray-400">
            {t('statsSongsCount', { count: total })} · {keys.length} {t('statsArtists')}{' '}
            <span className="ms-1">{statsExpanded[expandedKey] ? '▲' : '▼'}</span>
          </span>
        </button>

        {statsExpanded[expandedKey] && (
          <div className="border-t border-white/10 divide-y divide-white/5">
            {keys.map((groupKey) => {
              const artists    = artistsMap[groupKey] || {};
              const groupSongs = getStatsSongCount(artists);
              const openGroup  = groupState === groupKey;
              const openArtist = artistState[groupKey] || null;
              const openSong   = songState[groupKey]   || null;

              return (
                <div key={groupKey}>
                  <button
                    onClick={() => {
                      setStatsGenreGroup((prev) => ({ ...prev, [modeKey]: prev[modeKey] === groupKey ? null : groupKey }));
                      setStatsGenreArtist((prev) => ({ ...prev, [modeKey]: { ...prev[modeKey], [groupKey]: null } }));
                      setStatsGenreSong((prev)   => ({ ...prev, [modeKey]: { ...prev[modeKey], [groupKey]: null } }));
                    }}
                    className="w-full flex justify-between items-center px-6 py-2 text-start hover:bg-white/5 transition-all"
                  >
                    <span className="text-sm text-gray-200">{groupKey}</span>
                    <span className="text-xs text-gray-500">
                      {t('statsSongsCount', { count: groupSongs })} · {getPercentLabel(groupSongs, total)}{' '}
                      <span>{openGroup ? '▲' : '▼'}</span>
                    </span>
                  </button>

                  {openGroup && (
                    <div className="divide-y divide-white/5">
                      {sortStatsEntries(artists, statsSort).map(([artist, songs]) => (
                        <div key={`${groupKey}-${artist}`}>
                          <button
                            onClick={() => {
                              setStatsGenreArtist((prev) => ({
                                ...prev,
                                [modeKey]: {
                                  ...prev[modeKey],
                                  [groupKey]: prev[modeKey]?.[groupKey] === artist ? null : artist,
                                },
                              }));
                              setStatsGenreSong((prev) => ({ ...prev, [modeKey]: { ...prev[modeKey], [groupKey]: null } }));
                            }}
                            className="w-full flex justify-between items-center px-8 py-1.5 text-start hover:bg-white/5 transition-all"
                          >
                            <span className="text-sm text-gray-400">{artist}</span>
                            <span className="text-xs text-gray-600">
                              {t('statsSongsCount', { count: songs.length })} · {getPercentLabel(songs.length, groupSongs)}{' '}
                              <span>{openArtist === artist ? '▲' : '▼'}</span>
                            </span>
                          </button>

                          {openArtist === artist && (
                            <div className="divide-y divide-white/5">
                              {songs.map((song) => (
                                <div key={`${groupKey}-${song.file}`}>
                                  <button
                                    onClick={() => setStatsGenreSong((prev) => ({
                                      ...prev,
                                      [modeKey]: {
                                        ...prev[modeKey],
                                        [groupKey]: prev[modeKey]?.[groupKey] === song.file ? null : song.file,
                                      },
                                    }))}
                                    className="w-full flex justify-between items-center px-10 py-1.5 text-start hover:bg-white/5 transition-all"
                                  >
                                    <span className="text-sm text-gray-500">{song.title}</span>
                                    <span className="text-xs text-gray-700">{openSong === song.file ? '▲' : '▼'}</span>
                                  </button>
                                  {openSong === song.file && (
                                    <SongDetail song={song} artist={artist} t={t} durSuffix={durSuffix} className="px-12 py-2" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const genresDayTitle   = nightMode ? t('statsGenresDay') : t('statsGenres');
  const genresNightTitle = t('statsGenresNight');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl shadow-2xl ${
          isNight ? 'bg-[#1a0505] border border-red-900/40' : 'bg-gray-800 border border-white/10'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className={`font-black text-lg ${isNight ? 'text-red-400' : 'text-blue-400'}`}>
            {t('statsBtn')}
          </h2>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              {[
                { key: 'alpha',      label: t('statsSortAlpha') },
                { key: 'count-desc', label: t('statsSortCountDesc') },
                { key: 'count-asc',  label: t('statsSortCountAsc') },
              ].map(({ key, label }) => {
                const isActive = statsSort === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStatsSort(key)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all font-black ${
                      isActive
                        ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white')
                        : 'text-gray-400 hover:text-white bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {anyExpanded && (
              <button
                onClick={collapseAll}
                className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
              >
                {t('statsCollapseAll')}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 shrink-0">
          <input
            type="text"
            placeholder={t('statsSearch')}
            className="w-full p-4 rounded-xl text-[16px] font-black transition-all border-none outline-none text-start shadow-inner bg-white/90 text-gray-800 placeholder-gray-400 placeholder:text-xs"
            value={statsSearchQuery}
            onChange={(e) => { setStatsSearchQuery(e.target.value); setStatsSearchVisibleCount(PAGE_SIZE); }}
          />
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {statsLoading && <p className="text-center text-gray-500 py-8 animate-pulse">...</p>}

          {!statsLoading && statsSearchQuery.trim() && (
            <div className={`rounded-xl border ${isNight ? 'border-red-900/30' : 'border-white/10'}`}>
              <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
                <span className="font-black text-white">{t('statsSearch')}</span>
                <span className="text-xs text-gray-400">{t('statsSongsCount', { count: statsSearchResults.length })}</span>
              </div>
              <div className="divide-y divide-white/5">
                {statsSearchToShow.length > 0 ? statsSearchToShow.map((song) => (
                  <div key={song.searchId} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 truncate">{song.title}</div>
                        <div className="text-xs text-gray-500 uppercase truncate">{song.artist}</div>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${
                        song.folderKey === 'night' ? 'bg-red-700/30 text-red-300' : 'bg-blue-700/30 text-blue-300'
                      }`}>
                        {song.folderLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 space-y-0.5">
                      {song.album    && <div><span className="text-gray-400">{t('statsFieldAlbum')}:</span> {song.album}</div>}
                      {song.year     && <div><span className="text-gray-400">{t('statsFieldYear')}:</span> {song.year}</div>}
                      <div><span className="text-gray-400">{t('statsFieldDuration')}:</span> {formatDur(song.duration, durSuffix)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="text-center opacity-40 uppercase font-black text-xs py-8">{t('nothingFound')}</p>
                )}
              </div>
              {hasMoreStatsSearch && (
                <button
                  onClick={() => setStatsSearchVisibleCount((c) => c + PAGE_SIZE)}
                  className={`m-4 mt-3 py-3 w-[calc(100%-2rem)] rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                    isNight ? 'border-red-900/40 text-red-700 hover:bg-red-900/10'
                            : 'border-white/20 text-white/50 hover:bg-white/5'
                  }`}
                >
                  {t('showMoreLabel', { count: statsSearchResults.length - statsSearchVisibleCount })}
                </button>
              )}
            </div>
          )}

          {!statsLoading && statsData && !statsSearchQuery.trim() && ['day', 'night'].filter((f) => f === 'day' || nightMode).map((folder) => {
            const label       = folder === 'day' ? t('statsDay') : t('statsNight');
            const artists     = statsData[folder] || {};
            const totalSongs  = getStatsSongCount(artists);
            const totalArtists= Object.keys(artists).length;
            const expanded    = statsExpanded[folder];
            const openArtist  = statsArtist[folder];
            const openSong    = statsSong[folder];

            return (
              <div key={folder} className={`rounded-xl border ${isNight ? 'border-red-900/30' : 'border-white/10'}`}>
                <button
                  onClick={() => setStatsExpanded((prev) => ({ ...prev, [folder]: !prev[folder] }))}
                  className="w-full flex justify-between items-center px-4 py-3 text-start hover:bg-white/5 rounded-xl transition-all"
                >
                  <span className="font-black text-white">{label}</span>
                  <span className="text-sm text-gray-400">
                    {t('statsSongsCount', { count: totalSongs })} · {totalArtists} {t('statsArtists')}{' '}
                    <span className="ms-1">{expanded ? '▲' : '▼'}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-white/10 divide-y divide-white/5">
                    {sortStatsEntries(artists, statsSort).map(([artist, songs]) => (
                      <div key={artist}>
                        <button
                          onClick={() => {
                            setStatsArtist((prev) => ({ ...prev, [folder]: prev[folder] === artist ? null : artist }));
                            setStatsSong((prev) => ({ ...prev, [folder]: null }));
                          }}
                          className="w-full flex justify-between items-center px-6 py-2 text-start hover:bg-white/5 transition-all"
                        >
                          <span className="text-sm text-gray-200">{artist}</span>
                          <span className="text-xs text-gray-500">
                            {t('statsSongsCount', { count: songs.length })} · {getPercentLabel(songs.length, totalSongs)}{' '}
                            <span>{openArtist === artist ? '▲' : '▼'}</span>
                          </span>
                        </button>

                        {openArtist === artist && (
                          <div className="divide-y divide-white/5">
                            {songs.map((song) => (
                              <div key={song.file}>
                                <button
                                  onClick={() => setStatsSong((prev) => ({
                                    ...prev,
                                    [folder]: prev[folder] === song.file ? null : song.file,
                                  }))}
                                  className="w-full flex justify-between items-center px-8 py-1.5 text-start hover:bg-white/5 transition-all"
                                >
                                  <span className="text-sm text-gray-400">{song.title}</span>
                                  <span className="text-xs text-gray-600">{openSong === song.file ? '▲' : '▼'}</span>
                                </button>
                                {openSong === song.file && (
                                  <SongDetail song={song} artist={artist} t={t} durSuffix={durSuffix} className="px-10 py-2" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!statsLoading && statsData && !statsSearchQuery.trim() &&
            renderGenreSection('day', 'genres', genresDayTitle, genreKeys, genreArtists, totalGenreSongs)}

          {!statsLoading && statsData && !statsSearchQuery.trim() && nightMode &&
            renderGenreSection('night', 'nightGenres', genresNightTitle, nightGenreKeys, nightGenreArtists, totalNightGenreSongs)}

          {!statsLoading && statsData && !statsSearchQuery.trim() && (
            <div className={`rounded-xl border ${isNight ? 'border-red-900/30' : 'border-white/10'}`}>
              <button
                onClick={() => setYearsExpanded((prev) => !prev)}
                className="w-full flex justify-between items-center px-4 py-3 text-start hover:bg-white/5 rounded-xl transition-all"
              >
                <span className="font-black text-white">{t('statsYears')}</span>
                <span className="text-sm text-gray-400">
                  {t('statsSongsCount', { count: totalYearSongs })}{' '}
                  <span className="ms-1">{yearsExpanded ? '▲' : '▼'}</span>
                </span>
              </button>

              {yearsExpanded && (
                <div className="border-t border-white/10 divide-y divide-white/5">

                  <div className="flex items-center gap-2 px-4 py-2">
                    {nightMode && [
                      { key: null,    label: t('statsAll') },
                      { key: 'day',   label: t('statsDay') },
                      { key: 'night', label: t('statsNight') },
                    ].map(({ key, label }) => {
                      const active = yearsSubFolder === key;
                      return (
                        <button
                          key={String(key)}
                          onClick={() => {
                            setYearsSubFolder(key);
                            setYearsOpenYear(null);
                            setYearsOpenSong(null);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-all font-black ${
                            active
                              ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white')
                              : 'text-gray-400 hover:text-white bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => statsSort === 'alpha' && setYearDir((d) => d === 'asc' ? 'desc' : 'asc')}
                      title={yearDir === 'asc' ? t('statsSortYearDesc') : t('statsSortYearAsc')}
                      disabled={statsSort !== 'alpha'}
                      className={`ms-auto text-xs px-2 py-1 rounded-lg font-black transition-all ${
                        statsSort !== 'alpha'
                          ? 'opacity-30 cursor-not-allowed bg-white/5 text-gray-600'
                          : isNight ? 'bg-red-900/40 text-red-300 hover:bg-red-700 hover:text-white'
                                    : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {yearDir === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>

                  {yearEntries.map(([year, songs]) => {
                    const isYearOpen = yearsOpenYear === year;
                    return (
                      <div key={year}>
                        <button
                          onClick={() => {
                            setYearsOpenYear((prev) => prev === year ? null : year);
                            setYearsOpenSong(null);
                          }}
                          className="w-full flex justify-between items-center px-6 py-2 text-start hover:bg-white/5 transition-all"
                        >
                          <span className="text-sm text-gray-200">{year}</span>
                          <span className="text-xs text-gray-500">
                            {t('statsSongsCount', { count: songs.length })} · {getPercentLabel(songs.length, totalYearSongs)}{' '}
                            <span>{isYearOpen ? '▲' : '▼'}</span>
                          </span>
                        </button>

                        {isYearOpen && (
                          <div className="divide-y divide-white/5">
                            {[...songs]
                              .sort((a, b) => a.title.localeCompare(b.title))
                              .map((song) => (
                                <div key={`${song.folder}-${song.file}`}>
                                  <button
                                    onClick={() => setYearsOpenSong((prev) =>
                                      prev === `${song.folder}-${song.file}` ? null : `${song.folder}-${song.file}`
                                    )}
                                    className="w-full flex justify-between items-center px-8 py-1.5 text-start hover:bg-white/5 transition-all"
                                  >
                                    <span className="text-sm text-gray-400">{song.title}</span>
                                    <div className="flex items-center gap-2">
                                      {nightMode && (
                                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                          song.folder === 'night' ? 'bg-red-700/30 text-red-300' : 'bg-blue-700/30 text-blue-300'
                                        }`}>
                                          {song.folder === 'night' ? t('statsNight') : t('statsDay')}
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-600">
                                        {yearsOpenSong === `${song.folder}-${song.file}` ? '▲' : '▼'}
                                      </span>
                                    </div>
                                  </button>
                                  {yearsOpenSong === `${song.folder}-${song.file}` && (
                                    <SongDetail song={song} artist={song.artist} t={t} durSuffix={durSuffix} className="px-10 py-2" />
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end items-center px-5 py-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => setExportOpen(true)}
            className={`flex items-center gap-2 text-xs font-black uppercase px-4 py-2 rounded-lg transition-all ${
              isNight ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            {t('exportBtn')}
          </button>
        </div>
      </div>

      {exportOpen && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setExportOpen(false)}
        >
          <div
            className={`w-full max-w-xs rounded-2xl shadow-2xl p-5 space-y-4 ${
              isNight ? 'bg-[#1a0505] border border-red-900/40' : 'bg-gray-800 border border-white/10'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className={`font-black text-sm ${isNight ? 'text-red-400' : 'text-blue-400'}`}>
                {t('exportTitle')}
              </h3>
              <button
                onClick={() => setExportOpen(false)}
                className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-black text-gray-400 uppercase">{t('exportFormat')}</div>
              <div className="grid grid-cols-2 gap-2">
                {['json', 'txt', 'csv', 'xlsx'].map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-black uppercase transition-all ${
                      exportFormat === fmt
                        ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white')
                        : 'text-gray-400 hover:text-white bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-black text-gray-400 uppercase">{t('exportFields')}</div>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked disabled className="accent-current opacity-60" />
                  {t('statsFieldArtist')}
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked disabled className="accent-current opacity-60" />
                  {t('statsFieldTitle')}
                </label>
                {[
                  { key: 'album',    label: t('statsFieldAlbum') },
                  { key: 'year',     label: t('statsFieldYear') },
                  { key: 'duration', label: t('statsFieldDuration') },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportFields[key]}
                      onChange={() => setExportFields((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="accent-current"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {nightMode && (
              <div className="space-y-1.5">
                <div className="text-xs font-black text-gray-400 uppercase">{t('exportModes')}</div>
                <div className="flex gap-3">
                  {[
                    { key: 'day',   label: t('statsDay') },
                    { key: 'night', label: t('statsNight') },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportModes[key]}
                        onChange={() => setExportModes((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className="accent-current"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                isNight ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {t('exportBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StatsModal;