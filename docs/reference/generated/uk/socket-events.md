<!-- ЗГЕНЕРОВАНО автоматично через `npm run extract`. Не редагувати вручну. -->
<!-- Джерело правди — код сервера. Описи додавайте у файли поза цією текою. -->

Клієнт → сервер: **42** подій. Сервер → клієнт: **37** подій. Описано детально: **79** з 79.

## Клієнт → сервер

Події, які надсилає клієнт.

| Подія | Опис |
|---|---|
| [`admin_active`](#admin-active) | Підвищує з’єднання до адмінського й підтверджує сесію. |
| [`admin_add_song`](#admin-add-song) | Додає трек із бібліотеки в чергу. |
| [`admin_go_live`](#admin-go-live) | Виводить адміна в ефір як ведучого. |
| [`admin_guest_action`](#admin-guest-action) | Схвалити або відхилити заявку гостя. |
| [`admin_insert_song_group`](#admin-insert-song-group) | Вставляє в чергу наперед задану групу пісень. |
| [`admin_leave_live`](#admin-leave-live) | Завершує ефір ведучого. |
| [`admin_remove_song`](#admin-remove-song) | Прибирає трек із черги за позицією. |
| [`admin_skip_song`](#admin-skip-song) | Перемикає поточний трек. |
| [`admin_suggestion_action`](#admin-suggestion-action) | Ухвалює або відхиляє замовлення слухача. |
| [`get_queue`](#get-queue) | Сторінка майбутньої черги. |
| [`guest_check_ban`](#guest-check-ban) | Чи заблоковано цю IP-адресу для участі в ефірі. |
| [`guest_connect`](#guest-connect) | Під’єднання гостя до ефіру після схвалення. |
| [`guest_leave_live`](#guest-leave-live) | Гість залишає ефір. |
| [`guest_request`](#guest-request) | Заявка слухача на участь в ефірі. |
| [`host_audio_chunk`](#host-audio-chunk) | Порція звуку з мікрофона для підмішування в ефір. |
| [`host_get_background_music_list`](#host-get-background-music-list) | Сторінка доступної фонової музики. |
| [`host_guest_kick`](#host-guest-kick) | Вилучити гостя з ефіру. |
| [`host_guest_mute`](#host-guest-mute) | Вимкнути мікрофон гостю. |
| [`host_mic_gain`](#host-mic-gain) | Змінює гучність свого мікрофона в міксі. |
| [`host_mic_toggle`](#host-mic-toggle) | Вмикає або вимикає мікрофон у ефірі. |
| [`host_pause_queue`](#host-pause-queue) | Ставить чергу треків на паузу — режим «просто розмова». |
| [`host_resume_queue`](#host-resume-queue) | Повертає програвання черги. |
| [`host_set_background_music`](#host-set-background-music) | Обирає трек, який гратиме під час паузи черги. |
| [`listener_init`](#listener-init) | Реєструє з’єднання як слухача і просить видати art-токен. |
| [`moderator_ban_ip`](#moderator-ban-ip) | Заблокувати IP-адресу вручну. |
| [`moderator_ban_participant`](#moderator-ban-participant) | Заблокувати учасника ефіру за IP. |
| [`moderator_deactivate_guest_code`](#moderator-deactivate-guest-code) | Вимкнути чинний код доступу. |
| [`moderator_generate_guest_code`](#moderator-generate-guest-code) | Створити код доступу для спецгостя. |
| [`moderator_get_banlist`](#moderator-get-banlist) | Список заблокованих IP-адрес. |
| [`moderator_get_guest_code`](#moderator-get-guest-code) | Поточний код доступу для спецгостя. |
| [`moderator_get_live_roster`](#moderator-get-live-roster) | Хто зараз в ефірі. |
| [`moderator_kick`](#moderator-kick) | Вилучити учасника з ефіру. |
| [`moderator_mute`](#moderator-mute) | Вимкнути мікрофон будь-якому учаснику ефіру. |
| [`moderator_regenerate_guest_code`](#moderator-regenerate-guest-code) | Замінити чинний код доступу на новий. |
| [`moderator_unban_ip`](#moderator-unban-ip) | Зняти блокування з IP-адреси. |
| [`monitor_answer`](#monitor-answer) | WebRTC-відповідь для персонального моніторингу ведучого. |
| [`monitor_ice_candidate`](#monitor-ice-candidate) | ICE-кандидат для каналу моніторингу. |
| [`search_queue`](#search-queue) | Пошук по майбутній черзі. |
| [`special_guest_connect`](#special-guest-connect) | Вхід в ефір за одноразовим кодом, без черги. |
| [`stream_get_seek`](#stream-get-seek) | Запитує поточну позицію спільного потоку (лише stream-режим). |
| [`stream_ping`](#stream-ping) | Вимірює затримку до сервера. |
| [`suggest_song`](#suggest-song) | Замовити пісню з бібліотеки в ефір. |

## Сервер → клієнт

Події, на які клієнт має підписатися.

| Подія | Кому надсилається | Опис |
|---|---|---|
| [`admin_authorized`](#admin-authorized) | одному сокету | Помічника активовано: тимчасовий пароль замінено на власний. |
| [`admin_confirmed`](#admin-confirmed) | одному сокету | Сесію підтверджено; містить актуальні права. |
| [`admin_error`](#admin-error) | одному сокету | Помилка дії в адмінці. |
| [`admin_online`](#admin-online) | усім | Чи є онлайн адмін, здатний ухвалити замовлення. |
| [`admin_success`](#admin-success) | одному сокету | Успішне завершення дії в адмінці. |
| [`audit_new_entry`](#audit-new-entry) | усім | Новий запис у журналі аудиту. |
| [`background_music_now_playing`](#background-music-now-playing) | кімната LIVE_HOSTS_ROOM | Який трек зараз заповнює паузу. |
| [`background_music_selection_changed`](#background-music-selection-changed) | кімната LIVE_HOSTS_ROOM | Ведучий обрав інший фоновий трек. |
| [`background_music_updated`](#background-music-updated) | усім | Бібліотеку фонової музики змінено. |
| [`donation_result`](#donation-result) | одному сокету | Підсумок донат-замовлення: пісню додано до черги чи ні. |
| [`force_logout`](#force-logout) | одному сокету | Сесію припинено ззовні. |
| [`guest_code_updated`](#guest-code-updated) | одному сокету | Код доступу для спецгостів змінився. |
| [`guest_force_disconnect`](#guest-force-disconnect) | одному сокету | Участь гостя завершено ззовні. |
| [`guest_pending_status`](#guest-pending-status) | кімната LIVE_HOSTS_ROOM | Стан заявки гостя, поки він чекає. |
| [`guest_queue_update`](#guest-queue-update) | одному сокету | Черга заявок від гостей. |
| [`guest_request_result`](#guest-request-result) | одному сокету | Рішення за заявкою гостя. |
| [`host_force_disconnect`](#host-force-disconnect) | одному сокету | Ефір ведучого завершено ззовні. |
| [`host_queue_pause_state`](#host-queue-pause-state) | одному сокету, кімната LIVE_HOSTS_ROOM | Чергу поставлено на паузу, відновлено, або спробу паузи відхилено. |
| [`jingles_updated`](#jingles-updated) | усім | Набір джинглів змінився. |
| [`library_updated`](#library-updated) | усім | Бібліотека змінилася: трек додано, відредаговано, переміщено або видалено. |
| [`listener_uid`](#listener-uid) | одному сокету | Відповідь на `listener_init`: ідентичність слухача і art-токен. |
| [`live_hosts_roster`](#live-hosts-roster) | одному сокету, кімната LIVE_HOSTS_ROOM | Поточний склад ефіру: ведучі й гості. |
| [`phrases_updated`](#phrases-updated) | усім | Набір фраз змінився. |
| [`privileges_updated`](#privileges-updated) | одному сокету | Права цього адміна змінили просто зараз. |
| [`queue_updated`](#queue-updated) | усім | Черга змінилася. |
| [`radio_hosts_mode`](#radio-hosts-mode) | одному сокету | Чи зібрано сервер із підтримкою живих ведучих. |
| [`radio_hosts_online`](#radio-hosts-online) | усім, одному сокету | Чи є зараз хтось в ефірі. |
| [`stream_chat_mode_end`](#stream-chat-mode-end) | усім | Розмова завершилася, черга поновлюється. |
| [`stream_chat_mode_start`](#stream-chat-mode-start) | усім | Ведучі поставили чергу на паузу — почалася розмова. |
| [`stream_jingle_end`](#stream-jingle-end) | усім | Джингл завершився. |
| [`stream_jingle_start`](#stream-jingle-start) | усім | Почався джингл між піснями. |
| [`stream_track_start`](#stream-track-start) | усім | У спільному потоці почався новий трек. |
| [`suggest_cooldown_update`](#suggest-cooldown-update) | одному сокету | Скільки секунд лишилось до можливості замовити наступну пісню. |
| [`suggestion_result`](#suggestion-result) | одному сокету | Рішення адміна щодо вашого замовлення. |
| [`suggestions_update`](#suggestions-update) | одному сокету | Поточний список замовлень від слухачів. |
| [`sync`](#sync) | усім, одному сокету | Повний стан радіо. Основна подія протоколу. |
| [`usersUpdate`](#usersUpdate) | усім, одному сокету | Список активних слухачів для показу в шапці. |

## Деталі

### `admin_active`

<Badge type="info" text="admin" />

Підвищує з’єднання до адмінського й підтверджує сесію.

**Payload:** token?: string — JWT; якщо не передати, береться з куки `adminToken`

Обов’язковий перший крок адмінського клієнта: доти сокет вважається звичайним слухачем і всі адмінські події ігноруються **мовчки**. У відповідь приходить `admin_confirmed` або `admin_error`. Привілеї перечитуються з бази, а не беруться з токена, тож зміна прав діє без релогіну. Попередня сесія того самого адміна автоматично відключається — одночасно живе лише одне з’єднання на обліковий запис.

### `admin_add_song`

<Badge type="info" text="admin" />

Додає трек із бібліотеки в чергу.

**Payload:**

```js
{
  id: 'day/artist - title.mp3',
  title: 'Title', artist: 'Artist',
  orderType: 'lastinline' | 'donated',
}
```

Потребує привілею `queue_manage`. `donated` ставить трек попереду звичайних замовлень. Результат приходить подіями `admin_success` або `admin_error`, а не колбеком. Між додаваннями діє кулдаун; сервер також відмовить, якщо той самий трек уже стоїть поруч у черзі або якщо черга не вміщується до перемикання режиму.

### `admin_go_live`

<Badge type="info" text="host" />

Виводить адміна в ефір як ведучого.

**Payload:** без даних (перший аргумент ігнорується)

**Відповідь у колбеку:**

```js
{
  ok: true,
  queuePaused: false,
  hosts: [ /* поточний склад ефіру */ ],
  pendingGuests: [ /* черга заявок гостей */ ],
  backgroundMusicMode: 'random' | 'hostChoice',
  selectedBackgroundMusicId: null,
}
{ error: { uk: '…', en: '…' } }
```

Потребує привілею `radio_host` і `RADIO_HOSTS_MODE=true` на сервері. Кількість місць в ефірі обмежена `MAX_LIVE_HOST_SLOTS` — при заповненні повертається помилка. Повторний виклик уже живим ведучим просто підтверджує стан. Після успіху сокет приєднується до кімнати ведучих і починає отримувати її події.

### `admin_guest_action`

<Badge type="info" text="host" />

Схвалити або відхилити заявку гостя.

**Payload:**

```js
{ uid: '…', action: 'accept' | 'reject' }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

Потребує `radio_host`. Якщо місце зайняли між заявкою й рішенням, гість отримає відмову з `reason: "room_full"`.

### `admin_insert_song_group`

<Badge type="info" text="admin" />

Вставляє в чергу наперед задану групу пісень.

**Payload:**

```js
{ groupId: string }
```

Потребує **обох** привілеїв — `queue_manage` і `settings_groups`, — так само як `POST /api/admin/song-groups/:groupId/insert`. Групи налаштовуються окремо через `/api/admin/song-groups`. Має довший кулдаун, ніж поодинокі треки.

### `admin_leave_live`

<Badge type="info" text="host" />

Завершує ефір ведучого.

**Payload:** без аргументів

Місце звільняється одразу. Те саме відбувається при розриві з’єднання.

### `admin_remove_song`

<Badge type="info" text="admin" />

Прибирає трек із черги за позицією.

**Payload:** position: number — зсув від поточного треку, як у `search_queue`

Потребує `queue_manage`. Має власний кулдаун — при надто частих викликах повертається помилка з кількістю секунд очікування.

### `admin_skip_song`

<Badge type="info" text="admin" />

Перемикає поточний трек.

**Payload:** без аргументів

Потребує `queue_manage`. У stream-режимі сервер відмовить, якщо саме грає джингл або чергу поставлено на паузу ведучим. Кулдаун спільний із додаванням треків.

### `admin_suggestion_action`

<Badge type="info" text="admin" />

Ухвалює або відхиляє замовлення слухача.

**Payload:**

```js
{ uid: '…', action: 'add' | 'reject' }
```

Потребує `queue_manage`. `add` ставить трек як `lastinline`. Слухач отримує `suggestion_result`. Якщо замовлення вже згасло за таймером, повертається помилка «не знайдено».

### `get_queue`

<Badge type="info" text="admin" />

Сторінка майбутньої черги.

**Payload:**

```js
{ offset?: number = 0, limit?: number = 10 }
```

**Відповідь у колбеку:**

```js
{
  items: [{ id, title, artist, orderType }],
  total: 42,   // усього треків попереду
}
```

Відповідь приходить у колбеку. Поточний трек у вибірку не входить.

### `guest_check_ban`

<Badge type="info" text="guest" />

Чи заблоковано цю IP-адресу для участі в ефірі.

**Payload:** без даних

**Відповідь у колбеку:**

```js
{ banned: boolean }
```

Варто викликати до показу форми заявки, щоб не давати марних надій.

### `guest_connect`

<Badge type="info" text="guest" />

Під’єднання гостя до ефіру після схвалення.

**Payload:** без даних

**Відповідь у колбеку:**

```js
{ ok: true, role: '…', nickname: '…', expiresAt: 1754899200000 }
```

Спрацює лише якщо сесію вже підтверджено ведучим і в ефірі є вільне місце. `expiresAt` — час примусового завершення; тривалість задається в налаштуваннях радіо. Далі гість користується тими самими подіями мікрофона, що й ведучий.

### `guest_leave_live`

<Badge type="info" text="guest" />

Гість залишає ефір.

**Payload:** без аргументів

### `guest_request`

<Badge type="info" text="guest" />

Заявка слухача на участь в ефірі.

**Payload:**

```js
{ nickname: string }
```

**Відповідь у колбеку:**

```js
{ ok: true }
{ error: … , secsLeft?: number }
```

Заявка потрапляє в чергу до ведучих; рішення приходить подією `guest_request_result`. Адмін подати заявку не може. Діє кулдаун і перевірка бану за IP.

### `host_audio_chunk`

<Badge type="info" text="host" />

Порція звуку з мікрофона для підмішування в ефір.

**Payload:** Buffer / ArrayBuffer — сирі аудіодані

Приймається лише коли мікрофон увімкнено через `host_mic_toggle` — інакше фрагменти мовчки відкидаються. Це найгарячіший канал протоколу: надсилається безперервно, поки ведучий говорить.

### `host_get_background_music_list`

<Badge type="info" text="host" />

Сторінка доступної фонової музики.

**Payload:**

```js
{ offset?: number = 0, limit?: number = 5 }
```

**Відповідь у колбеку:**

```js
{ items: [ … ], total: 12, mode: 'day' }
```

Список залежить від поточного режиму радіо. `limit` обмежений 50. Не-ведучому повертається порожній список.

### `host_guest_kick`

<Badge type="info" text="host" />

Вилучити гостя з ефіру.

**Payload:**

```js
{ targetId: string }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

### `host_guest_mute`

<Badge type="info" text="host" />

Вимкнути мікрофон гостю.

**Payload:**

```js
{ targetId: string, muted: boolean }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

### `host_mic_gain`

<Badge type="info" text="host" />

Змінює гучність свого мікрофона в міксі.

**Payload:**

```js
{ gain: number }
```

### `host_mic_toggle`

<Badge type="info" text="host" />

Вмикає або вимикає мікрофон у ефірі.

**Payload:**

```js
{ on: boolean }
```

Доки мікрофон вимкнено, сервер відкидає аудіо-фрагменти від цього сокета. Працює і для ведучих, і для гостей.

### `host_pause_queue`

<Badge type="info" text="host" />

Ставить чергу треків на паузу — режим «просто розмова».

**Payload:** без аргументів

Доступно лише ведучому, не гостю. Тишу заповнює фонова музика, а в події `sync` у всіх слухачів `title` стає `"Just chatting"`.

### `host_resume_queue`

<Badge type="info" text="host" />

Повертає програвання черги.

**Payload:** без аргументів

### `host_set_background_music`

<Badge type="info" text="host" />

Обирає трек, який гратиме під час паузи черги.

**Payload:**

```js
{ trackId: string | null }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

`null` повертає випадковий вибір. Має сенс лише коли `backgroundMusicMode` дорівнює `hostChoice`.

### `listener_init`

<Badge type="info" text="listener" />

Реєструє з’єднання як слухача і просить видати art-токен.

**Payload:** без аргументів

Сервер не видає токен сам — поки клієнт не надішле цю подію, у відповідь не прийде `listener_uid`, і доступ до артів, текстів та аудіо буде закритий. Адмінські з’єднання цю подію ігнорують.

### `moderator_ban_ip`

<Badge type="info" text="admin" />

Заблокувати IP-адресу вручну.

**Payload:**

```js
{ ip: string, nickname?: string }
```

**Відповідь у колбеку:**

```js
{ ok: true, entry: { … } } або { error: … }
```

### `moderator_ban_participant`

<Badge type="info" text="admin" />

Заблокувати учасника ефіру за IP.

**Payload:**

```js
{ targetId: string }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

Працює лише для гостей: заблокувати ведучого не можна. Потребує SQL-провайдера.

### `moderator_deactivate_guest_code`

<Badge type="info" text="admin" />

Вимкнути чинний код доступу.

**Payload:** без даних

**Відповідь у колбеку:**

```js
{ ok: true }
```

### `moderator_generate_guest_code`

<Badge type="info" text="admin" />

Створити код доступу для спецгостя.

**Payload:**

```js
{ ttlHours?: number }
```

**Відповідь у колбеку:**

```js
{ ok: true, code: "…", expiresAt: 1754899200000 }
```

Якщо активний код уже є, повертається помилка — спершу вимкніть його або скористайтеся `moderator_regenerate_guest_code`. Код дозволяє зайти в ефір без черги через `special_guest_connect`.

### `moderator_get_banlist`

<Badge type="info" text="admin" />

Список заблокованих IP-адрес.

**Payload:**

```js
{ offset?: number = 0, limit?: number = 10 }
```

**Відповідь у колбеку:**

```js
{ list: [ … ], total: 7 }
```

Потребує `DATA_PROVIDER=sql` — інакше список недоступний.

### `moderator_get_guest_code`

<Badge type="info" text="admin" />

Поточний код доступу для спецгостя.

**Payload:** без даних

**Відповідь у колбеку:**

```js
{ code: "…" } — або { code: null }, якщо активного коду немає
```

### `moderator_get_live_roster`

<Badge type="info" text="admin" />

Хто зараз в ефірі.

**Payload:** без даних

**Відповідь у колбеку:**

```js
{ roster: [ … ], hostsOnline: true }
```

Без привілею повертається порожній склад, а не помилка.

### `moderator_kick`

<Badge type="info" text="admin" />

Вилучити учасника з ефіру.

**Payload:**

```js
{ targetId: string }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

Учасник отримає `host_force_disconnect` або `guest_force_disconnect`.

### `moderator_mute`

<Badge type="info" text="admin" />

Вимкнути мікрофон будь-якому учаснику ефіру.

**Payload:**

```js
{ targetId: string, muted: boolean }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

На відміну від `host_guest_mute`, діє і на ведучих.

### `moderator_regenerate_guest_code`

<Badge type="info" text="admin" />

Замінити чинний код доступу на новий.

**Payload:**

```js
{ ttlHours?: number }
```

**Відповідь у колбеку:**

```js
{ ok: true, code: "…", expiresAt: … }
```

Старий код одразу перестає діяти.

### `moderator_unban_ip`

<Badge type="info" text="admin" />

Зняти блокування з IP-адреси.

**Payload:**

```js
{ ip: string }
```

**Відповідь у колбеку:**

```js
{ ok: true } або { error: … }
```

### `monitor_answer`

<Badge type="info" text="host" />

WebRTC-відповідь для персонального моніторингу ведучого.

**Payload:**

```js
{ sdp: … }
```

Особистий канал прослуховування ефіру з мінімальною затримкою — окремо від спільного MP3-потоку, який іде із запізненням. Потребує відкритих UDP-портів `HOST_MONITOR_ICE_PORT_MIN`–`MAX`.

### `monitor_ice_candidate`

<Badge type="info" text="host" />

ICE-кандидат для каналу моніторингу.

**Payload:** об’єкт кандидата WebRTC

### `search_queue`

<Badge type="info" text="admin" />

Пошук по майбутній черзі.

**Payload:**

```js
{ query?: string }
```

**Відповідь у колбеку:**

```js
[{ id, title, artist, orderType, position }]
```

`position` — це зсув від поточного треку, і саме його очікує `admin_remove_song`. Порожній запит повертає всю чергу.

### `special_guest_connect`

<Badge type="info" text="guest" />

Вхід в ефір за одноразовим кодом, без черги.

**Payload:**

```js
{ code: string, nickname: string }
```

**Відповідь у колбеку:**

```js
{ ok: true, … } або { error: … }
```

Код видає модератор. Кількість спроб обмежена; протухлий або вимкнений код дає помилку.

### `stream_get_seek`

<Badge type="info" text="listener" />

Запитує поточну позицію спільного потоку (лише stream-режим).

**Payload:** clientTs: number — локальний час клієнта

**Відповідь у колбеку:**

```js
{ seek: 87.2, duration: 214.5, trackId: 'day/artist - title.mp3' }
```

Потрібно лише щоб показати таймер в інтерфейсі: саме звучання у stream-режимі синхронне за побудовою. Поза stream-режимом сервер не відповідає взагалі.

### `stream_ping`

<Badge type="info" text="listener" />

Вимірює затримку до сервера.

**Payload:** clientTs: number

**Відповідь у колбеку:**

```js
{ serverTs: number, clientTs: number }
```

Сервер повертає ваш `clientTs` без змін — різниця часу туди й назад дає оцінку затримки для точнішого позиціювання.

### `suggest_song`

<Badge type="info" text="listener" />

Замовити пісню з бібліотеки в ефір.

**Payload:**

```js
// об’єкт пісні з GET /api/library
{ id: 'day/artist - title.mp3', title: 'Title', artist: 'Artist' }
```

**Відповідь у колбеку:**

```js
{ ok: true }
{ error: 'cooldown', secsLeft: 240 }
{ error: 'no_admin' }   // немає онлайн-адміна з правом на чергу
{ error: 'no_uid' }     // не надіслано listener_init
```

Використовує підтверджувальний колбек — другим аргументом `emit`. Коди помилок тут — **звичайні рядки**, а не локалізовані об’єкти, на відміну від решти API. Кулдаун — 5 хвилин на `uid`; замовлення живе 5 хвилин і згасає, якщо адмін не відповів.

### `admin_authorized`

<Badge type="info" text="admin" />

Помічника активовано: тимчасовий пароль замінено на власний.

До цього моменту обліковий запис має `authorized: false` і нічого не може.

### `admin_confirmed`

<Badge type="info" text="admin" />

Сесію підтверджено; містить актуальні права.

**Payload:**

```js
{
  role: 'super_admin' | 'admin',
  privileges: ['queue_manage', '…'],
  authorized: true,   // false = помічник ще не активував себе
}
```

Будуйте інтерфейс за цим списком, а не за тим, що було в токені. `authorized: false` означає, що помічник має спершу задати собі пароль.

### `admin_error`

<Badge type="info" text="admin" />

Помилка дії в адмінці.

**Payload:** рядок JSON з локалізованим об’єктом усередині

Payload — це **рядок**, а не об’єкт: його треба спершу `JSON.parse`, а вже потім вибрати мову. Те саме стосується `admin_success`.

### `admin_online`

<Badge type="info" text="listener" />

Чи є онлайн адмін, здатний ухвалити замовлення.

**Payload:** boolean

Йде всім слухачам. `false` означає, що `suggest_song` поверне помилку `no_admin`, тож кнопку замовлення варто ховати.

### `admin_success`

<Badge type="info" text="admin" />

Успішне завершення дії в адмінці.

**Payload:** рядок JSON з локалізованим об’єктом усередині

Часто містить поле `code` для машинної обробки. Див. `admin_error`.

### `audit_new_entry`

<Badge type="info" text="admin" />

Новий запис у журналі аудиту.

**Payload:** об’єкт запису — той самий формат, що й у `GET /api/admin/audit`

Дозволяє дописувати журнал наживо, не перезапитуючи весь список.

### `background_music_now_playing`

<Badge type="info" text="host" />

Який трек зараз заповнює паузу.

**Payload:**

```js
{ trackId: '…', filename: '…' }   // обидва null, коли фонова музика зупинена
```

### `background_music_selection_changed`

<Badge type="info" text="host" />

Ведучий обрав інший фоновий трек.

Синхронізує вибір між кількома ведучими в ефірі, щоб усі бачили те саме.

### `background_music_updated`

<Badge type="info" text="admin" />

Бібліотеку фонової музики змінено.

Сигнал перечитати список через `host_get_background_music_list`.

### `donation_result`

<Badge type="info" text="listener" />

Підсумок донат-замовлення: пісню додано до черги чи ні.

**Payload:**

```js
{ donationId, accepted: true, tier: 2 | null, song: { title, artist } }
{ donationId, accepted: false, reason: 'payment_failed' | 'no_slot' }
```

Приходить лише сокету, чий `listener_uid` збігається з донатером (обидва виводяться з IP). `no_slot` означає, що оплату підтверджено, але вставити пісню в чергу не вдалося (наприклад, не лишилось часу до зміни режиму) — донат позначається `paid_unqueued` і лишається видимим адміну в історії донатів.

### `force_logout`

<Badge type="info" text="admin" />

Сесію припинено ззовні.

**Payload:**

```js
{ reason: 'admin_deleted' }
```

Обліковий запис видалено або відкликано. Клієнт має очистити стан і повернути користувача на екран входу.

### `guest_code_updated`

<Badge type="info" text="admin" />

Код доступу для спецгостів змінився.

Сигнал іншим адмінам оновити показаний код — щоб двоє модераторів не диктували різні коди.

### `guest_force_disconnect`

<Badge type="info" text="guest" />

Участь гостя завершено ззовні.

Причини: вилучення, бан або вичерпаний ліміт часу з `expiresAt`. Клієнт має зупинити мікрофон і прибрати інтерфейс ефіру.

### `guest_pending_status`

<Badge type="info" text="guest" />

Стан заявки гостя, поки він чекає.

### `guest_queue_update`

<Badge type="info" text="host" />

Черга заявок від гостей.

Надсилається адресно лише адмінам з привілеєм `radio_host`.

### `guest_request_result`

<Badge type="info" text="guest" />

Рішення за заявкою гостя.

**Payload:**

```js
{ accepted: true, nickname: '…' }
{ accepted: false, auto: false, reason: 'room_full' }
```

`reason: "room_full"` означає, що місце зайняли, поки заявка чекала. Після `accepted: true` клієнт має надіслати `guest_connect`.

### `host_force_disconnect`

<Badge type="info" text="host" />

Ефір ведучого завершено ззовні.

Приходить при вилученні модератором або примусовому завершенні сесії. Клієнт має прибрати інтерфейс ефіру й зупинити захоплення мікрофона.

### `host_queue_pause_state`

<Badge type="info" text="host" />

Чергу поставлено на паузу, відновлено, або спробу паузи відхилено.

**Payload:**

```js
{ paused: boolean }
{ paused: false, denied: true, reason: 'donatedInQueue' }  // лише тому, хто намагався поставити паузу
```

Успішна зміна йде в кімнату ведучих. Відмова (черга містить донатну пісню) надсилається лише сокету, що її ініціював. Слухачі бачать сам стан паузи через `sync`.

### `jingles_updated`

<Badge type="info" text="admin" />

Набір джинглів змінився.

Сигнал перечитати список. Джингли доступні лише в конфігурації cloud + sql + stream.

### `library_updated`

<Badge type="info" text="admin" />

Бібліотека змінилася: трек додано, відредаговано, переміщено або видалено.

**Payload:** без даних — це лише сигнал перечитати

Йде **всім** підключеним, не лише адмінам. Сигнал не каже, що саме змінилося, тож у відповідь просто перезапитайте потрібний список — `/api/admin/songs` для адмінки або `/api/library` для слухача. Надсилається з кількох місць: після завантаження, збереження в редакторі, зміни режиму треку та масових операцій.

### `listener_uid`

<Badge type="info" text="listener" />

Відповідь на `listener_init`: ідентичність слухача і art-токен.

**Payload:**

```js
{
  uid: '…',                 // виводиться з IP, клієнт його не обирає
  artToken: '…',
  artTokenExpiresIn: 3600,  // секунди
  cooldownSecsLeft: 0,      // до наступного замовлення пісні
}
```

Слухачі за спільним NAT отримають однаковий `uid`, а отже спільний токен і спільний кулдаун замовлень.

### `live_hosts_roster`

<Badge type="info" text="host" />

Поточний склад ефіру: ведучі й гості.

Надсилається в кімнату ведучих при кожній зміні складу. Звичайні слухачі цієї події не отримують.

### `phrases_updated`

<Badge type="info" text="admin" />

Набір фраз змінився.

Сигнал перечитати список. На відміну від джинглів, для фраз немає `stream_phrase_start`/`stream_phrase_end`: фраза мікшується у пісню, а не замінює її, тож метадані треку для слухачів не змінюються.

### `privileges_updated`

<Badge type="info" text="admin" />

Права цього адміна змінили просто зараз.

**Payload:**

```js
{ privileges: ['queue_manage', '…'], authorized: true }
```

Приходить адресно тому адміну, чиї права змінив супер-адмін. Саме ця подія робить зміну прав чинною **без повторного входу** — перебудуйте інтерфейс за новим списком.

### `queue_updated`

<Badge type="info" text="admin" />

Черга змінилася.

Широкомовний сигнал перечитати чергу через `get_queue`. Сам стан ефіру слухачі й далі отримують подією `sync`.

### `radio_hosts_mode`

<Badge type="info" text="listener" />

Чи зібрано сервер із підтримкою живих ведучих.

**Payload:** boolean

Надсилається одразу після підключення, без запиту.

### `radio_hosts_online`

<Badge type="info" text="listener" />

Чи є зараз хтось в ефірі.

**Payload:** boolean

Надсилається лише коли `radio_hosts_mode` увімкнено.

### `stream_chat_mode_end`

<Badge type="info" text="listener" />

Розмова завершилася, черга поновлюється.

### `stream_chat_mode_start`

<Badge type="info" text="listener" />

Ведучі поставили чергу на паузу — почалася розмова.

**Payload:**

```js
{ serverTs: … }
```

Дублює те, що видно в `sync` за `title: "Just chatting"`, але приходить миттєво, а не в межах двох секунд.

### `stream_jingle_end`

<Badge type="info" text="listener" />

Джингл завершився.

### `stream_jingle_start`

<Badge type="info" text="listener" />

Почався джингл між піснями.

**Payload:**

```js
{ jingleId: '…', serverTs: … }
```

Час сховати метадані треку: зараз звучить не пісня.

### `stream_track_start`

<Badge type="info" text="listener" />

У спільному потоці почався новий трек.

**Payload:**

```js
{ trackId: '…', duration: 214.5, serverTs: 1754899200000 }
```

`serverTs` — момент початку за годинником сервера. Разом із власним вимірюванням затримки через `stream_ping` це дає точну позицію в треку.

### `suggest_cooldown_update`

<Badge type="info" text="listener" />

Скільки секунд лишилось до можливості замовити наступну пісню.

**Payload:** number — секунди, 0 якщо можна замовляти

Надсилається всім з’єднанням з тим самим `uid`, тож кілька вкладок бачать однаковий відлік.

### `suggestion_result`

<Badge type="info" text="listener" />

Рішення адміна щодо вашого замовлення.

**Payload:**

```js
{ accepted: true, auto: false, song: { title, artist, … } }
```

`auto: true` означає, що замовлення згасло за таймером, а не було відхилене вручну. Приходить лише тому сокету, що замовляв.

### `suggestions_update`

<Badge type="info" text="admin" />

Поточний список замовлень від слухачів.

**Payload:**

```js
[{ uid: '…', song: { id, title, artist }, addedAt: 1754899200000 }]
```

Надсилається лише адмінам з привілеєм `queue_manage` — при вході, при кожній зміні списку та при переході на денний режим, коли всі замовлення скидаються.

### `sync`

<Badge type="info" text="listener" />

Повний стан радіо. Основна подія протоколу.

**Payload:**

```js
{
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
}
```

Надсилається кожні 2 секунди всім, а також одразу після підключення. Коли сервер перемикає режим, приходить скорочена форма з `isPreparing: true` і `track: null`. Коли ведучі ставлять чергу на паузу, `title` стає `"Just chatting"`, а `artist` порожніє.

### `usersUpdate`

<Badge type="info" text="listener" />

Список активних слухачів для показу в шапці.

**Payload:**

```js
[{ name: 'Ім’я', img: 'file.png', color: '#a3f01c' }]
```

Слухачі анонімні: сервер видає кожному з’єднанню випадкове ім’я з набору «олігархів» і випадковий колір. Ім’я приходить уже локалізованим.

