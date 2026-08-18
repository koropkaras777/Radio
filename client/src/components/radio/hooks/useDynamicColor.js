import { useState, useEffect, useRef } from 'react';
import { TW_COLORS } from '../utils/theme.js';

// ── Color conversion ──────────────────────────────────────────────────────────
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn: h = ((gn - bn) / delta + 6) % 6; break;
      case gn: h = (bn - rn) / delta + 2;        break;
      default: h = (rn - gn) / delta + 4;        break;
    }
    h = (h * 60 + 360) % 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

// ── Tailwind palette (shade 500 as representative) ────────────────────────────
const TW_PALETTE = Object.entries(TW_COLORS)
  .filter(([name]) => !['slate', 'zinc', 'stone'].includes(name))
  .map(([name, shades]) => {
    const hex = shades[500];
    if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
    return { name, hsl: rgbToHsl(hexToRgb(hex)) };
  })
  .filter(Boolean);

// ── Perceptual HSL distance ───────────────────────────────────────────────────
function hslDistance(a, b) {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  return Math.sqrt(
    (dh                  * 2.0) ** 2 +
    (Math.abs(a.s - b.s) * 0.5) ** 2 +
    (Math.abs(a.l - b.l) * 0.3) ** 2
  );
}

// ── Pick the best "theme color" from the image palette ───────────────────────
function pickThemeColor(palette) {
  const n = palette.length || 1;

  const scored = palette.map(([r, g, b], idx) => {
    const hsl = rgbToHsl({ r, g, b });
    const vibrancy = (hsl.l > 15 && hsl.l < 85 && hsl.s > 20)
      ? hsl.s * (1 - Math.abs(hsl.l - 50) / 50)
      : 0;
    return { r, g, b, hsl, score: vibrancy * (1 - (idx / n) * 0.5) };
  });

  const vivid = scored.filter((c) => c.score > 0);
  return vivid.length > 0
    ? vivid.reduce((best, c) => (c.score > best.score ? c : best))
    : scored[0];
}

// ── Find closest Tailwind color ───────────────────────────────────────────────
function findClosestTailwindColor(dominant, palette) {
  const source = pickThemeColor(palette?.length ? palette : [dominant]);

  if (source.hsl.s < 12) return 'gray';

  let best = TW_PALETTE[0];
  let bestDist = Infinity;
  for (const c of TW_PALETTE) {
    const d = hslDistance(source.hsl, c.hsl);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best.name;
}

// ── ColorThief loader (lazy, singleton) ──────────────────────────────────────
let colorThiefInstance = null;
let colorThiefPromise  = null;

function loadColorThief() {
  if (colorThiefInstance) return Promise.resolve(colorThiefInstance);
  if (colorThiefPromise)  return colorThiefPromise;

  colorThiefPromise = new Promise((resolve, reject) => {
    if (window.ColorThief) {
      colorThiefInstance = new window.ColorThief();
      resolve(colorThiefInstance);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js';
    script.onload  = () => { colorThiefInstance = new window.ColorThief(); resolve(colorThiefInstance); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return colorThiefPromise;
}

async function extractColors(src) {
  const ct = await loadColorThief();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        resolve({ dominant: ct.getColor(img), palette: ct.getPalette(img, 8) });
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    // Cache-bust to avoid CORS cache issues
    img.src = src.includes('?') ? src : `${src}?_ct=1`;
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDynamicColor(coverUrl, isDefaultCover, enabled) {
  const [dynamicColor, setDynamicColor] = useState(null);
  const lastCoverRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setDynamicColor(null);
      lastCoverRef.current = null;
      return;
    }

    if (!coverUrl || isDefaultCover) {
      setDynamicColor('blue');
      lastCoverRef.current = null;
      return;
    }

    if (coverUrl === lastCoverRef.current) return;

    let cancelled = false;

    const extract = async () => {
      try {
        const { dominant, palette } = await extractColors(coverUrl);
        if (cancelled) return;
        const color = findClosestTailwindColor(dominant, palette);
        lastCoverRef.current = coverUrl;
        setDynamicColor(color);
      } catch {
        if (!cancelled) lastCoverRef.current = null;
      }
    };

    extract();
    return () => { cancelled = true; };
  }, [coverUrl, isDefaultCover, enabled]);

  return dynamicColor;
}