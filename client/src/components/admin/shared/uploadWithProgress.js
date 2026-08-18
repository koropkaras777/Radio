import { pickLocalized, getAuthHeaders } from '../../../i18n/serverMessage.js';

// ─── uploadFileWithProgress ─────────────────────────────────────────────────
export const uploadFileWithProgress = ({ url, file, lang, onProgress, signal }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;

    const headers = getAuthHeaders();
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror  = () => reject(new Error('Network error'));
    xhr.onabort  = () => reject(Object.assign(new Error('aborted'), { aborted: true }));
    xhr.onload   = () => {
      let payload = {};
      try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { payload = {}; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(payload); return; }
      reject(new Error(pickLocalized(payload.localized || payload.message || payload.error, lang) || `HTTP ${xhr.status}`));
    };

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });