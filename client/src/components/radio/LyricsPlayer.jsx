import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { theme } from './utils/theme.js';

const FONT_SIZES = ['text-xs', 'text-base', 'text-lg', 'text-2xl', 'text-4xl', 'text-6xl', 'text-8xl'];

const findActiveIdx = (lines, seekTime, offset = 0) => {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time + offset <= seekTime)  idx = i;
    else break;
  }
  return idx;
};

function LyricsAlignmentButton({ isLeftAligned, onClick, th, t }) {
  const label = isLeftAligned ? t('alignLeftTitle') : t('alignCenterTitle');
  return (
    <button
      onClick={onClick}
      className={th.lyricsControlBtn}
      title={label}
      aria-label={label}
    >
      {isLeftAligned ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M4 6h14" />
          <path d="M4 10h10" />
          <path d="M4 14h14" />
          <path d="M4 18h10" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M5 6h14" />
          <path d="M7 10h10" />
          <path d="M5 14h14" />
          <path d="M7 18h10" />
        </svg>
      )}
    </button>
  );
}

const LYRICS_STYLE = (() => {
  const id  = 'lyrics-keyframes';
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `@keyframes lyricsSlideIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(s);
  }
})();

function LyricsModal({ lyrics, seekRef, sizeIdx, setSizeIdx, alignment, setAlignment, isNight, dayTheme, dayColor, t, onClose }) {
  const th = theme(isNight, dayTheme, dayColor);
  const currSize = FONT_SIZES[sizeIdx];
  const isSynced = lyrics?.synced && lyrics.lines?.length;
  const isLeftAligned = alignment === 'left';
  const bgColor = th.gradientBg;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [activeIdx, setActiveIdx] = useState(-1);
  useEffect(() => {
    if (!isSynced) return;
    let rafId;
    const offset = lyrics.offset || 0;
    const tick = () => {
      const s   = seekRef.current ?? 0;
      const idx = findActiveIdx(lyrics.lines, s, offset);
      setActiveIdx(prev => prev !== idx ? idx : prev);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isSynced, lyrics, seekRef]);

  const containerRef = useRef(null);
  const activeRef    = useRef(null);
  const targetOffsetRef = useRef(0);
  const [offsetY, setOffsetY] = useState(0);
  const recalcOffset = () => {
    if (!containerRef.current || !activeRef.current) return;
    const containerH = containerRef.current.clientHeight;
    const activeTop  = activeRef.current.offsetTop;
    const activeH    = activeRef.current.clientHeight;
    targetOffsetRef.current = activeTop - containerH / 2 + activeH / 2;
  };

  useEffect(() => {
    let raf;
    const tick = () => {
      setOffsetY(prev => {
        const target = targetOffsetRef.current;
        const diff   = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        return prev + diff * 0.12;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    if (!isSynced) return;
    recalcOffset();
  }, [activeIdx, isSynced]);

  useEffect(() => {
    if (!isSynced || !activeRef.current) return;
    const ro = new ResizeObserver(() => recalcOffset());
    ro.observe(activeRef.current);
    return () => ro.disconnect();
  }, [sizeIdx, activeIdx, isSynced]);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col backdrop-blur-sm"
      style={{ background: bgColor }}
      onClick={onClose}
    >
      <div
        className="flex justify-between items-center px-6 py-4 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <h2 className={`text-xl font-semibold ${th.textPanel}`}>{t('lyricsTitle')}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSizeIdx(Math.max(0, sizeIdx - 1))}
            disabled={sizeIdx === 0}
            className={`${th.lyricsControlBtn} disabled:opacity-25 disabled:cursor-not-allowed text-sm font-black`}
          >A–</button>
          <button
            onClick={() => setSizeIdx(Math.min(FONT_SIZES.length - 1, sizeIdx + 1))}
            disabled={sizeIdx === FONT_SIZES.length - 1}
            className={`${th.lyricsControlBtn} disabled:opacity-25 disabled:cursor-not-allowed text-base font-black`}
          >A+</button>
          <LyricsAlignmentButton isLeftAligned={isLeftAligned} onClick={() => setAlignment(prev => prev === 'center' ? 'left' : 'center')} th={th} t={t} />
          <button
            onClick={onClose}
            className={`${th.lyricsControlBtn} ms-2 text-lg font-black`}
          >✕</button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {isSynced ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 z-10"
              style={{ background: `linear-gradient(to bottom, ${bgColor}, transparent)` }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 z-10"
              style={{ background: `linear-gradient(to top, ${bgColor}, transparent)` }} />

            <div
              className={`flex flex-col gap-[1.2em] pt-[50vh] pb-[50vh] ${isLeftAligned ? 'items-start text-left w-full max-w-5xl mx-auto' : 'items-center text-center'}`}
              style={{
                transform: `translate3d(0, ${-offsetY}px, 0)`,
                willChange: 'transform'
              }}
            >
              {lyrics.lines.map((line, i) => (
                <p
                  key={i}
                  ref={i === activeIdx ? activeRef : null}
                  className={`${currSize} font-black leading-[1.35] min-h-[1.35em] ${isLeftAligned ? 'w-full' : ''}`}
                  style={{
                    opacity: i === activeIdx ? 1 : i === activeIdx + 1 ? 0.8 : 0.2,
                    color: i === activeIdx ? th.lyricsActive : th.lyricsLineInactive,
                    transition: 'opacity 0.3s ease, color 0.3s ease',
                  }}                >
                  {line.text}
                </p>
              ))}
            </div>
          </>
        ) : (
          <div
            className={`h-full overflow-y-auto flex flex-col gap-3 pb-8 ${isLeftAligned ? 'items-start text-left w-full max-w-5xl mx-auto' : 'items-center text-center'}`}
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${th.lyricsScrollbar} transparent` }}
          >
            {lyrics.lines.map((line, i) => (
              <p key={i} className={`${currSize} leading-relaxed ${th.lyricsPlainText} transition-all duration-300 ${isLeftAligned ? 'w-full' : ''}`}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LyricsPlayer({ lyrics, lyricsLoading, seek, lyricsSeekRef, isNight, dayTheme, dayColor, t, onModalChange, panelStyle }) {
  const th = theme(isNight, dayTheme, dayColor);
  const [sizeIdx, setSizeIdx] = useState(() => {
    const saved = localStorage.getItem('lyrics_font_size');
    return saved !== null ? parseInt(saved, 10) : 1;
  });
  const [alignment, setAlignment] = useState(() => localStorage.getItem('lyrics_alignment') || 'center');
  const [modalOpen, setModalOpen] = useState(false);

  const openModal  = () => { setModalOpen(true);  onModalChange?.(true);  };
  const closeModal = () => { setModalOpen(false); onModalChange?.(false); };

  const fallbackSeekRef = useRef(seek);
  const seekRef = lyricsSeekRef ?? fallbackSeekRef;

  const setSize = (idx) => {
    setSizeIdx(idx);
    localStorage.setItem('lyrics_font_size', idx);
  };

  const toggleAlignment = () => {
    setAlignment(prev => {
      const next = prev === 'center' ? 'left' : 'center';
      localStorage.setItem('lyrics_alignment', next);
      return next;
    });
  };

  const isLeftAligned = alignment === 'left';
  const currSize = FONT_SIZES[sizeIdx];

  const modal = modalOpen && (
    <LyricsModal
      lyrics={lyrics} seekRef={seekRef}
      sizeIdx={sizeIdx} setSizeIdx={setSize}
      alignment={alignment} setAlignment={setAlignment}
      isNight={isNight} dayTheme={dayTheme} dayColor={dayColor} t={t}
      onClose={closeModal}
    />
  );

  const sizeButtons = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setSize(Math.max(0, sizeIdx - 1))}
        disabled={sizeIdx === 0}
        className={`${th.lyricsControlBtn} disabled:opacity-25 disabled:cursor-not-allowed text-sm font-black`}
      >A–</button>
      <button
        onClick={() => setSize(Math.min(FONT_SIZES.length - 1, sizeIdx + 1))}
        disabled={sizeIdx === FONT_SIZES.length - 1}
        className={`${th.lyricsControlBtn} disabled:opacity-25 disabled:cursor-not-allowed text-base font-black`}
      >A+</button>
      <LyricsAlignmentButton isLeftAligned={isLeftAligned} onClick={toggleAlignment} th={th} t={t} />
      {lyrics && !lyrics.notFound && (
        <button
          onClick={openModal}
          className={`${th.lyricsControlBtn} ms-1`}
          title={t('fullscreenTitle')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
            <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
          </svg>
        </button>
      )}
    </div>
  );

  const header = (
    <div className="flex justify-between items-center mb-4">
      <h2 className={`text-2xl font-semibold ${th.textPanel}`}>{t('lyricsTitle')}</h2>
      {sizeButtons}
    </div>
  );

  if (lyricsLoading) {
    return (
      <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={panelStyle}>
        {header}
        <p className={`${th.lyricsNextLine} text-base text-center animate-pulse`}>{t('lyricsLoading')}</p>
      </div>
    );
  }

  if (!lyrics || lyrics.notFound) {
    return (
      <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={panelStyle}>
        {header}
        <p className={`${th.lyricsNextLine} text-base text-center`}>{t('lyricsNotFound')}</p>
      </div>
    );
  }

  if (lyrics.synced && lyrics.lines?.length) {
    const offset    = lyrics.offset || 0;
    const lyricsSeek = seekRef.current ?? seek;
    const activeIdx  = findActiveIdx(lyrics.lines, lyricsSeek, offset);
    const curr = activeIdx >= 0 ? lyrics.lines[activeIdx] : null;
    const next = activeIdx >= 0 && activeIdx + 1 < lyrics.lines.length
      ? lyrics.lines[activeIdx + 1] : null;

    return (
      <>
        {modal}
        <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={panelStyle}>
          {header}
          <div className={`relative overflow-hidden ${isLeftAligned ? 'text-left' : 'text-center'}`} style={{ minHeight: '4rem' }}>
            <div
              key={`curr-${activeIdx}`}
              style={{ animation: 'lyricsSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both' }}
            >
              {curr ? (
                <>
                  <p className={`${currSize} font-black leading-snug transition-all duration-300 ${isLeftAligned ? 'w-full' : ''} ${th.lyricsActiveLine}`}>
                    {curr.text}
                  </p>
                  {next && (
                    <p className={`${currSize} font-black ${th.lyricsNextLine} leading-snug mt-2 transition-all duration-300 ${isLeftAligned ? 'w-full' : ''}`}>
                      {next.text}
                    </p>
                  )}
                </>
              ) : (
                <p className={`text-base ${th.lyricsWaiting} ${isLeftAligned ? 'text-left' : 'text-center'}`}>♪</p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {modal}
      <div className={`${th.bgPanelCls} rounded-lg p-6 mt-6`} style={panelStyle}>
        {header}
        <div
          className="max-h-64 overflow-y-auto space-y-1 pe-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: `${th.lyricsScrollbarAlt} transparent` }}
        >
          {lyrics.lines.map((line, i) => (
            <p key={i} className={`${currSize} leading-relaxed ${th.lyricsPlainText} transition-all duration-300 ${isLeftAligned ? 'text-left' : 'text-center'}`}>{line}</p>
          ))}
        </div>
      </div>
    </>
  );
}