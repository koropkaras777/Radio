import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './serverMessage.js';

// ─── Locale-prefixed radio/guest routes (/en/, /pl/guest, ... - uk stays unprefixed) ─
const RADIO_PATH_RE = /^\/(?:([a-z]{2})\/)?(guest)?\/?$/;

export function parseRadioPath(path) {
  const match = path.match(RADIO_PATH_RE);
  if (!match) return null;

  const [, localeSeg, guestSeg] = match;
  if (localeSeg && !(localeSeg !== DEFAULT_LOCALE && SUPPORTED_LOCALES.includes(localeSeg))) return null;

  return { locale: localeSeg || DEFAULT_LOCALE, page: guestSeg ? 'guest' : 'radio', explicit: Boolean(localeSeg) };
}

export function buildRadioPath(locale, page = 'radio') {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return page === 'guest' ? `${prefix}/guest` : `${prefix}/`;
}
