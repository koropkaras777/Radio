// ─── Shared client constants ──────────────────────────────────────────────────
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://192.168.31.213:3001'; //http://localhost:3001

export const VISIBLE_LISTENERS = 3;

export const ARTIST_ARTS_PATH    = '/arts';

export const FADE_IN_S   = 15;
export const FADE_OUT_S  = 15;
export const MAX_OPACITY = 0.7;
export const BLUR_PX     = 8;

// ─── Available day theme accent colors ───────────────────────────────────────
export const DAY_COLORS = [
  'slate',
  'gray',
  'zinc',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

export const DEFAULT_DAY_COLOR = 'blue';