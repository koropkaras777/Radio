import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { accentBtn, inputBorder as inputBorderTheme } from '../shared/theme.js';
import { cropToPhoneJpg } from './cropToPhoneJpg.js';
import { PhoneFrame } from './PhoneFrame.jsx';

const COMPACT_INPUT = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors';

export function ArtEditorCard({
  artistItem,
  isNight,
  lang,
  showToast,
  onBack,
  onSaved,
  onDeleted,
}) {
  const t = useNamespace('artistArts', lang);

  const [draftFile, setDraftFile] = useState(null);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const currentArtUrl = useMemo(() => {
    if (!artistItem?.hasArt) return '';
    const v = artistItem.updatedAt || artistItem.artFile || '';
    return `${SERVER_URL}/api/admin/artist-arts/file/${encodeURIComponent(artistItem.artist)}?v=${encodeURIComponent(v)}`;
  }, [artistItem]);

  const inputRef     = useRef(null);
  const compactInput = COMPACT_INPUT;

  useEffect(() => {
    return () => {
      if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
    };
  }, [draftPreviewUrl]);

  const applyDraftFile = useCallback(async (file) => {
    if (!file) return;
    const isJpg = /image\/jpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name);
    if (!isJpg) {
      showToast?.(t('requirements'), 'error');
      return;
    }

    const prepared = await cropToPhoneJpg(file);
    if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
    setDraftFile(prepared.file);
    setDraftPreviewUrl(prepared.previewUrl);
  }, [draftPreviewUrl, t, showToast]);

  const applyFileSafe = useCallback(async (file, afterApply) => {
    if (!file) return;
    try {
      await applyDraftFile(file);
      afterApply?.();
    } catch (error) {
      showToast?.(error.message, 'error');
    }
  }, [applyDraftFile, showToast]);

  const handleChoose = async (event) => {
    const file = event.target.files?.[0];
    await applyFileSafe(file, () => { event.target.value = ''; });
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    await applyFileSafe(event.dataTransfer?.files?.[0]);
  };

  const handleSave = async () => {
    if (!artistItem?.artist || !draftFile || saving || deleting) return;

    setSaving(true);
    try {
      const data = await apiRequest(
        `${SERVER_URL}/api/admin/artist-arts/upload?artist=${encodeURIComponent(artistItem.artist)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'image/jpeg',
            'X-File-Name': encodeURIComponent(`${artistItem.artist}.jpg`),
          },
          body: draftFile,
        },
        lang
      );

      const artFile = data?.item?.artFileName || data?.item?.artFile || `${artistItem.artist}.jpg`;
      const updated = { ...artistItem, hasArt: true, artFile, artFileName: artFile, updatedAt: Date.now() };

      if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
      setDraftFile(null);
      setDraftPreviewUrl('');
      showToast?.(t('saveOk'), 'success');
      onSaved?.(updated);
    } catch (error) {
      showToast?.(`${t('saveError')}: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!artistItem?.artist || !artistItem?.hasArt || saving || deleting) return;

    setDeleting(true);
    try {
      const data = await apiRequest(
        `${SERVER_URL}/api/admin/artist-arts/${encodeURIComponent(artistItem.artist)}`,
        {
          method: 'DELETE',
        },
        lang
      );

      const updated = {
        ...artistItem,
        hasArt: false,
        artFile: null,
        updatedAt: Date.now(),
        ...(data?.item || {}),
      };

      showToast?.(t('deleteOk'), 'success');
      onDeleted?.(updated);
    } catch (error) {
      showToast?.(`${t('deleteError')}: ${error.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 hover:text-white transition-colors"
      >
        <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 rtl:-scale-x-100">
          <polygon points="8,1 2,5 8,9" />
        </svg>
        {t('backToList')}
      </button>

      <div className={`rounded-xl border p-4 space-y-4 ${isNight ? 'bg-red-950/10 border-red-900/30' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-black text-sm uppercase truncate text-white">{artistItem.artist}</div>
            <div className="text-[11px] text-gray-400 truncate">{t('requirements')}</div>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${artistItem.hasArt ? 'bg-green-700/40 text-green-300' : 'bg-gray-700/40 text-gray-400'}`}>
            {artistItem.hasArt ? t('hasArt') : t('noArt')}
          </span>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (draftPreviewUrl) URL.revokeObjectURL(draftPreviewUrl);
              setDraftFile(null);
              setDraftPreviewUrl('');
            }}
            disabled={!draftFile || saving || deleting}
            className="rounded-xl px-4 py-2 text-xs font-black text-white/80 bg-white/10 transition-all hover:bg-white/20 disabled:opacity-40"
          >
            {t('clearBtn')}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!artistItem.hasArt || saving || deleting}
            className="rounded-xl px-4 py-2 text-xs font-black text-white transition-all disabled:opacity-50 bg-red-700 hover:bg-red-600"
          >
            {deleting ? t('deleting') : t('deleteBtn')}
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={saving || deleting}
            className="rounded-xl px-4 py-2 text-xs font-black text-white/80 bg-white/10 transition-all hover:bg-white/20 disabled:opacity-50"
          >
            {t('chooseFile')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draftFile || saving || deleting}
            className={`rounded-xl px-5 py-2 text-xs font-black text-white transition-all disabled:opacity-50 ${accentBtn(isNight)}`}
          >
            {saving ? t('saving') : t('saveBtn')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,image/jpeg"
            className="hidden"
            onChange={handleChoose}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-[11px] font-black text-gray-300">{t('currentArt')}</div>
            <div className={`${compactInput} ${inputBorderTheme(isNight)} !p-4`}>
              <PhoneFrame imageUrl={currentArtUrl} emptyText={t('noArt')} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-black text-gray-300">{t('newArt')}</div>
            {draftPreviewUrl ? (
              <div className={`${compactInput} ${inputBorderTheme(isNight)} !p-4`}>
                <PhoneFrame imageUrl={draftPreviewUrl} emptyText={t('noArt')} />
              </div>
            ) : (
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false);
                }}
                onDrop={handleDrop}
                className={`flex min-h-[320px] items-center justify-center rounded-lg border-2 border-dashed bg-black/20 px-4 text-center transition-all ${
                  dragActive
                    ? (isNight ? 'border-red-600 bg-red-950/20' : 'border-blue-500 bg-blue-950/20')
                    : (isNight ? 'border-red-900/40' : 'border-white/15')
                }`}
              >
                <div>
                  <div className="text-sm font-black uppercase text-white">{t('dropTitle')}</div>
                  <div className="mt-2 text-[11px] font-bold text-gray-400">{t('dropHint')}</div>
                  <div className="mt-4 text-[10px] font-black uppercase text-gray-500">{t('previewLabel')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}