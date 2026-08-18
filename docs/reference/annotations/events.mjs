export const EVENT_DOCS = {
  // ── Client → server ───────────────────────────────────────────────────────
  listener_init: {
    audience: 'listener',
    summary: {
      uk: 'Реєструє з’єднання як слухача і просить видати art-токен.',
      en: 'Registers the connection as a listener and asks for an art token.',
    },
    payload: { uk: 'без аргументів', en: 'no arguments' },
    notes: {
      uk:
        'Сервер не видає токен сам — поки клієнт не надішле цю подію, у відповідь ' +
        'не прийде `listener_uid`, і доступ до артів, текстів та аудіо буде закритий. ' +
        'Адмінські з’єднання цю подію ігнорують.',
      en:
        'The server does not hand out the token by itself — until the client sends ' +
        'this event, no `listener_uid` arrives and art, lyrics and audio stay closed. ' +
        'Admin connections ignore this event.',
    },
  },

  suggest_song: {
    audience: 'listener',
    summary: {
      uk: 'Замовити пісню з бібліотеки в ефір.',
      en: 'Request a song from the library to be played.',
    },
    payload: {
      uk: `// об’єкт пісні з GET /api/library
{ id: 'day/artist - title.mp3', title: 'Title', artist: 'Artist' }`,
      en: `// a song object from GET /api/library
{ id: 'day/artist - title.mp3', title: 'Title', artist: 'Artist' }`,
    },
    ack: {
      uk: `{ ok: true }
{ error: 'cooldown', secsLeft: 240 }
{ error: 'no_admin' }   // немає онлайн-адміна з правом на чергу
{ error: 'no_uid' }     // не надіслано listener_init`,
      en: `{ ok: true }
{ error: 'cooldown', secsLeft: 240 }
{ error: 'no_admin' }   // no online admin with queue rights
{ error: 'no_uid' }     // listener_init was never sent`,
    },
    notes: {
      uk:
        'Використовує підтверджувальний колбек — другим аргументом `emit`. ' +
        'Коди помилок тут — **звичайні рядки**, а не локалізовані об’єкти, на ' +
        'відміну від решти API. Кулдаун — 5 хвилин на `uid`; замовлення живе ' +
        '5 хвилин і згасає, якщо адмін не відповів.',
      en:
        'Uses an acknowledgement callback — the second argument to `emit`. The error ' +
        'codes here are **plain strings**, not locale objects, unlike the rest of the ' +
        'API. The cooldown is 5 minutes per `uid`; a request expires after 5 minutes ' +
        'if no admin responds.',
    },
  },

  stream_get_seek: {
    audience: 'listener',
    summary: 'Запитує поточну позицію спільного потоку (лише stream-режим).',
    payload: 'clientTs: number — локальний час клієнта',
    ack: `{ seek: 87.2, duration: 214.5, trackId: 'day/artist - title.mp3' }`,
    notes:
      'Потрібно лише щоб показати таймер в інтерфейсі: саме звучання у ' +
      'stream-режимі синхронне за побудовою. Поза stream-режимом сервер ' +
      'не відповідає взагалі.',
  },

  stream_ping: {
    audience: 'listener',
    summary: 'Вимірює затримку до сервера.',
    payload: 'clientTs: number',
    ack: '{ serverTs: number, clientTs: number }',
    notes:
      'Сервер повертає ваш `clientTs` без змін — різниця часу туди й назад дає ' +
      'оцінку затримки для точнішого позиціювання.',
  },

  // ── Server → client ───────────────────────────────────────────────────────
  sync: {
    audience: 'listener',
    summary: {
      uk: 'Повний стан радіо. Основна подія протоколу.',
      en: 'The complete radio state. The core event of the protocol.',
    },
    payload: `{
  track: 'day/artist - title.mp3',  // null під час перемикання режиму
  title: 'Title', artist: 'Artist', album: 'Album', year: 2020,
  duration: 214.5,
  seek: 87.2,                       // позиція на момент serverTimeMs
  isPlaying: true,
  playlist: [ /* до 10 наступних треків */ ],
  currentIndex: 3, totalTracks: 42,
  mode: 'day',                      // 'day' | 'night'
  pendingModeSwitch: null,
  skipCooldownSecsLeft: 0,
  uiSettings: { /* брендинг */ },
  serverTimeMs: 1754899200000,
  dayStartHour: 6, nightStartHour: 0,
}`,
    notes: {
      uk:
        'Надсилається кожні 2 секунди всім, а також одразу після підключення. ' +
        'Коли сервер перемикає режим, приходить скорочена форма з `isPreparing: true` ' +
        'і `track: null`. Коли ведучі ставлять чергу на паузу, `title` стає ' +
        '`"Just chatting"`, а `artist` порожніє.',
      en:
        'Broadcast to everyone every 2 seconds, and once immediately on connect. ' +
        'While the server switches modes a shortened form arrives with ' +
        '`isPreparing: true` and `track: null`. When hosts pause the queue, `title` ' +
        'becomes `"Just chatting"` and `artist` goes empty.',
    },
  },

  listener_uid: {
    audience: 'listener',
    summary: {
      uk: 'Відповідь на `listener_init`: ідентичність слухача і art-токен.',
      en: 'The reply to `listener_init`: listener identity and art token.',
    },
    payload: `{
  uid: '…',                 // виводиться з IP, клієнт його не обирає
  artToken: '…',
  artTokenExpiresIn: 3600,  // секунди
  cooldownSecsLeft: 0,      // до наступного замовлення пісні
}`,
    notes: {
      uk:
        'Слухачі за спільним NAT отримають однаковий `uid`, а отже спільний токен ' +
        'і спільний кулдаун замовлень.',
      en:
        'Listeners behind a shared NAT receive the same `uid`, and therefore share a ' +
        'token and a song-request cooldown.',
    },
  },

  usersUpdate: {
    audience: 'listener',
    summary: 'Список активних слухачів для показу в шапці.',
    payload: `[{ name: 'Ім’я', img: 'file.png', color: '#a3f01c' }]`,
    notes:
      'Слухачі анонімні: сервер видає кожному з’єднанню випадкове ім’я з набору ' +
      '«олігархів» і випадковий колір. Ім’я приходить уже локалізованим.',
  },

  radio_hosts_mode: {
    audience: 'listener',
    summary: 'Чи зібрано сервер із підтримкою живих ведучих.',
    payload: 'boolean',
    notes: 'Надсилається одразу після підключення, без запиту.',
  },

  radio_hosts_online: {
    audience: 'listener',
    summary: 'Чи є зараз хтось в ефірі.',
    payload: 'boolean',
    notes: 'Надсилається лише коли `radio_hosts_mode` увімкнено.',
  },

  suggestion_result: {
    audience: 'listener',
    summary: 'Рішення адміна щодо вашого замовлення.',
    payload: `{ accepted: true, auto: false, song: { title, artist, … } }`,
    notes:
      '`auto: true` означає, що замовлення згасло за таймером, а не було ' +
      'відхилене вручну. Приходить лише тому сокету, що замовляв.',
  },

  donation_result: {
    audience: 'listener',
    summary: {
      uk: 'Підсумок донат-замовлення: пісню додано до черги чи ні.',
      en: 'Outcome of a donation order: the song was queued or not.',
    },
    payload: {
      uk: `{ donationId, accepted: true, tier: 2 | null, song: { title, artist } }
{ donationId, accepted: false, reason: 'payment_failed' | 'no_slot' }`,
      en: `{ donationId, accepted: true, tier: 2 | null, song: { title, artist } }
{ donationId, accepted: false, reason: 'payment_failed' | 'no_slot' }`,
    },
    notes: {
      uk:
        'Приходить лише сокету, чий `listener_uid` збігається з донатером ' +
        '(обидва виводяться з IP). `no_slot` означає, що оплату підтверджено, ' +
        'але вставити пісню в чергу не вдалося (наприклад, не лишилось часу до ' +
        'зміни режиму) — донат позначається `paid_unqueued` і лишається видимим ' +
        'адміну в історії донатів.',
      en:
        'Sent only to the socket whose `listener_uid` matches the donor (both ' +
        'are derived from IP). `no_slot` means the payment was confirmed but the ' +
        'song could not be queued (e.g. not enough time before a mode switch) — ' +
        'the donation is marked `paid_unqueued` and stays visible to the admin ' +
        'in the donation history.',
    },
  },

  suggest_cooldown_update: {
    audience: 'listener',
    summary: 'Скільки секунд лишилось до можливості замовити наступну пісню.',
    payload: 'number — секунди, 0 якщо можна замовляти',
    notes:
      'Надсилається всім з’єднанням з тим самим `uid`, тож кілька вкладок ' +
      'бачать однаковий відлік.',
  },

  // ── Admin session and queue ───────────────────────────────────────────────
  admin_active: {
    audience: 'admin',
    summary: 'Підвищує з’єднання до адмінського й підтверджує сесію.',
    payload: 'token?: string — JWT; якщо не передати, береться з куки `adminToken`',
    notes:
      'Обов’язковий перший крок адмінського клієнта: доти сокет вважається ' +
      'звичайним слухачем і всі адмінські події ігноруються **мовчки**. ' +
      'У відповідь приходить `admin_confirmed` або `admin_error`. ' +
      'Привілеї перечитуються з бази, а не беруться з токена, тож зміна прав ' +
      'діє без релогіну. Попередня сесія того самого адміна автоматично ' +
      'відключається — одночасно живе лише одне з’єднання на обліковий запис.',
  },

  admin_confirmed: {
    audience: 'admin',
    summary: 'Сесію підтверджено; містить актуальні права.',
    payload: `{
  role: 'super_admin' | 'admin',
  privileges: ['queue_manage', '…'],
  authorized: true,   // false = помічник ще не активував себе
}`,
    notes:
      'Будуйте інтерфейс за цим списком, а не за тим, що було в токені. ' +
      '`authorized: false` означає, що помічник має спершу задати собі пароль.',
  },

  get_queue: {
    audience: 'admin',
    summary: 'Сторінка майбутньої черги.',
    payload: '{ offset?: number = 0, limit?: number = 10 }',
    ack: `{
  items: [{ id, title, artist, orderType }],
  total: 42,   // усього треків попереду
}`,
    notes: 'Відповідь приходить у колбеку. Поточний трек у вибірку не входить.',
  },

  search_queue: {
    audience: 'admin',
    summary: 'Пошук по майбутній черзі.',
    payload: '{ query?: string }',
    ack: `[{ id, title, artist, orderType, position }]`,
    notes:
      '`position` — це зсув від поточного треку, і саме його очікує ' +
      '`admin_remove_song`. Порожній запит повертає всю чергу.',
  },

  admin_add_song: {
    audience: 'admin',
    summary: 'Додає трек із бібліотеки в чергу.',
    payload: `{
  id: 'day/artist - title.mp3',
  title: 'Title', artist: 'Artist',
  orderType: 'lastinline' | 'donated',
}`,
    notes:
      'Потребує привілею `queue_manage`. `donated` ставить трек попереду ' +
      'звичайних замовлень. Результат приходить подіями `admin_success` або ' +
      '`admin_error`, а не колбеком. Між додаваннями діє кулдаун; сервер також ' +
      'відмовить, якщо той самий трек уже стоїть поруч у черзі або якщо черга ' +
      'не вміщується до перемикання режиму.',
  },

  admin_remove_song: {
    audience: 'admin',
    summary: 'Прибирає трек із черги за позицією.',
    payload: 'position: number — зсув від поточного треку, як у `search_queue`',
    notes:
      'Потребує `queue_manage`. Має власний кулдаун — при надто частих ' +
      'викликах повертається помилка з кількістю секунд очікування.',
  },

  admin_skip_song: {
    audience: 'admin',
    summary: 'Перемикає поточний трек.',
    payload: 'без аргументів',
    notes:
      'Потребує `queue_manage`. У stream-режимі сервер відмовить, якщо саме ' +
      'грає джингл або чергу поставлено на паузу ведучим. Кулдаун спільний із ' +
      'додаванням треків.',
  },

  admin_insert_song_group: {
    audience: 'admin',
    summary: 'Вставляє в чергу наперед задану групу пісень.',
    payload: '{ groupId: string }',
    notes:
      'Потребує **обох** привілеїв — `queue_manage` і `settings_groups`, — так ' +
      'само як `POST /api/admin/song-groups/:groupId/insert`. Групи ' +
      'налаштовуються окремо через `/api/admin/song-groups`. Має довший ' +
      'кулдаун, ніж поодинокі треки.',
  },

  admin_suggestion_action: {
    audience: 'admin',
    summary: 'Ухвалює або відхиляє замовлення слухача.',
    payload: `{ uid: '…', action: 'add' | 'reject' }`,
    notes:
      'Потребує `queue_manage`. `add` ставить трек як `lastinline`. Слухач ' +
      'отримує `suggestion_result`. Якщо замовлення вже згасло за таймером, ' +
      'повертається помилка «не знайдено».',
  },

  suggestions_update: {
    audience: 'admin',
    summary: 'Поточний список замовлень від слухачів.',
    payload: `[{ uid: '…', song: { id, title, artist }, addedAt: 1754899200000 }]`,
    notes:
      'Надсилається лише адмінам з привілеєм `queue_manage` — при вході, при ' +
      'кожній зміні списку та при переході на денний режим, коли всі ' +
      'замовлення скидаються.',
  },

  library_updated: {
    audience: 'admin',
    summary: 'Бібліотека змінилася: трек додано, відредаговано, переміщено або видалено.',
    payload: 'без даних — це лише сигнал перечитати',
    notes:
      'Йде **всім** підключеним, не лише адмінам. Сигнал не каже, що саме ' +
      'змінилося, тож у відповідь просто перезапитайте потрібний список — ' +
      '`/api/admin/songs` для адмінки або `/api/library` для слухача. ' +
      'Надсилається з кількох місць: після завантаження, збереження в ' +
      'редакторі, зміни режиму треку та масових операцій.',
  },

  admin_online: {
    audience: 'listener',
    summary: 'Чи є онлайн адмін, здатний ухвалити замовлення.',
    payload: 'boolean',
    notes:
      'Йде всім слухачам. `false` означає, що `suggest_song` поверне помилку ' +
      '`no_admin`, тож кнопку замовлення варто ховати.',
  },

  // ── Live broadcast: host ───────────────────────────────────────────────────
  admin_go_live: {
    audience: 'host',
    summary: 'Виводить адміна в ефір як ведучого.',
    payload: 'без даних (перший аргумент ігнорується)',
    ack: `{
  ok: true,
  queuePaused: false,
  hosts: [ /* поточний склад ефіру */ ],
  pendingGuests: [ /* черга заявок гостей */ ],
  backgroundMusicMode: 'random' | 'hostChoice',
  selectedBackgroundMusicId: null,
}
{ error: { uk: '…', en: '…' } }`,
    notes:
      'Потребує привілею `radio_host` і `RADIO_HOSTS_MODE=true` на сервері. ' +
      'Кількість місць в ефірі обмежена `MAX_LIVE_HOST_SLOTS` — при заповненні ' +
      'повертається помилка. Повторний виклик уже живим ведучим просто ' +
      'підтверджує стан. Після успіху сокет приєднується до кімнати ведучих і ' +
      'починає отримувати її події.',
  },

  admin_leave_live: {
    audience: 'host',
    summary: 'Завершує ефір ведучого.',
    payload: 'без аргументів',
    notes: 'Місце звільняється одразу. Те саме відбувається при розриві з’єднання.',
  },

  host_mic_toggle: {
    audience: 'host',
    summary: 'Вмикає або вимикає мікрофон у ефірі.',
    payload: '{ on: boolean }',
    notes:
      'Доки мікрофон вимкнено, сервер відкидає аудіо-фрагменти від цього ' +
      'сокета. Працює і для ведучих, і для гостей.',
  },

  host_mic_gain: {
    audience: 'host',
    summary: 'Змінює гучність свого мікрофона в міксі.',
    payload: '{ gain: number }',
  },

  host_audio_chunk: {
    audience: 'host',
    summary: 'Порція звуку з мікрофона для підмішування в ефір.',
    payload: 'Buffer / ArrayBuffer — сирі аудіодані',
    notes:
      'Приймається лише коли мікрофон увімкнено через `host_mic_toggle` — ' +
      'інакше фрагменти мовчки відкидаються. Це найгарячіший канал протоколу: ' +
      'надсилається безперервно, поки ведучий говорить.',
  },

  host_pause_queue: {
    audience: 'host',
    summary: 'Ставить чергу треків на паузу — режим «просто розмова».',
    payload: 'без аргументів',
    notes:
      'Доступно лише ведучому, не гостю. Тишу заповнює фонова музика, а в ' +
      'події `sync` у всіх слухачів `title` стає `"Just chatting"`.',
  },

  host_resume_queue: {
    audience: 'host',
    summary: 'Повертає програвання черги.',
    payload: 'без аргументів',
  },

  host_get_background_music_list: {
    audience: 'host',
    summary: 'Сторінка доступної фонової музики.',
    payload: '{ offset?: number = 0, limit?: number = 5 }',
    ack: `{ items: [ … ], total: 12, mode: 'day' }`,
    notes:
      'Список залежить від поточного режиму радіо. `limit` обмежений 50. ' +
      'Не-ведучому повертається порожній список.',
  },

  host_set_background_music: {
    audience: 'host',
    summary: 'Обирає трек, який гратиме під час паузи черги.',
    payload: '{ trackId: string | null }',
    ack: '{ ok: true } або { error: … }',
    notes:
      '`null` повертає випадковий вибір. Має сенс лише коли ' +
      '`backgroundMusicMode` дорівнює `hostChoice`.',
  },

  live_hosts_roster: {
    audience: 'host',
    summary: 'Поточний склад ефіру: ведучі й гості.',
    notes:
      'Надсилається в кімнату ведучих при кожній зміні складу. Звичайні ' +
      'слухачі цієї події не отримують.',
  },

  host_queue_pause_state: {
    audience: 'host',
    summary: 'Чергу поставлено на паузу, відновлено, або спробу паузи відхилено.',
    payload: `{ paused: boolean }
{ paused: false, denied: true, reason: 'donatedInQueue' }  // лише тому, хто намагався поставити паузу`,
    notes:
      'Успішна зміна йде в кімнату ведучих. Відмова (черга містить донатну ' +
      'пісню) надсилається лише сокету, що її ініціював. Слухачі бачать сам ' +
      'стан паузи через `sync`.',
  },

  background_music_now_playing: {
    audience: 'host',
    summary: 'Який трек зараз заповнює паузу.',
    payload: `{ trackId: '…', filename: '…' }   // обидва null, коли фонова музика зупинена`,
  },

  host_force_disconnect: {
    audience: 'host',
    summary: 'Ефір ведучого завершено ззовні.',
    notes:
      'Приходить при вилученні модератором або примусовому завершенні сесії. ' +
      'Клієнт має прибрати інтерфейс ефіру й зупинити захоплення мікрофона.',
  },

  monitor_answer: {
    audience: 'host',
    summary: 'WebRTC-відповідь для персонального моніторингу ведучого.',
    payload: '{ sdp: … }',
    notes:
      'Особистий канал прослуховування ефіру з мінімальною затримкою — окремо ' +
      'від спільного MP3-потоку, який іде із запізненням. Потребує відкритих ' +
      'UDP-портів `HOST_MONITOR_ICE_PORT_MIN`–`MAX`.',
  },

  monitor_ice_candidate: {
    audience: 'host',
    summary: 'ICE-кандидат для каналу моніторингу.',
    payload: 'об’єкт кандидата WebRTC',
  },

  // ── Live broadcast: guests ─────────────────────────────────────────────────────
  guest_request: {
    audience: 'guest',
    summary: 'Заявка слухача на участь в ефірі.',
    payload: '{ nickname: string }',
    ack: `{ ok: true }
{ error: … , secsLeft?: number }`,
    notes:
      'Заявка потрапляє в чергу до ведучих; рішення приходить подією ' +
      '`guest_request_result`. Адмін подати заявку не може. Діє кулдаун і ' +
      'перевірка бану за IP.',
  },

  guest_check_ban: {
    audience: 'guest',
    summary: 'Чи заблоковано цю IP-адресу для участі в ефірі.',
    payload: 'без даних',
    ack: '{ banned: boolean }',
    notes: 'Варто викликати до показу форми заявки, щоб не давати марних надій.',
  },

  guest_connect: {
    audience: 'guest',
    summary: 'Під’єднання гостя до ефіру після схвалення.',
    payload: 'без даних',
    ack: `{ ok: true, role: '…', nickname: '…', expiresAt: 1754899200000 }`,
    notes:
      'Спрацює лише якщо сесію вже підтверджено ведучим і в ефірі є вільне ' +
      'місце. `expiresAt` — час примусового завершення; тривалість задається в ' +
      'налаштуваннях радіо. Далі гість користується тими самими подіями ' +
      'мікрофона, що й ведучий.',
  },

  special_guest_connect: {
    audience: 'guest',
    summary: 'Вхід в ефір за одноразовим кодом, без черги.',
    payload: '{ code: string, nickname: string }',
    ack: '{ ok: true, … } або { error: … }',
    notes:
      'Код видає модератор. Кількість спроб обмежена; протухлий або вимкнений ' +
      'код дає помилку.',
  },

  guest_leave_live: {
    audience: 'guest',
    summary: 'Гість залишає ефір.',
    payload: 'без аргументів',
  },

  guest_pending_status: {
    audience: 'guest',
    summary: 'Стан заявки гостя, поки він чекає.',
  },

  guest_request_result: {
    audience: 'guest',
    summary: 'Рішення за заявкою гостя.',
    payload: `{ accepted: true, nickname: '…' }
{ accepted: false, auto: false, reason: 'room_full' }`,
    notes:
      '`reason: "room_full"` означає, що місце зайняли, поки заявка чекала. ' +
      'Після `accepted: true` клієнт має надіслати `guest_connect`.',
  },

  guest_queue_update: {
    audience: 'host',
    summary: 'Черга заявок від гостей.',
    notes: 'Надсилається адресно лише адмінам з привілеєм `radio_host`.',
  },

  admin_guest_action: {
    audience: 'host',
    summary: 'Схвалити або відхилити заявку гостя.',
    payload: `{ uid: '…', action: 'accept' | 'reject' }`,
    ack: '{ ok: true } або { error: … }',
    notes:
      'Потребує `radio_host`. Якщо місце зайняли між заявкою й рішенням, ' +
      'гість отримає відмову з `reason: "room_full"`.',
  },

  host_guest_mute: {
    audience: 'host',
    summary: 'Вимкнути мікрофон гостю.',
    payload: '{ targetId: string, muted: boolean }',
    ack: '{ ok: true } або { error: … }',
  },

  host_guest_kick: {
    audience: 'host',
    summary: 'Вилучити гостя з ефіру.',
    payload: '{ targetId: string }',
    ack: '{ ok: true } або { error: … }',
  },

  guest_force_disconnect: {
    audience: 'guest',
    summary: 'Участь гостя завершено ззовні.',
    notes:
      'Причини: вилучення, бан або вичерпаний ліміт часу з `expiresAt`. ' +
      'Клієнт має зупинити мікрофон і прибрати інтерфейс ефіру.',
  },

  // ── Broadcast moderation ───────────────────────────────────────────────────────
  moderator_get_live_roster: {
    audience: 'admin',
    summary: 'Хто зараз в ефірі.',
    payload: 'без даних',
    ack: '{ roster: [ … ], hostsOnline: true }',
    notes: 'Без привілею повертається порожній склад, а не помилка.',
  },

  moderator_mute: {
    audience: 'admin',
    summary: 'Вимкнути мікрофон будь-якому учаснику ефіру.',
    payload: '{ targetId: string, muted: boolean }',
    ack: '{ ok: true } або { error: … }',
    notes: 'На відміну від `host_guest_mute`, діє і на ведучих.',
  },

  moderator_kick: {
    audience: 'admin',
    summary: 'Вилучити учасника з ефіру.',
    payload: '{ targetId: string }',
    ack: '{ ok: true } або { error: … }',
    notes: 'Учасник отримає `host_force_disconnect` або `guest_force_disconnect`.',
  },

  moderator_get_banlist: {
    audience: 'admin',
    summary: 'Список заблокованих IP-адрес.',
    payload: '{ offset?: number = 0, limit?: number = 10 }',
    ack: '{ list: [ … ], total: 7 }',
    notes: 'Потребує `DATA_PROVIDER=sql` — інакше список недоступний.',
  },

  moderator_ban_participant: {
    audience: 'admin',
    summary: 'Заблокувати учасника ефіру за IP.',
    payload: '{ targetId: string }',
    ack: '{ ok: true } або { error: … }',
    notes:
      'Працює лише для гостей: заблокувати ведучого не можна. Потребує ' +
      'SQL-провайдера.',
  },

  moderator_ban_ip: {
    audience: 'admin',
    summary: 'Заблокувати IP-адресу вручну.',
    payload: '{ ip: string, nickname?: string }',
    ack: '{ ok: true, entry: { … } } або { error: … }',
  },

  moderator_unban_ip: {
    audience: 'admin',
    summary: 'Зняти блокування з IP-адреси.',
    payload: '{ ip: string }',
    ack: '{ ok: true } або { error: … }',
  },

  moderator_get_guest_code: {
    audience: 'admin',
    summary: 'Поточний код доступу для спецгостя.',
    payload: 'без даних',
    ack: '{ code: "…" } — або { code: null }, якщо активного коду немає',
  },

  moderator_generate_guest_code: {
    audience: 'admin',
    summary: 'Створити код доступу для спецгостя.',
    payload: '{ ttlHours?: number }',
    ack: '{ ok: true, code: "…", expiresAt: 1754899200000 }',
    notes:
      'Якщо активний код уже є, повертається помилка — спершу вимкніть його або ' +
      'скористайтеся `moderator_regenerate_guest_code`. Код дозволяє зайти в ' +
      'ефір без черги через `special_guest_connect`.',
  },

  moderator_regenerate_guest_code: {
    audience: 'admin',
    summary: 'Замінити чинний код доступу на новий.',
    payload: '{ ttlHours?: number }',
    ack: '{ ok: true, code: "…", expiresAt: … }',
    notes: 'Старий код одразу перестає діяти.',
  },

  moderator_deactivate_guest_code: {
    audience: 'admin',
    summary: 'Вимкнути чинний код доступу.',
    payload: 'без даних',
    ack: '{ ok: true }',
  },

  guest_code_updated: {
    audience: 'admin',
    summary: 'Код доступу для спецгостів змінився.',
    notes:
      'Сигнал іншим адмінам оновити показаний код — щоб двоє модераторів не ' +
      'диктували різні коди.',
  },

  // ── Refresh signals and sessions ─────────────────────────────────────────────
  privileges_updated: {
    audience: 'admin',
    summary: 'Права цього адміна змінили просто зараз.',
    payload: `{ privileges: ['queue_manage', '…'], authorized: true }`,
    notes:
      'Приходить адресно тому адміну, чиї права змінив супер-адмін. Саме ця ' +
      'подія робить зміну прав чинною **без повторного входу** — перебудуйте ' +
      'інтерфейс за новим списком.',
  },

  admin_authorized: {
    audience: 'admin',
    summary: 'Помічника активовано: тимчасовий пароль замінено на власний.',
    notes: 'До цього моменту обліковий запис має `authorized: false` і нічого не може.',
  },

  force_logout: {
    audience: 'admin',
    summary: 'Сесію припинено ззовні.',
    payload: `{ reason: 'admin_deleted' }`,
    notes:
      'Обліковий запис видалено або відкликано. Клієнт має очистити стан і ' +
      'повернути користувача на екран входу.',
  },

  queue_updated: {
    audience: 'admin',
    summary: 'Черга змінилася.',
    notes:
      'Широкомовний сигнал перечитати чергу через `get_queue`. Сам стан ефіру ' +
      'слухачі й далі отримують подією `sync`.',
  },

  audit_new_entry: {
    audience: 'admin',
    summary: 'Новий запис у журналі аудиту.',
    payload: 'об’єкт запису — той самий формат, що й у `GET /api/admin/audit`',
    notes: 'Дозволяє дописувати журнал наживо, не перезапитуючи весь список.',
  },

  jingles_updated: {
    audience: 'admin',
    summary: 'Набір джинглів змінився.',
    notes: 'Сигнал перечитати список. Джингли доступні лише в конфігурації cloud + sql + stream.',
  },

  background_music_updated: {
    audience: 'admin',
    summary: 'Бібліотеку фонової музики змінено.',
    notes: 'Сигнал перечитати список через `host_get_background_music_list`.',
  },

  phrases_updated: {
    audience: 'admin',
    summary: 'Набір фраз змінився.',
    notes:
      'Сигнал перечитати список. На відміну від джинглів, для фраз немає ' +
      '`stream_phrase_start`/`stream_phrase_end`: фраза мікшується у пісню, а не ' +
      'замінює її, тож метадані треку для слухачів не змінюються.',
  },

  background_music_selection_changed: {
    audience: 'host',
    summary: 'Ведучий обрав інший фоновий трек.',
    notes:
      'Синхронізує вибір між кількома ведучими в ефірі, щоб усі бачили те саме.',
  },

  // ── Stream mode: broadcast markup ──────────────────────────────────────────
  stream_track_start: {
    audience: 'listener',
    summary: 'У спільному потоці почався новий трек.',
    payload: `{ trackId: '…', duration: 214.5, serverTs: 1754899200000 }`,
    notes:
      '`serverTs` — момент початку за годинником сервера. Разом із власним ' +
      'вимірюванням затримки через `stream_ping` це дає точну позицію в треку.',
  },

  stream_jingle_start: {
    audience: 'listener',
    summary: 'Почався джингл між піснями.',
    payload: `{ jingleId: '…', serverTs: … }`,
    notes: 'Час сховати метадані треку: зараз звучить не пісня.',
  },

  stream_jingle_end: {
    audience: 'listener',
    summary: 'Джингл завершився.',
  },

  stream_chat_mode_start: {
    audience: 'listener',
    summary: 'Ведучі поставили чергу на паузу — почалася розмова.',
    payload: '{ serverTs: … }',
    notes:
      'Дублює те, що видно в `sync` за `title: "Just chatting"`, але приходить ' +
      'миттєво, а не в межах двох секунд.',
  },

  stream_chat_mode_end: {
    audience: 'listener',
    summary: 'Розмова завершилася, черга поновлюється.',
  },

  admin_error: {
    audience: 'admin',
    summary: 'Помилка дії в адмінці.',
    payload: 'рядок JSON з локалізованим об’єктом усередині',
    notes:
      'Payload — це **рядок**, а не об’єкт: його треба спершу `JSON.parse`, а вже ' +
      'потім вибрати мову. Те саме стосується `admin_success`.',
  },

  admin_success: {
    audience: 'admin',
    summary: 'Успішне завершення дії в адмінці.',
    payload: 'рядок JSON з локалізованим об’єктом усередині',
    notes: 'Часто містить поле `code` для машинної обробки. Див. `admin_error`.',
  },
};
