import {
  BIBLE_BLACK_START, BIBLE_BLACK_END,
  BIBLE_BLACK_HELL_START, BIBLE_BLACK_HELL_END,
  RAINBOW_ARCS,
} from '../../config/easterConstants.js';

export function EasterEggs({
  zone,
  isSabbathFamily,
  isBibleBlack,
  isRainbowActive,
  isHammerTrack,
  seek,
  duration,
  henryColor,
}) {

  // ─── Henry (Black Sabbath / Heaven & Hell) ──────────────
  if (zone === 'title') {
    if (!isSabbathFamily) return null;

    const henryProgress = duration > 0 ? (seek / duration) * 100 : 0;

    if (!isBibleBlack) {
      let opacity = 0;
      let top     = '100%';

      if (henryProgress <= 33.3) {
        const p = henryProgress / 33.3;
        opacity = p * 0.5;
        top     = `${100 - p * 50}%`;
      } else if (henryProgress <= 66.6) {
        opacity = 0.5;
        top     = '50%';
      } else {
        const p = Math.min((henryProgress - 66.6) / 33.4, 1);
        opacity = 0.5 * (1 - p);
        top     = '50%';
      }

      return (
        <div
          aria-hidden="true"
          style={{
            position           : 'absolute',
            left               : '50%',
            top,
            transform          : 'translate(-50%, -50%)',
            width              : '180px',
            height             : '180px',
            opacity,
            zIndex             : 0,
            pointerEvents      : 'none',
            backgroundColor    : henryColor,
            WebkitMaskImage    : 'url(/svg/henry.svg)',
            maskImage          : 'url(/svg/henry.svg)',
            WebkitMaskRepeat   : 'no-repeat',
            maskRepeat         : 'no-repeat',
            WebkitMaskPosition : 'center',
            maskPosition       : 'center',
            WebkitMaskSize     : 'contain',
            maskSize           : 'contain',
            filter             : 'drop-shadow(0 0 4px rgba(0,0,0,0.2))',
            transition         : 'filter 1s linear, opacity 1s linear, background-color 0.4s ease',
          }}
        />
      );
    }

    // ── Bible Black ───────────────────────────────────
    const hellTransitionProgress =
      seek >= BIBLE_BLACK_HELL_START && seek < BIBLE_BLACK_HELL_END
        ? Math.min((seek - BIBLE_BLACK_HELL_START) / (BIBLE_BLACK_HELL_END - BIBLE_BLACK_HELL_START), 1)
        : seek >= BIBLE_BLACK_HELL_END ? 1 : 0;

    let phase = 'angel';
    if (duration > 0) {
      if      (seek >  BIBLE_BLACK_END)       phase = 'fadeout';
      else if (seek >= BIBLE_BLACK_START)      phase = 'demon';
      else if (seek >= BIBLE_BLACK_START - 5)  phase = 'rising';
      else if (seek >= BIBLE_BLACK_HELL_END)   phase = 'hell';
      else if (seek >= BIBLE_BLACK_HELL_START) phase = 'transition';
      else                                     phase = 'angel';
    }

    const hellVisible = (phase === 'hell' || phase === 'rising') ? 1 : 0;

    const angelBottomTop = 'calc(100% + 5px)';
    const demonTop       = '50%';

    let opacity = 0;
    let top     = angelBottomTop;
    let filter  = 'sepia(0.2) brightness(1.2)';
    let shadow  = 'none';

    if (phase === 'angel') {
      const fadeIn = Math.min(seek / 15, 1);
      opacity = 0.85 * fadeIn;
      top     = angelBottomTop;
      filter  = 'brightness(1.1) saturate(1.1)';
      shadow  = 'drop-shadow(0 4px 18px rgba(0,0,0,0.7)) drop-shadow(0 2px 8px rgba(0,0,0,0.5))';
    } else if (phase === 'transition') {
      const p = hellTransitionProgress;
      opacity = 0.85;
      top     = angelBottomTop;
      filter  = `brightness(${1.1 - p * 0.2}) saturate(${1.1 + p * 0.5})`;
      shadow  = `drop-shadow(0 4px 18px rgba(${Math.round(p * 120)},0,0,${0.5 + p * 0.3})) drop-shadow(0 2px 8px rgba(0,0,0,0.5))`;
    } else if (phase === 'hell') {
      opacity = 0.85;
      top     = angelBottomTop;
      filter  = 'brightness(0.9) saturate(1.6)';
      shadow  = 'drop-shadow(0 4px 20px rgba(180,0,0,0.75)) drop-shadow(0 2px 8px rgba(255,50,0,0.4))';
    } else if (phase === 'rising') {
      opacity = 0.85;
      top     = demonTop;
      filter  = 'brightness(0.9) saturate(1.6)';
      shadow  = 'drop-shadow(0 4px 20px rgba(180,0,0,0.75)) drop-shadow(0 2px 8px rgba(255,50,0,0.4))';
    } else if (phase === 'demon') {
      const fp = Math.min(seek - BIBLE_BLACK_START, 1);
      opacity  = 0.5 + fp * 0.5;
      top      = demonTop;
      filter   = `brightness(${1 - fp})`;
      shadow   = `drop-shadow(0 0 ${15 * fp}px rgba(255,69,0,0.9)) drop-shadow(0 0 5px rgba(255,140,0,1))`;
    } else if (phase === 'fadeout') {
      const pp = Math.min((seek - BIBLE_BLACK_END) / (duration - BIBLE_BLACK_END), 1);
      opacity  = 1 - pp;
      top      = demonTop;
      filter   = 'brightness(0)';
      shadow   = `drop-shadow(0 0 ${15 * (1 - pp)}px rgba(255,69,0,0.5))`;
    }

    const isDemon = phase === 'demon' || phase === 'fadeout';

    const commonImgStyle = {
      position     : 'absolute',
      left         : '50%',
      transform    : 'translate(-50%, -50%)',
      height       : '120px',
      width        : 'auto',
      zIndex       : 0,
      pointerEvents: 'none',
      filter       : `${filter} ${shadow}`,
      transition   : 'top 5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 1s ease, filter 1s linear',
    };

    return (
      <>
        <img
          src="/img/henry_heaven.png"
          alt="Henry Angel"
          style={{ ...commonImgStyle, top, opacity: isDemon ? 0 : opacity * (1 - hellVisible) }}
        />

        <img
          src="/img/henry_hell.png"
          alt="Henry Hell"
          style={{ ...commonImgStyle, top, opacity: isDemon ? 0 : opacity * hellVisible }}
        />

        {isDemon && (
          <img
            src="/svg/henry.svg"
            alt="Sabbath Symbol"
            style={{
              position     : 'absolute',
              left         : '50%',
              top,
              transform    : 'translate(-50%, -50%)',
              height       : '180px',
              width        : 'auto',
              opacity,
              zIndex       : 0,
              pointerEvents: 'none',
              filter       : `${filter} ${shadow}`,
              transition   : 'opacity 0.7s ease, filter 1s linear',
            }}
          />
        )}
      </>
    );
  }

  // ─── Rainbow ────────────────────────────────────
  if (zone === 'player') {
    return (
      <div
        className={`absolute left-0 right-0 top-[] w-full aspect-[2/1] z-[-1] pointer-events-none -translate-y-full transition-opacity duration-1000 ${
          isRainbowActive ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <svg viewBox="0 0 100 50" className="w-full h-full" style={{ display: 'block' }}>
          {RAINBOW_ARCS.map((arc, i) => {
            const circ     = Math.PI * arc.r;
            const progress = duration > 0 ? seek / duration : 0;
            return (
              <circle
                key={i}
                cx="50" cy="50" r={arc.r}
                fill="none"
                stroke={arc.color}
                strokeWidth="4"
                strokeDasharray={circ}
                style={{
                  strokeDashoffset: isRainbowActive ? circ * (1 - progress) : circ,
                  transition      : 'stroke-dashoffset 0.15s linear',
                }}
                strokeLinecap="round"
                transform="rotate(-180 50 50)"
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // ─── HammerFall ────────────────────────────────
  if (zone === 'connection') {
    if (!isHammerTrack) return null;

    return (
      <img
        src="/svg/hammer.svg"
        alt="Hammer"
        className={`absolute z-0 w-[160px] h-[160px] pointer-events-none ease-in transition-all duration-1000 ${
          seek > 1.2
            ? 'opacity-100 translate-y-[-120px] translate-x-[-75px] rotate-[210deg]'
            : 'opacity-0  translate-y-[-120px] translate-x-[-75px] rotate-[360deg]'
        }`}
        style={{
          filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.9)) drop-shadow(0 0 28px rgba(255,69,0,0.7))',
          left  : 'calc(50% + 40px)',
          top   : '-10px',
        }}
      />
    );
  }

  return null;
}