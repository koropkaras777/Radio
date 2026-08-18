// ─── Shared admin theme helpers ────────────────────────────────────────────
export const accentBtn = (isNight) =>
  isNight ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-500';

export const accentActive = (isNight) =>
  isNight ? 'bg-red-700 text-white' : 'bg-blue-600 text-white';

export const accentPanel = (isNight) =>
  isNight ? 'bg-[#1a0505] border-red-900/40' : 'bg-gray-800 border-white/10';

export const inputBorder = (isNight) =>
  isNight ? 'border-red-900/40 focus:border-red-600' : 'border-white/15 focus:border-blue-500';