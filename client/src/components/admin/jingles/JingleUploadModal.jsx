import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { uploadFileWithProgress } from '../shared/uploadWithProgress.js';

const MAX_FILES = 30;

const NAMESPACE_BY_KIND = { jingle: 'jingleUploadJingle', backgroundMusic: 'jingleUploadBackgroundMusic', phrase: 'jingleUploadPhrase' };

const API_BASE = { jingle: 'jingles', backgroundMusic: 'background-music', phrase: 'phrases' };

const createUploadItem = (file, index) => ({
  id: `${Date.now()}-${index}-${file.name}`,
  file,
  name: file.name,
  progress: 0,
  status: 'pending', // pending | uploading | success | error | skipped
  error: '',
  jingle: null,
});


export function JingleUploadModal({ open, onClose, isNight, lang = 'uk', showToast, onUploaded, nightMode = true, kind = 'jingle' }) {
  const t = useNamespace(NAMESPACE_BY_KIND[kind] || NAMESPACE_BY_KIND.jingle, lang);

  const [mode,        setMode]        = useState(nightMode && isNight ? 'night' : 'day');
  const [items,        setItems]      = useState([]);
  const [dragActive,   setDragActive] = useState(false);
  const [isUploading,  setIsUploading] = useState(false);
  const [isDone,       setIsDone]      = useState(false);
  const [stopConfirm,  setStopConfirm] = useState(false);

  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (open) {
      setMode(nightMode && isNight ? 'night' : 'day');
      setItems([]);
      setIsDone(false);
    }
  }, [open, isNight, nightMode]);

  const pendingCount = useMemo(() => items.filter((i) => i.status === 'pending').length, [items]);
  const canStart      = pendingCount > 0 && !isUploading;

  const applyFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.some((f) => !/\.mp3$/i.test(f.name))) { showToast?.(t('typeError'), 'error'); return; }

    let duplicateCount = 0;
    let hitLimit = false;

    setItems((prev) => {
      const existingNames = new Set(prev.map((i) => i.name.toLowerCase()));
      const seen = new Set();
      const deduped = [];
      for (const f of files) {
        const key = f.name.toLowerCase();
        if (existingNames.has(key) || seen.has(key)) { duplicateCount++; continue; }
        seen.add(key);
        deduped.push(f);
      }

      const freeSlots = MAX_FILES - prev.filter((i) => i.status === 'pending').length;
      if (freeSlots <= 0) { hitLimit = deduped.length > 0; return prev; }

      const accepted = deduped.slice(0, freeSlots);
      hitLimit = accepted.length < deduped.length;

      const newItems = accepted.map((f, i) => createUploadItem(f, prev.length + i));
      return [...prev, ...newItems];
    });

    if (hitLimit) showToast?.(t('limitError', { max: MAX_FILES }), 'error');
    else if (duplicateCount > 0) showToast?.(t('duplicatesSkipped', { count: duplicateCount }), 'error');

    setIsDone(false);
  }, [showToast, t]);

  const handleClear = useCallback(() => {
    if (isUploading) return;
    setItems([]);
    setIsDone(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [isUploading]);

  const handleClose = useCallback(() => {
    if (isUploading) { showToast?.(t('locked'), 'error'); return; }
    onClose?.();
  }, [isUploading, onClose, showToast, t]);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleStopRequest = useCallback(() => {
    if (!isUploading) return;
    setStopConfirm(true);
  }, [isUploading]);

  const handleStopConfirm = useCallback(() => {
    setStopConfirm(false);
    abortRef.current?.abort();
  }, []);

  const handleStart = useCallback(async () => {
    if (!items.some((i) => i.status === 'pending')) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsUploading(true);
    setIsDone(false);
    let successCount = 0;

    try {
      for (const item of items) {
        if (item.status !== 'pending') continue;

        if (signal.aborted) {
          updateItem(item.id, { status: 'skipped' });
          continue;
        }

        try {
          const checkRes = await apiRequest(
            `${SERVER_URL}/api/admin/${API_BASE[kind]}/upload-check-duplicate`,
            { method: 'POST', body: JSON.stringify({ filename: item.file.name }), signal },
            lang,
          );
          if (checkRes.exists) {
            updateItem(item.id, { status: 'error', error: t('duplicate') });
            continue;
          }
        } catch (checkErr) {
          if (checkErr.name === 'AbortError' || checkErr.aborted) break;
        }

        try {
          updateItem(item.id, { status: 'uploading', progress: 0, error: '' });

          let uploadData;
          try {
            uploadData = await uploadFileWithProgress({
              url: `${SERVER_URL}/api/admin/${API_BASE[kind]}/upload?mode=${encodeURIComponent(mode)}`,
              file: item.file, lang,
              onProgress: (p) => updateItem(item.id, { progress: p }),
              signal,
            });
          } catch (uploadErr) {
            if (uploadErr.aborted || uploadErr.name === 'AbortError' || signal.aborted) {
              updateItem(item.id, { status: 'skipped' });
              break;
            }
            throw uploadErr;
          }

          successCount += 1;
          updateItem(item.id, { status: 'success', progress: 100, jingle: uploadData.jingle ?? uploadData.track ?? uploadData.phrase });
        } catch (error) {
          updateItem(item.id, { status: 'error', error: error.message });
        }
      }

      if (signal.aborted) {
        setItems((prev) => prev.map((item) =>
          item.status === 'pending' || item.status === 'uploading'
            ? { ...item, status: 'skipped' }
            : item,
        ));
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
  }, [items, lang, mode, kind, onUploaded, showToast, t]);

  if (!open) return null;

  const accentBg = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';

  return createPortal(
    <>
      {stopConfirm && (
        <ConfirmDialog
          isNight={isNight}
          zIndex={560}
          title={t('stopConfirmTitle')}
          body={t('stopConfirmText')}
          yesLabel={t('stopConfirmYes')}
          noLabel={t('stopConfirmNo')}
          yesClassName="bg-red-700 hover:bg-red-600"
          onYes={handleStopConfirm}
          onNo={() => setStopConfirm(false)}
        />
      )}

      <div className="fixed inset-0 z-[540] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={handleClose}>
        <div
          className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
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
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={inputRef} type="file" accept=".mp3,audio/mpeg" multiple className="hidden"
                  onChange={(e) => applyFiles(e.target.files)} />
                <button onClick={() => inputRef.current?.click()} disabled={isUploading}
                  className={`rounded-xl px-4 py-2 text-xs font-black text-white transition-all ${accentBg} disabled:opacity-50`}>
                  {t('choose')}
                </button>

                {nightMode && (
                  <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                    {['day', 'night'].map((value) => (
                      <button
                        key={value}
                        onClick={() => !isUploading && setMode(value)}
                        disabled={isUploading}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase transition-all ${
                          mode === value ? `${accentBg} text-white` : 'text-white/60 hover:text-white'
                        } disabled:opacity-50`}
                      >
                        {value === 'night' ? t('night') : t('day')}
                      </button>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <button onClick={handleClear} disabled={isUploading}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white transition-all hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed">
                    {t('clear')}
                  </button>
                )}
              </div>

              {items.length > 0 && (
                isUploading ? (
                  <button onClick={handleStopRequest}
                    className="rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2 text-xs font-black text-white transition-all">
                    {t('stop')}
                  </button>
                ) : (
                  <button onClick={handleStart} disabled={!canStart}
                    className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40 transition-all">
                    {t('start')}
                  </button>
                )
              )}
            </div>

            {!items.length ? (
              <div
                className={`flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-all ${
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
                {items.map((item) => {
                  const statusContent =
                    item.status === 'error'   ? <span className="text-red-400">{item.error}</span>
                    : item.status === 'success' ? <span className="text-emerald-300">{t('success')}</span>
                    : item.status === 'skipped' ? <span className="text-white/30">{t('skipped')}</span>
                    : item.status === 'uploading' ? <span className="text-white/70">{t('uploading')} {item.progress}%</span>
                    : <span className="text-white/50">{t('queued')}</span>;

                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border px-4 py-3 border-white/10 bg-white/[0.03]">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-bold text-white">{item.name}</div>
                        <div className="text-[11px] font-bold mt-0.5">{statusContent}</div>
                      </div>
                      {item.status === 'uploading' && (
                        <div className="relative h-8 w-8 shrink-0">
                          <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="13" className="fill-none stroke-white/10" strokeWidth="3" />
                            <circle cx="16" cy="16" r="13" className="fill-none stroke-white" strokeWidth="3"
                              strokeLinecap="round" strokeDasharray={2 * Math.PI * 13}
                              strokeDashoffset={2 * Math.PI * 13 - (item.progress / 100) * 2 * Math.PI * 13} />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}