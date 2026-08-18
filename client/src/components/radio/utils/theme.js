// ─── Tailwind color hex values (exported for UI color swatches) ───────────────
export const TW_COLORS = {
  slate:   { 200:'#cbd5e1', 300:'#94a3b8', 400:'#94a3b8', 500:'#64748b', 600:'#475569', 700:'#334155', 800:'#1e293b', 900:'#0f172a', 950:'#020617' },
  gray:    { 200:'#e5e7eb', 300:'#d1d5db', 400:'#9ca3af', 500:'#6b7280', 600:'#4b5563', 700:'#374151', 800:'#1f2937', 900:'#111827', 950:'#030712' },
  zinc:    { 200:'#e4e4e7', 300:'#d4d4d8', 400:'#a1a1aa', 500:'#71717a', 600:'#52525b', 700:'#3f3f46', 800:'#27272a', 900:'#18181b', 950:'#09090b' },
  stone:   { 200:'#e7e5e4', 300:'#d6d3d1', 400:'#a8a29e', 500:'#78716c', 600:'#57534e', 700:'#44403c', 800:'#292524', 900:'#1c1917', 950:'#0c0a09' },
  red:     { 200:'#fecaca', 300:'#fca5a5', 400:'#f87171', 500:'#ef4444', 600:'#dc2626', 700:'#b91c1c', 800:'#991b1b', 900:'#7f1d1d', 950:'#450a0a' },
  orange:  { 200:'#fed7aa', 300:'#fdba74', 400:'#fb923c', 500:'#f97316', 600:'#ea580c', 700:'#c2410c', 800:'#9a3412', 900:'#7c2d12', 950:'#431407' },
  amber:   { 200:'#fde68a', 300:'#fcd34d', 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706', 700:'#b45309', 800:'#92400e', 900:'#78350f', 950:'#451a03' },
  yellow:  { 200:'#fef08a', 300:'#fde047', 400:'#facc15', 500:'#eab308', 600:'#ca8a04', 700:'#a16207', 800:'#854d0e', 900:'#713f12', 950:'#422006' },
  lime:    { 200:'#d9f99d', 300:'#bef264', 400:'#a3e635', 500:'#84cc16', 600:'#65a30d', 700:'#4d7c0f', 800:'#3f6212', 900:'#365314', 950:'#1a2e05' },
  green:   { 200:'#bbf7d0', 300:'#86efac', 400:'#4ade80', 500:'#22c55e', 600:'#16a34a', 700:'#15803d', 800:'#166534', 900:'#14532d', 950:'#052e16' },
  emerald: { 200:'#a7f3d0', 300:'#6ee7b7', 400:'#34d399', 500:'#10b981', 600:'#059669', 700:'#047857', 800:'#065f46', 900:'#064e3b', 950:'#022c22' },
  teal:    { 200:'#99f6e4', 300:'#5eead4', 400:'#2dd4bf', 500:'#14b8a6', 600:'#0d9488', 700:'#0f766e', 800:'#115e59', 900:'#134e4a', 950:'#042f2e' },
  cyan:    { 200:'#a5f3fc', 300:'#67e8f9', 400:'#22d3ee', 500:'#06b6d4', 600:'#0891b2', 700:'#0e7490', 800:'#155e75', 900:'#164e63', 950:'#083344' },
  sky:     { 200:'#bae6fd', 300:'#7dd3fc', 400:'#38bdf8', 500:'#0ea5e9', 600:'#0284c7', 700:'#0369a1', 800:'#075985', 900:'#0c4a6e', 950:'#082f49' },
  blue:    { 200:'#c8d9f5', 300:'#d6e4f7', 'panel-alt':'#bfd0ee', 400:'#60a5fa', 500:'#3b82f6', 600:'#2563eb', 700:'#1d4ed8', 800:'#1e40af', 900:'#1e3a8a', 950:'#172554' },
  indigo:  { 200:'#c7d2fe', 300:'#a5b4fc', 400:'#818cf8', 500:'#6366f1', 600:'#4f46e5', 700:'#4338ca', 800:'#3730a3', 900:'#312e81', 950:'#1e1b4b' },
  violet:  { 200:'#ddd6fe', 300:'#c4b5fd', 400:'#a78bfa', 500:'#8b5cf6', 600:'#7c3aed', 700:'#6d28d9', 800:'#5b21b6', 900:'#4c1d95', 950:'#2e1065' },
  purple:  { 200:'#e9d5ff', 300:'#d8b4fe', 400:'#c084fc', 500:'#a855f7', 600:'#9333ea', 700:'#7e22ce', 800:'#6b21a8', 900:'#581c87', 950:'#3b0764' },
  fuchsia: { 200:'#f5d0fe', 300:'#f0abfc', 400:'#e879f9', 500:'#d946ef', 600:'#c026d3', 700:'#a21caf', 800:'#86198f', 900:'#701a75', 950:'#4a044e' },
  pink:    { 200:'#fbcfe8', 300:'#f9a8d4', 400:'#f472b6', 500:'#ec4899', 600:'#db2777', 700:'#be185d', 800:'#9d174d', 900:'#831843', 950:'#500724' },
  rose:    { 200:'#fecdd3', 300:'#fda4af', 400:'#fb7185', 500:'#f43f5e', 600:'#e11d48', 700:'#be123c', 800:'#9f1239', 900:'#881337', 950:'#4c0519' },
};
const TW = TW_COLORS;

// ─── Night palette (SOSUN) - fixed ───────────────────────────────────────────
export const night = {
  vars: {
    '--color-base':      '#0f0505',
    '--color-panel':     '#1a0505',
    '--color-panel-alt': '#2d1212',
    '--color-toast':     '#4a0404',
    '--color-accent':    '#bc0000',
    '--color-overlay':   'rgba(10,0,0,0.96)',
  },

  bgBaseCls:   'bg-[var(--color-base)]',
  bgPanelCls:  'bg-[var(--color-panel)]',
  bgPanelAlt:  'bg-[var(--color-panel-alt)]',
  bgToast:     'var(--color-toast)',
  bgToastBorder: '#991b1b',

  accent:        'var(--color-accent)',
  accentBtn:     'bg-red-700 hover:bg-red-600',
  accentBtnSm:   'bg-red-600 hover:bg-red-500',
  accentBg:      'bg-red-600 hover:bg-red-500',
  accentInactive:'text-gray-400 hover:text-white hover:bg-white/10',
  accentActive:  'bg-red-700 text-white',
  accentGlow:    'bg-[#8a0303] hover:bg-[#a00404] shadow-[0_0_15px_rgba(138,3,3,0.4)]',
  accentPulse:   'bg-[#bc0000] shadow-[0_0_8px_rgba(188,0,0,0.5)]',

  border:        'border-red-900/40',
  borderFocus:   'focus:border-red-600',
  borderActive:  'border-red-500',
  borderCard:    'border-red-900/30',
  borderToast:   'border border-red-900',

  text:          'text-red-200',
  textMuted:     'text-red-400',
  textFaint:     'text-red-400/60',
  textStrong:    'text-[#bc0000]',
  textDim:       'text-red-900/60',
  textError:     'text-red-500',

  cardSubtle:    'bg-red-950/90 border-red-900/40',
  cardSubtleHov: 'bg-red-950/20 border-red-900/30 hover:border-red-600',
  cardAlert:     'bg-red-900/10 border border-red-900/20',
  cardError:     'bg-red-900/40 text-red-500 border border-red-500/30',

  orderBtn:      'bg-orange-700 hover:bg-orange-600',
  orderCard:     'bg-orange-950/20 border-orange-900/30 hover:border-orange-600',

  headingColor:  'rgb(255,255,255)',
  headingStroke: '1px #4a0404',
  headingShadow: 'none',
  lyricsActive:  'rgb(254,205,211)',
  gradientBg:    'var(--color-overlay)',
  borderRaw:     'rgba(153,27,27,0.4)',
  shadowGlow:    '0 0 15px var(--color-accent)',
  shadowGlowRgb: '0 0 15px rgba(188,0,0,0.3)',

  textPanel:          'text-gray-400',
  textDimLabel:       'text-red-900/60',
  hiddenCountBadge:   'bg-[#3d1414]/80 border-[#4a0404] text-[#ff0000]',
  hiddenDropdown:     'bg-[var(--color-panel)]/70 border border-[#4a0404]/50',
  hiddenDropdownHdr:  'text-red-900 border-red-900/30',
  hiddenName:         'text-gray-200',
  progressTrack:      'bg-[#2d1212]',
  progressBar:        'bg-[#bc0000] shadow-[0_0_8px_rgba(188,0,0,0.5)]',
  volumeBar:          'bg-red-950/90 border-red-500/30 rounded-t-2xl',
  accentInput:        'accent-red-500',
  blurBtn:            'bg-red-900/40 text-red-500 border border-red-500/30',
  blurredPlaylistItem:'bg-red-900/10 border border-red-900/20',
  textAccentMuted:    'text-red-400',
  miniPlayerBtn:      'bg-[#3a1010] hover:bg-[#511414] text-red-200',
  coverBackground:    'bg-black/60',
  coverBorder:        'border-red-900/30',
  titleColor:         'text-[#bc0000]',
  coverTitleColor:    'text-[#bc0000]',
  checkboxActive:     'bg-red-600 border-red-600',
  cookieBanner:       'bg-[var(--color-base)]/70 border-red-900/30 text-gray-300',
  pipCoverBorder:     'border-red-900/30',
  pipMuteBtn:         'bg-red-900/30 hover:bg-red-800/40 text-red-200',
  lyricsActiveLine:   'text-red-200',
  lyricsControlBtn:   'w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all',
  lyricsScrollbar:    'rgba(150,150,150,0.2)',
  lyricsScrollbarAlt: 'rgba(150,150,150,0.3)',
  lyricsLineInactive: 'rgb(156,163,175)',
  lyricsPlainText:    'text-gray-300',
  lyricsNextLine:     'text-gray-500',
  lyricsWaiting:      'text-gray-600',
  textSecondary:      'text-gray-300',
  textSubtle:         'text-gray-500',
  textMono:           'text-gray-400',
  controlBtn:         'w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all',
  checkboxLabel:      'text-sm text-gray-400 hover:text-white transition-colors',
  playlistTrackNum:   'text-gray-500 font-mono text-xs',
  playlistArtist:     'text-gray-400 text-xs truncate',
  settingLabel:       'text-sm text-gray-300 group-hover:text-white transition-colors select-none',
  settingsSectionLabel:'text-[10px] uppercase tracking-widest text-gray-500 mb-2 select-none',
  settingsIcon:       'text-gray-300',
  settingsBorder:     'border-white/10',
  dayThemeInactive:   'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20',
  toastSuccess:       'bg-emerald-950/80 border-emerald-500/40 text-emerald-200',
  toastInfo:          'bg-gray-900/80 border-gray-500/40 text-gray-200',
  toastError:         'bg-red-950/80 border-red-500/40 text-red-200',
  coverText:          'text-gray-200',
  coverTextMuted:     'text-gray-300',
  henryColor:         '#fca5a5',
  tileBg:             'bg-red-900',
  tileInput:          'bg-red-900 text-white placeholder-gray-100 focus:ring-gray-500',
  artPanelBg:         'rgba(31,41,55,',
};

// ─── Day theme generator ──────────────────────────────────────────────────────

/**
 * @param {string}        color    - Tailwind color name (e.g. 'blue', 'rose')
 * @param {'dark'|'light'} variant
 */
export const buildDayTheme = (color = 'blue', variant = 'dark') => {
  const c = TW[color] || TW.blue;
  const isLight = variant === 'light';

  const vars = isLight
    ? {
        '--color-base':      c[200],
        '--color-panel':     c[300],
        '--color-panel-alt': c['panel-alt'] || c[200],
        '--color-toast':     c[900],
        '--color-accent':    c[700],
        '--color-overlay':   hexToRgba(c[200], 0.97),
      }
    : {
        '--color-base':      TW.gray[900],
        '--color-panel':     TW.gray[800],
        '--color-panel-alt': TW.gray[800],
        '--color-toast':     TW.gray[800],
        '--color-accent':    c[600],
        '--color-overlay':   'rgba(15,15,25,0.97)',
      };

  return {
    vars,

    bgBaseCls:   'bg-[var(--color-base)]',
    bgPanelCls:  'bg-[var(--color-panel)]',
    bgPanelAlt:  'bg-[var(--color-panel-alt)]',
    bgToast:     'var(--color-toast)',
    bgToastBorder: isLight ? c[400] : 'transparent',

    accent:        'var(--color-accent)',
    accentBtn:     isLight ? 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)]' : 'bg-[var(--brand-600)] hover:bg-[var(--brand-500)]',
    accentBtnSm:   isLight ? 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)]' : 'bg-[var(--brand-600)] hover:bg-[var(--brand-500)]',
    accentBg:      isLight ? 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)]' : 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)]',
    accentInactive: isLight
      ? 'text-[var(--brand-700)] hover:text-white hover:bg-white/10'
      : 'text-gray-400 hover:text-white hover:bg-white/10',
    accentActive:  isLight ? 'bg-[var(--brand-700)] text-white' : 'bg-[var(--brand-600)] text-white',
    accentGlow:    isLight
      ? 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)] shadow-[0_0_15px_rgba(0,0,0,0.2)]'
      : 'bg-[var(--brand-700)] hover:bg-[var(--brand-600)]',
    accentPulse:   isLight ? 'bg-[var(--brand-700)]' : 'bg-[var(--brand-600)]',

    border:        isLight ? 'border-[var(--brand-400)]' : 'border-white/10',
    borderFocus:   isLight ? 'focus:border-[var(--brand-600)]' : 'focus:border-[var(--brand-500)]',
    borderActive:  isLight ? 'border-[var(--brand-600)]' : 'border-[var(--brand-500)]',
    borderCard:    isLight ? 'border-[rgb(var(--brand-300-rgb)/0.6)]' : 'border-white/10',
    borderToast:   isLight ? 'border border-[var(--brand-400)]' : '',

    text:          isLight ? 'text-white' : 'text-white',
    textMuted:     isLight ? 'text-[var(--brand-900)]' : 'text-gray-400',
    textFaint:     isLight ? 'text-[rgb(var(--brand-700-rgb)/0.7)]' : 'text-[rgb(var(--brand-400-rgb)/0.6)]',
    textStrong:    isLight ? 'text-[var(--brand-900)]' : 'text-white',
    textDim:       isLight ? 'text-[var(--brand-700)]' : 'text-gray-500',
    textError:     isLight ? 'text-red-600' : 'text-red-400',

    cardSubtle:    isLight
      ? 'bg-[var(--color-panel)] border border-[rgb(var(--brand-300-rgb)/0.6)]'
      : 'border-white/10 bg-[var(--color-panel)]',
    cardSubtleHov: isLight
      ? 'bg-[var(--color-panel)] border-[rgb(var(--brand-300-rgb)/0.6)] hover:border-[var(--brand-500)]'
      : `bg-[var(--color-panel)] border-white/10 hover:border-gray-500`,
    cardAlert:     isLight
      ? 'bg-[rgb(var(--brand-300-rgb)/0.4)] border border-[var(--brand-300)]'
      : 'bg-[rgb(var(--brand-600-rgb)/0.1)] border border-[rgb(var(--brand-600-rgb)/0.2)]',
    cardError:     isLight
      ? 'bg-red-100 text-red-700 border border-red-300'
      : 'bg-red-900/40 text-red-400 border border-red-500/30',

    orderBtn:      `bg-orange-500 hover:bg-orange-400`,
    orderCard:     isLight
      ? 'bg-[var(--color-panel)] border-[rgb(var(--brand-300-rgb)/0.6)] hover:border-[var(--brand-500)]'
      : `bg-[var(--color-panel)] border-white/10 hover:border-gray-500`,

    headingColor:  isLight ? 'var(--color-accent)' : 'rgb(255,255,255)',
    headingStroke: 'none',
    headingShadow: isLight
      ? `0 2px 12px ${hexToRgba(c[600], 0.2)}`
      : '0 2px 10px rgba(0,0,0,0.1)',
    lyricsActive:  isLight ? c[900] : 'rgb(255,255,255)',
    gradientBg:    'var(--color-overlay)',
    borderRaw:     isLight ? hexToRgba(c[300], 0.7) : 'rgba(255,255,255,0.15)',
    shadowGlow:    'none',
    shadowGlowRgb: 'none',

    textPanel:          isLight ? 'text-[var(--brand-800)]' : 'text-gray-400',
    textDimLabel:       isLight ? 'text-[var(--brand-700)]' : 'text-gray-500',
    hiddenCountBadge:   isLight
      ? 'bg-[var(--brand-300)] border-[var(--brand-400)] text-[var(--brand-900)]'
      : 'bg-gray-700/80 border-white text-white',
    hiddenDropdown:     isLight
      ? 'bg-[rgb(var(--color-base-rgb)/0.9)] border border-[rgb(var(--brand-300-rgb)/0.7)]'
      : 'bg-white/70 border border-gray-200/50',
    hiddenDropdownHdr:  isLight
      ? 'text-[var(--brand-900)] border-[var(--brand-300)]'
      : 'text-gray-800 border-gray-100',
    hiddenName:         isLight ? 'text-[var(--brand-900)]' : 'text-gray-700',
    progressTrack:      isLight ? 'bg-[var(--brand-400)]' : 'bg-gray-700',
    progressBar:        isLight
      ? 'bg-[var(--brand-700)] shadow-[0_0_8px_rgba(0,0,0,0.2)]'
      : 'bg-[var(--brand-600)]',
    volumeBar:          isLight
      ? 'bg-[rgb(var(--color-panel-alt-rgb)/0.9)] border-[rgb(var(--brand-400-rgb)/0.5)] rounded-t-2xl'
      : 'bg-[rgb(var(--brand-600-rgb)/0.2)] border-[rgb(var(--brand-400-rgb)/0.3)] rounded-t-2xl',
    accentInput:        isLight ? 'accent-[var(--brand-700)]' : 'accent-[var(--brand-500)]',
    blurBtn:            isLight
      ? 'bg-[var(--brand-300)] text-[var(--brand-800)] border border-[var(--brand-400)]'
      : 'bg-[rgb(var(--brand-600-rgb)/0.2)] text-[var(--brand-400)] border border-[rgb(var(--brand-500-rgb)/0.3)]',
    blurredPlaylistItem: isLight
      ? 'bg-[rgb(var(--brand-200-rgb)/0.6)] border border-[var(--brand-200)]'
      : 'bg-[rgb(var(--brand-600-rgb)/0.1)] border border-[rgb(var(--brand-600-rgb)/0.2)]',
    textAccentMuted:    isLight ? 'text-[var(--brand-800)]' : 'text-[var(--brand-400)]',
    miniPlayerBtn:      isLight
      ? 'bg-[var(--brand-300)] hover:bg-[var(--brand-400)] text-[var(--brand-900)]'
      : 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    coverBackground:    isLight ? 'bg-[rgb(var(--brand-300-rgb)/0.6)]' : 'bg-black/60',
    coverBorder:        isLight ? 'border-[var(--brand-300)]' : 'border-[rgb(var(--brand-600-rgb)/0.3)]',
    titleColor:         isLight ? 'text-[var(--brand-900)]' : 'text-[var(--brand-400)]',
    coverTitleColor:    isLight ? 'text-[var(--brand-900)]' : 'text-[var(--brand-400)]',
    checkboxActive:     isLight ? 'bg-[var(--brand-700)] border-[var(--brand-700)]' : 'bg-[var(--brand-500)] border-[var(--brand-500)]',
    cookieBanner:       isLight
      ? 'bg-[var(--color-base)]/85 border-[var(--brand-300)] text-[var(--brand-900)]'
      : 'bg-gray-900/70 border-gray-700 text-gray-300',
    pipCoverBorder:     isLight ? 'border-[var(--brand-300)]' : 'border-[rgb(var(--brand-600-rgb)/0.3)]',
    pipMuteBtn:         isLight
      ? 'bg-[var(--brand-300)] hover:bg-[var(--brand-400)] text-[var(--brand-900)]'
      : 'bg-white/10 hover:bg-white/20 text-white',
    lyricsActiveLine:   isLight ? 'text-[var(--brand-900)]' : 'text-white',
    lyricsControlBtn:   isLight
      ? 'w-7 h-7 rounded flex items-center justify-center text-[var(--brand-700)] hover:text-[var(--brand-900)] hover:bg-[rgb(var(--brand-300-rgb)/0.6)] transition-all'
      : 'w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all',
    lyricsScrollbar:    isLight ? hexToRgba(c[600], 0.15) : 'rgba(150,150,150,0.2)',
    lyricsScrollbarAlt: isLight ? hexToRgba(c[600], 0.25) : 'rgba(150,150,150,0.3)',
    lyricsLineInactive: isLight ? hexToRgba(c[500], 0.8)  : 'rgb(156,163,175)',
    lyricsPlainText:    isLight ? 'text-[var(--brand-800)]' : 'text-gray-300',
    lyricsNextLine:     isLight ? 'text-[var(--brand-500)]' : 'text-gray-500',
    lyricsWaiting:      isLight ? 'text-[var(--brand-500)]' : 'text-gray-600',
    textSecondary:      isLight ? 'text-[var(--brand-800)]' : 'text-gray-300',
    textSubtle:         isLight ? 'text-[var(--brand-600)]' : 'text-gray-500',
    textMono:           isLight ? 'text-[var(--brand-700)]' : 'text-gray-400',
    controlBtn:         isLight
      ? 'w-7 h-7 rounded-full flex items-center justify-center text-[var(--brand-700)] hover:text-[var(--brand-900)] hover:bg-[rgb(var(--brand-300-rgb)/0.6)] transition-all'
      : 'w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all',
    checkboxLabel:      isLight
      ? 'text-sm text-[var(--brand-700)] hover:text-[var(--brand-900)] transition-colors'
      : 'text-sm text-gray-400 hover:text-white transition-colors',
    playlistTrackNum:   isLight ? 'text-[var(--brand-500)] font-mono text-xs' : 'text-gray-500 font-mono text-xs',
    playlistArtist:     isLight ? 'text-[var(--brand-600)] text-xs truncate' : 'text-gray-400 text-xs truncate',
    settingLabel:       isLight
      ? 'text-sm text-[var(--brand-800)] group-hover:text-[var(--brand-900)] transition-colors select-none'
      : 'text-sm text-gray-300 group-hover:text-white transition-colors select-none',
    settingsSectionLabel: isLight
      ? 'text-[10px] uppercase tracking-widest text-[var(--brand-600)] mb-2 select-none'
      : 'text-[10px] uppercase tracking-widest text-gray-500 mb-2 select-none',
    settingsIcon:       isLight ? 'text-[var(--brand-700)]' : 'text-gray-300',
    settingsBorder:     isLight ? 'border-[rgb(var(--brand-400-rgb)/0.6)]' : 'border-white/10',
    dayThemeInactive:   isLight
      ? 'bg-[var(--brand-200)] text-[var(--brand-600)] hover:text-[var(--brand-900)] hover:bg-[var(--brand-400)]'
      : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20',
    toastSuccess:       'bg-emerald-950/80 border-emerald-500/40 text-emerald-200',
    toastInfo:          isLight
      ? 'bg-[rgb(var(--brand-900-rgb)/0.8)] border-[rgb(var(--brand-500-rgb)/0.4)] text-[var(--brand-300)]'
      : 'bg-gray-900/80 border-gray-500/40 text-gray-200',
    toastError:         'bg-red-950/80 border-red-500/40 text-red-200',
    coverText:          isLight ? 'text-[var(--brand-900)]' : 'text-gray-200',
    coverTextMuted:     isLight ? 'text-[var(--brand-800)]' : 'text-gray-300',
    henryColor:         isLight ? 'var(--brand-900)' : 'var(--brand-300)',
    tileBg:             isLight ? 'bg-[var(--color-panel-alt)]' : 'bg-gray-700',
    tileInput:          isLight
      ? 'bg-[var(--color-panel-alt)] text-[var(--brand-900)] placeholder:text-[var(--brand-500)] focus:ring-[var(--brand-400)]'
      : 'bg-gray-700 text-white placeholder-gray-500 focus:ring-gray-500',
    artPanelBg:         isLight ? hexToRgba(c[300], null) : 'rgba(31,41,55,',
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return alpha === null ? `rgba(${r},${g},${b},` : `rgba(${r},${g},${b},${alpha})`;
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgbChannels(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

// ─── Neutral colors (shared between all modes) ────────────────────────────────
export const neutral = {
  successBg:     'bg-emerald-700',
  successBgHov:  'bg-emerald-700 hover:bg-emerald-600',
  successToast:  'bg-emerald-950/80 border-emerald-500/40 text-emerald-200',
  successBorder: 'border-emerald-500',
  successText:   'text-emerald-400',
  errorToast:    'bg-red-950/80 border-red-500/40 text-red-200',
  warningText:   'text-amber-400',
  warningBg:     'bg-amber-400/20',
  white:         'rgb(255,255,255)',
  grayMid:       'rgb(156,163,175)',
};

// ─── Utility functions ────────────────────────────────────────────────────────
export const applyTheme = (isNight, dayVariant = 'dark', dayColor = 'blue') => {
  const root = document.documentElement;
  
  if (!isNight) {
    const palette = TW_COLORS[dayColor] || TW_COLORS.blue;

    Object.entries(palette).forEach(([shade, hex]) => {
      root.style.setProperty(`--brand-${shade}`, hex);
      if (isHexColor(hex)) {
        root.style.setProperty(`--brand-${shade}-rgb`, hexToRgbChannels(hex));
      }
    });
  }

  const t = theme(isNight, dayVariant, dayColor);
  if (t.vars) {
    Object.entries(t.vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
      if (isHexColor(v)) {
        root.style.setProperty(`${k}-rgb`, hexToRgbChannels(v));
      }
    });
  }
};

/**
 * @param {boolean}        isNight
 * @param {'dark'|'light'} dayVariant
 * @param {string}         dayColor    - Tailwind color name, default 'blue'
 */
export const theme = (isNight, dayVariant = 'dark', dayColor = 'blue') =>
  isNight ? night : buildDayTheme(dayColor, dayVariant);

export const c = (isNight, nightVal, dayVal) => isNight ? nightVal : dayVal;