export const WINDOWS = [
  { key: '1h',  labelKey: 'window1h'  },
  { key: '6h',  labelKey: 'window6h'  },
  { key: '24h', labelKey: 'window24h' },
  { key: '7d',  labelKey: 'window7d'  },
];

export const WINDOW_MS = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };

// ─── Session-end reason suffix (guest/specialGuest live sessions) ─────────────
const REASON_KEYS = { self: 'reasonSelf', timeout: 'reasonTimeout', no_hosts: 'reasonNoHosts', kick: 'reasonKick', ban: 'reasonBan' };
const reasonSuffix = (reason, t) => {
  const key = REASON_KEYS[reason];
  return key ? ` (${t(key)})` : '';
};

// ─── Operation type -> i18n key + param builder ────────────────────────────────
const OP_KEYS = {
  upload_song:              { key: 'uploadSong',              params: (d) => ({ title: d.title, artist: d.artist }) },
  delete_song:               { key: 'deleteSong',              params: (d) => ({ title: d.title, artist: d.artist }) },
  edit_song_lyrics:          { key: 'editSongLyrics',          params: (d) => ({ title: d.title, artist: d.artist }) },
  edit_song_meta:            { key: 'editSongMeta',            params: (d) => ({ title: d.title, artist: d.artist }) },
  artist_art_upload:         { key: 'artistArtUpload',         params: (d) => ({ artist: d.artist }) },
  artist_art_delete:         { key: 'artistArtDelete',         params: (d) => ({ artist: d.artist }) },
  jingle_upload:             { key: 'jingleUpload',            params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightM' : 'modeDayM'), filename: d.filename }) },
  jingle_delete:              { key: 'jingleDelete',            params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightM' : 'modeDayM'), filename: d.filename }) },
  background_music_upload:   { key: 'backgroundMusicUpload',   params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightF' : 'modeDayF'), filename: d.filename }) },
  background_music_delete:   { key: 'backgroundMusicDelete',   params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightF' : 'modeDayF'), filename: d.filename }) },
  phrase_upload:              { key: 'phraseUpload',            params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightF' : 'modeDayF'), filename: d.filename }) },
  phrase_delete:              { key: 'phraseDelete',            params: (d, t) => ({ modeWord: t(d.mode === 'night' ? 'modeNightF' : 'modeDayF'), filename: d.filename }) },
  queue_add:                 { key: 'queueAdd',                params: (d, t) => ({ title: d.title, artist: d.artist, donatedSuffix: d.orderType === 'donated' ? t('donatedSuffix') : '' }) },
  queue_remove:               { key: 'queueRemove',             params: (d) => ({ position: d.position ?? '?' }) },
  queue_skip:                 { key: 'queueSkip',               params: (d) => ({ title: d.title, artistSuffix: d.artist ? ` - ${d.artist}` : '' }) },
  suggestion_accept:         { key: 'suggestionAccept',        params: (d) => ({ title: d.title, artist: d.artist }) },
  suggestion_reject:         { key: 'suggestionReject',        params: (d) => ({ title: d.title, artist: d.artist }) },
  mode_switch:                { key: 'modeSwitch',              params: (d, t) => ({ modeWord: t(d.targetMode === 'night' ? 'modeNightM' : 'modeDayM') }) },
  settings_save:              { key: 'settingsSave',            params: () => ({}) },
  group_create:                { key: 'groupCreate',             params: (d) => ({ name: d.name }) },
  group_edit:                  { key: 'groupEdit',               params: (d) => ({ name: d.name }) },
  group_delete:                { key: 'groupDelete',             params: (d) => ({ groupId: d.groupId }) },
  group_insert:                { key: 'groupInsert',             params: (d) => ({ groupId: d.groupId }) },
  admin_create:                { key: 'adminCreate',             params: (d) => ({ login: d.login }) },
  admin_delete:                { key: 'adminDelete',             params: (d) => ({ login: d.login }) },
  admin_privileges:           { key: 'adminPrivileges',         params: (d) => ({ login: d.login }) },
  admin_activate:              { key: 'adminActivate',           params: (d) => ({ login: d.login }) },
  admin_login_change:         { key: 'adminLoginChange',        params: (d) => ({ newLogin: d.newLogin }) },
  admin_password_change:      { key: 'adminPasswordChange',     params: () => ({}) },
  radio_host_live_start:      { key: 'radioHostLiveStart',      params: () => ({}) },
  radio_host_live_end:        { key: 'radioHostLiveEnd',        params: (d, t) => ({ reasonSuffix: d?.reason ? reasonSuffix(d.reason, t) : '' }) },
  guest_code_generate:        { key: 'guestCodeGenerate',       params: (d) => ({ ttlHours: d.ttlHours }) },
  guest_code_deactivate:      { key: 'guestCodeDeactivate',     params: () => ({}) },
  guest_code_regenerate:      { key: 'guestCodeRegenerate',     params: (d) => ({ ttlHours: d.ttlHours }) },
  guest_ban:                    { key: 'guestBan',                 params: (d, t) => ({ nicknameSuffix: d.nickname ? t('nicknameQuotedSuffix', { nickname: d.nickname }) : '', ip: d.ip }) },
  guest_unban:                  { key: 'guestUnban',               params: (d) => ({ ip: d.ip }) },
  guest_live_start:              { key: 'guestLiveStart',           params: () => ({}) },
  guest_live_end:                { key: 'guestLiveEnd',             params: (d, t) => ({ reasonSuffix: reasonSuffix(d?.reason, t) }) },
  special_guest_live_start:      { key: 'specialGuestLiveStart',    params: () => ({}) },
  special_guest_live_end:        { key: 'specialGuestLiveEnd',      params: (d, t) => ({ reasonSuffix: reasonSuffix(d?.reason, t) }) },
  guest_kick:     { key: 'guestKick',        params: (d) => ({ nickname: d.nickname, ipSuffix: d.ip ? ` (${d.ip})` : '' }) },
  participant_kick: { key: 'participantKick', params: (d) => ({ nickname: d.nickname }) },
  donation_queue_add:     { key: 'donationQueueAdd',     params: (d) => ({ title: d.title, artist: d.artist, amount: d.amount, currency: d.currency }) },
  donation_insert_failed: { key: 'donationInsertFailed', params: (d) => ({ title: d.title, artist: d.artist }) },
};

export function formatOpLabel(operationType, data, t) {
  const cfg = OP_KEYS[operationType];
  if (!cfg) return operationType;
  return t(cfg.key, cfg.params(data || {}, t));
}

// ─── Filter categories ─────────────────────────────────────────────────────────
export const CATEGORIES = [
  {
    key: 'songs', labelKey: 'catSongs',
    types: ['upload_song', 'delete_song', 'edit_song_lyrics', 'edit_song_meta'],
  },
  {
    key: 'arts', labelKey: 'catArts',
    types: ['artist_art_upload', 'artist_art_delete'],
  },
  {
    key: 'jingles', labelKey: 'catJingles',
    types: ['jingle_upload', 'jingle_delete'],
  },
  {
    key: 'backgroundMusic', labelKey: 'catBackgroundMusic',
    types: ['background_music_upload', 'background_music_delete'],
  },
  {
    key: 'phrases', labelKey: 'catPhrases',
    types: ['phrase_upload', 'phrase_delete'],
  },
  {
    key: 'queue', labelKey: 'catQueue',
    types: [
      'queue_add', 'queue_remove', 'queue_skip', 'suggestion_accept', 'suggestion_reject', 'group_insert',
      'donation_queue_add', 'donation_insert_failed',
    ],
  },
  {
    key: 'mode', labelKey: 'catMode',
    types: ['mode_switch'],
  },
  {
    key: 'settings', labelKey: 'catSettings',
    types: ['settings_save', 'group_create', 'group_edit', 'group_delete'],
  },
  {
    key: 'admins', labelKey: 'catAdmins',
    types: ['admin_create', 'admin_delete', 'admin_privileges', 'admin_activate', 'admin_login_change', 'admin_password_change'],
  },
  {
    key: 'radioHosts', labelKey: 'catRadioHosts',
    types: [
      'radio_host_live_start', 'radio_host_live_end',
      'guest_code_generate', 'guest_code_deactivate', 'guest_code_regenerate',
      'guest_ban', 'guest_unban',
      'guest_live_start', 'guest_live_end',
      'special_guest_live_start', 'special_guest_live_end',
      'guest_kick', 'participant_kick',
    ],
  },
];

export const CATEGORY_BY_TYPE = new Map(
  CATEGORIES.flatMap((cat) => cat.types.map((type) => [type, cat.key]))
);