// ─── Admin Privilege IDs ──────────────────────────────────────────────────────
export const PRIVILEGES = {
  /** 1 - Queue: add from library, remove, skip, respond to listener suggestions */
  QUEUE_MANAGE:        'queue_manage',
  /** 2 - Artist arts: upload & change artist artwork */
  ARTIST_ARTS:         'artist_arts',
  /** 3 - Upload new songs to the library */
  UPLOAD_SONGS:        'upload_songs',
  /** 4 - Song editor: edit lyrics and timing offsets only */
  EDITOR_LYRICS:       'editor_lyrics',
  /** 5 - Song editor: edit metadata and delete songs (includes lyrics editing) */
  EDITOR_META:         'editor_meta',
  /** 6 - Settings: branding and links */
  SETTINGS_BRANDING:   'settings_branding',
  /** 7 - Settings: create / edit / delete song groups */
  SETTINGS_GROUPS:     'settings_groups',
  /** 8 - Settings: radio algorithm (durations, mode, genre groups) */
  SETTINGS_ALGORITHM:  'settings_algorithm',
  /** 9 - View statistics */
  STATS:               'stats',
  /** 10 - Switch radio mode (day ↔ night) */
  MODE_SWITCH:         'mode_switch',
  /** 11 - Upload & manage jingles, background music and phrases (cloud + SQL only) */
  JINGLES_UPLOADER:    'jingles_uploader',
  /** 12 - Become a live radio host */
  RADIO_HOST:          'radio_host',
  /** 13 - Radio panel settings (guest/special-guest max duration, etc.) +
   *  live-broadcast moderation (kick/mute/ban any participant, ban list) +
   *  special-guest access code generation (shared with RADIO_HOST). */
  RADIO_MODERATOR:     'radio_moderator',
  /** 14 - Donation settings (price, currency, tiers) + donation history */
  DONATIONS_MANAGE:    'donations_manage',
};

export const ALL_PRIVILEGES = Object.values(PRIVILEGES);