export const ALWAYS_ON = new Set(['stats']);

export const PRIV_KEYS = {
  queue_manage:       'privQueueManage',
  artist_arts:        'privArtistArts',
  upload_songs:       'privUploadSongs',
  editor_lyrics:      'privEditorLyrics',
  editor_meta:        'privEditorMeta',
  settings_branding:  'privSettingsBranding',
  settings_groups:    'privSettingsGroups',
  settings_algorithm: 'privSettingsAlgorithm',
  stats:              'privStats',
  mode_switch:        'privModeSwitch',
  jingles_uploader:   'privJinglesUploader',
  radio_host:         'privRadioHost',
  radio_moderator:    'privRadioModerator',
  donations_manage:   'privDonationsManage',
};

export function generatePassword() {
  const upper  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower  = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all    = upper + lower + digits + '!@#$%';
  let pass = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];
  for (let i = 3; i < 12; i++) pass.push(all[Math.floor(Math.random() * all.length)]);
  return pass.sort(() => Math.random() - 0.5).join('');
}