import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { pickLocalized, apiRequest, getAuthHeaders } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { uploadFileWithProgress } from '../shared/uploadWithProgress.js';
import { ProgressRing } from './ProgressRing.jsx';
import { createUploadItem, createYoutubeUploadItem } from './uploadItems.js';
import { isYoutubeTrackUrl, isYoutubePlaylistUrl, extractYoutubeVideoId, normalizeTrackKey, getItemTrackKey } from './youtubeHelpers.js';
import { downloadYoutubeSong, fetchYoutubeTrackInfo, handleRemovedArtists } from './songUploadApi.js';

const MAX_FILES = 30;

export function UploadSongsModal({ open, onClose, isNight, lang = 'uk', showToast, onUploaded, onEditSong, privileges = [], nightMode = true, capabilities = {} }) {
  const t = useNamespace('uploadSongs', lang);
  const canMoveMode = Boolean(capabilities.moveTrackMode);

  const [mode,          setMode]          = useState(isNight ? 'night' : 'day');
  const [items,         setItems]         = useState([]);
  const [dragActive,    setDragActive]    = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [isDone,        setIsDone]        = useState(false);

  const [stopConfirm,   setStopConfirm]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [moveConfirm,   setMoveConfirm]   = useState(null);
  const [batchWorking,  setBatchWorking]  = useState(false);

  const [artDeleteConfirm, setArtDeleteConfirm] = useState(null);

  const [selected,      setSelected]      = useState(new Set());

  const [ytbAvailable,     setYtbAvailable]     = useState(false);
  const [youtubeUrlInput,  setYoutubeUrlInput]  = useState('');
  const [urlInputError,    setUrlInputError]    = useState('');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [clipboardUrl,   setClipboardUrl]   = useState('');
  const [showCookiesBox, setShowCookiesBox] = useState(false);
  const [cookiesInput,   setCookiesInput]   = useState('');
  const [savingCookies,  setSavingCookies]  = useState(false);

  const inputRef    = useRef(null);
  const abortRef    = useRef(null); 

  useEffect(() => {
    if (open) {
      setMode(isNight ? 'night' : 'day');
      setSelected(new Set());
    }
  }, [open, isNight]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`${SERVER_URL}/api/admin/ytbdown-status`, { credentials: 'include', headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setYtbAvailable(Boolean(data?.available));
        if (data?.ytbdownAvailable && !data?.ffmpegAvailable) {
          console.warn('[UploadSongsModal] ytbdown found, but ffmpeg is missing on the server - YouTube download stays hidden until it is installed.');
        }
      })
      .catch(() => { if (!cancelled) setYtbAvailable(false); });
    return () => { cancelled = true; };
  }, [open]);

  const checkClipboardForYoutubeUrl = useCallback(async () => {
    if (!navigator.clipboard?.readText) return;
    try {
      const text = (await navigator.clipboard.readText())?.trim() || '';
      setClipboardUrl(text && isYoutubeTrackUrl(text) ? text : '');
    } catch {
      setClipboardUrl('');
    }
  }, []);

  useEffect(() => {
    if (!open || !ytbAvailable) return;
    checkClipboardForYoutubeUrl();
    window.addEventListener('focus', checkClipboardForYoutubeUrl);
    return () => window.removeEventListener('focus', checkClipboardForYoutubeUrl);
  }, [open, ytbAvailable, checkClipboardForYoutubeUrl]);

  const canEditSong    = privileges.includes('editor_lyrics') || privileges.includes('editor_meta');
  const pendingCount   = useMemo(() => items.filter((i) => i.status === 'pending').length, [items]);
  const canStart       = useMemo(() => pendingCount > 0 && !isUploading, [pendingCount, isUploading]);
  const completedCount = useMemo(() => items.filter((i) => i.status === 'success').length, [items]);
  const successItems   = useMemo(() => items.filter((i) => i.status === 'success' && !i.postAction), [items]);
  const canMove        = canMoveMode && nightMode;

  const applyFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.some((f) => !/\.mp3$/i.test(f.name))) { showToast?.(t('typeError'), 'error'); return; }

    let duplicateCount = 0;
    let hitQueueLimit = false;
    let addedCount = 0;

    setItems((prev) => {
      const existingNames = new Set(
        prev.filter((i) => i.sourceType === 'file').map((i) => i.name.toLowerCase()),
      );
      const existingTrackKeys = new Set(prev.map(getItemTrackKey).filter(Boolean));
      const seenNames = new Set();
      const seenTrackKeys = new Set();
      const deduped = [];
      for (const f of files) {
        const key = f.name.toLowerCase();
        const trackKey = normalizeTrackKey(f.name);
        const isDup = existingNames.has(key) || seenNames.has(key)
          || (trackKey && (existingTrackKeys.has(trackKey) || seenTrackKeys.has(trackKey)));
        if (isDup) { duplicateCount++; continue; }
        seenNames.add(key);
        if (trackKey) seenTrackKeys.add(trackKey);
        deduped.push(f);
      }

      const pendingCountInPrev = prev.filter((i) => i.status === 'pending').length;
      const freeSlots = MAX_FILES - pendingCountInPrev;
      if (freeSlots <= 0) {
        hitQueueLimit = deduped.length > 0;
        return prev;
      }
      const accepted = deduped.slice(0, freeSlots);
      hitQueueLimit = accepted.length < deduped.length;
      addedCount = accepted.length;

      const newItems = accepted.map((f, i) => createUploadItem(f, prev.length + i));
      return [...prev, ...newItems];
    });

    if (hitQueueLimit) showToast?.(t('limitError', { max: MAX_FILES }), 'error');
    else if (duplicateCount > 0) showToast?.(t('duplicatesInQueueSkipped', { count: duplicateCount }), 'error');

    if (addedCount > 0) setIsDone(false);
  }, [showToast, t]);

  const handleSaveCookies = useCallback(async () => {
    const value = cookiesInput.trim();
    if (!value) return;
    setSavingCookies(true);
    try {
      await apiRequest(`${SERVER_URL}/api/admin/youtube-cookies`, { method: 'POST', body: JSON.stringify({ cookies: value }) }, lang);
      showToast?.(t('cookiesSaved'), 'success');
      setCookiesInput('');
      setShowCookiesBox(false);
    } catch (err) {
      showToast?.(err?.message || t('cookiesError'), 'error');
    } finally {
      setSavingCookies(false);
    }
  }, [cookiesInput, lang, showToast, t]);

  const handlePasteFromClipboard = useCallback(() => {
    if (!clipboardUrl) return;
    setYoutubeUrlInput(clipboardUrl);
    setUrlInputError('');
  }, [clipboardUrl]);

  const handleAddYoutubeUrl = useCallback(async () => {
    const value = youtubeUrlInput.trim();
    if (!value) return;
    if (!isYoutubeTrackUrl(value)) { setUrlInputError(t('invalidYoutubeUrl')); return; }
    if (pendingCount >= MAX_FILES) { showToast?.(t('limitError', { max: MAX_FILES }), 'error'); return; }

    if (isYoutubePlaylistUrl(value)) {
      setIsFetchingInfo(true);
      setUrlInputError('');
      try {
        const { tracks, total, truncated } = await fetchYoutubeTrackInfo({ url: value, lang, signal: undefined });

        if (!tracks.length) {
          setUrlInputError(t('playlistEmpty'));
          return;
        }

        let addedCount = 0;
        let duplicateCount = 0;
        let hitQueueLimit = false;
        setItems((prev) => {
          const existingIds = new Set(
            prev.filter((i) => i.sourceType === 'youtube')
              .map((i) => extractYoutubeVideoId(i.sourceUrl))
              .filter(Boolean),
          );
          const existingTrackKeys = new Set(prev.map(getItemTrackKey).filter(Boolean));
          const seenIds = new Set();
          const seenTrackKeys = new Set();
          const deduped = [];
          for (const tr of tracks) {
            const id = extractYoutubeVideoId(tr.url);
            const trackKey = normalizeTrackKey(tr.title || '');
            const isDup = (id && (existingIds.has(id) || seenIds.has(id)))
              || (trackKey && (existingTrackKeys.has(trackKey) || seenTrackKeys.has(trackKey)));
            if (isDup) { duplicateCount++; continue; }
            if (id) seenIds.add(id);
            if (trackKey) seenTrackKeys.add(trackKey);
            deduped.push(tr);
          }

          const pendingCountInPrev = prev.filter((i) => i.status === 'pending').length;
          const freeSlots = MAX_FILES - pendingCountInPrev;
          if (freeSlots <= 0) { hitQueueLimit = deduped.length > 0; return prev; }
          const accepted = deduped.slice(0, freeSlots);
          hitQueueLimit = accepted.length < deduped.length;
          addedCount = accepted.length;
          const newItems = accepted.map((tr, i) => createYoutubeUploadItem(tr.url, prev.length + i, tr.title || ''));
          return [...prev, ...newItems];
        });

        if (addedCount > 0) {
          setIsDone(false);
          setYoutubeUrlInput('');
          setClipboardUrl('');
          if (truncated || hitQueueLimit) {
            showToast?.(t('playlistTruncated', { added: addedCount, total }), 'error');
          } else if (duplicateCount > 0) {
            showToast?.(t('duplicatesInQueueSkipped', { count: duplicateCount }), 'error');
          } else {
            showToast?.(t('playlistAdded', { count: addedCount }), 'success');
          }
        } else if (duplicateCount > 0) {
          showToast?.(t('duplicatesInQueueSkipped', { count: duplicateCount }), 'error');
        } else {
          showToast?.(t('limitError', { max: MAX_FILES }), 'error');
        }
      } catch (err) {
        setUrlInputError(err?.message || t('playlistFetchError'));
      } finally {
        setIsFetchingInfo(false);
      }
      return;
    }

    const newId = extractYoutubeVideoId(value);
    const alreadyQueued = newId && items.some(
      (i) => i.sourceType === 'youtube' && extractYoutubeVideoId(i.sourceUrl) === newId,
    );
    if (alreadyQueued) { showToast?.(t('duplicateInQueue'), 'error'); return; }

    setIsFetchingInfo(true);
    setUrlInputError('');
    let hintTitle = '';
    try {
      const { tracks } = await fetchYoutubeTrackInfo({ url: value, lang, signal: undefined });
      hintTitle = tracks?.[0]?.title || '';
    } catch {
    } finally {
      setIsFetchingInfo(false);
    }

    let wasDuplicate = false;
    setItems((prev) => {
      const trackKey = normalizeTrackKey(hintTitle);
      if (trackKey && prev.some((i) => getItemTrackKey(i) === trackKey)) {
        wasDuplicate = true;
        return prev;
      }
      return [...prev, createYoutubeUploadItem(value, prev.length, hintTitle)];
    });

    if (wasDuplicate) {
      showToast?.(t('duplicateInQueue'), 'error');
      return;
    }

    setIsDone(false);
    setYoutubeUrlInput('');
    setUrlInputError('');
    setClipboardUrl('');
  }, [youtubeUrlInput, items, pendingCount, lang, showToast, t]);

  const handleClear = useCallback(() => {
    if (isUploading) return;
    setItems([]);
    setIsDone(false);
    setSelected(new Set());
    setYoutubeUrlInput('');
    setUrlInputError('');
    if (inputRef.current) inputRef.current.value = '';
  }, [isUploading]);

  const handleClose = useCallback(() => {
    if (isUploading) { showToast?.(t('locked'), 'error'); return; }
    onClose?.();
  }, [isUploading, onClose, showToast, t]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // ── Stop upload ─────────────────────────────────────────────────────────────
  const handleStopRequest = useCallback(() => {
    if (!isUploading) return;
    setStopConfirm(true);
  }, [isUploading]);

  const handleStopConfirm = useCallback(() => {
    setStopConfirm(false);
    abortRef.current?.abort();
  }, []);

  // ── Main upload loop ─────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (!items.some((i) => i.status === 'pending')) { showToast?.(t('emptyError'), 'error'); return; }

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsUploading(true);
    setIsDone(false);
    let successCount = 0;
    let abortedStorageKey = null;

    try {
      for (const item of items) {
        if (item.status !== 'pending') continue;

        if (signal.aborted) {
          updateItem(item.id, { status: 'skipped', stage: 'skipped', stageLabel: t('skipped') });
          continue;
        }

        const isYoutubeItem = item.sourceType === 'youtube';

        if (!isYoutubeItem) {
          const safeFilename = item.file.name;
          const wouldBeId    = `${mode}/${safeFilename}`;

          try {
            const checkRes = await apiRequest(
              `${SERVER_URL}/api/admin/upload-check-duplicate`,
              { method: 'POST', body: JSON.stringify({ trackId: wouldBeId }), signal },
              lang,
            );
            if (checkRes.exists) {
              updateItem(item.id, {
                status: 'error',
                stage: 'error',
                stageLabel: '',
                error: t('duplicate'),
              });
              continue;
            }
          } catch (checkErr) {
            if (checkErr.name === 'AbortError' || checkErr.aborted) break;
          }
        }

        try {
          updateItem(item.id, {
            status: 'uploading',
            stage: isYoutubeItem ? 'downloading' : 'uploading',
            stageLabel: isYoutubeItem ? t('downloadingYoutube') : t('uploading'),
            progress: 0,
            error: '',
          });

          let uploadData;
          try {
            uploadData = isYoutubeItem
              ? await downloadYoutubeSong({ url: item.sourceUrl, mode, lang, signal })
              : await uploadFileWithProgress({
                  url: `${SERVER_URL}/api/admin/upload-song-file?mode=${encodeURIComponent(mode)}`,
                  file: item.file, lang,
                  onProgress: (p) => updateItem(item.id, { progress: p, stageLabel: t('uploading') }),
                  signal,
                });
          } catch (uploadErr) {
            if (uploadErr.aborted || uploadErr.name === 'AbortError' || signal.aborted) {
              abortedStorageKey = isYoutubeItem ? null : `${mode}/${item.file.name}`;
              updateItem(item.id, { status: 'skipped', stage: 'skipped', stageLabel: t('skipped') });
              break;
            }
            throw uploadErr;
          }

          updateItem(item.id, {
            progress: 100, stage: 'lyrics', stageLabel: t('fetchingLyrics'),
            metadata: uploadData.metadata, storageKey: uploadData.storageKey,
          });

          let lyricsData;
          try {
            lyricsData = await apiRequest(`${SERVER_URL}/api/admin/upload-song-lyrics`, {
              method: 'POST',
              body: JSON.stringify({
                title:    uploadData.metadata.title,
                artist:   uploadData.metadata.artist,
                album:    uploadData.metadata.album,
                duration: uploadData.metadata.duration,
              }),
              signal,
            }, lang);
          } catch (lyricsError) {
            if (lyricsError.name === 'AbortError') {
              abortedStorageKey = uploadData.storageKey;
              updateItem(item.id, { status: 'skipped', stage: 'skipped', stageLabel: t('skipped') });
              break;
            }
            lyricsData = {
              lyricsEntry: { notFound: true, reason: 'fetch_error', fetchedAt: Date.now() },
              lyricsStatus: 'none', lyricsFormat: null, message: lyricsError.message,
            };
          }

          updateItem(item.id, {
            stage: 'db', stageLabel: t('savingDb'),
            lyricsStatus: lyricsData.lyricsStatus,
            lyricsFormat: lyricsData.lyricsFormat,
            lyricsMessage: pickLocalized(lyricsData.message, lang),
          });

          let commitData;
          try {
            commitData = await apiRequest(`${SERVER_URL}/api/admin/upload-song-commit`, {
              method: 'POST',
              body: JSON.stringify({
                metadata: uploadData.metadata,
                lyricsEntry: lyricsData.lyricsEntry,
              }),
              signal,
            }, lang);
          } catch (commitErr) {
            if (commitErr.name === 'AbortError') {
              abortedStorageKey = uploadData.storageKey;
              updateItem(item.id, { status: 'skipped', stage: 'skipped', stageLabel: t('skipped') });
              break;
            }
            throw commitErr;
          }

          successCount += 1;
          updateItem(item.id, {
            status: 'success', stage: 'success',
            stageLabel: pickLocalized(commitData.lyricsMessage, lang) || t('success'),
            progress: 100,
            lyricsStatus: commitData.lyricsStatus,
            lyricsFormat: commitData.lyricsFormat,
            lyricsMessage: pickLocalized(commitData.lyricsMessage, lang),
            storageKey: uploadData.storageKey,
          });

        } catch (error) {
          updateItem(item.id, { status: 'error', stage: 'error', stageLabel: '', error: error.message });
        }
      }

      if (signal.aborted) {
        setItems((prev) => prev.map((item) =>
          item.status === 'pending' || item.status === 'uploading'
            ? { ...item, status: 'skipped', stage: 'skipped', stageLabel: t('skipped') }
            : item,
        ));

        if (abortedStorageKey) {
          apiRequest(`${SERVER_URL}/api/admin/upload-batch-delete`, { method: 'POST', body: JSON.stringify({ songIds: [abortedStorageKey] }) }, lang)
            .catch(() => {});
        }
      }

    } finally {
      setIsUploading(false);
      setIsDone(true);
      abortRef.current = null;
      if (successCount > 0) {
        await onUploaded?.();
        showToast?.(t('done'), 'success');
      }
    }
  }, [items, lang, mode, onUploaded, showToast, t, updateItem]);

  // ── Post-upload selection ────────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll   = useCallback(() => setSelected(new Set(successItems.map((i) => i.id))), [successItems]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);
  const allSelected = successItems.length > 0 && successItems.every((i) => selected.has(i.id));

  // ── Batch delete ─────────────────────────────────────────────────────────────
  const requestDelete = useCallback((ids) => {
    if (!ids.length) return;
    setDeleteConfirm({ ids });
  }, []);

  const confirmDelete = useCallback(async () => {
    const { ids } = deleteConfirm;
    setDeleteConfirm(null);
    setBatchWorking(true);
    try {
      const songIds = items.filter((i) => ids.includes(i.id) && i.storageKey).map((i) => i.storageKey);
      if (songIds.length) {
        const res = await apiRequest(`${SERVER_URL}/api/admin/upload-batch-delete`, { method: 'POST', body: JSON.stringify({ songIds }) }, lang);
        await handleRemovedArtists({
          removedArtists: res.removedArtists || [],
          lang, showToast,
          onConfirmArtDelete: (entry) => setArtDeleteConfirm(entry),
        });
      }
      setItems((prev) => prev.map((i) => ids.includes(i.id)
        ? { ...i, postAction: 'deleted', stageLabel: t('deleted') }
        : i));
      setSelected(new Set());
      await onUploaded?.();
      showToast?.(t('batchDeleteDone', { count: songIds.length }), 'success');
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBatchWorking(false);
    }
  }, [deleteConfirm, items, lang, onUploaded, showToast, t]);

  // ── Batch move ───────────────────────────────────────────────────────────────
  const requestMove = useCallback((ids, targetMode) => {
    if (!ids.length) return;
    setMoveConfirm({ ids, targetMode });
  }, []);

  const confirmMove = useCallback(async () => {
    const { ids, targetMode } = moveConfirm;
    setMoveConfirm(null);
    setBatchWorking(true);
    try {
      const songIds = items.filter((i) => ids.includes(i.id) && i.storageKey).map((i) => i.storageKey);
      if (songIds.length) {
        const res = await apiRequest(`${SERVER_URL}/api/admin/upload-batch-move`, { method: 'POST', body: JSON.stringify({ songIds, targetMode }) }, lang);
        await handleRemovedArtists({
          removedArtists: res.removedArtists || [],
          lang, showToast,
          onConfirmArtDelete: (entry) => setArtDeleteConfirm(entry),
        });
      }
      setItems((prev) => prev.map((i) => ids.includes(i.id)
        ? { ...i, postAction: 'moved', stageLabel: t('moved') }
        : i));
      setSelected(new Set());
      await onUploaded?.();
      showToast?.(t('batchMoveDone', { count: songIds.length }), 'success');
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setBatchWorking(false);
    }
  }, [moveConfirm, items, lang, onUploaded, showToast, t]);

  if (!open) return null;

  const targetMode    = mode === 'day' ? 'night' : 'day';
  const selectedIds   = [...selected];
  const selectedCount = selectedIds.length;
  const allSuccessIds = successItems.map((i) => i.id);

  const accentBg   = isNight ? 'bg-red-700 hover:bg-red-600'     : 'bg-blue-600 hover:bg-blue-500';
  const accentBdr  = isNight ? 'border-red-800/50 text-red-300'  : 'border-blue-800/50 text-blue-300';

  return createPortal(
    <>
      {stopConfirm && (
        <ConfirmDialog
          isNight={isNight}
          title={t('stopConfirmTitle')}
          text={t('stopConfirmText')}
          yesLabel={t('stopConfirmYes')}
          noLabel={t('stopConfirmNo')}
          yesClassName="bg-red-700 hover:bg-red-600"
          onYes={handleStopConfirm}
          onNo={() => setStopConfirm(false)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          isNight={isNight}
          title={t('deleteConfirmTitle')}
          text={t('deleteConfirmText', { count: deleteConfirm.ids.length })}
          yesLabel={t('deleteConfirmYes')}
          noLabel={t('deleteConfirmNo')}
          yesClassName="bg-red-700 hover:bg-red-600"
          onYes={confirmDelete}
          onNo={() => setDeleteConfirm(null)}
        />
      )}

      {moveConfirm && (
        <ConfirmDialog
          isNight={isNight}
          title={t('moveConfirmTitle')}
          text={t('moveConfirmText', { count: moveConfirm.ids.length, modeWord: t(moveConfirm.targetMode === 'night' ? 'modeNightGen' : 'modeDayGen') })}
          yesLabel={t('moveConfirmYes')}
          noLabel={t('moveConfirmNo')}
          yesClassName={isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500'}
          onYes={confirmMove}
          onNo={() => setMoveConfirm(null)}
        />
      )}

      <div
        className="fixed inset-0 z-[430] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
            isNight ? 'border-red-900/40 bg-[#1a0505]' : 'border-white/10 bg-gray-800'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className={`font-black text-lg ${isNight ? 'text-red-400' : 'text-blue-400'}`}>{t('title')}</div>
              <div className="text-xs font-bold text-white/40">{t('limit', { max: MAX_FILES })}</div>
            </div>
            <button onClick={handleClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 py-5"
            onDragEnter={(e) => { e.preventDefault(); if (!isUploading) setDragActive(true); }}
            onDragOver={(e)  => { e.preventDefault(); if (!isUploading) setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false); }}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (isUploading) return; applyFiles(e.dataTransfer.files); }}
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {nightMode && (
                <div className="flex items-center gap-3">
                  <div className="text-[11px] font-black uppercase text-gray-300">{t('mode')}</div>
                  <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                    {['day', 'night'].map((value) => (
                      <button
                        key={value}
                        onClick={() => !isUploading && setMode(value)}
                        disabled={isUploading}
                        className={`rounded-lg px-4 py-2 text-[11px] font-black uppercase transition-all ${
                          mode === value ? `${accentBg} text-white` : 'text-white/60 hover:text-white'
                        } disabled:opacity-50`}
                      >
                        {value === 'night' ? t('night') : t('day')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <input ref={inputRef} type="file" accept=".mp3,audio/mpeg" multiple className="hidden"
                  onChange={(e) => applyFiles(e.target.files)} />

                <button onClick={() => inputRef.current?.click()} disabled={isUploading}
                  className={`rounded-xl px-4 py-2 text-xs font-black text-white transition-all ${accentBg} disabled:opacity-50`}>
                  {t('choose')}
                </button>

                {items.length > 0 && (
                  <button onClick={handleClear} disabled={isUploading}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed">
                    {t('clear')}
                  </button>
                )}

                {isUploading ? (
                  <button onClick={handleStopRequest}
                    className="rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2 text-xs font-black text-white transition-all">
                    {t('stop')}
                  </button>
                ) : (
                  <button onClick={handleStart} disabled={!canStart}
                    className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40 transition-all">
                    {t('start')}
                  </button>
                )}
              </div>
            </div>

            {ytbAvailable && (
              <div className="mb-4 flex items-start gap-2 flex-wrap">
                <input
                  type="text"
                  value={youtubeUrlInput}
                  onChange={(e) => { setYoutubeUrlInput(e.target.value); setUrlInputError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddYoutubeUrl(); } }}
                  disabled={isUploading || isFetchingInfo}
                  placeholder={t('youtubeUrlPlaceholder')}
                  className="flex-1 min-w-[220px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white placeholder-white/30 outline-none focus:border-white/30 disabled:opacity-50"
                />
                {clipboardUrl && clipboardUrl !== youtubeUrlInput.trim() && (
                  <button
                    onClick={handlePasteFromClipboard}
                    disabled={isUploading || isFetchingInfo}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white/80 transition-all hover:bg-white/10 disabled:opacity-40"
                  >
                    {t('pasteButton')}
                  </button>
                )}
                <button
                  onClick={handleAddYoutubeUrl}
                  disabled={isUploading || isFetchingInfo || !youtubeUrlInput.trim() || items.length >= MAX_FILES}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/15 disabled:opacity-40"
                >
                  {isFetchingInfo ? t('fetchingInfo') : t('youtubeAdd')}
                </button>
                {urlInputError && (
                  <div className="w-full text-[11px] font-bold text-red-400">{urlInputError}</div>
                )}
              </div>
            )}

            {ytbAvailable && (
              <div className="mb-4">
                <button
                  onClick={() => setShowCookiesBox((v) => !v)}
                  className="text-[11px] font-bold uppercase text-white/40 hover:text-white/60 transition-all"
                >
                  🍪 {t('cookiesToggle')}
                </button>
                {showCookiesBox && (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={cookiesInput}
                      onChange={(e) => setCookiesInput(e.target.value)}
                      disabled={savingCookies}
                      placeholder={t('cookiesPlaceholder')}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-mono text-white placeholder-white/30 outline-none focus:border-white/30 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSaveCookies}
                      disabled={savingCookies || !cookiesInput.trim()}
                      className="self-start rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/15 disabled:opacity-40"
                    >
                      {t('cookiesSave')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!items.length ? (
              <div
                className={`flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-all ${
                  dragActive
                    ? (isNight ? 'border-red-500 bg-red-950/20' : 'border-blue-400 bg-blue-950/20')
                    : 'border-white/15 bg-white/[0.03]'
                }`}
              >
                <div className="text-lg font-black text-white">{dragActive ? t('dragActive') : t('dropTitle')}</div>
                <div className="mt-2 text-sm font-bold text-white/50">{t('dropHint')}</div>
              </div>
            ) : (
              <div
                className={`space-y-2 rounded-2xl transition-all ${
                  dragActive ? `border-2 border-dashed p-2 ${isNight ? 'border-red-500 bg-red-950/10' : 'border-blue-400 bg-blue-950/10'}` : ''
                }`}
              >
                {dragActive && (
                  <div className="pb-1 text-center text-xs font-black uppercase text-white/70">{t('dragActive')}</div>
                )}
                {items.map((item) => {
                  const isYoutubeItem = item.sourceType === 'youtube';
                  const title      = item.metadata?.title || (isYoutubeItem ? (item.hintTitle || item.sourceUrl) : item.name);
                  const artist     = item.metadata?.artist || (isYoutubeItem && !item.metadata ? t('youtubeSourceLabel') : '');
                  const lyricsLabel = item.status === 'success'
                    ? ({ synced: t('synced'), plain: t('plain'), none: t('none') }[item.lyricsStatus] ?? t('none'))
                    : null;
                  const isSuccess  = item.status === 'success' && !item.postAction;
                  const isSkipped  = item.status === 'skipped';
                  const hasAction  = !!item.postAction;
                  const isChecked  = selected.has(item.id);

                  const statusContent =
                    item.status === 'error'   ? <span className="text-red-400">{item.error}</span>
                    : item.postAction === 'deleted' ? <span className="text-white/30">{t('deleted')}</span>
                    : item.postAction === 'moved'   ? <span className="text-white/30">{t('moved')}</span>
                    : item.status === 'success'     ? <div className="text-emerald-300">{item.lyricsMessage || lyricsLabel || t('success')}</div>
                    : item.status === 'skipped'     ? <span className="text-white/30">{t('skipped')}</span>
                    : <div className="text-white/70">{item.stageLabel || t('queued')}</div>;

                  return (
                    <div
                      key={item.id}
                      onClick={() => isSuccess && toggleSelect(item.id)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                        isSuccess ? 'cursor-pointer' : ''
                      } ${
                        isChecked
                          ? (isNight ? 'border-red-700/60 bg-red-950/30' : 'border-blue-600/60 bg-blue-950/30')
                          : isSkipped || hasAction
                            ? 'border-white/5 bg-white/[0.02] opacity-50'
                            : 'border-white/10 bg-white/5'
                      }`}
                    >
                      {isSuccess && (
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

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black uppercase text-white">{title}</div>
                            <div className="truncate text-[11px] font-bold uppercase text-white/45">{artist || item.name}</div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="hidden text-right text-[11px] font-black uppercase leading-tight sm:block sm:w-[200px]">
                              {statusContent}
                            </div>

                            {isSuccess && canEditSong && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEditSong?.(item.storageKey); }}
                                title={t('editSongBtn')}
                                aria-label={t('editSongBtn')}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-all hover:border-white/30 hover:text-white"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                              </button>
                            )}

                            <ProgressRing
                              progress={item.progress}
                              success={item.status === 'success' && !item.postAction}
                              failed={item.status === 'error'}
                              skipped={item.status === 'skipped' || !!item.postAction}
                            />
                          </div>
                        </div>

                        <div className="mt-1 text-[11px] font-black uppercase leading-tight sm:hidden">
                          {statusContent}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!!items.length && (
            <div className="border-t border-white/10 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-black text-white/45">{completedCount}/{items.length}</div>

              {isDone && successItems.length > 0 && !batchWorking && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={allSelected ? deselectAll : selectAll}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white/60 bg-white/10 hover:bg-white/15 transition-all"
                  >
                    {allSelected ? t('deselectAll') : t('selectAll')}
                  </button>

                  {canMove && selectedCount > 0 && (
                    <button
                      onClick={() => requestMove(selectedIds, targetMode)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white transition-all ${accentBg}`}
                    >
                      {t('moveSelected')} <span className="rtl:-scale-x-100 inline-block">→</span> {targetMode === 'night' ? t('night') : t('day')}
                    </button>
                  )}

                  {selectedCount > 0 && (
                    <button
                      onClick={() => requestDelete(selectedIds)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-white bg-red-700 hover:bg-red-600 transition-all"
                    >
                      {t('deleteSelected')}
                    </button>
                  )}
                </div>
              )}

              {batchWorking && (
                <div className="text-xs font-black text-white/50">{t('batchWorking')}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {artDeleteConfirm && (
        <ConfirmDialog
          isNight={isNight}
          title={t('artDeleteTitle')}
          text={t('artDeleteText', { artist: artDeleteConfirm.artist })}
          yesLabel={t('artDeleteYes')}
          noLabel={t('artDeleteNo')}
          yesClassName="bg-red-700 hover:bg-red-600"
          onNo={() => setArtDeleteConfirm(null)}
          onYes={async () => {
            const artist = artDeleteConfirm.artist;
            setArtDeleteConfirm(null);
            try {
              await fetch(`${SERVER_URL}/api/admin/artist-arts/${encodeURIComponent(artist)}`, {
                method: 'DELETE', credentials: 'include', headers: getAuthHeaders(),
              });
            } catch { /* ignore */ }
            showToast?.(t('artDeletedToast', { artist }), 'success');
          }}
        />
      )}
    </>,
    document.body
  );
}