const KEY_REFRESH_SAFE = 30;

class KeyManager {
  constructor(serverUrl, artToken, uid) {
    this.serverUrl = serverUrl;
    this.artToken = artToken;
    this.uid = uid;
    this._audioToken = null;
    this._expiresAt = 0;
    this._pending = null;
    this._timer = null;
  }

  get audioToken() {
    return this._audioToken;
  }

  async ensureToken() {
    if (this._audioToken && Date.now() < this._expiresAt - KEY_REFRESH_SAFE * 1000) {
      return this._audioToken;
    }
    if (this._pending) return this._pending;
    this._pending = this._fetchToken().finally(() => {
      this._pending = null;
    });
    return this._pending;
  }

  async _fetchToken() {
    const resp = await fetch(`${this.serverUrl}/api/audio-key`, {
      headers: {
        'X-Art-Token': this.artToken,
        'X-Listener-Uid': this.uid,
      },
    });
    if (!resp.ok) throw new Error(`audio-key ${resp.status}`);

    const { token, expiresIn } = await resp.json();
    if (!token) throw new Error('audio-key token missing');

    this._audioToken = token;
    this._expiresAt = Date.now() + (Number(expiresIn || 0) * 1000);

    clearTimeout(this._timer);
    const refreshIn = Math.max(5000, (Number(expiresIn || 0) - KEY_REFRESH_SAFE) * 1000);
    this._timer = setTimeout(() => {
      this._fetchToken().catch(() => {});
    }, refreshIn);

    return this._audioToken;
  }

  destroy() {
    clearTimeout(this._timer);
    this._audioToken = null;
    this._pending = null;
  }
}

function waitForAudioReady(audioEl) {
  if (audioEl.readyState >= 1) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let done = false;

    const cleanup = () => {
      audioEl.removeEventListener('loadedmetadata', onReady);
      audioEl.removeEventListener('loadeddata',     onReady);
      audioEl.removeEventListener('canplay',        onReady);
      audioEl.removeEventListener('error',          onError);
    };

    const finish = (fn) => {
      if (done) return;
      done = true;
      cleanup();
      fn();
    };

    const onReady = () => finish(resolve);
    const onError = () => {
      const err = audioEl.error;
      const msg = err ? `MediaError ${err.code}: ${err.message}` : 'audio element failed to load stream';
      finish(() => reject(new Error(msg)));
    };

    audioEl.addEventListener('loadedmetadata', onReady, { once: true });
    audioEl.addEventListener('loadeddata',     onReady, { once: true });
    audioEl.addEventListener('canplay',        onReady, { once: true });
    audioEl.addEventListener('error',          onError, { once: true });
    audioEl.load();
  });
}

export class EncryptedAudioPlayer {
  constructor(audioEl, serverUrl, artToken, uid) {
    this.audioEl = audioEl;
    this.serverUrl = serverUrl;
    this.keyMgr = new KeyManager(serverUrl, artToken, uid);
    this._trackId = null;
    this._destroyed = false;
    this._loadingPromise = null;
    this._streamUrl = null;
  }

  async load(trackId, startSeek = 0) {
    if (this._destroyed) return;
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = this._loadInternal(trackId, startSeek).finally(() => {
      this._loadingPromise = null;
    });
    return this._loadingPromise;
  }

  async _loadInternal(trackId, startSeek = 0) {
    this._trackId = trackId;

    const audioToken = await this.keyMgr.ensureToken();
    if (this._destroyed) return;

    const url = new URL(`${this.serverUrl}/api/audio/stream`);
    url.searchParams.set('track',      trackId);
    url.searchParams.set('artToken',   this.keyMgr.artToken);
    url.searchParams.set('audioToken', audioToken);

    const nextUrl    = url.toString();
    const currentUrl = this.audioEl.getAttribute('src') || '';

    if (currentUrl !== nextUrl) {
      this._streamUrl = nextUrl;
      this.audioEl.pause();
      this.audioEl.referrerPolicy = 'no-referrer';
      this.audioEl.src     = nextUrl;
      this.audioEl.preload = 'auto';
    }

    await waitForAudioReady(this.audioEl);
    if (this._destroyed) return;

    const safeSeek = Math.max(0, Number(startSeek) || 0);
    if (safeSeek > 0 && Math.abs(this.audioEl.currentTime - safeSeek) > 0.35) {
      try { this.audioEl.currentTime = safeSeek; } catch {}
    }
  }

  async seek(seek) {
    if (this._destroyed) return;
    const safeSeek = Math.max(0, Number(seek) || 0);
    try {
      this.audioEl.currentTime = safeSeek;
    } catch {}
  }

  destroy() {
    this._destroyed = true;
    this.keyMgr.destroy();
    this._trackId = null;
    this._streamUrl = null;

    try {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    } catch {}
  }
}