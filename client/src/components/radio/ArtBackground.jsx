import { BLUR_PX } from '../../config/constants.js';

export function ArtBackground({ artSrc, artOpacity }) {
  if (!artSrc) return null;
  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <img
        src={artSrc}
        alt=""
        style={{
          position : 'absolute',
          top      : 0,
          left     : '50%',
          transform: 'translateX(-50%)',
          height   : '100vh',
          width    : 'auto',
          objectFit: 'cover',
          filter   : `blur(${BLUR_PX}px)`,
          opacity  : artOpacity,
          transition: 'opacity 0.5s linear',
          willChange: 'opacity',
        }}
      />
    </div>
  );
}