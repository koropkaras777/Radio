import { t as translate } from '../../../i18n/index.js';
import { PRIV_KEYS } from '../adminManage/adminManageHelpers.js';
import { pickLocalized } from '../../../i18n/serverMessage.js';

const LABELS = {
  title: 'textEditor.metaTitle', artist: 'textEditor.metaArtist', album: 'textEditor.metaAlbum', year: 'textEditor.metaYear',
  lyrics: 'textEditor.linesLabel', lyricsStatus: 'auditLog.fieldLyricsStatus', offset: 'textEditor.offset',
  name: 'settingsModal.songGroupName', mode: 'settingsModal.songGroupMode', songs: 'settingsModal.selectedSongs',
  login: 'adminManage.loginLabel', privileges: 'adminManage.hasPriv', privilegesAdded: 'auditLog.privilegesAdded', privilegesRemoved: 'auditLog.privilegesRemoved',
  backgroundTrack: 'jinglesModalBackgroundMusic.title', source: 'auditLog.fieldSource', force: 'textEditor.forceLyricsUpdate',
  clamped: 'auditLog.fieldClamped', muted: 'auditLog.fieldMuted', used: 'auditLog.fieldUsed',
  previousFile: 'auditLog.previousFile', file: 'auditLog.file', bytes: 'auditLog.bytes', width: 'auditLog.width', height: 'auditLog.height',
  amount: 'auditLog.amount', currency: 'donationSettings.currencyLabel', orderId: 'auditLog.orderId', failureReason: 'auditLog.failureReason',
  pricingMode: 'auditLog.pricingMode', fixedPrice: 'donationSettings.fixedPriceLabel', pricePerSecond: 'donationSettings.pricePerSecondLabel',
  tiersEnabled: 'donationSettings.tiersEnabledLabel', tierCeiling: 'donationSettings.tierCeilingLabel', blockDonationsWhileChatting: 'donationSettings.blockWhileChattingLabel',
};
const SETTINGS_LABELS = {
  telegram_url: 'telegramUrl', dayRadioName: 'dayRadioName', nightRadioName: 'nightRadioName', telegramLabel: 'telegramLabel',
  guestMaxDurationMinutes: 'guestMaxDuration', specialGuestMaxDurationMinutes: 'specialGuestMaxDuration', backgroundMusicMode: 'backgroundMusicModeLabel',
  dayEnabled: 'artistArtsDayEnabled', nightEnabled: 'artistArtsNightEnabled',
};

export function auditSection(field) {
  if (field.startsWith('branding.')) return 'branding';
  if (field.startsWith('radioHosts.')) return 'radioHosts';
  if (field.startsWith('artistArts.')) return 'artistArts';
  if (field.startsWith('generation.JINGLES_')) return 'jingles';
  if (field.startsWith('generation.PHRASES_')) return 'phrases';
  if (field.startsWith('generation.')) return /NIGHT/.test(field.split('.')[1]) ? 'generationNight' : 'generationDay';
  return null;
}

export function sectionLabel(section, t) {
  return t(`section_${section}`);
}

export function fieldLabel(field, lang) {
  const parts = field.split('.');
  if (parts[0] === 'generation') {
    const key = parts[1];
    const label = translate(`settingsFields.${key === 'PHRASES_DAY_ID' ? 'phrasesPickDay' : key === 'PHRASES_NIGHT_ID' ? 'phrasesPickNight' : key}`, {}, lang);
    return parts.length > 2 ? `${label}: ${parts.slice(2).join('.')}` : label;
  }
  const key = parts.at(-1);
  if (SETTINGS_LABELS[key]) {
    const label = translate(`settingsModal.${SETTINGS_LABELS[key]}`, {}, lang);
    return parts[1] === 'byLang' ? `${label} (${parts[2].toUpperCase()})` : label;
  }
  return LABELS[key] ? translate(LABELS[key], {}, lang) : field;
}

const ENUMS = {
  synced: 'textEditor.statusSynced', plain: 'textEditor.statusPlain', none: 'textEditor.statusNone',
  day: 'settingsModal.modeDay', night: 'settingsModal.modeNight', random: 'settingsModal.backgroundMusicModeRandom',
  hostChoice: 'settingsModal.backgroundMusicModeHostChoice', fixed: 'donationSettings.pricingFixed', calculated: 'donationSettings.pricingCalculated',
  bulk: 'auditLog.bulkUpdate',
};

export function formatAuditValue(value, field, lang, t) {
  if (field === 'failureReason') return pickLocalized(value, lang) || t('donationFailureExplanation');
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return t('emptyValue');
  if (typeof value === 'boolean') return t(value ? 'enabled' : 'disabled');
  if (Array.isArray(value)) return value.map((item, index) => {
    const label = field.startsWith('privileges') && PRIV_KEYS[item] ? translate(`adminManage.${PRIV_KEYS[item]}`, {}, lang) : String(item);
    return field === 'songs' ? `${index + 1}. ${label}` : label;
  }).join('\n');
  if (typeof value === 'string' && ['lyricsStatus', 'mode', 'backgroundMusicMode', 'pricingMode', 'source'].includes(field.split('.').at(-1)) && ENUMS[value]) return translate(ENUMS[value], {}, lang);
  if (/MAX_(DAY|NIGHT)_DURATION$/.test(field)) return `${Number(value) / 60} ${translate('settingsModal.minutes', {}, lang)}`;
  if (/DurationMinutes$/.test(field)) return `${value} ${translate('settingsModal.minutes', {}, lang)}`;
  if (field === 'offset' || field.endsWith('PHRASES_TIME_SECONDS')) return `${value} ${translate('settingsModal.seconds', {}, lang)}`;
  return String(value);
}

export const hasAuditDetails = (data) => Boolean(data?.details?.changes?.length || Object.keys(data?.details?.info || {}).length);
