import { SERVER_URL } from '../../../config/constants.js';

export class StreamPlayer {
  #audio      = null;
  #artToken   = null;
  #connected  = false;
  #onError    = null;
  #onPlaying  = null;
  #playingCb  = null;
  #errorCb    = null;
  #playSeq    = 0;

  constructor({ onError, onPlaying } = {}) {
    this.#onError   = onError   || (() => {});
    this.#onPlaying = onPlaying || (() => {});
  }

  connect(artToken, audioEl) {
    if (!artToken || !audioEl) return;

    this.#artToken = artToken;

    if (this.#audio && this.#audio !== audioEl) {
      this.#detachListeners(this.#audio);
    }

    this.#audio = audioEl;
    this.#attachListeners(audioEl);
    this.#connected = true;
  }

  #attachListeners(audioEl) {
    this.#detachListeners(audioEl);

    this.#playingCb = () => this.#onPlaying();
    this.#errorCb   = (e) => {
      console.error('[StreamPlayer] Audio error:', e);
      this.#onError(e);
    };

    audioEl.addEventListener('playing', this.#playingCb);
    audioEl.addEventListener('error',   this.#errorCb);
  }

  #detachListeners(audioEl) {
    if (this.#playingCb) audioEl.removeEventListener('playing', this.#playingCb);
    if (this.#errorCb)   audioEl.removeEventListener('error',   this.#errorCb);
  }

  async play() {
    if (!this.#audio || !this.#artToken) return false;

    const seq = ++this.#playSeq;
    const url = `${SERVER_URL}/api/stream?token=${encodeURIComponent(this.#artToken)}&_t=${Date.now()}`;

    this.#audio.src     = url;
    this.#audio.preload = 'auto';
    this.#audio.load();

    if (seq !== this.#playSeq) return false;

    try {
      await this.#audio.play();
      return seq === this.#playSeq;
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[StreamPlayer] Play error:', err);
      }
      return false;
    }
  }

  pause() {
    ++this.#playSeq;
    this.#audio?.pause();
  }

  flush() {
    ++this.#playSeq;
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.removeAttribute('src');
      this.#audio.load();
    }
  }

  disconnect() {
    ++this.#playSeq;
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.removeAttribute('src');
      this.#audio.load();
      this.#detachListeners(this.#audio);
    }
    this.#audio     = null;
    this.#artToken  = null;
    this.#connected = false;
  }

  updateToken(newToken) {
    if (!newToken || newToken === this.#artToken) return;
    this.#artToken = newToken;
    const wasPlaying = this.#audio && !this.#audio.paused && !!this.#audio.src;
    if (wasPlaying) this.play();
  }

  get isConnected() { return this.#connected; }
}