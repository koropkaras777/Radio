import { MAX_LIVE_HOST_SLOTS } from '../config/env.js';

export const session = {
  activeUsers: {},

  /** @type {Map<string, { adminId: string, role: string, privileges: string[], login: string }>} */
  activeAdminSockets: new Map(),
};

export const suggestState = {
  pending: new Map(),
  cooldowns: new Map(),
  lastMode: null,
};

// ─── Live radio-hosts session state (RADIO_HOSTS_MODE) ─────────────────────────
export const HOST_ROLE_CAP          = 2;
export const SPECIAL_GUEST_ROLE_CAP = 1;
export const RANDOM_GUEST_ROLE_CAP  = 1;

export const LIVE_HOSTS_ROOM = 'live-hosts';

export const liveSession = {
  hosts:        new Set(), 
  specialGuest: null, 
  guest:        null, 
};

export const liveSlotsUsed = () =>
  liveSession.hosts.size + (liveSession.specialGuest ? 1 : 0) + (liveSession.guest ? 1 : 0);

/**
 * @param {'host'|'specialGuest'|'guest'} role
 * @returns {boolean} whether a new participant of this role can go live right now
 */
export const canGoLive = (role) => {
  if (liveSlotsUsed() >= MAX_LIVE_HOST_SLOTS) return false;
  switch (role) {
    case 'host':         return liveSession.hosts.size < HOST_ROLE_CAP;
    case 'specialGuest':  return SPECIAL_GUEST_ROLE_CAP > 0 && !liveSession.specialGuest;
    case 'guest':         return RANDOM_GUEST_ROLE_CAP > 0 && !liveSession.guest;
    default:              return false;
  }
};

export const registerLiveHost        = (socketId) => { liveSession.hosts.add(socketId); };
export const unregisterLiveHost      = (socketId) => { liveSession.hosts.delete(socketId); };
export const registerLiveSpecialGuest = (socketId) => { liveSession.specialGuest = socketId; };
export const clearLiveSpecialGuest    = ()         => { liveSession.specialGuest = null; };
export const registerLiveGuest       = (socketId) => { liveSession.guest = socketId; };
export const clearLiveGuest          = ()         => { liveSession.guest = null; };

export const isHostRoomEmpty = () => liveSession.hosts.size === 0;

// ─── Session helpers ──────────────────────────────────────────────────────────
export const isAdminSocket = (socketId) => session.activeAdminSockets.has(socketId);

export const getAdminSession = (socketId) => session.activeAdminSockets.get(socketId) ?? null;

export const anyAdminHasPrivilege = (privilege) => {
  for (const entry of session.activeAdminSockets.values()) {
    if (Array.isArray(entry.privileges) && entry.privileges.includes(privilege)) return true;
  }
  return false;
};

export const socketHasPrivilege = (socketId, privilege) => {
  const entry = session.activeAdminSockets.get(socketId);
  return Array.isArray(entry?.privileges) && entry.privileges.includes(privilege);
};