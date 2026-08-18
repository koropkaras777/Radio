import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { pickLocalized, apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { useCooldown } from '../hooks/useCooldown.js';
import { PrivilegeGate } from '../shared/PrivilegeGate.jsx';
import {
  secToMin,
  minToSec,
  formatCooldown,
  formatDuration,
  normalizeFormFromSettings,
  createEmptySongGroupForm,
} from './settingsForm.js';
import { SongTooltip, useSongTooltip } from './SongTooltip.jsx';
import { SongChip } from './SongChip.jsx';
import { FormField } from './FormField.jsx';
import { AlgorithmRow } from './AlgorithmRow.jsx';
import { GroupDefsEditor } from './groupDefs/GroupDefsEditor.jsx';
import { SelectMenu } from '../shared/SelectMenu.jsx';

const SETTINGS_LIBRARY_PAGE = 5;
const SELECTED_PAGE = 10;

const compactInput = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none';

const P = {
  SETTINGS_BRANDING:  'settings_branding',
  SETTINGS_GROUPS:    'settings_groups',
  SETTINGS_ALGORITHM: 'settings_algorithm',
  QUEUE_MANAGE:       'queue_manage',
  RADIO_MODERATOR:    'radio_moderator',
};

export const SettingsModal = ({ open, onClose, isNight, lang = 'uk', showToast, privileges = [], nightMode = true, streamMode = false, radioHostsMode = false, readOnly = false }) => {
  const can = (priv) => privileges.includes(priv);
  const t = useNamespace('settingsModal', lang);
  const tf = useNamespace('settingsFields', lang);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState(null);
  const [form, setForm] = useState(null);
  const [groupDefs, setGroupDefs] = useState({});
  const [nightGroupDefs, setNightGroupDefs] = useState({});
  const [songGroups, setSongGroups] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [songGroupForm, setSongGroupForm] = useState(createEmptySongGroupForm());
  const [songSearch, setSongSearch] = useState('');
  const [songLibrary, setSongLibrary] = useState({ items: [], total: 0, offset: 0 });
  const [songLibraryLoading, setSongLibraryLoading] = useState(false);
  const [selectedVisibleCount, setSelectedVisibleCount] = useState(SELECTED_PAGE);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [insertCooldown, setInsertCooldown] = useState(0);
  const [generationTab, setGenerationTab] = useState('day');
  const [jingleCounts, setJingleCounts] = useState(null);
  const [phraseCounts, setPhraseCounts] = useState(null);
  const [phraseDayOptions, setPhraseDayOptions] = useState([]);
  const [phraseNightOptions, setPhraseNightOptions] = useState([]);
  const { tooltip, show: showSongTooltip, hide: hideSongTooltip } = useSongTooltip();

  useCooldown(insertCooldown, setInsertCooldown);

  const toastError   = useCallback((error) => {
    showToast?.(pickLocalized(error.message, lang) || t('notApplied'), 'error');
  }, [showToast, lang, t]);

  const toastSuccess = useCallback((data, fallback) => {
    showToast?.(pickLocalized(data.message, lang) || fallback, 'success');
  }, [showToast, lang]);

  useEffect(() => {
    if (!open || !streamMode) { setJingleCounts(null); return; }
    let cancelled = false;

    apiRequest(`${SERVER_URL}/api/admin/jingles/counts`, {}, lang)
      .then((data) => {
        if (cancelled) return;
        setJingleCounts({
          day: data.day || 0,
          night: data.night || 0,
          dayUsable: data.dayUsable || 0,
          nightUsable: data.nightUsable || 0,
          minRequired: data.minRequired || 3,
        });
      })
      .catch(() => { if (!cancelled) setJingleCounts({ day: 0, night: 0, dayUsable: 0, nightUsable: 0, minRequired: 3 }); });

    return () => { cancelled = true; };
  }, [open, streamMode, lang]);

  useEffect(() => {
    if (!open || !streamMode) { setPhraseCounts(null); setPhraseDayOptions([]); setPhraseNightOptions([]); return; }
    let cancelled = false;

    apiRequest(`${SERVER_URL}/api/admin/phrases/counts`, {}, lang)
      .then((data) => {
        if (cancelled) return;
        setPhraseCounts({
          day: data.day || 0,
          night: data.night || 0,
          dayUsable: data.dayUsable || 0,
          nightUsable: data.nightUsable || 0,
          minRequired: data.minRequired || 1,
        });
      })
      .catch(() => { if (!cancelled) setPhraseCounts({ day: 0, night: 0, dayUsable: 0, nightUsable: 0, minRequired: 1 }); });

    const fetchOptions = (mode, setter) =>
      apiRequest(`${SERVER_URL}/api/admin/phrases?mode=${mode}&limit=100`, {}, lang)
        .then((data) => { if (!cancelled) setter((data.items || []).filter((item) => item.used)); })
        .catch(() => { if (!cancelled) setter([]); });

    fetchOptions('day', setPhraseDayOptions);
    if (nightMode) fetchOptions('night', setPhraseNightOptions);

    return () => { cancelled = true; };
  }, [open, streamMode, nightMode, lang]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await apiRequest(`${SERVER_URL}/api/admin/settings`, {}, lang);
        if (!cancelled) {
          setPayload(data);
          const s = data.settings;
          setForm(normalizeFormFromSettings(s));
          setSongGroups(data.songGroups || s?.songGroups || []);
          setGroupDefs(s.generation.GROUP_DEFS || {});
          setNightGroupDefs(s.generation.NIGHT_GROUP_DEFS || {});
          if (data.insertCooldownSecsLeft > 0) setInsertCooldown(data.insertCooldownSecsLeft);
        }
      } catch (error) {
        if (!cancelled) toastError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSettings();
    return () => { cancelled = true; };
  }, [open, lang, toastError]);

  useEffect(() => {
    if (!editorOpen) return;
    let cancelled = false;

    const fetchSongs = async () => {
      setSongLibraryLoading(true);
      try {
        const params = new URLSearchParams({
          mode: songGroupForm.mode || 'day',
          query: songSearch,
          offset: '0',
          limit: String(SETTINGS_LIBRARY_PAGE),
        });
        const data = await apiRequest(`${SERVER_URL}/api/admin/song-groups/library?${params}`, {}, lang);
        if (!cancelled) {
          setSongLibrary({ items: data.items, total: data.total, offset: data.offset });
        }
      } catch (error) {
        if (!cancelled) toastError(error);
      } finally {
        if (!cancelled) setSongLibraryLoading(false);
      }
    };

    fetchSongs();
    return () => { cancelled = true; };
  }, [editorOpen, songGroupForm.mode, songSearch, lang, toastError]);

  const bounds = payload?.bounds;
  const generation = form?.generation;

  const groupStats = useMemo(() => Object.entries(bounds?.groupSongCounts || {}), [bounds]);
  const nightGroupStats = useMemo(() => Object.entries(bounds?.nightGroupSongCounts || {}), [bounds]);

  const selectedSongs = useMemo(() => {
    const libraryMap = new Map(songLibrary.items.map((s) => [s.id, s]));
    const previewMap = new Map(
      songGroups.flatMap((g) => g.songsPreview || []).map((s) => [s.id, s])
    );
    return (songGroupForm.songs || []).map(
      (id) => libraryMap.get(id) ?? previewMap.get(id) ?? { id, title: id.split('/').pop(), artist: '-' }
    );
  }, [songGroupForm.songs, songLibrary.items, songGroups]);

  const visibleSelectedSongs = selectedSongs.slice(0, selectedVisibleCount);
  const selectedRemaining = Math.max(0, selectedSongs.length - selectedVisibleCount);

  const onField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, generation: { ...prev.generation, [key]: value } }));
  }, []);

  const onMainField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onRadioHostsField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, radioHosts: { ...prev.radioHosts, [key]: value } }));
  }, []);

  const onArtistArtsField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, artistArts: { ...prev.artistArts, [key]: value } }));
  }, []);

  const onBrandingUrlField = useCallback((value) => {
    setForm((prev) => ({ ...prev, branding: { ...prev.branding, telegram_url: value } }));
  }, []);

  const onBrandingLangField = useCallback((locale, key, value) => {
    setForm((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        byLang: {
          ...prev.branding?.byLang,
          [locale]: { ...(prev.branding?.byLang?.[locale] || {}), [key]: value },
        },
      },
    }));
  }, []);

  const [brandingLang, setBrandingLang] = useState('');
  const brandingLangs = Object.keys(form?.branding?.byLang || {});
  const activeBrandingLang = brandingLangs.includes(brandingLang) ? brandingLang : brandingLangs[0];
  const activeBrandingEntry = (activeBrandingLang && form?.branding?.byLang?.[activeBrandingLang]) || {
    dayRadioName: '', nightRadioName: '', telegramLabel: '',
  };

  const resetEditor = useCallback(() => {
    setEditorOpen(false);
    setSongGroupForm(createEmptySongGroupForm());
    setSongSearch('');
    setSongLibrary({ items: [], total: 0, offset: 0 });
    setDeleteTarget(null);
  }, []);

  const editorRef = useRef(null);

  const openSongGroupEditor = useCallback((group = null) => {
    setEditorOpen(true);
    setSongGroupForm(
      group
        ? { id: group.id, name: group.name, mode: group.mode, songs: [...group.songs] }
        : createEmptySongGroupForm()
    );
    setSongSearch('');
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const addSongToGroup = useCallback((song) => {
    setSongGroupForm((prev) => ({
      ...prev,
      songs: prev.songs.includes(song.id) ? prev.songs : [...prev.songs, song.id],
    }));
    setSelectedVisibleCount(SELECTED_PAGE);
  }, []);

  const removeSongFromGroup = useCallback((songId) => {
    setSongGroupForm((prev) => ({
      ...prev,
      songs: prev.songs.filter((id) => id !== songId),
    }));
    setSelectedVisibleCount(SELECTED_PAGE);
  }, []);

  const accent      = isNight ? 'border-red-900/40 bg-[#1a0505]' : 'border-white/10 bg-gray-800';
  const inputBorder = isNight ? 'border-red-900/40 focus:border-red-500/50' : 'border-white/10 focus:border-blue-500/50';
  const accentBtn   = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';

  if (!open) return null;

  const handleSave = async () => {
    const dayNeedsGroups = !!generation.GROUP_SECTIONS_ALGORYTM;
    const nightNeedsGroups = nightMode && !!generation.NIGHT_GROUP_SECTIONS_ALGORYTM;

    if (dayNeedsGroups && (!groupDefs || typeof groupDefs !== 'object' || Array.isArray(groupDefs) || !Object.keys(groupDefs).length)) {
      showToast?.(t('invalidJson'), 'error');
      return;
    }

    if (nightNeedsGroups && (!nightGroupDefs || typeof nightGroupDefs !== 'object' || Array.isArray(nightGroupDefs) || !Object.keys(nightGroupDefs).length)) {
      showToast?.(t('invalidJson'), 'error');
      return;
    }

    const telegramUrl = (form.branding?.telegram_url || '').trim();
    if (telegramUrl && !/^https?:\/\/.+/.test(telegramUrl)) {
      showToast?.(t('telegramUrlError'), 'error');
      return;
    }

    setSaving(true);
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/settings`, {
        method: 'POST',
        body: JSON.stringify({
          branding: form.branding,
          radioHosts: {
            guestMaxDurationMinutes: Number(form.radioHosts?.guestMaxDurationMinutes),
            specialGuestMaxDurationMinutes: Number(form.radioHosts?.specialGuestMaxDurationMinutes),
            backgroundMusicMode: form.radioHosts?.backgroundMusicMode === 'hostChoice' ? 'hostChoice' : 'random',
          },
          artistArts: {
            dayEnabled: Boolean(form.artistArts?.dayEnabled),
            nightEnabled: Boolean(form.artistArts?.nightEnabled),
          },
          generation: {
            ...generation,
            MAX_DAY_DURATION:   minToSec(generation.MAX_DAY_DURATION),
            MAX_NIGHT_DURATION: minToSec(generation.MAX_NIGHT_DURATION),
            SONGS_PER_SECTION:  Number(generation.SONGS_PER_SECTION),
            NIGHT_SONGS_PER_SECTION: Number(generation.NIGHT_SONGS_PER_SECTION),
            PHRASES_TIME_SECONDS: Number(generation.PHRASES_TIME_SECONDS),
            GROUP_DEFS: groupDefs,
            NIGHT_GROUP_DEFS: nightGroupDefs,
          },
          songGroups: songGroups.map(({ id, name, mode, songs }) => ({ id, name, mode, songs })),
        }),
      }, lang);

      setPayload(data);
      const newSettings = data.settings;
      setForm(normalizeFormFromSettings(newSettings));
      setSongGroups(data.songGroups || newSettings.songGroups || []);
      setGroupDefs(newSettings.generation.GROUP_DEFS || {});
      setNightGroupDefs(newSettings.generation.NIGHT_GROUP_DEFS || {});

      const successMsg = pickLocalized(data.algorithmNotice || data.message, lang)
        || (data.algorithmNotice ? t('appliedLater') : t('appliedNow'));
      showToast?.(successMsg, 'success');
    } catch (error) {
      toastError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSongGroup = async () => {
    if (!songGroupForm.name.trim() || !songGroupForm.mode || !songGroupForm.songs.length) {
      showToast?.(t('songGroupInvalid'), 'error');
      return;
    }

    try {
      const isEdit = !!songGroupForm.id;
      const data = await apiRequest(
        isEdit
          ? `${SERVER_URL}/api/admin/song-groups/${songGroupForm.id}`
          : `${SERVER_URL}/api/admin/song-groups`,
        {
          method: isEdit ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: songGroupForm.name.trim(),
            mode: songGroupForm.mode,
            songs: songGroupForm.songs,
          }),
        },
        lang
      );

      const refreshed = await apiRequest(`${SERVER_URL}/api/admin/song-groups`, {}, lang);
      setSongGroups(refreshed.items || []);
      toastSuccess(data, t('groupSaved'));
      resetEditor();
    } catch (error) {
      toastError(error);
    }
  };

  const handleDeleteSongGroup = async () => {
    if (!deleteTarget) return;
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/song-groups/${deleteTarget.id}`, {
        method: 'DELETE',
      }, lang);
      setSongGroups((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toastSuccess(data, t('groupDeleted'));
      resetEditor();
    } catch (error) {
      toastError(error);
    }
  };

  const handleInsertSongGroup = async (groupId) => {
    try {
      const data = await apiRequest(`${SERVER_URL}/api/admin/song-groups/${groupId}/insert`, {
        method: 'POST',
      }, lang);
      toastSuccess(data, t('groupInserted'));
      if (data.insertCooldownSecsLeft > 0) setInsertCooldown(data.insertCooldownSecsLeft);
    } catch (error) {
      toastError(error);
    }
  };

  const loadMoreSongs = async () => {
    try {
      const params = new URLSearchParams({
        mode: songGroupForm.mode || 'day',
        query: songSearch,
        offset: String(songLibrary.items.length),
        limit: String(SETTINGS_LIBRARY_PAGE),
      });
      const data = await apiRequest(`${SERVER_URL}/api/admin/song-groups/library?${params}`, {}, lang);
      setSongLibrary((prev) => ({
        items: [...prev.items, ...(data.items || [])],
        total: data.total,
        offset: data.offset,
      }));
    } catch (error) {
      toastError(error);
    }
  };

  return (
    <div className="fixed inset-0 z-[410] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${accent}`}
        style={{ maxHeight: 'calc(100vh - 32px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className={`text-lg font-black ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</h2>
            <p className="text-xs text-gray-400">{t('generation')}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {readOnly && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-3 text-xs text-amber-200">
            {t('readOnlyNotice')}
          </div>
        )}

        {loading || !form ? (
          <div className="p-6 text-sm text-gray-400">{t('loading')}</div>
        ) : (
          <fieldset
            disabled={readOnly}
            className="contents"
          >
          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-white" style={{ scrollbarGutter: 'stable' }}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">

                <PrivilegeGate locked={!can(P.SETTINGS_BRANDING)} lang={lang}>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-3 text-xs font-black text-gray-300">{t('brandingSection')}</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      label={t('telegramUrl')}
                      value={form.branding?.telegram_url}
                      onChange={onBrandingUrlField}
                      inputBorder={inputBorder}
                      colSpan="sm:col-span-2"
                    />
                  </div>

                  {brandingLangs.length > 0 && (
                    <>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {brandingLangs.map((locale) => (
                          <button
                            key={locale}
                            type="button"
                            onClick={() => setBrandingLang(locale)}
                            className={`rounded-lg px-3 py-1 text-xs font-bold uppercase transition-all ${
                              locale === activeBrandingLang
                                ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white')
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {locale}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField
                          label={t('dayRadioName')}
                          value={activeBrandingEntry.dayRadioName}
                          onChange={(v) => onBrandingLangField(activeBrandingLang, 'dayRadioName', v)}
                          inputBorder={inputBorder}
                        />
                        {nightMode && (
                          <FormField
                            label={t('nightRadioName')}
                            value={activeBrandingEntry.nightRadioName}
                            onChange={(v) => onBrandingLangField(activeBrandingLang, 'nightRadioName', v)}
                            inputBorder={inputBorder}
                          />
                        )}
                        <FormField
                          label={t('telegramLabel')}
                          value={activeBrandingEntry.telegramLabel}
                          onChange={(v) => onBrandingLangField(activeBrandingLang, 'telegramLabel', v)}
                          inputBorder={inputBorder}
                        />
                      </div>
                    </>
                  )}
                </div>
                </PrivilegeGate>

                {radioHostsMode && (
                  <PrivilegeGate locked={!can(P.RADIO_MODERATOR)} lang={lang}>
                  <div className="rounded-xl border border-white/10 p-3">
                    <div className="mb-1 text-xs font-black text-gray-300">{t('radioHostsSection')}</div>
                    <p className="mb-3 text-[11px] text-gray-400">{t('radioHostsHint')}</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <div className="text-[11px] font-black text-gray-300">{t('guestMaxDuration')}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={240}
                            className={`${compactInput} ${inputBorder}`}
                            value={form.radioHosts?.guestMaxDurationMinutes ?? ''}
                            onChange={(e) => onRadioHostsField('guestMaxDurationMinutes', e.target.value)}
                          />
                          <span className="shrink-0 text-xs text-gray-400">{t('minutes')}</span>
                        </div>
                      </label>
                      <label className="space-y-1">
                        <div className="text-[11px] font-black text-gray-300">{t('specialGuestMaxDuration')}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={240}
                            className={`${compactInput} ${inputBorder}`}
                            value={form.radioHosts?.specialGuestMaxDurationMinutes ?? ''}
                            onChange={(e) => onRadioHostsField('specialGuestMaxDurationMinutes', e.target.value)}
                          />
                          <span className="shrink-0 text-xs text-gray-400">{t('minutes')}</span>
                        </div>
                      </label>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="mb-1 text-[11px] font-black text-gray-300">{t('backgroundMusicModeLabel')}</div>
                      <p className="mb-3 text-[11px] text-gray-400">{t('backgroundMusicModeHint')}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          { value: 'random', label: t('backgroundMusicModeRandom'), hint: t('backgroundMusicModeRandomHint') },
                          { value: 'hostChoice', label: t('backgroundMusicModeHostChoice'), hint: t('backgroundMusicModeHostChoiceHint') },
                        ].map((opt) => {
                          const checked = (form.radioHosts?.backgroundMusicMode ?? 'random') === opt.value;
                          return (
                            <label
                              key={opt.value}
                              className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer transition-colors ${
                                checked ? inputBorder : 'border-white/10'
                              }`}
                            >
                              <input
                                type="radio"
                                name="backgroundMusicMode"
                                className="mt-0.5 shrink-0"
                                checked={checked}
                                onChange={() => onRadioHostsField('backgroundMusicMode', opt.value)}
                              />
                              <span>
                                <span className="block text-[11px] font-black text-white">{opt.label}</span>
                                <span className="block text-[10px] text-gray-400">{opt.hint}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  </PrivilegeGate>
                )}

                <PrivilegeGate locked={!can(P.SETTINGS_ALGORITHM)} lang={lang}>
                <div className="rounded-xl border border-white/10 p-3 space-y-3">
                  <div className="text-xs font-black text-gray-300">{t('artistArtsSection')}</div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!form.artistArts?.dayEnabled}
                      onChange={(e) => onArtistArtsField('dayEnabled', e.target.checked)}
                    />
                    <div className="text-xs font-black text-gray-300">{t('artistArtsDayEnabled')}</div>
                  </label>

                  {nightMode && (
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={!!form.artistArts?.nightEnabled}
                        onChange={(e) => onArtistArtsField('nightEnabled', e.target.checked)}
                      />
                      <div className="text-xs font-black text-gray-300">{t('artistArtsNightEnabled')}</div>
                    </label>
                  )}
                </div>
                </PrivilegeGate>

                <PrivilegeGate locked={!can(P.SETTINGS_ALGORITHM)} lang={lang}>
                <div className="rounded-xl border border-white/10 p-3 space-y-3">
                  <div className="text-xs font-black text-gray-300">{t('generation')}</div>

                  {streamMode && (
                    <div className="rounded-xl border border-white/10 p-3 space-y-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={!!generation.JINGLES_ENABLED}
                          onChange={(e) => onField('JINGLES_ENABLED', e.target.checked)}
                        />
                        <div>
                          <div className="text-xs font-black text-gray-300">{tf('JINGLES_ENABLED')}</div>
                          <div className="mt-0.5 text-[11px] text-gray-500">{tf('JINGLES_ENABLED_HINT')}</div>
                          <div className="mt-1 text-[11px] text-gray-400">
                            {jingleCounts
                              ? tf('jinglesCount', { day: jingleCounts.day, night: jingleCounts.night })
                              : tf('jinglesCountLoading')}
                          </div>
                          {jingleCounts && jingleCounts.dayUsable < jingleCounts.minRequired && (
                            <div className="mt-1 text-[11px] font-bold text-amber-400">
                              {tf('jinglesEligibilityDay', { used: jingleCounts.dayUsable, min: jingleCounts.minRequired })}
                            </div>
                          )}
                          {nightMode && jingleCounts && jingleCounts.nightUsable < jingleCounts.minRequired && (
                            <div className="mt-1 text-[11px] font-bold text-amber-400">
                              {tf('jinglesEligibilityNight', { used: jingleCounts.nightUsable, min: jingleCounts.minRequired })}
                            </div>
                          )}
                        </div>
                      </label>

                      <div className={`border-t border-white/10 pt-3 ${!generation.JINGLES_ENABLED ? 'opacity-40' : ''}`}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={!generation.JINGLES_ENABLED}
                            checked={!!generation.JINGLES_RANDOM}
                            onChange={(e) => onField('JINGLES_RANDOM', e.target.checked)}
                          />
                          <div>
                            <div className="text-xs font-black text-gray-300">{tf('JINGLES_RANDOM')}</div>
                            <div className="mt-0.5 text-[11px] text-gray-500">{tf('JINGLES_RANDOM_HINT')}</div>
                          </div>
                        </label>

                        <div className={`mt-3 ${generation.JINGLES_RANDOM || !generation.JINGLES_ENABLED ? 'opacity-40' : ''}`}>
                          <div className="mb-2 text-xs font-black text-gray-300">{tf('JINGLES_FREQUENCY')}</div>
                          <input
                            type="number"
                            className={`${compactInput} ${inputBorder}`}
                            value={generation.JINGLES_FREQUENCY}
                            min={1}
                            max={5}
                            disabled={!!generation.JINGLES_RANDOM || !generation.JINGLES_ENABLED}
                            onChange={(e) => onField(
                              'JINGLES_FREQUENCY',
                              Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                            )}
                          />
                          <div className="mt-2 text-[11px] text-gray-400">{tf('JINGLES_FREQUENCY_HINT')}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {streamMode && (() => {
                    const canEnablePhrases = Boolean(
                      phraseCounts && phraseCounts.dayUsable >= phraseCounts.minRequired
                        && (!nightMode || phraseCounts.nightUsable >= phraseCounts.minRequired)
                    );
                    const phrasesTimeBounds = bounds?.PHRASES_TIME_SECONDS || { min: 5, max: 30 };

                    return (
                      <div className="rounded-xl border border-white/10 p-3 space-y-3">
                        <label className={`flex items-start gap-2 ${canEnablePhrases ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={!canEnablePhrases}
                            checked={!!generation.PHRASES_ENABLED}
                            onChange={(e) => onField('PHRASES_ENABLED', e.target.checked)}
                          />
                          <div>
                            <div className="text-xs font-black text-gray-300">{tf('PHRASES_ENABLED')}</div>
                            <div className="mt-0.5 text-[11px] text-gray-500">{tf('PHRASES_ENABLED_HINT')}</div>
                            <div className="mt-1 text-[11px] text-gray-400">
                              {phraseCounts
                                ? tf('phrasesCount', { day: phraseCounts.day, night: phraseCounts.night })
                                : tf('phrasesCountLoading')}
                            </div>
                            {phraseCounts && phraseCounts.dayUsable < phraseCounts.minRequired && (
                              <div className="mt-1 text-[11px] font-bold text-amber-400">
                                {tf('phrasesNeedMoreDay', { used: phraseCounts.dayUsable, min: phraseCounts.minRequired })}
                              </div>
                            )}
                            {nightMode && phraseCounts && phraseCounts.nightUsable < phraseCounts.minRequired && (
                              <div className="mt-1 text-[11px] font-bold text-amber-400">
                                {tf('phrasesNeedMoreNight', { used: phraseCounts.nightUsable, min: phraseCounts.minRequired })}
                              </div>
                            )}
                          </div>
                        </label>

                        <div className={`border-t border-white/10 pt-3 space-y-3 ${!generation.PHRASES_ENABLED ? 'opacity-40' : ''}`}>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              disabled={!generation.PHRASES_ENABLED}
                              checked={!!generation.PHRASES_RANDOM}
                              onChange={(e) => onField('PHRASES_RANDOM', e.target.checked)}
                            />
                            <div>
                              <div className="text-xs font-black text-gray-300">{tf('PHRASES_RANDOM')}</div>
                              <div className="mt-0.5 text-[11px] text-gray-500">{tf('PHRASES_RANDOM_HINT')}</div>
                            </div>
                          </label>

                          <div className={generation.PHRASES_RANDOM || !generation.PHRASES_ENABLED ? 'opacity-40' : ''}>
                            <div className="mb-2 text-xs font-black text-gray-300">{tf('phrasesPickDay')}</div>
                            <SelectMenu
                              items={phraseDayOptions}
                              value={generation.PHRASES_DAY_ID || ''}
                              onChange={(id) => onField('PHRASES_DAY_ID', id)}
                              getKey={(item) => item.id}
                              getLabel={(item) => item.filename.replace(/\.mp3$/i, '')}
                              placeholder={tf('phrasesPickPlaceholder')}
                              disabled={!!generation.PHRASES_RANDOM || !generation.PHRASES_ENABLED}
                              isNight={isNight}
                            />

                            {nightMode && (
                              <>
                                <div className="mb-2 mt-3 text-xs font-black text-gray-300">{tf('phrasesPickNight')}</div>
                                <SelectMenu
                                  items={phraseNightOptions}
                                  value={generation.PHRASES_NIGHT_ID || ''}
                                  onChange={(id) => onField('PHRASES_NIGHT_ID', id)}
                                  getKey={(item) => item.id}
                                  getLabel={(item) => item.filename.replace(/\.mp3$/i, '')}
                                  placeholder={tf('phrasesPickPlaceholder')}
                                  disabled={!!generation.PHRASES_RANDOM || !generation.PHRASES_ENABLED}
                                  isNight={isNight}
                                />
                              </>
                            )}
                          </div>

                          <label className="flex items-start gap-2 cursor-pointer border-t border-white/10 pt-3">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              disabled={!generation.PHRASES_ENABLED}
                              checked={!!generation.PHRASES_DEFAULT_TIME}
                              onChange={(e) => onField('PHRASES_DEFAULT_TIME', e.target.checked)}
                            />
                            <div>
                              <div className="text-xs font-black text-gray-300">{tf('PHRASES_DEFAULT_TIME')}</div>
                              <div className="mt-0.5 text-[11px] text-gray-500">{tf('PHRASES_DEFAULT_TIME_HINT')}</div>
                            </div>
                          </label>

                          <div className={generation.PHRASES_DEFAULT_TIME || !generation.PHRASES_ENABLED ? 'opacity-40' : ''}>
                            <div className="mb-2 text-xs font-black text-gray-300">{tf('PHRASES_TIME_SECONDS')}</div>
                            <input
                              type="number"
                              className={`${compactInput} ${inputBorder}`}
                              value={generation.PHRASES_TIME_SECONDS}
                              min={phrasesTimeBounds.min}
                              max={phrasesTimeBounds.max}
                              disabled={!!generation.PHRASES_DEFAULT_TIME || !generation.PHRASES_ENABLED}
                              onChange={(e) => onField(
                                'PHRASES_TIME_SECONDS',
                                Math.min(phrasesTimeBounds.max, Math.max(phrasesTimeBounds.min, Number(e.target.value) || phrasesTimeBounds.min)),
                              )}
                            />
                            <div className="mt-2 text-[11px] text-gray-400">
                              {tf('PHRASES_TIME_SECONDS_HINT', { min: phrasesTimeBounds.min, max: phrasesTimeBounds.max })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {nightMode && (
                    <div className="flex gap-2">
                      {['day', 'night'].map((tab) => {
                        const isActive = generationTab === tab;
                        return (
                          <button
                            key={tab}
                            onClick={() => setGenerationTab(tab)}
                            className={`rounded-lg px-4 py-1.5 text-xs font-black transition-all ${
                              isActive
                                ? (isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white')
                                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                            }`}
                          >
                            {tab === 'day' ? t('tabDay') : t('tabNight')}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[11px] text-amber-300/90">{t('oneHourWarning')}</p>

                  {(!nightMode || generationTab === 'day') && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-1 text-xs font-black text-gray-300">{t('dayTotal')}</div>
                        <div className="text-sm">{formatDuration(bounds?.totalDayDuration, lang)}</div>
                      </div>

                      <label className="block rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('MAX_DAY_DURATION')}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className={`${compactInput} ${inputBorder}`}
                            value={generation.MAX_DAY_DURATION}
                            min={secToMin(bounds?.MAX_DAY_DURATION?.min)}
                            max={secToMin(bounds?.MAX_DAY_DURATION?.max)}
                            disabled={generation.USE_ALL_DAY_SONGS}
                            onChange={(e) => onField('MAX_DAY_DURATION', e.target.value)}
                          />
                          <span className="shrink-0 text-xs text-gray-400">{t('minutes')}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-400">
                          {t('bounds')}: {secToMin(bounds?.MAX_DAY_DURATION?.min)} – {secToMin(bounds?.MAX_DAY_DURATION?.max)} {t('minutes')}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={!!generation.USE_ALL_DAY_SONGS}
                            onChange={(e) => onField('USE_ALL_DAY_SONGS', e.target.checked)}
                          />
                          {tf('USE_ALL_DAY_SONGS')}
                        </label>
                      </label>

                      <div className="rounded-xl border border-white/10 p-3 space-y-3">
                        <div className="text-xs font-black text-gray-300">{t('algorithmSectionTitle')}</div>
                        {(() => {
                          const sharedAlgoProps = {
                            infoTitle: t('algorithmInfoTitle'),
                            infoClose: t('algorithmInfoClose'),
                            blockedLabel: t('algorithmBlocked'),
                            isNight,
                            t,
                          };
                          return (
                            <>
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={t('simpleAlgorithm')}
                                hint={t('simpleAlgorithmHint')}
                                info={t('simpleAlgorithmInfo')}
                                canUse={true}
                                blockedMsg={null}
                                checked={!generation.DAY_ALGORYTM && !generation.GROUP_SECTIONS_ALGORYTM}
                                onChange={(val) => {
                                  if (val) {
                                    onField('DAY_ALGORYTM', false);
                                    onField('GROUP_SECTIONS_ALGORYTM', false);
                                  }
                                }}
                              />
                              <div className="border-t border-white/10" />
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={tf('DAY_ALGORYTM')}
                                hint={t('dayAlgorithmHint')}
                                info={t('dayAlgorithmInfo')}
                                canUse={bounds?.dayAlgorithmStatus?.canUse}
                                blockedMsg={bounds?.dayAlgorithmStatus?.canUse ? null : pickLocalized(bounds?.dayAlgorithmStatus?.reason, lang)}
                                checked={!!generation.DAY_ALGORYTM}
                                onChange={(val) => {
                                  onField('DAY_ALGORYTM', val);
                                  if (val) onField('GROUP_SECTIONS_ALGORYTM', false);
                                }}
                              />
                              <div className="border-t border-white/10" />
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={tf('GROUP_SECTIONS_ALGORYTM')}
                                hint={t('groupSectionsAlgorithmHint')}
                                info={t('groupSectionsAlgorithmInfo')}
                                canUse={bounds?.groupSectionsAlgorithmStatus?.canUse}
                                blockedMsg={bounds?.groupSectionsAlgorithmStatus?.canUse ? null : pickLocalized(bounds?.groupSectionsAlgorithmStatus?.reason, lang)}
                                checked={!!generation.GROUP_SECTIONS_ALGORYTM}
                                onChange={(val) => {
                                  onField('GROUP_SECTIONS_ALGORYTM', val);
                                  if (val) onField('DAY_ALGORYTM', false);
                                }}
                              />
                            </>
                          );
                        })()}
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('SONGS_PER_SECTION')}</div>
                        <input
                          type="number"
                          className={`${compactInput} ${inputBorder} ${!generation.DAY_ALGORYTM ? 'opacity-40 cursor-not-allowed' : ''}`}
                          value={generation.SONGS_PER_SECTION}
                          min={bounds?.SONGS_PER_SECTION?.min}
                          max={bounds?.SONGS_PER_SECTION?.max}
                          disabled={!generation.DAY_ALGORYTM}
                          onChange={(e) => onField('SONGS_PER_SECTION', e.target.value)}
                        />
                        <div className="mt-2 text-[11px] text-gray-400">
                          {t('bounds')}: {bounds?.SONGS_PER_SECTION?.min} – {bounds?.SONGS_PER_SECTION?.max}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">{t('sectionHint')}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('GROUP_DEFS')}</div>
                        <GroupDefsEditor
                          value={groupDefs}
                          onChange={setGroupDefs}
                          t={t}
                          inputBorder={inputBorder}
                          isNight={isNight}
                          groupStats={groupStats}
                          lang={lang}
                        />
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{t('groupStats')}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {groupStats.map(([group, count]) => (
                            <div key={group} className="rounded-lg bg-white/5 px-3 py-2 text-xs">
                              <div className="font-black">{group}</div>
                              <div className="text-gray-400">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {nightMode && generationTab === 'night' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-1 text-xs font-black text-gray-300">{t('nightTotal')}</div>
                        <div className="text-sm">{formatDuration(bounds?.totalNightDuration, lang)}</div>
                      </div>

                      <label className="block rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('MAX_NIGHT_DURATION')}</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className={`${compactInput} ${inputBorder}`}
                            value={generation.MAX_NIGHT_DURATION}
                            min={secToMin(bounds?.MAX_NIGHT_DURATION?.min)}
                            max={secToMin(bounds?.MAX_NIGHT_DURATION?.max)}
                            disabled={generation.USE_ALL_NIGHT_SONGS}
                            onChange={(e) => onField('MAX_NIGHT_DURATION', e.target.value)}
                          />
                          <span className="shrink-0 text-xs text-gray-400">{t('minutes')}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-gray-400">
                          {t('bounds')}: {secToMin(bounds?.MAX_NIGHT_DURATION?.min)} – {secToMin(bounds?.MAX_NIGHT_DURATION?.max)} {t('minutes')}
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={!!generation.USE_ALL_NIGHT_SONGS}
                            onChange={(e) => onField('USE_ALL_NIGHT_SONGS', e.target.checked)}
                          />
                          {tf('USE_ALL_NIGHT_SONGS')}
                        </label>
                      </label>

                      <div className="rounded-xl border border-white/10 p-3 space-y-3">
                        <div className="text-xs font-black text-gray-300">{t('nightAlgorithmSectionTitle')}</div>
                        {(() => {
                          const sharedAlgoProps = {
                            infoTitle: t('algorithmInfoTitle'),
                            infoClose: t('algorithmInfoClose'),
                            blockedLabel: t('algorithmBlocked'),
                            isNight,
                            t,
                          };
                          return (
                            <>
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={t('simpleAlgorithm')}
                                hint={t('nightSimpleAlgorithmHint')}
                                info={t('simpleAlgorithmInfo')}
                                canUse={true}
                                blockedMsg={null}
                                checked={!generation.NIGHT_ALGORYTM && !generation.NIGHT_GROUP_SECTIONS_ALGORYTM}
                                onChange={(val) => {
                                  if (val) {
                                    onField('NIGHT_ALGORYTM', false);
                                    onField('NIGHT_GROUP_SECTIONS_ALGORYTM', false);
                                  }
                                }}
                              />
                              <div className="border-t border-white/10" />
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={tf('NIGHT_ALGORYTM')}
                                hint={t('nightDayAlgorithmHint')}
                                info={t('nightDayAlgorithmInfo')}
                                canUse={bounds?.nightAlgorithmStatus?.canUse}
                                blockedMsg={bounds?.nightAlgorithmStatus?.canUse ? null : pickLocalized(bounds?.nightAlgorithmStatus?.reason, lang)}
                                checked={!!generation.NIGHT_ALGORYTM}
                                onChange={(val) => {
                                  onField('NIGHT_ALGORYTM', val);
                                  if (val) onField('NIGHT_GROUP_SECTIONS_ALGORYTM', false);
                                }}
                              />
                              <div className="border-t border-white/10" />
                              <AlgorithmRow
                                {...sharedAlgoProps}
                                label={tf('NIGHT_GROUP_SECTIONS_ALGORYTM')}
                                hint={t('nightGroupSectionsAlgorithmHint')}
                                info={t('nightGroupSectionsAlgorithmInfo')}
                                canUse={bounds?.nightGroupSectionsAlgorithmStatus?.canUse}
                                blockedMsg={bounds?.nightGroupSectionsAlgorithmStatus?.canUse ? null : pickLocalized(bounds?.nightGroupSectionsAlgorithmStatus?.reason, lang)}
                                checked={!!generation.NIGHT_GROUP_SECTIONS_ALGORYTM}
                                onChange={(val) => {
                                  onField('NIGHT_GROUP_SECTIONS_ALGORYTM', val);
                                  if (val) onField('NIGHT_ALGORYTM', false);
                                }}
                              />
                            </>
                          );
                        })()}
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('NIGHT_SONGS_PER_SECTION')}</div>
                        <input
                          type="number"
                          className={`${compactInput} ${inputBorder} ${!generation.NIGHT_ALGORYTM ? 'opacity-40 cursor-not-allowed' : ''}`}
                          value={generation.NIGHT_SONGS_PER_SECTION}
                          min={bounds?.NIGHT_SONGS_PER_SECTION?.min}
                          max={bounds?.NIGHT_SONGS_PER_SECTION?.max}
                          disabled={!generation.NIGHT_ALGORYTM}
                          onChange={(e) => onField('NIGHT_SONGS_PER_SECTION', e.target.value)}
                        />
                        <div className="mt-2 text-[11px] text-gray-400">
                          {t('bounds')}: {bounds?.NIGHT_SONGS_PER_SECTION?.min} – {bounds?.NIGHT_SONGS_PER_SECTION?.max}
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">{t('sectionHint')}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{tf('NIGHT_GROUP_DEFS')}</div>
                        <GroupDefsEditor
                          value={nightGroupDefs}
                          onChange={setNightGroupDefs}
                          t={t}
                          inputBorder={inputBorder}
                          isNight={isNight}
                          groupStats={nightGroupStats}
                          lang={lang}
                          mode="night"
                        />
                      </div>

                      <div className="rounded-xl border border-white/10 p-3">
                        <div className="mb-2 text-xs font-black text-gray-300">{t('groupStats')}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {nightGroupStats.map(([group, count]) => (
                            <div key={group} className="rounded-lg bg-white/5 px-3 py-2 text-xs">
                              <div className="font-black">{group}</div>
                              <div className="text-gray-400">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </PrivilegeGate>

              </div>

              <PrivilegeGate locked={!can(P.SETTINGS_GROUPS)} lang={lang}>
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="text-xs font-black text-gray-300">{t('songGroupsSection')}</div>
                    <button
                      onClick={() => openSongGroupEditor()}
                      className={`rounded-lg px-3 py-2 text-[11px] font-black ${accentBtn}`}
                    >
                      {t('createSongGroup')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {songGroups.length === 0 ? (
                      <div className="rounded-lg bg-white/5 px-3 py-3 text-xs text-gray-400">{t('noSongGroups')}</div>
                    ) : (
                      songGroups.map((group) => (
                        <div key={group.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black">{group.name}</div>
                              <div className="text-[11px] text-gray-400">
                                {(group.mode === 'night' ? t('modeNight') : t('modeDay'))} · {t('songsCount', { count: group.songCount || group.songs?.length || 0 })}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openSongGroupEditor(group)}
                                className="rounded bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-white/80 hover:bg-white/20"
                              >
                                {t('editSongGroup')}
                              </button>
                              <button
                                onClick={() => handleInsertSongGroup(group.id)}
                                disabled={insertCooldown > 0}
                                className={`rounded px-3 py-1.5 text-[10px] font-black uppercase transition-all disabled:opacity-50 ${accentBtn}`}
                              >
                                {insertCooldown > 0 ? formatCooldown(insertCooldown, t) : t('insertSongGroup')}
                              </button>
                            </div>
                          </div>
                          {!!group.songsPreview?.length && (
                            <div className="mt-2 space-y-1">
                              {group.songsPreview.slice(0, 3).map((song) => (
                                <div key={song.id} className="truncate text-[11px] text-gray-400">
                                  {song.artist} - {song.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {editorOpen && (
                  <div ref={editorRef} className="rounded-xl border border-white/10 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-xs font-black text-gray-300">
                        {songGroupForm.id ? t('editing') : t('creating')}
                      </div>
                      <button onClick={resetEditor} className="rounded bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-white/70 hover:bg-white/20">
                        {t('closeEditor')}
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-[11px] font-black text-gray-300">{t('songGroupName')}</div>
                        <input
                          type="text"
                          className={`${compactInput} ${inputBorder}`}
                          value={songGroupForm.name}
                          onChange={(e) => setSongGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      {nightMode && <div>
                        <div className="mb-1 text-[11px] font-black text-gray-300">{t('songGroupMode')}</div>
                        <div className="grid grid-cols-2 gap-2">
                          {['day', 'night'].map((mode) => {
                            const isActive = songGroupForm.mode === mode;
                            return (
                              <button
                                key={mode}
                                onClick={() =>
                                  setSongGroupForm((prev) => (
                                    prev.mode === mode ? prev : { ...prev, mode }
                                  ))
                                }
                                className={`rounded-lg px-3 py-2 text-xs font-black ${
                                  isActive
                                    ? (isNight ? 'bg-red-700' : 'bg-blue-600')
                                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                                }`}
                              >
                                {mode === 'night' ? t('modeNight') : t('modeDay')}
                              </button>
                            );
                          })}
                        </div>
                      </div>}

                      <div>
                        <input
                          type="text"
                          placeholder={t('searchSongs')}
                          className={`${compactInput} ${inputBorder}`}
                          value={songSearch}
                          onChange={(e) => setSongSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-white/10 p-3">
                          <div className="mb-2 text-[11px] font-black uppercase text-gray-300">{t('searchSongs')}</div>
                          <div className="space-y-2">
                            {songLibraryLoading && songLibrary.items.length === 0 ? (
                              <div className="text-xs text-gray-400">{t('loadingSongs')}</div>
                            ) : songLibrary.items.length === 0 ? (
                              <div className="text-xs text-gray-400">{t('nothingFound')}</div>
                            ) : (
                              songLibrary.items.map((song) => {
                                const exists = songGroupForm.songs.includes(song.id);
                                return (
                                  <div key={song.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs">
                                    <div
                                      className="min-w-0 cursor-default"
                                      onMouseEnter={(e) => showSongTooltip(song, e)}
                                      onMouseLeave={hideSongTooltip}
                                    >
                                      <div className="truncate font-black">{song.title}</div>
                                      <div className="truncate text-gray-400">{song.artist}</div>
                                    </div>
                                    <button
                                      disabled={exists}
                                      onClick={() => addSongToGroup(song)}
                                      className="rounded bg-white/10 px-3 py-1 text-[10px] font-black uppercase text-white/80 hover:bg-white/20 disabled:opacity-40"
                                    >
                                      {t('addSong')}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {songLibrary.items.length < songLibrary.total && (
                            <button
                              onClick={loadMoreSongs}
                              className="mt-2 rounded bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-white/80 hover:bg-white/20"
                            >
                              {t('loadMore', { count: songLibrary.total - songLibrary.items.length })}
                            </button>
                          )}
                        </div>

                        <div className="rounded-lg border border-white/10 p-3">
                          <div className="mb-2 text-[11px] font-black uppercase text-gray-300">{t('selectedSongs')}</div>
                          <div className="space-y-2">
                            {visibleSelectedSongs.length === 0 ? (
                              <div className="text-xs text-gray-400">{t('nothingFound')}</div>
                            ) : (
                              visibleSelectedSongs.map((song) => (
                                <SongChip key={song.id} song={song} onRemove={removeSongFromGroup} onShowTooltip={showSongTooltip} onHideTooltip={hideSongTooltip} />
                              ))
                            )}
                          </div>
                          {selectedRemaining > 0 && (
                            <button
                              onClick={() => setSelectedVisibleCount((prev) => prev + SELECTED_PAGE)}
                              className="mt-2 rounded bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase text-white/80 hover:bg-white/20"
                            >
                              {t('loadMore', { count: selectedRemaining })}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {songGroupForm.id && (
                          <button
                            onClick={() => setDeleteTarget(songGroupForm)}
                            className="rounded-lg bg-red-950/60 px-3 py-2 text-[11px] font-black text-red-200 hover:bg-red-900/70"
                          >
                            {t('deleteGroup')}
                          </button>
                        )}
                        <button
                          onClick={handleSaveSongGroup}
                          className={`rounded-lg px-3 py-2 text-[11px] font-black ${accentBtn}`}
                        >
                          {t('saveSongGroup')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </PrivilegeGate>
            </div>
          </div>
          </fieldset>
        )}

        {!readOnly && (
          <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
            <button
              onClick={handleSave}
              disabled={loading || saving || !form}
              className={`rounded-xl px-4 py-2 text-xs font-black text-white transition-all ${accentBtn} disabled:opacity-50`}
            >
              {saving ? '...' : t('save')}
            </button>
          </div>
        )}

        {deleteTarget && (
          <div className="absolute inset-0 z-[420] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className={`w-full max-w-sm rounded-2xl border p-4 shadow-2xl ${accent}`}>
              <div className="text-lg font-black text-red-600">{t('confirmDeleteTitle')}</div>
              <div className="mt-2 text-sm text-gray-300">{t('confirmDeleteText')}</div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/20">
                  {t('confirmDeleteNo')}
                </button>
                <button onClick={handleDeleteSongGroup} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-600">
                  {t('confirmDeleteYes')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <SongTooltip song={tooltip.song} anchor={tooltip.anchor} />
    </div>
  );
};

export default SettingsModal;