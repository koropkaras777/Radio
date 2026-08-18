# Message format and i18n

The least obvious part of the protocol. If your client crashes while handling an
error, this is almost certainly why.

## The server does not know your language

The usual approach is that the client sends `Accept-Language` and the server
replies in one language. This project does the opposite: **the server returns
all 17 locales at once**, and the client picks one locally.

```js
t('queue.songAdded', { title })
```

```json
{
  "uk": "Пісню додано",
  "en": "Song added",
  "pl": "Utwór dodano",
  "…": "…"
}
```

The reason is the nature of radio: one socket event goes to **all listeners at
the same time**, and they have different languages selected. If the server
localized messages itself, it would have to either send a personal copy to
everyone or keep language in connection state. An all-locales object removes
both problems: the broadcast stays a single event, and each client renders its
own.

The cost is bandwidth: every message carries 17 variants. For short system
strings that is acceptable; for arbitrary text it would not be.

## What this means for your client

The `error` field is **not a string**:

```js
// ✗ prints "[object Object]"
alert(data.error);

// ✓
alert(pickLocalized(data.error, 'en'));
```

A minimal implementation:

```js
const DEFAULT_LOCALE = 'uk';

function pickLocalized(source, lang = DEFAULT_LOCALE) {
  if (source == null) return '';
  if (typeof source === 'string') return source;      // some errors are strings
  const src = source.localized ?? source;             // sometimes nested
  return src[lang] ?? src[DEFAULT_LOCALE] ?? Object.values(src)[0] ?? '';
}
```

Three shapes you have to survive:

1. **A plain locale object** — `{ uk: "…", en: "…" }`.
2. **Nested under `localized`** — `{ code: "…", localized: { uk: "…" } }`.
3. **A plain string** — some older endpoints and technical errors.

## Error codes

Machine-readable errors carry a `code` alongside the locales:

```json
{ "code": "TRACK_NOT_FOUND", "uk": "Трек не знайдено", "en": "Track not found" }
```

Branch on `code` and show the locales to the user. Never compare message text —
it changes whenever translations are refined.

## One exception worth knowing

The `suggest_song` acknowledgement callback returns **plain string codes**, not
locale objects:

```js
{ error: 'cooldown', secsLeft: 240 }
{ error: 'no_admin' }
{ error: 'no_uid' }
```

This is the only place in the API that behaves this way. Map those strings to
your own messages.

## Interpolation

Strings may contain `{token}` placeholders, which the server substitutes before
sending. Sometimes a substituted value is itself a locale object — it is then
resolved in the same language as the surrounding string.

## Looking up the locale list

The set of locales is not hardcoded: the server derives it from directory names
under `server/src/i18n/`. Do not rely on a fixed list — read the keys of the
object you received.

## Interface language and writing direction

The `ar` and `he` locales are written right to left. The reference client
switches `document.documentElement.dir` to `rtl` and uses logical CSS properties
(`text-start`, `margin-inline-start`) instead of left and right. If you plan to
support those languages, design for it from the start — retrofitting is painful.
