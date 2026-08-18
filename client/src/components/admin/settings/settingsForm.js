export const secToMin = (s) => (s != null && s !== '' ? Math.round(Number(s) / 60) : '');
export const minToSec = (m) => (m != null && m !== '' ? Math.round(Number(m) * 60) : '');

export const formatCooldown = (secs, t) =>
  secs < 60
    ? `${secs}${t('seconds')}`
    : `${Math.ceil(secs / 60)}${t('minutes')}`;

export const formatDuration = (seconds, lang = 'uk') => {
  if (!seconds && seconds !== 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return lang === 'en' ? `${h}h ${m}m` : `${h}г ${m}хв`;
};

export const normalizeFormFromSettings = (s) => ({
  ...s,
  generation: {
    ...s.generation,
    MAX_DAY_DURATION:   secToMin(s.generation.MAX_DAY_DURATION),
    MAX_NIGHT_DURATION: secToMin(s.generation.MAX_NIGHT_DURATION),
  },
  radioHosts: {
    guestMaxDurationMinutes: 15,
    specialGuestMaxDurationMinutes: 60,
    backgroundMusicMode: 'random',
    ...s.radioHosts,
  },
  artistArts: {
    dayEnabled: true,
    nightEnabled: true,
    ...s.artistArts,
  },
});

export const createEmptySongGroupForm = () => ({
  id: null,
  name: '',
  mode: 'day',
  songs: [],
});