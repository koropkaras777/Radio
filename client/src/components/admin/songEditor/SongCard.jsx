import { useCallback, useState } from 'react';
import { SERVER_URL } from '../../../config/constants.js';
import { apiRequest, getAuthHeaders } from '../../../i18n/serverMessage.js';
import { useNamespace } from '../../../i18n/index.js';
import { PrivilegeGate } from '../shared/PrivilegeGate.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { handleRemovedArtists } from '../uploadSongs/songUploadApi.js';
import {
  SYNCED_RE,
  splitKey,
  lyricsToText,
  textToEntry,
  isSyncedFormat,
  stripTimecodes,
  generateTimecodes,
  parseDownloadFilename,
} from './songEditorUtils.js';
import { WaveformPlayer } from './WaveformPlayer.jsx';
import { SyncedTextarea } from './SyncedTextarea.jsx';
import { LyricsLine } from './LyricsLine.jsx';

const LINES_PAGE = 5;
const DELETE_BTN = 'bg-red-700 hover:bg-red-600';
const COMPACT_INPUT = 'w-full rounded-lg border bg-black/20 px-3 py-2 text-sm text-white outline-none transition-colors';

// ─── SongCard ─────────────────────────────────────────────────────────────────
export function SongCard({ songId, songKey, songMeta, entry, initialOffset = 0, isNight, lang, onSaved, onDeleted, onRemovedArtists, onConfirmArtDelete, lockedReason = '', showToast, canEditMeta, canDelete = false, canDownload = false, capabilities = {}, nightMode = true }) {
  const t = useNamespace('textEditor', lang);
  const keyParts = splitKey(songKey);
  const artist = String(songMeta?.artist || keyParts.artist || '');
  const title = String(songMeta?.title || keyParts.title || '');
  const album = String(songMeta?.album || '');
  const year = Number.isFinite(Number(songMeta?.year)) ? Number(songMeta.year) : null;

  const currentMode = String(songId || '').startsWith('night/') ? 'night' : 'day';
  const canMoveMode = Boolean(capabilities.moveTrackMode);

  const rawOffset = Number.isFinite(Number(initialOffset)) ? Number(initialOffset) : 0;
  const status = !entry || entry.notFound ? 'none' : entry.synced ? 'synced' : 'plain';
  const allLines = entry && !entry.notFound && Array.isArray(entry.lines) ? entry.lines : [];

  const [editing, setEditing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [linesVisible, setLinesVisible] = useState(LINES_PAGE);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [tcConfirm, setTcConfirm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [markerTime, setMarkerTime] = useState(0);
  const [editOffset, setEditOffset] = useState(rawOffset);
  const [editSynced, setEditSynced] = useState(entry?.synced ?? false);
  const [editText, setEditText] = useState(() => lyricsToText(entry));
  const [editMetaTitle, setEditMetaTitle] = useState(title);
  const [editMetaArtist, setEditMetaArtist] = useState(artist);
  const [editMetaAlbum, setEditMetaAlbum] = useState(album);
  const [editMetaYear, setEditMetaYear] = useState(year ?? '');
  const [editMode, setEditMode] = useState(currentMode);

  const accentBtn   = isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';
  const inputBorder = isNight ? 'border-red-900/40 focus:border-red-600' : 'border-white/15 focus:border-blue-500';
  const compactInput = COMPACT_INPUT;
  const statusBadge = { synced: 'bg-green-700/40 text-green-300', plain: 'bg-blue-700/40 text-blue-300', none: 'bg-gray-700/40 text-gray-400' }[status];
  const statusLabel = { synced: t('statusSynced'), plain: t('statusPlain'), none: t('statusNone') }[status];
  const lockMessage = lockedReason || '';
  const isLocked    = Boolean(lockMessage);
  const displayMeta = [artist, album ? `${album}${year ? ` (${year})` : ''}` : year ? `(${year})` : ''].filter(Boolean).join(' · ');

  const handleDownload = useCallback(async () => {
    if (downloading || !songId) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/admin/song-editor/download?songId=${encodeURIComponent(songId)}`,
        { credentials: 'include', headers: getAuthHeaders() },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.[lang] || data?.error?.uk || t('downloadError'));
      }
      const blob = await res.blob();
      const fallbackName = `${artist || 'Unknown Artist'} - ${title || 'Untitled'}.mp3`;
      const filename = parseDownloadFilename(res.headers.get('Content-Disposition'), fallbackName);

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      showToast?.(err.message || t('downloadError'), 'error');
    } finally {
      setDownloading(false);
    }
  }, [songId, artist, title, lang, showToast, t, downloading]);

  const handleSyncedToggle = () => {
    const next = !editSynced;
    if (next) {
      const hasTimecodes = editText.trim().split('\n').some((l) => SYNCED_RE.test(l.trim()));
      if (!hasTimecodes && editText.trim()) {
        setTcConfirm(true);
        return;
      }
    }
    setEditSynced(next);
  };

  const handleTcYes = () => {
    setTcConfirm(false);
    setEditText(generateTimecodes(editText));
    setEditSynced(true);
  };

  const handleTcNo = () => {
    setTcConfirm(false);
    setEditSynced(true);
  };

  const handleJumpToTime = setMarkerTime;

  const handleSave = async () => {
    if (isLocked) {
      showToast(lockMessage, 'error');
      return;
    }

    if (editSynced && editText.trim() && !isSyncedFormat(editText)) {
      showToast(t('formatError'), 'error');
      return;
    }

    const normalizedMeta = {
      title: String(editMetaTitle || '').trim(),
      artist: String(editMetaArtist || '').trim(),
      album: String(editMetaAlbum || '').trim(),
      year: Number.isFinite(Number(editMetaYear)) ? Number(editMetaYear) : null,
    };

    const metadataChanged = (
      normalizedMeta.title !== title ||
      normalizedMeta.artist !== artist ||
      normalizedMeta.album !== album ||
      normalizedMeta.year !== year
    );

    let finalText = editText;
    if (!editSynced && entry?.synced) finalText = stripTimecodes(editText);
    const newEntry = textToEntry(finalText, editSynced, entry);
    const entryChanged = JSON.stringify(newEntry) !== JSON.stringify(entry);
    const normalizedOffset = Number.isFinite(Number(editOffset)) ? Number(editOffset) : 0;
    const offsetChanged = normalizedOffset !== rawOffset;
    const modeChanged = canMoveMode && editMode !== currentMode;

    if (!metadataChanged && !entryChanged && !offsetChanged && !modeChanged) {
      showToast(t('nothingChanged'), 'success');
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      let savedSongId = songId;
      let savedTrack = null;
      let savedEntry = entry;
      let savedOffset = rawOffset;

      if (metadataChanged || entryChanged || offsetChanged) {
        const result = await apiRequest(`${SERVER_URL}/api/admin/song-editor/save`, {
          method: 'POST',
          body: JSON.stringify({
            songId,
            metadata: normalizedMeta,
            lyricsEntry: newEntry,
            lyricsChanged: entryChanged,
            offset: normalizedOffset,
            offsetChanged,
            metadataChanged,
          }),
        }, lang);
        savedSongId = result.track?.id || songId;
        savedTrack  = result.track;
        savedEntry  = result.entry || newEntry;
        savedOffset = Number.isFinite(Number(result.offset)) ? Number(result.offset) : normalizedOffset;
      }

      let movedTrack = null;
      if (modeChanged) {
        const moveResult = await apiRequest(`${SERVER_URL}/api/admin/song-editor/move-mode`, {
          method: 'POST',
          body: JSON.stringify({ songId: savedSongId, targetMode: editMode }),
        }, lang);
        movedTrack  = moveResult.track;
        savedSongId = moveResult.track?.id || savedSongId;

        await handleRemovedArtists({
          removedArtists: moveResult.removedArtists || [],
          lang,
          showToast,
          onConfirmArtDelete,
        });
      }

      const finalTrack = movedTrack || savedTrack;

      setSavedMsg(t('saveOk'));
      setTimeout(() => setSavedMsg(''), 2000);
      setEditing(false);
      onSaved?.({
        songId: savedSongId,
        songKey: finalTrack
          ? `${String(finalTrack.artist).toLowerCase()}||${String(finalTrack.title).toLowerCase()}`
          : `${String((savedTrack?.artist || normalizedMeta.artist)).toLowerCase()}||${String((savedTrack?.title || normalizedMeta.title)).toLowerCase()}`,
        songMeta: finalTrack || savedTrack || { id: savedSongId, ...normalizedMeta },
        entry: savedEntry,
        offset: savedOffset,
        newMode: modeChanged ? editMode : undefined,
        reloadEntry: modeChanged,
      });
    } catch (err) {
      showToast(t('saveError') + ': ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isLocked) {
      showToast(lockMessage, 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest(`${SERVER_URL}/api/admin/song-editor`, {
        method: 'DELETE',
        body: JSON.stringify({ songId }),
      }, lang);
      setDeleteConfirmOpen(false);
      onDeleted?.({ songId, songKey });
      showToast(t('deleteOk'), 'success');
      if (result.removedArtists?.length) {
        onRemovedArtists?.(result.removedArtists);
      }
    } catch (err) {
      showToast(t('deleteError') + ': ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const visibleLines = allLines.slice(0, linesVisible);
  const remaining = allLines.length - linesVisible;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isNight ? 'bg-red-950/10 border-red-900/30' : 'bg-white/5 border-white/10'}`}>
      <ConfirmDialog
        open={tcConfirm}
        isNight={isNight}
        title={t('generateTcTitle')}
        body={t('generateTcBody')}
        yesLabel={t('generateTcYes')}
        noLabel={t('generateTcNo')}
        onYes={handleTcYes}
        onNo={handleTcNo}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        isNight={isNight}
        title={t('confirmDeleteTitle')}
        body={t('confirmDeleteBody')}
        yesLabel={t('confirmDeleteYes')}
        noLabel={t('confirmDeleteNo')}
        onYes={handleDelete}
        onNo={() => setDeleteConfirmOpen(false)}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-black text-sm uppercase truncate text-white">{title}</div>
            {nightMode && (
              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide ${
                currentMode === 'night'
                  ? 'bg-indigo-900/50 text-indigo-300'
                  : 'bg-amber-900/40 text-amber-300'
              }`}>
                {currentMode === 'night' ? t('broadcastNight') : t('broadcastDay')}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 truncate">{displayMeta || artist}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${statusBadge}`}>{statusLabel}</span>
            <span className="text-[10px] text-gray-500">{t('offset')}: <span className={isNight ? 'text-red-300' : 'text-blue-300'}>{rawOffset}s</span></span>
            {savedMsg && <span className="text-[10px] text-emerald-400 font-black">{savedMsg}</span>}
          </div>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${editing ? 'bg-white/10 text-white/60 hover:bg-white/20' : `${accentBtn} text-white`}`}
        >
          {editing ? t('cancelEdit') : t('editBtn')}
        </button>
      </div>

      {!editing && allLines.length > 0 && (
        <div className="rounded-lg bg-black/20 px-3 py-2 space-y-0.5">
          {visibleLines.map((line, i) => <LyricsLine key={i} line={line} synced={entry?.synced} isNight={isNight} />)}
          {remaining > 0 && (
            <button onClick={() => setLinesVisible(allLines.length)} className="mt-1 text-[10px] font-black text-gray-400 hover:text-white transition-colors">
              {t('showMore', { count: remaining })}
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <WaveformPlayer songKey={songKey} isNight={isNight} t={t} markerTime={markerTime} onMarkerChange={setMarkerTime} />

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 text-[11px] font-black text-gray-300">{t('offset')}</div>
              <input type="number" step="0.1" className={`${compactInput} ${inputBorder}`} value={editOffset} onChange={(e) => setEditOffset(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-5 cursor-pointer select-none" onClick={handleSyncedToggle}>
              <div className={`relative w-9 h-5 rounded-full transition-colors ${editSynced ? (isNight ? 'bg-red-700' : 'bg-blue-600') : 'bg-white/20'}`}>
                <div className={`absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white transition-transform ${editSynced ? 'translate-x-4 rtl:-translate-x-4' : ''}`} />
              </div>
              <span className="text-[11px] font-black text-gray-300">{t('synced')}</span>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-black text-gray-300">{t('linesLabel')}</div>
            {editSynced ? (
              <SyncedTextarea value={editText} onChange={setEditText} isNight={isNight} onJumpToTime={handleJumpToTime} t={t} />
            ) : (
              <textarea className={`${compactInput} ${inputBorder} font-mono text-xs leading-relaxed resize-y`} style={{ minHeight: 160 }} value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="text..." spellCheck={false} />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditText('')} className="rounded-xl px-4 py-2 text-xs font-black text-white/80 bg-white/10 transition-all hover:bg-white/20">{t('clearBtn')}</button>
          </div>

          <PrivilegeGate locked={!canEditMeta} lang={lang}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-black text-gray-300">{t('metaTitle')}</div>
              <input className={`${compactInput} ${inputBorder}`} value={editMetaTitle} onChange={(e) => setEditMetaTitle(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-black text-gray-300">{t('metaArtist')}</div>
              <input className={`${compactInput} ${inputBorder}`} value={editMetaArtist} onChange={(e) => setEditMetaArtist(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-black text-gray-300">{t('metaAlbum')}</div>
              <input className={`${compactInput} ${inputBorder}`} value={editMetaAlbum} onChange={(e) => setEditMetaAlbum(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-black text-gray-300">{t('metaYear')}</div>
              <input type="number" className={`${compactInput} ${inputBorder}`} value={editMetaYear} onChange={(e) => setEditMetaYear(e.target.value)} />
            </div>
          </div>

          {canMoveMode && nightMode && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] font-black text-gray-300 uppercase tracking-wide flex-shrink-0">{t('moveToBroadcast')}</span>
              <span className={`text-[11px] font-black transition-colors ${editMode === 'day' ? 'text-amber-300' : 'text-gray-500'}`}>{t('broadcastDay')}</span>
              <div
                onClick={() => setEditMode((m) => m === 'day' ? 'night' : 'day')}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                  editMode === 'night' ? 'bg-indigo-700' : 'bg-amber-600'
                }`}
              >
                <div className={`absolute top-1 start-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  editMode === 'night' ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                }`} />
              </div>
              <span className={`text-[11px] font-black transition-colors ${editMode === 'night' ? 'text-indigo-300' : 'text-gray-500'}`}>{t('broadcastNight')}</span>
              {editMode !== currentMode && (
                <span className="text-[9px] font-black uppercase text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded">
                  {editMode === 'night' ? `→ ${t('broadcastNight')}` : `→ ${t('broadcastDay')}`}
                </span>
              )}
            </div>
          )}
          </PrivilegeGate>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:items-center" title={lockMessage}>
            <PrivilegeGate locked={!canDownload} lang={lang}>
              <button type="button" onClick={handleDownload} disabled={downloading} className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-600 transition-all disabled:opacity-50 w-full sm:w-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? t('downloading') : t('downloadBtn')}
              </button>
            </PrivilegeGate>
            <div className="flex gap-2 justify-end">
              <PrivilegeGate locked={!canDelete} lang={lang}>
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={saving || isLocked} title={lockMessage} className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white transition-all disabled:opacity-50 flex-1 sm:flex-none ${DELETE_BTN}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('deleteBtn')}
                </button>
              </PrivilegeGate>
              <button onClick={handleSave} disabled={saving || isLocked} title={lockMessage} className={`flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-black text-white transition-all disabled:opacity-50 flex-1 sm:flex-none ${accentBtn}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving ? t('saving') : t('saveBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}