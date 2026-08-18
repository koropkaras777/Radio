export const ENDPOINT_DOCS = {
  // ── Public ──────────────────────────────────────────────────────────────
  'GET /api/public/config': {
    summary: {
      uk: 'Режим роботи сервера. Єдиний ендпоінт без будь-якої авторизації.',
      en: 'How the server is configured. The only endpoint with no authentication at all.',
    },
    response: `{
  dataProvider:   'json' | 'sql',
  musicSource:    'local' | 'cloud',
  nightMode:      true,     // чи є нічний режим узагалі
  streamMode:     false,    // false = sync-режим, true = спільний MP3-потік
  radioHostsMode: false,    // чи можливий живий ефір
  allPrivileges:  ['queue_manage', '…'],
  timeZone:       'Europe/Kyiv',
  capabilities:   { donations: false, auditLog: true, history: true, … },
  donationInfo:   null | {
    provider: 'liqpay' | 'stripe' | 'donatello' | 'kofi',
    displayName: 'LiqPay',
    currency: 'UAH', pricingMode: 'fixed' | 'calculated',
    fixedPrice: 1, pricePerSecond: 0.02,
    tiersEnabled: true, tierCeiling: 5,
    blockDonationsWhileChatting: false,
    donationRetentionDays: 365,
  },
}`,
    notes: {
      uk:
        'З цього починається будь-який клієнт: `streamMode` визначає, яким саме ' +
        'способом діставати звук, а `musicSource` — чи буде редирект на хмару. ' +
        '`capabilities` вмикає/вимикає окремі фічі залежно від конфігурації ' +
        'сервера (сховище, провайдер даних); `donationInfo` — `null`, якщо ' +
        '`capabilities.donations` вимкнено, інакше — активна конфігурація ' +
        'донатів для відображення ціни й черг ще до виклику `/donations/tiers`.',
      en:
        'Every client starts here: `streamMode` decides how you obtain audio, and ' +
        '`musicSource` tells you whether to expect a redirect to cloud storage. ' +
        '`capabilities` toggles individual features on/off based on server ' +
        'configuration (storage, data provider); `donationInfo` is `null` when ' +
        '`capabilities.donations` is off, otherwise it is the active donation ' +
        'configuration, useful for showing pricing/tiers before ever calling ' +
        '`/donations/tiers`.',
    },
  },

  'GET /api/library': {
    summary: {
      uk: 'Треки, доступні для замовлення в поточному режимі.',
      en: 'Tracks available to request in the current mode.',
    },
    response: `[{ id: 'day/artist - title.mp3', title: 'Title', artist: 'Artist' }]`,
    notes: {
      uk:
        'Без токенів. Повертає лише треки поточного режиму (день або ніч), ' +
        'відсортовані за виконавцем. `id` — це те, що надсилається в `suggest_song`.',
      en:
        'No tokens needed. Returns only tracks of the current mode (day or night), ' +
        'sorted by artist. The `id` is what you send in `suggest_song`.',
    },
  },

  'GET /api/history': {
    summary: {
      uk: 'Останні 10 зіграних пісень.',
      en: 'The last 10 played songs.',
    },
    response: `[{ id, trackId, title, artist, album, mode: 'day' | 'night', playedAt }]`,
    notes: {
      uk:
        'Без токенів. Не залежить від поточного режиму (день/ніч) — просто ' +
        'останні зіграні треки в хронологічному порядку.',
      en:
        'No tokens needed. Not affected by the current mode (day/night) — just ' +
        'the most recently played tracks in chronological order.',
    },
  },

  // ── Tokens and audio ────────────────────────────────────────────────────────
  'GET /api/audio-key': {
    summary: {
      uk: 'Обмінює art-токен на короткоживучий audio-токен.',
      en: 'Exchanges an art token for a short-lived audio token.',
    },
    headers: {
      uk: '`X-Art-Token` і `X-Listener-Uid` — обидва обов’язкові',
      en: '`X-Art-Token` and `X-Listener-Uid` — both required',
    },
    response: `{ token: '<audioToken>', expiresIn: 900 }`,
    errors: {
      uk: '`400` — не надіслано `X-Listener-Uid`; `401` — art-токен недійсний або протух',
      en: '`400` — `X-Listener-Uid` missing; `401` — art token invalid or expired',
    },
    notes: {
      uk:
        'Відповідь має `Cache-Control: no-store`. Оновлюйте токен завчасно: ' +
        'референсний клієнт робить це за 30 секунд до закінчення.',
      en:
        'The response carries `Cache-Control: no-store`. Refresh early — the ' +
        'reference client does so 30 seconds before expiry.',
    },
  },

  'GET /api/audio/stream': {
    summary: {
      uk: 'Байти аудіо поточного або замовленого треку.',
      en: 'Audio bytes for the current or a requested track.',
    },
    query: {
      uk: '`track` — ідентифікатор треку з `sync` або `/api/library`',
      en: '`track` — the identifier from `sync` or `/api/library`',
    },
    headers: {
      uk: '`X-Art-Token` + `X-Audio-Token`, або ті самі значення в query як `artToken` і `audioToken`',
      en: '`X-Art-Token` + `X-Audio-Token`, or the same values as `artToken` and `audioToken` in the query',
    },
    errors: {
      uk: '`400` — немає `track`; `401` — недійсні токени; `404` — трек не знайдено',
      en: '`400` — `track` missing; `401` — invalid tokens; `404` — track not found',
    },
    notes: {
      uk:
        'У режимі `local` віддає байти з підтримкою HTTP Range. У режимі `cloud` ' +
        'відповідає `302` на тимчасове посилання R2 — при завантаженні через ' +
        '`fetch` дозвольте редирект. Аудіо **не** шифрується XOR: токени тут лише ' +
        'перепустка. Для `<audio src>` доводиться передавати токени в query, бо ' +
        'заголовки там задати неможливо.',
      en:
        'In `local` mode it serves bytes with HTTP Range support. In `cloud` mode ' +
        'it answers `302` redirecting to a temporary R2 URL — allow redirects if ' +
        'you fetch manually. Audio is **not** XOR-encrypted: the tokens are only a ' +
        'pass. For `<audio src>` the tokens have to go in the query, since headers ' +
        'cannot be set there.',
    },
  },

  'GET /api/audio/url': {
    summary: {
      uk: 'Посилання на аудіо без віддавання самих байтів.',
      en: 'A URL for the audio, without serving the bytes.',
    },
    query: {
      uk: '`track` — ідентифікатор треку',
      en: '`track` — the track identifier',
    },
    headers: {
      uk: 'ті самі, що й у `/api/audio/stream`',
      en: 'same as `/api/audio/stream`',
    },
    response: `{ url: 'https://…', ttl: 900 }   // ttl in cloud mode only`,
    notes: {
      uk:
        'Зручно, коли програвач хоче отримати посилання наперед. У `local`-режимі ' +
        'повертає посилання назад на `/api/audio/stream` з уже вбудованими токенами.',
      en:
        'Useful when your player wants the URL up front. In `local` mode it returns ' +
        'a URL back to `/api/audio/stream` with the tokens already embedded.',
    },
  },

  'GET /api/stream': {
    summary: {
      uk: 'Спільний MP3-потік радіо (лише stream-режим).',
      en: 'The shared MP3 radio stream (stream mode only).',
    },
    headers: '`X-Art-Token` / `?token=`',
    errors: {
      uk: '`404` — сервер працює в sync-режимі; `503` — потік ще не готовий',
      en: '`404` — the server runs in sync mode; `503` — the stream is not ready yet',
    },
    notes: {
      uk:
        'Нескінченна відповідь: клієнт просто програє її як потік. Позиція для ' +
        'інтерфейсу береться подіями `stream_get_seek` і `stream_ping`. Заголовок ' +
        '`Icy-MetaData: 1` вмикає ICY-метадані (`icy-metaint` + `StreamTitle` в тілі ' +
        'потоку) для зовнішніх плеєрів на кшталт VLC чи foobar2000.',
      en:
        'An endless response: the client just plays it as a stream. Position for the ' +
        'UI comes from the `stream_get_seek` and `stream_ping` events. Sending ' +
        '`Icy-MetaData: 1` turns on ICY metadata (`icy-metaint` + in-band `StreamTitle`) ' +
        'for external players like VLC or foobar2000.',
    },
  },

  'GET /api/stream/public.mp3': {
    summary: {
      uk: 'Той самий потік, але без токена — постійне посилання для зовнішніх плеєрів.',
      en: 'The same stream without a token — a permanent link for external players.',
    },
    errors: {
      uk: '`404` — сервер працює в sync-режимі; `503` — потік ще не готовий',
      en: '`404` — the server runs in sync mode; `503` — the stream is not ready yet',
    },
    notes: {
      uk:
        'Без авторизації взагалі — це навмисно окремий шлях від `/api/stream`, який ' +
        'лишається токен-огородженим для власного веб-клієнта. Посилання можна ' +
        'вставити у VLC, автомагнітолу чи будь-який Shoutcast/Icecast-сумісний плеєр ' +
        'один раз і назавжди. Розширення `.mp3` у шляху навмисне: деякі плеєри (VLC, ' +
        'foobar2000, Winamp) обирають модуль для відкриття посилання за розширенням у ' +
        'URL, і без нього можуть відкрити його як звичайний файл замість живого ' +
        'ICY-стріму. Відповідь віддає повний набір `icy-*` заголовків (`icy-name`, ' +
        '`icy-genre`, `icy-br`, `Server: Icecast`) одразу, без чекання на ' +
        '`Icy-MetaData: 1` — так плеєр розпізнає стрім як Icecast-сумісний і сам ' +
        'перепідключається, щоб запросити вбудовані метадані (`icy-metaint` + ' +
        '`StreamTitle` у тілі потоку). Тіло — сирий, необмежений потік без ' +
        '`Transfer-Encoding: chunked` (`Connection: close`), як у справжніх ' +
        'Icecast/Shoutcast: ICY-парсер плеєра рахує байти напряму в тілі відповіді, і ' +
        'HTTP-обгортка chunked-кодування збиває цей підрахунок.',
      en:
        'No authorization at all — deliberately a separate path from `/api/stream`, ' +
        'which stays token-gated for the site’s own web client. Paste this link into ' +
        'VLC, a car radio, or any Shoutcast/Icecast-compatible player once and forget ' +
        'about it. The `.mp3` extension in the path is deliberate: some players (VLC, ' +
        'foobar2000, Winamp) pick which module opens a URL based on its extension, and ' +
        'without one they may treat it as a plain file instead of a live ICY stream. ' +
        'The response sends the full `icy-*` header set (`icy-name`, `icy-genre`, ' +
        '`icy-br`, `Server: Icecast`) unconditionally, without waiting for ' +
        '`Icy-MetaData: 1` - that lets the player recognize it as Icecast-compatible ' +
        'and reconnect on its own to request the embedded metadata (`icy-metaint` + ' +
        'in-band `StreamTitle`). The body is a raw, unbounded stream with no ' +
        '`Transfer-Encoding: chunked` (`Connection: close`), matching real ' +
        'Icecast/Shoutcast - a player\'s ICY parser counts bytes directly in the ' +
        'response body, and HTTP chunk framing throws that count off.',
    },
  },

  // ── Encrypted resources ───────────────────────────────────────────────────
  'GET /api/lyrics': {
    summary: {
      uk: 'Синхронізований текст пісні.',
      en: 'Time-synced lyrics for a song.',
    },
    query: {
      uk: '`title` і `artist` обов’язкові, `album` — необов’язковий',
      en: '`title` and `artist` are required, `album` is optional',
    },
    headers: '`X-Art-Token` / `?token=`',
    response: `// after XOR decoding — JSON:
{
  synced: true,
  lines: [{ time: 32.5, text: 'a line' }],
  offset: 0,        // timing correction for this track
  notFound: false,  // true when no lyrics were found
}`,
    errors: {
      uk: '`400` — немає `title` чи `artist`; `500` — `fetch_failed`',
      en: '`400` — `title` or `artist` missing; `500` — `fetch_failed`',
    },
    notes: {
      uk:
        'Тіло відповіді **поксорене** ключем з art-токена, `Content-Type` — ' +
        '`application/octet-stream`. Спочатку розшифруйте, потім `JSON.parse`. ' +
        'Якщо тексту немає в кеші, сервер спробує дістати його з LRCLIB — такий ' +
        'запит помітно повільніший.',
      en:
        'The response body is **XOR-wrapped** with the key from the art token, and ' +
        '`Content-Type` is `application/octet-stream`. Decode first, then ' +
        '`JSON.parse`. If the lyrics are not cached, the server tries LRCLIB — that ' +
        'request is noticeably slower.',
    },
  },

  'GET /api/artist-art/:artist': {
    summary: {
      uk: 'Зображення виконавця.',
      en: 'Artist artwork.',
    },
    headers: '`X-Art-Token` / `?token=`',
    response: {
      uk: 'поксорені байти зображення; справжній MIME — у заголовку `X-Art-Mime`',
      en: 'XOR-wrapped image bytes; the real MIME type is in the `X-Art-Mime` header',
    },
    errors: {
      uk: '`400` — некоректне ім’я; `404` — арту немає',
      en: '`400` — invalid name; `404` — no artwork',
    },
    notes: {
      uk:
        'Заголовок `X-Art-Mime` відкритий через `Access-Control-Expose-Headers`, ' +
        'тож його видно з браузера. Ім’я виконавця нормалізується до нижнього ' +
        'регістру.',
      en:
        'The `X-Art-Mime` header is exposed via `Access-Control-Expose-Headers`, so ' +
        'browsers can read it. Artist names are normalized to lower case.',
    },
  },

  'GET /api/avatar/:filename': {
    summary: {
      uk: 'Аватар слухача.',
      en: 'A listener avatar.',
    },
    headers: '`X-Art-Token` / `?token=`',
    response: {
      uk: 'поксорені байти зображення; MIME — у `X-Art-Mime`',
      en: 'XOR-wrapped image bytes; MIME type in `X-Art-Mime`',
    },
    errors: {
      uk: '`400` — некоректне ім’я файлу; `404` — файлу немає',
      en: '`400` — invalid filename; `404` — file not found',
    },
    notes: {
      uk: 'Ім’я файлу приходить у події `usersUpdate`, у полі `img`.',
      en: 'The filename arrives in the `usersUpdate` event, in the `img` field.',
    },
  },

  'GET /api/art/url': {
    summary: {
      uk: 'Посилання на арт виконавця замість самих байтів.',
      en: 'A URL for artist artwork instead of the bytes.',
    },
    query: {
      uk: '`artist` — ім’я виконавця',
      en: '`artist` — the artist name',
    },
    headers: '`X-Art-Token` / `?token=`',
    response: `{ url: 'https://…', ttl: 900 }`,
    notes: {
      uk:
        'У `cloud`-режимі це тимчасове посилання R2 і зображення **не** ' +
        'зашифроване. У `local`-режимі повертає посилання на ' +
        '`/api/artist-art/:artist`, тобто відповідь усе одно доведеться ' +
        'розшифровувати.',
      en:
        'In `cloud` mode this is a temporary R2 URL and the image is **not** ' +
        'wrapped. In `local` mode it points back at `/api/artist-art/:artist`, so ' +
        'the response still has to be decoded.',
    },
  },

  // ── Donations (public) ────────────────────────────────────────────────────
  'GET /api/public/donations/tiers': {
    summary: {
      uk: 'Розраховані ціни донатних черг для конкретної пісні.',
      en: 'Computed donation-tier prices for a specific song.',
    },
    query: {
      uk: '`songId` — обов’язковий, `id` з `/api/library`',
      en: '`songId` — required, the `id` from `/api/library`',
    },
    response: `{
  currency: 'UAH',
  pricingMode: 'fixed' | 'calculated',
  tiersEnabled: true,
  tiers: [{ tier: 1, price: 1 }, { tier: 2, price: 2 }, …],  // подвоюється з кожним tier
  flowType: 'checkout' | 'matching',
  chattingBlocked: false,
}`,
    errors: {
      uk:
        '`400` — донати вимкнено; `404` — пісні немає в бібліотеці; ' +
        '`409` — пісня зараз грає або буде наступною',
      en:
        '`400` — donations are disabled; `404` — song not in the library; ' +
        '`409` — the song is currently playing or up next',
    },
    notes: {
      uk:
        '`tiers` — порожній масив, якщо навіть перша черга перевищує ' +
        'максимальну суму транзакції активного провайдера. `flowType` каже, ' +
        'чого чекати від `POST /donations/create`: `checkout` одразу віддає ' +
        '`redirectUrl`, `matching` — сторінку автора й код підтвердження. ' +
        '`chattingBlocked` стосується лише `RADIO_HOSTS_MODE` — черга на паузі, ' +
        'і донати тимчасово не приймаються.',
      en:
        '`tiers` is an empty array when even the first tier exceeds the active ' +
        'provider’s max transaction amount. `flowType` tells you what to expect ' +
        'from `POST /donations/create`: `checkout` returns a `redirectUrl` ' +
        'right away, `matching` returns the creator’s page and a confirmation ' +
        'code instead. `chattingBlocked` only applies under `RADIO_HOSTS_MODE` — ' +
        'the queue is paused and donations are temporarily refused.',
    },
  },

  'POST /api/public/donations/create': {
    summary: {
      uk: 'Оформлює донат на пісню за обраною чергою.',
      en: 'Places a donation order for a song at the chosen tier.',
    },
    body: `{ songId: 'day/artist - title.mp3', tier?: 2 }`,
    response: `// flowType: 'checkout' (LiqPay, Stripe)
{ donationId: '…', flowType: 'checkout', redirectUrl: 'https://…' }

// flowType: 'matching' (Donatello, Ko-fi)
{
  donationId: '…', flowType: 'matching',
  pageUrl: 'https://…', matchCode: 'F7BQFF',
  amount: 40, currency: 'UAH', expiresAt: 1700000000000,
}`,
    errors: {
      uk:
        '`400` — донати вимкнено або обрана черга недоступна; `404` — пісні ' +
        'немає в бібліотеці; `409` — пісня зараз грає, буде наступною, або ' +
        'донати призупинено (`RADIO_HOSTS_MODE`)',
      en:
        '`400` — donations are disabled or the chosen tier is unavailable; ' +
        '`404` — song not in the library; `409` — the song is currently ' +
        'playing, up next, or donations are paused (`RADIO_HOSTS_MODE`)',
    },
    notes: {
      uk:
        'Пісня потрапляє в чергу **лише** після серверного підтвердження ' +
        'оплати (вебхук для `checkout`/Ko-fi, опитування для Donatello) — ' +
        'ніколи напряму від клієнта. Для `matching`-провайдерів `redirectUrl` ' +
        'не повертається: покажіть `pageUrl` і попросіть вписати `matchCode` у ' +
        'коментар до донату; результат прийде подією `donation_result` або ' +
        'опитуванням `/donations/:id/status`.',
      en:
        'The song is queued **only** after server-side payment confirmation ' +
        '(a webhook for `checkout`/Ko-fi, polling for Donatello) — never ' +
        'directly from the client. For `matching` providers no `redirectUrl` ' +
        'is returned: show `pageUrl` and ask the donor to include `matchCode` ' +
        'in their donation comment; the outcome arrives via the `donation_result` ' +
        'event or by polling `/donations/:id/status`.',
    },
  },

  'GET /api/public/donations/:id/status': {
    summary: {
      uk: 'Поточний статус конкретного донату.',
      en: 'Current status of a specific donation.',
    },
    response: `{
  status: 'pending' | 'paid' | 'paid_unqueued' | 'failed' | 'expired',
  tier: 2 | null,
  matchCode: 'F7BQFF' | null,
  expiresAt: 1700000000000 | null,
}`,
    errors: {
      uk: '`404` — донату з таким `id` немає, або він належить іншому `uid`',
      en: '`404` — no donation with that `id`, or it belongs to a different `uid`',
    },
    notes: {
      uk:
        'Належність перевіряється за `uid`, виведеним з IP запиту — тим самим, ' +
        'яким позначався донат при створенні. Призначений для сторінки ' +
        'повернення з оплати (`checkout`) або для опитування під час очікування ' +
        'коду (`matching`).',
      en:
        'Ownership is checked against the `uid` derived from the request IP — ' +
        'the same one the donation was stamped with on creation. Meant for the ' +
        'payment return page (`checkout`) or for polling while waiting on a ' +
        'code (`matching`).',
    },
  },

  'POST /webhooks/donations/:provider': {
    summary: {
      uk: 'Підтвердження оплати від платіжного провайдера.',
      en: 'Payment confirmation from a donation provider.',
    },
    response: {
      uk: '`200` завжди (навіть при відхиленні) — так провайдери не ретраять без потреби; `404` — невідомий/невлаштований провайдер',
      en: '`200` always (even on rejection) — so providers do not retry needlessly; `404` — unknown/unconfigured provider',
    },
    notes: {
      uk:
        'Не для виклику з клієнта. `:provider` — один з `liqpay`, `stripe`, ' +
        '`donatello`, `kofi`. Змонтований **до** `express.json()`, тож підпис ' +
        'перевіряється по сирому тілу запиту: HMAC для LiqPay/Stripe, ' +
        '`verification_token` для Ko-fi. Donatello сюди нічого не шле — там ' +
        'опитування, не вебхук.',
      en:
        'Not meant to be called from a client. `:provider` is one of `liqpay`, ' +
        '`stripe`, `donatello`, `kofi`. Mounted **before** `express.json()`, so ' +
        'the signature is verified against the raw request body: HMAC for ' +
        'LiqPay/Stripe, a `verification_token` for Ko-fi. Donatello never posts ' +
        'here — it is polled instead of receiving a webhook.',
    },
  },

  // ── Donations (admin) ─────────────────────────────────────────────────────
  'GET /api/admin/donations/settings': {
    summary: {
      uk: 'Поточні налаштування донатів і список провайдера.',
      en: 'Current donation settings and the active provider.',
    },
    response: `{
  settings: {
    currency: 'UAH', pricingMode: 'fixed' | 'calculated',
    fixedPrice: 1, pricePerSecond: 0.02,
    tiersEnabled: true, tierCeiling: 5,
    blockDonationsWhileChatting: false,
  },
  radioHostsMode: false,
  provider: null | { id: 'donatello', displayName: 'Donatello', supportedCurrencies: ['UAH'] },
  historyCurrencies: ['UAH'],   // валюти, що реально зустрічались в історії донатів
  donationRetentionDays: 365,
}`,
    notes: {
      uk:
        'Доступно будь-якому адміну без окремого привілею — так само, як ' +
        '`GET /api/admin/settings`. Запис вимагає `donations_manage`.',
      en:
        'Available to any admin without a dedicated privilege — same pattern ' +
        'as `GET /api/admin/settings`. Writing requires `donations_manage`.',
    },
  },

  'POST /api/admin/donations/settings': {
    summary: {
      uk: 'Зберігає налаштування донатів.',
      en: 'Saves donation settings.',
    },
    body: `{ currency, pricingMode, fixedPrice, pricePerSecond, tiersEnabled, tierCeiling, blockDonationsWhileChatting }`,
    response: `{ settings: { … }, clamped: false }`,
    notes: {
      uk:
        'Якщо `tiersEnabled` і найгірший сценарій (найдовший трек у бібліотеці ' +
        'для `calculated`, або `fixedPrice` для `fixed`) на верхній черзі ' +
        'перевищує максимальну суму транзакції провайдера — `tierCeiling` ' +
        'автоматично знижується, а відповідь позначається `clamped: true`.',
      en:
        'If `tiersEnabled` and the worst case (the longest track in the ' +
        'library for `calculated`, or `fixedPrice` for `fixed`) at the top ' +
        'tier exceeds the provider’s max transaction amount, `tierCeiling` is ' +
        'automatically lowered and the response is flagged `clamped: true`.',
    },
  },

  'GET /api/admin/donations/history': {
    summary: {
      uk: 'Історія донатів з фільтром за періодом.',
      en: 'Donation history, filterable by time window.',
    },
    query: {
      uk: '`window` — `24h` \\| `7d` \\| `30d` \\| `max` (усі, обмежені `DONATION_RETENTION_DAYS`); `limit`, `offset` — пагінація',
      en: '`window` — `24h` \\| `7d` \\| `30d` \\| `max` (all, bounded by `DONATION_RETENTION_DAYS`); `limit`, `offset` — pagination',
    },
    response: `{ entries: [{ id, uid, songId, songTitle, songArtist, provider, currency, amount, tier, status, createdAt, paidAt }], total, offset, limit }`,
    notes: {
      uk: 'Потребує `donations_manage`.',
      en: 'Requires `donations_manage`.',
    },
  },

  'GET /api/admin/donations/price-preview': {
    summary: {
      uk: 'Ціна першої черги для довільної тривалості — для попереднього перегляду в модалці налаштувань.',
      en: 'First-tier price for an arbitrary duration — for the settings modal preview.',
    },
    query: {
      uk: '`durationSeconds` — необов’язковий, за замовчуванням береться найдовший трек у бібліотеці',
      en: '`durationSeconds` — optional, defaults to the longest track in the library',
    },
    response: `{ basePrice: 1 }`,
    notes: {
      uk: 'Потребує `donations_manage`. Рахує за поточними, ще не збереженими значеннями форми не можна — лише за вже збереженими налаштуваннями.',
      en: 'Requires `donations_manage`. Computes against the already-saved settings, not unsaved form values.',
    },
  },

  // ── Administration ───────────────────────────────────────────────────────
  'POST /api/admin/login': {
    summary: {
      uk: 'Вхід адміністратора.',
      en: 'Admin login.',
    },
    body: `{ login: '…', password: '…' }`,
    response: `{ ok: true }              // in production
{ ok: true, token: '…' }  // in development`,
    errors: {
      uk: '`400` — не передано логін чи пароль; `401` — невірні дані',
      en: '`400` — login or password missing; `401` — wrong credentials',
    },
    notes: {
      uk:
        '**У продакшені токена в тілі відповіді немає** — він приходить лише в ' +
        'httpOnly-куці `adminToken`. Тобто клієнт мусить надсилати запити з ' +
        '`credentials: "include"`, а його походження — бути в `CLIENT_ORIGIN`. ' +
        'Токен живе 12 годин. Кількість спроб входу обмежена.',
      en:
        '**In production the token is not in the response body** — it arrives only ' +
        'in the httpOnly `adminToken` cookie. Your client must send requests with ' +
        '`credentials: "include"`, and its origin must be listed in ' +
        '`CLIENT_ORIGIN`. The token lasts 12 hours. Login attempts are rate-limited.',
    },
  },

  'POST /api/admin/logout': {
    summary: {
      uk: 'Вихід: очищає куку з токеном.',
      en: 'Logout: clears the token cookie.',
    },
    response: '{ ok: true }',
  },

  'GET /api/admin/songs': {
    summary: 'Уся бібліотека режиму зі статусом текстів.',
    query: '`mode` — `day` або `night`; без нього береться поточний режим радіо',
    response: `[{
  id: 'day/artist - title.mp3',
  title: 'Title', artist: 'Artist',
  filename: 'day/artist - title.mp3',
  lyricsStatus: 'synced' | 'plain' | 'none',
}]`,
    notes:
      'На відміну від публічного `/api/library`, показує обидва режими на вибір ' +
      'і додає стан текстів. Окремого привілею не потребує — досить бути ' +
      'автентифікованим адміном.',
  },

  'POST /api/admin/upload-check-duplicate': {
    summary: 'Перевіряє, чи такий трек уже є, до завантаження файлу.',
    body: `{ trackId: 'day/artist - title.mp3' }`,
    response: '{ ok: true, exists: false }',
    notes:
      'Дешева перевірка перед довгим завантаженням. `trackId` будується як ' +
      '`<режим>/<ім’я файлу>`.',
  },

  'POST /api/admin/upload-song-file': {
    summary: 'Крок 1 завантаження: кладе MP3 у сховище й читає теги.',
    query: '`mode` — `day` або `night` (типово `day`)',
    headers: '`X-File-Name` — ім’я файлу у відсотковому кодуванні; `Content-Type: audio/mpeg`',
    body: 'сирі байти MP3, не multipart. Обмеження — 80 МБ',
    response: `{
  ok: true,
  storageKey: 'day/artist - title.mp3',
  metadata: { artist, title, album, year, duration, mode, filename, storageKey },
}`,
    errors:
      '`400` — порожнє тіло або не MP3; `409` — трек із таким іменем уже існує; ' +
      '`400` — помилка запису у сховище',
    notes:
      'Тіло надсилається сирими байтами (`express.raw`), а **не** як ' +
      '`multipart/form-data` — це найчастіша причина `400` на цьому кроці. ' +
      'Метадані читаються з ID3-тегів; відсутні поля заповнюються запасними ' +
      'значеннями. У бібліотеку трек ще не потрапляє.',
  },

  'POST /api/admin/upload-song-lyrics': {
    summary: 'Крок 2 завантаження: шукає текст пісні через LRCLIB.',
    body: `{ title, artist, album?, duration? }`,
    response: `{
  ok: true,
  lyricsEntry: { synced: true, lines: [{ time, text }] },
  lyricsStatus: 'synced' | 'plain' | 'none',
  lyricsFormat: '…',
  message: { uk: '…', en: '…' },
}`,
    errors: '`400` — немає `title` чи `artist`; `500` — не вдалося звернутися до LRCLIB',
    notes:
      'Крок необов’язковий і не потребує жодних облікових даних: LRCLIB відкритий. ' +
      'Навіть при `500` у відповіді є придатний `lyricsEntry` з `notFound: true`, ' +
      'тож завантаження можна продовжити.',
  },

  'POST /api/admin/upload-song-commit': {
    summary: 'Крок 3 завантаження: заносить трек у бібліотеку.',
    body: `{
  metadata: { … },      // з кроку 1, з можливими правками користувача
  lyricsEntry: { … },   // з кроку 2, необов’язково
}`,
    response: `{ ok: true, track: { … }, lyricsStatus, lyricsFormat, lyricsMessage, message }`,
    errors: '`400` — бракує `metadata.filename` чи `metadata.mode`, або збій запису',
    notes:
      'Аж до цього кроку трек не бере участі в ефірі. Після успіху сервер ' +
      'широкомовно шле подію `library_updated` — оновіть свої списки за нею. ' +
      'Для денних треків заразом створюється запис арту виконавця.',
  },

  'POST /api/admin/song-editor/save': {
    summary: 'Зберігає метадані, текст і зсув тексту для треку.',
    body: `{
  songId: 'day/artist - title.mp3',
  metadata: { title, artist, album, year },
  metadataChanged: false,   // прапорці визначають, які привілеї потрібні
  lyricsEntry: { … },  lyricsChanged: false,
  offset: 0,           offsetChanged: false,
}`,
    errors:
      '`400` — немає `songId` чи `metadata`; `403` — бракує привілею для того, ' +
      'що змінюється; `404` — трек не знайдено; `409` — трек заблоковано',
    notes:
      'Потрібний привілей залежить від прапорців: правка метаданих вимагає ' +
      '`editor_meta`, правка тексту — `editor_lyrics` або `editor_meta`. ' +
      '**`409` — очікувана відповідь**, а не збій: трек не можна редагувати, ' +
      'поки він звучить або стоїть наступним; причина приходить у полі ' +
      '`localized`. Зміна метаданих перезаписує ID3-теги у сховищі, тож ' +
      'ідентифікатор треку може змінитися.',
  },

  // ── Administrative assistants ──────────────────────────────────────────────
  'GET /api/admin/admins': {
    summary: 'Список помічників та перелік можливих привілеїв.',
    response: `{
  ok: true,
  admins: [{ adminId, login, privileges, authorized }],
  allPrivileges: ['queue_manage', '…'],
}`,
    notes: 'Хешів паролів у відповіді немає. `allPrivileges` зручно брати для побудови форми.',
  },

  'POST /api/admin/admins': {
    summary: 'Створює помічника.',
    body: `{ login: '…', password: '…', privileges: ['queue_manage'] }`,
    response: `{ ok: true, admin: { … }, message: { uk: '…', en: '…' } }`,
    notes:
      'Пароль тут — **тимчасовий**: обліковий запис створюється з ' +
      '`authorized: false` і нічого не може, доки помічник не активує себе ' +
      'через `/admins/self/activate`.',
  },

  'PUT /api/admin/admins/:id/privileges': {
    summary: 'Змінює набір прав помічника.',
    body: `{ privileges: ['queue_manage', 'stats'] }`,
    notes:
      'Якщо помічник зараз онлайн, він одразу отримає подію ' +
      '`privileges_updated` — зміна діє **без повторного входу**.',
  },

  'PUT /api/admin/admins/:id/reset-password': {
    summary: 'Скидає пароль помічника на новий тимчасовий.',
    body: `{ newPassword: '…' }`,
    notes: 'Обліковий запис знову стає неавторизованим і потребує повторної активації.',
  },

  'DELETE /api/admin/admins/:id': {
    summary: 'Видаляє помічника.',
    notes:
      'Якщо він онлайн, його з’єднання отримає `force_logout` з ' +
      '`reason: "admin_deleted"` і сесія обірветься негайно.',
  },

  'POST /api/admin/admins/self/activate': {
    summary: 'Активація помічником самого себе після створення.',
    body: `{ tempPassword: '…', newPassword: '…' }`,
    errors: '`400` — для супер-адміна не застосовується, або тимчасовий пароль невірний',
    notes:
      'Єдина дія, доступна помічнику з `authorized: false`. Після успіху ' +
      'приходить подія `admin_authorized`.',
  },

  'PUT /api/admin/admins/self/login': {
    summary: 'Зміна власного логіна.',
    body: `{ newLogin: '…', currentPassword: '…' }`,
    errors: '`400` — для супер-адміна не застосовується, або пароль невірний',
  },

  'PUT /api/admin/admins/self/password': {
    summary: 'Зміна власного пароля.',
    body: `{ currentPassword: '…', newPassword: '…' }`,
    errors: '`400` — для супер-адміна не застосовується, або пароль невірний',
    notes: 'Пароль супер-адміна змінюється лише через `ADMIN_PASS` у `.env`.',
  },

  // ── Lyrics ─────────────────────────────────────────────────────────
  'GET /api/admin/lyrics/songs': {
    summary: 'Треки зі станом текстів — вихідні дані для редактора.',
    response: '{ items: [ … ] }',
  },

  'GET /api/admin/lyrics/cache-index': {
    summary: 'Легкий перелік того, для чого текст уже є.',
    response: '{ items: [ … ] }',
    notes: 'Дешевша альтернатива `/cache-full`, коли потрібен лише перелік.',
  },

  'GET /api/admin/lyrics/cache-full': {
    summary: 'Повний кеш текстів.',
    notes: 'Віддає все одним шматком — для великої бібліотеки відповідь важка.',
  },

  'GET /api/admin/lyrics/cache-entry': {
    summary: 'Текст одного треку.',
    query: '`songId`, або пара `title` + `artist`',
  },

  'PUT /api/admin/lyrics/cache': {
    summary: 'Зберігає відредагований текст.',
    body: `{ title: '…', artist: '…', entry: { synced: true, lines: [{ time, text }] } }`,
    response: '{ ok: true }',
    notes: 'Ключ — пара «виконавець + назва», а не ідентифікатор треку.',
  },

  'DELETE /api/admin/lyrics/cache': {
    summary: 'Видаляє текст із кешу.',
    query: '`title` і `artist`',
    response: '{ ok: true, existed: true }',
    notes: 'Після видалення текст буде перезапитано з LRCLIB при наступному зверненні.',
  },

  'GET /api/admin/lyrics/offsets': {
    summary: 'Усі збережені зсуви синхронізації текстів.',
  },

  'GET /api/admin/lyrics/audio-preview': {
    summary: 'Посилання на аудіо для звірки таймкодів у редакторі.',
    query: '`title` і `artist`',
    response: `{ url: 'https://…' }`,
    notes:
      'У cloud-режимі — тимчасове посилання R2; у local — посилання на ' +
      '`/api/audio/stream/admin`, який приймає адмінський токен і не потребує ' +
      'art/audio токенів.',
  },

  'POST /api/lyrics/offset': {
    summary: 'Зберігає зсув синхронізації тексту для треку.',
    body: `{ title: '…', artist: '…', offset: 0.5 }`,
    errors: '`400` — немає `title` чи `artist`',
    notes:
      'Зверніть увагу на шлях: він **без** префікса `/admin`, хоча вимагає ' +
      'адмінського токена. Зсув у секундах, може бути від’ємним.',
  },

  // ── Song groups ──────────────────────────────────────────────────────────
  'GET /api/admin/song-groups': {
    summary: 'Усі групи пісень з кількістю треків і попереднім переглядом.',
    response: '{ items: [{ id, name, mode, songCount, songsPreview }] }',
    notes: 'Читання доступне будь-якому адміну; зміни потребують `settings_groups`.',
  },

  'GET /api/admin/song-groups/library': {
    summary: 'Пошук по бібліотеці для наповнення групи.',
    query: '`mode` (типово `day`), `query`, `offset` (0), `limit` (5)',
  },

  'POST /api/admin/song-groups': {
    summary: 'Створює групу пісень.',
    body: `{ name: '…', mode: 'day' | 'night', songs: ['day/…'] }`,
    notes: 'Потребує `settings_groups`.',
  },

  'PUT /api/admin/song-groups/:groupId': {
    summary: 'Оновлює групу: назву або склад треків.',
    body: 'ті самі поля, що й при створенні',
    notes: 'Потребує `settings_groups`.',
  },

  'DELETE /api/admin/song-groups/:groupId': {
    summary: 'Видаляє групу пісень.',
    notes: 'Потребує `settings_groups`. На вже поставлені в чергу треки не впливає.',
  },

  'POST /api/admin/song-groups/:groupId/insert': {
    summary: 'Ставить усю групу в чергу.',
    errors: '`400` — група порожня, не вміщується до зміни режиму або діє кулдаун',
    notes:
      'Потребує **обох** привілеїв — `queue_manage` і `settings_groups`, — бо ' +
      'дія зачіпає і ефір, і склад груп. Наявності лише одного з них ' +
      'недостатньо. Те саме робить подія `admin_insert_song_group` з тими ж ' +
      'вимогами, тож обійти правило через сокет не вийде.',
  },

  // ── Track operations ──────────────────────────────────────────────────
  'GET /api/admin/song-editor/download': {
    summary: 'Завантажити вихідний файл треку.',
    notes: 'Потребує `editor_meta`. Віддає той самий MP3, що лежить у сховищі.',
  },

  'POST /api/admin/song-editor/move-mode': {
    summary: 'Переносить трек між денним і нічним режимом.',
    notes:
      'Потребує `editor_meta`. Файл фізично переміщується між режимами — у ' +
      'префіксах бакета або в теках на диску, залежно від сховища. ' +
      'Ідентифікатор треку змінюється разом з режимом, бо містить його у ' +
      'своєму складі.',
  },

  'DELETE /api/admin/song-editor': {
    summary: 'Видаляє трек із бібліотеки та сховища.',
    errors: '`409` — трек звучить зараз або стоїть наступним',
    notes:
      'Потребує `editor_meta`. Якщо це був останній денний трек виконавця, ' +
      'заразом прибирається його запис арту. Для не-супер-адмінів діє добова ' +
      'квота видалень.',
  },

  'POST /api/admin/song-editor/batch-delete': {
    summary: 'Видаляє кілька позначених треків.',
    notes:
      'Потребує `editor_meta`. Заблоковані треки пропускаються, а не валять ' +
      'усю операцію. Добова квота — 30 видалень для не-супер-адмінів; при ' +
      'перевищенні у відповіді буде залишок.',
  },

  'POST /api/admin/song-editor/batch-move': {
    summary: 'Переносить кілька треків між режимами.',
    notes: 'Потребує `editor_meta`. Працює на будь-якому сховищі.',
  },

  'POST /api/admin/upload-batch-delete': {
    summary: 'Видаляє щойно завантажені треки.',
    notes:
      'Потребує `upload_songs`. Призначено для скасування свіжого ' +
      'завантаження, тоді як `song-editor/batch-delete` працює з усією ' +
      'бібліотекою і вимагає іншого привілею.',
  },

  'POST /api/admin/upload-batch-move': {
    summary: 'Переносить щойно завантажені треки між режимами.',
    notes: 'Потребує `upload_songs`.',
  },

  'GET /api/audio/stream/admin': {
    summary: 'Аудіо треку для адмінських інтерфейсів.',
    query: '`track` — ідентифікатор треку',
    notes:
      'Приймає адмінський токен у заголовку **або в query**, і не потребує ' +
      'art/audio токенів. Саме тому придатний для `<audio src>` у редакторі, ' +
      'де заголовки задати неможливо.',
  },

  // ── Import from YouTube ──────────────────────────────────────────────────────
  'GET /api/admin/ytbdown-status': {
    summary: 'Чи готовий інструмент завантаження з YouTube.',
    response: '{ ok: true, … }',
    notes:
      'Викликайте перед показом форми імпорту: інструмент вимагає Python і ' +
      'FFmpeg, і на частині розгортань недоступний.',
  },

  'POST /api/admin/youtube-track-info': {
    summary: 'Читає перелік треків за посиланням на відео або плейлист.',
    body: `{ url: 'https://www.youtube.com/…', lang: 'uk' }`,
    errors:
      '`400` — посилання немає або воно не з YouTube; `503` — інструмент ' +
      'недоступний; `504` — плейлист читався надто довго',
    notes:
      'Нічого не завантажує — лише повертає, що знайдено за посиланням, щоб ' +
      'користувач обрав потрібне.',
  },

  'POST /api/admin/upload-song-url': {
    summary: 'Завантажує аудіо з YouTube у сховище.',
    body: `{ url: 'https://www.youtube.com/watch?v=…' }`,
    notes:
      'Найдовша операція в усьому API: включає завантаження й перекодування ' +
      'через FFmpeg. Далі трек проходить ті самі кроки тексту й коміту, що й ' +
      'звичайне завантаження файлу.',
  },

  'POST /api/admin/youtube-cookies': {
    summary: 'Зберігає куки YouTube для обходу вікової перевірки.',
    body: `{ cookies: '… # Netscape HTTP Cookie File …' }`,
    errors: '`400` — порожньо або рядок не містить `youtube.com`',
    notes:
      'Куки пишуться у тимчасову теку сервера і живуть до перезапуску. ' +
      'Потрібні лише для відео з обмеженнями. Це чутливі дані: вони дають ' +
      'доступ до облікового запису, з якого їх узято.',
  },

  // ── Artists' art ───────────────────────────────────────────────────────
  'GET /api/admin/artist-arts': {
    summary: 'Перелік виконавців із позначкою, у кого є арт.',
    notes: 'Записи створюються автоматично при завантаженні денного треку.',
  },

  'GET /api/admin/artist-arts/file/:artist': {
    summary: 'Файл арту для перегляду в адмінці.',
    notes: 'На відміну від клієнтського `/api/artist-art/:artist`, віддається без XOR-обгортки.',
  },

  'POST /api/admin/artist-arts/upload': {
    summary: 'Завантажує зображення виконавця.',
    headers: '`Content-Type: image/jpeg`',
    body: 'сирі байти JPEG, до 10 МБ',
    notes:
      'Приймається **лише JPEG** — PNG чи WebP дадуть помилку. Зображення ' +
      'очікується вже обрізаним під вертикальний формат: клієнт робить це ' +
      'перед надсиланням.',
  },

  'DELETE /api/admin/artist-arts/:artist': {
    summary: 'Видаляє арт виконавця.',
    notes: 'Сам запис виконавця лишається, зникає тільки зображення.',
  },

  // ── Settings ──────────────────────────────────────────────────────────
  'GET /api/admin/settings': {
    summary: 'Усі налаштування радіо.',
    notes:
      'Доступно будь-якому адміну без окремого привілею — інтерфейсу потрібні ' +
      'ці дані для ініціалізації. Обмежується лише запис.',
  },

  'POST /api/admin/settings': {
    summary: 'Зберігає налаштування; кожна секція під своїм привілеєм.',
    body: `{
  branding:   { telegram_url, byLang: { uk: { dayRadioName, … } } },
  generation: { DAY_ALGORYTM, MAX_DAY_DURATION, GROUP_DEFS, … },
  radioHosts: { guestMaxDurationMinutes, specialGuestMaxDurationMinutes, backgroundMusicMode },
  songGroups: [ … ],   // ігнорується
}`,
    errors: '`403` — бракує привілею на секцію, яка змінюється; `400` — дані не пройшли валідацію',
    notes:
      'Авторизація йде за тим, що **реально змінюється**, а не за тим, що ' +
      'надіслано: адмінка завжди шле всі секції. `branding` потребує ' +
      '`settings_branding`, `generation` — `settings_algorithm`, `radioHosts` — ' +
      '`radio_moderator`. `songGroups` тут ігнорується: групи редагуються через ' +
      '`/api/admin/song-groups`. Деталі — у [Привілеях](/reference/privileges).',
  },

  // ── Jingles ───────────────────────────────────────────────────────────────
  'GET /api/admin/jingles/counts': {
    summary: 'Скільки джинглів є і скільки з них придатні до ефіру.',
    response: `{
  ok: true,
  day: 12, night: 8,          // усього
  dayUsable: 10, nightUsable: 6,  // позначені як активні
  minRequired: 3,             // мінімум для ротації
}`,
    notes:
      'Єдиний ендпоінт розділу без `jingles_uploader` — щоб інтерфейс міг ' +
      'показати стан будь-якому адміну. Якщо придатних менше за `minRequired`, ' +
      'джингли в ефір не підставляються.',
  },

  'GET /api/admin/jingles': {
    summary: 'Список джинглів з пагінацією та пошуком.',
    notes: 'Віддається з кешу в пам’яті, тож запит дешевий.',
  },

  'POST /api/admin/jingles/upload-check-duplicate': {
    summary: 'Перевіряє, чи є вже джингл з таким іменем файлу.',
    body: `{ filename: 'jingle.mp3' }`,
    notes: 'Імена джинглів унікальні глобально, а не в межах режиму.',
  },

  'POST /api/admin/jingles/upload': {
    summary: 'Завантажує джингл.',
    query: '`mode` — `day` або `night` (типово `day`)',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'сирі байти MP3, не multipart. Обмеження — 80 МБ',
    response: `{ ok: true, jingle: { id, filename, mode, duration, used } }`,
    errors: '`400` — порожнє тіло, не MP3 або конфігурація не підходить; `409` — таке ім’я вже є',
    notes:
      'Як і при завантаженні треку, тіло надсилається сирими байтами. Новий ' +
      'джингл одразу активний (`used: true`). Якщо запис у базу не вдався, ' +
      'файл прибирається зі сховища — «осиротілих» файлів не лишається. ' +
      'Після успіху широкомовно йде подія `jingles_updated`.',
  },

  'GET /api/admin/jingles/:id/audio': {
    summary: 'Аудіо джингла для прослуховування в адмінці.',
    notes:
      'Повертає `{ url }`. У хмарі це підписане посилання на бакет, при ' +
      'локальному сховищі — абсолютне посилання на `/api/admin/jingles/file` ' +
      'з токеном у запиті.',
  },

  'GET /api/admin/jingles/file': {
    summary: 'Віддає сам файл джингла з локального сховища.',
    query: '`mode` — `day` або `night`; `filename` — ім\'я файлу; `adminToken` — токен адміна',
    notes:
      'Потрібен лише при локальному сховищі: у хмарі клієнт іде за підписаним ' +
      'посиланням просто в бакет. Токен приймається і в заголовку, і в рядку ' +
      'запиту, бо програвач хвильової форми качає посилання звичайним `fetch` ' +
      'без заголовків. Вихід за межі теки джинглів дає `400`, відсутній файл — `404`.',
  },

  'POST /api/admin/jingles/:id/used': {
    summary: 'Вмикає або вимикає джингл у ротації.',
    notes:
      'Вимкнений джингл лишається у сховищі, але в ефір не потрапляє. Так ' +
      'зручно тимчасово прибрати сезонний джингл, не видаляючи його.',
  },

  'POST /api/admin/jingles/batch-delete': {
    summary: 'Видаляє кілька джинглів за раз.',
    body: `{ ids: ['…', '…'] }`,
  },

  'POST /api/admin/jingles/batch-move': {
    summary: 'Переносить кілька джинглів між денним і нічним режимом.',
    body: `{ ids: ['…'], targetMode: 'day' | 'night' }`,
    notes: 'Файли переміщуються у сховищі, тож операція не миттєва.',
  },

  // ── Background music ─────────────────────────────────────────────────────────
  'GET /api/admin/background-music/counts': {
    summary: 'Скільки фонових треків доступно.',
    notes: 'Доступно будь-якому адміну, як і лічильник джинглів.',
  },

  'GET /api/admin/background-music': {
    summary: 'Список фонових треків з пагінацією.',
    notes:
      'Ведучий в ефірі бачить той самий список через подію ' +
      '`host_get_background_music_list`.',
  },

  'POST /api/admin/background-music/upload-check-duplicate': {
    summary: 'Перевіряє ім’я файлу до завантаження.',
    body: `{ filename: 'ambient.mp3' }`,
  },

  'POST /api/admin/background-music/upload': {
    summary: 'Завантажує фоновий трек.',
    query: '`mode` — `day` або `night`',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'сирі байти MP3, до 80 МБ',
    notes: 'Після успіху йде подія `background_music_updated`.',
  },

  'GET /api/admin/background-music/:id/audio': {
    summary: 'Аудіо фонового треку для прослуховування.',
    notes:
      'Влаштований так само, як `/api/admin/jingles/:id/audio`: у хмарі — ' +
      'підписане посилання, локально — посилання на `/api/admin/background-music/file`.',
  },

  'GET /api/admin/background-music/file': {
    summary: 'Віддає сам файл фонової музики з локального сховища.',
    query: '`mode` — `day` або `night`; `filename` — ім\'я файлу; `adminToken` — токен адміна',
    notes:
      'Повний аналог `/api/admin/jingles/file` для фонової музики: потрібен ' +
      'лише при локальному сховищі, приймає токен у заголовку або в запиті.',
  },

  'POST /api/admin/background-music/:id/used': {
    summary: 'Вмикає або вимикає трек у доборі.',
  },

  'POST /api/admin/background-music/batch-delete': {
    summary: 'Видаляє кілька фонових треків.',
    body: `{ ids: ['…'] }`,
  },

  'POST /api/admin/background-music/batch-move': {
    summary: 'Переносить фонові треки між режимами.',
    body: `{ ids: ['…'], targetMode: 'day' | 'night' }`,
  },

  // ── Phrases ───────────────────────────────────────────────────────────────
  'GET /api/admin/phrases/counts': {
    summary: 'Скільки фраз є і скільки з них придатні до ефіру.',
    response: `{
  ok: true,
  day: 5, night: 3,          // усього
  dayUsable: 4, nightUsable: 2,  // позначені як активні
  minRequired: 1,             // мінімум, щоб прапорець "Фрази в ефірі" можна було увімкнути
}`,
    notes:
      'Єдиний ендпоінт розділу без `jingles_uploader` — щоб інтерфейс міг ' +
      'показати стан будь-якому адміну. На відміну від джинглів, налаштування ' +
      '"Фрази в ефірі" в адмінці буде заблоковано (не просто попереджено), ' +
      'доки в кожному активному режимі не буде хоча б `minRequired` придатних фраз.',
  },

  'GET /api/admin/phrases': {
    summary: 'Список фраз з пагінацією та пошуком.',
    notes: 'Віддається з кешу в пам’яті, тож запит дешевий.',
  },

  'POST /api/admin/phrases/upload-check-duplicate': {
    summary: 'Перевіряє, чи є вже фраза з таким іменем файлу.',
    body: `{ filename: 'phrase.mp3' }`,
    notes: 'Імена фраз унікальні глобально, а не в межах режиму.',
  },

  'POST /api/admin/phrases/upload': {
    summary: 'Завантажує фразу.',
    query: '`mode` — `day` або `night` (типово `day`)',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'сирі байти MP3, не multipart. Обмеження — 10 МБ',
    response: `{ ok: true, phrase: { id, filename, mode, duration, used } }`,
    errors:
      '`400` — порожнє тіло, не MP3, тривалість довша за ~5 секунд або її не ' +
      'вдалося визначити, або конфігурація не підходить; `409` — таке ім’я вже є',
    notes:
      'На відміну від джинглів і фонової музики, тривалість тут перевіряється ' +
      'суворо: фраза довша за 5 секунд (з невеликим допуском) або без визначеної ' +
      'тривалості відхиляється. Нова фраза одразу активна (`used: true`). Якщо ' +
      'запис у базу не вдався, файл прибирається зі сховища. Після успіху ' +
      'широкомовно йде подія `phrases_updated`.',
  },

  'GET /api/admin/phrases/:id/audio': {
    summary: 'Аудіо фрази для прослуховування в адмінці.',
    notes:
      'Повертає `{ url }`. У хмарі це підписане посилання на бакет, при ' +
      'локальному сховищі — абсолютне посилання на `/api/admin/phrases/file` ' +
      'з токеном у запиті.',
  },

  'GET /api/admin/phrases/file': {
    summary: 'Віддає сам файл фрази з локального сховища.',
    query: '`mode` — `day` або `night`; `filename` — ім\'я файлу; `adminToken` — токен адміна',
    notes:
      'Повний аналог `/api/admin/jingles/file` для фраз: потрібен лише при ' +
      'локальному сховищі, приймає токен у заголовку або в запиті.',
  },

  'POST /api/admin/phrases/:id/used': {
    summary: 'Вмикає або вимикає фразу в ротації.',
  },

  'POST /api/admin/phrases/batch-delete': {
    summary: 'Видаляє кілька фраз за раз.',
    body: `{ ids: ['…', '…'] }`,
  },

  'POST /api/admin/phrases/batch-move': {
    summary: 'Переносить кілька фраз між денним і нічним режимом.',
    body: `{ ids: ['…'], targetMode: 'day' | 'night' }`,
    notes: 'Файли переміщуються у сховищі, тож операція не миттєва.',
  },

  // ── Broadcast control ──────────────────────────────────────────────────────
  'POST /api/admin/switch-mode': {
    summary: 'Перемикає радіо між денним і нічним режимом.',
    body: `{
  targetMode: 'day' | 'night',
  scheduledTime: '23:30',   // необов’язково, HH:MM у часовому поясі сервера
}`,
    response: '{ ok: true }',
    errors:
      '`400` — `targetMode` не `day`/`night` або час не у форматі `HH:MM`; ' +
      '`409` — перемкнути зараз не можна (діє кулдаун або в черзі є донат)',
    notes:
      'Без `scheduledTime` перемикання відбувається одразу. Вказаний час, який ' +
      'уже минув сьогодні, трактується як завтрашній. При `409` у відповіді є ' +
      'прапорець `donated`, який пояснює причину.',
  },

  'GET /api/admin/stats': {
    summary: 'Зведена статистика бібліотеки та ефіру.',
    response: 'об’єкт зі зведенням по режимах, групах і тривалостях',
    notes: 'Потребує привілею `stats`. Обчислюється на льоту з поточного стану движка.',
  },

  'GET /api/admin/audit': {
    summary: 'Журнал дій адміністраторів.',
    query: '`window` — `24h` та інші проміжки; `limit` (типово 30); `offset`',
    response: `{ ok: true, entries: [ … ], total, offset, limit }`,
    notes:
      'Читається з кешу в пам’яті, тож запит дешевий. Записи автоматично ' +
      'видаляються через `LOG_RETENTION_DAYS` днів. Окремого привілею не ' +
      'потребує — доступно кожному адміну.',
  },

  'GET /api/admin/history': {
    summary: 'Повна історія програвань.',
    response: `{ ok: true, entries: [ … ], total }`,
    notes:
      'Потребує привілею `stats`. Записи автоматично видаляються через ' +
      '`LOG_RETENTION_DAYS` днів — тим самим розкладом, що й журнал адмін-дій.',
  },

  'GET /api/admin/verify': {
    summary: {
      uk: 'Перевіряє сесію і повертає актуальні привілеї.',
      en: 'Validates the session and returns current privileges.',
    },
    response: `{
  ok: true,
  role: 'super_admin' | 'admin',
  adminId: '…', login: '…',
  privileges: ['queue_manage', '…'],
  authorized: true,
}`,
    errors: {
      uk: '`401` — сесія недійсна або обліковий запис видалено',
      en: '`401` — invalid session, or the account no longer exists',
    },
    notes: {
      uk:
        'Для помічників привілеї перечитуються з бази, а не беруться з токена — ' +
        'саме тому зміни прав діють без повторного входу. Викликайте це на ' +
        'старті адмінського інтерфейсу.',
      en:
        'For helper admins privileges are re-read from the database rather than ' +
        'taken from the token — which is why permission changes take effect without ' +
        'logging in again. Call this when your admin UI starts.',
    },
  },
};
