<!-- ЗГЕНЕРОВАНО автоматично через `npm run extract`. Не редагувати вручну. -->
<!-- Джерело правди — код сервера. Описи додавайте у файли поза цією текою. -->

Усього ендпоінтів: **101**. Описано детально: **101**.

## Адмінські

| Метод | Шлях | Доступ | Привілей | Опис |
|---|---|---|---|---|
| `GET` | [`/api/admin/admins`](#get-api-admin-admins) | лише супер-адмін | — | Список помічників та перелік можливих привілеїв. |
| `POST` | [`/api/admin/admins`](#post-api-admin-admins) | лише супер-адмін | — | Створює помічника. |
| `DELETE` | [`/api/admin/admins/:id`](#delete-api-admin-admins-id) | лише супер-адмін | — | Видаляє помічника. |
| `PUT` | [`/api/admin/admins/:id/privileges`](#put-api-admin-admins-id-privileges) | лише супер-адмін | — | Змінює набір прав помічника. |
| `PUT` | [`/api/admin/admins/:id/reset-password`](#put-api-admin-admins-id-reset-password) | лише супер-адмін | — | Скидає пароль помічника на новий тимчасовий. |
| `POST` | [`/api/admin/admins/self/activate`](#post-api-admin-admins-self-activate) | адмін (JWT) | — | Активація помічником самого себе після створення. |
| `PUT` | [`/api/admin/admins/self/login`](#put-api-admin-admins-self-login) | адмін (JWT) | — | Зміна власного логіна. |
| `PUT` | [`/api/admin/admins/self/password`](#put-api-admin-admins-self-password) | адмін (JWT) | — | Зміна власного пароля. |
| `GET` | [`/api/admin/artist-arts`](#get-api-admin-artist-arts) | адмін (JWT) | `ARTIST_ARTS` | Перелік виконавців із позначкою, у кого є арт. |
| `DELETE` | [`/api/admin/artist-arts/:artist`](#delete-api-admin-artist-arts-artist) | адмін (JWT) | `ARTIST_ARTS або EDITOR_META` | Видаляє арт виконавця. |
| `GET` | [`/api/admin/artist-arts/file/:artist`](#get-api-admin-artist-arts-file-artist) | адмін (JWT) | `ARTIST_ARTS` | Файл арту для перегляду в адмінці. |
| `POST` | [`/api/admin/artist-arts/upload`](#post-api-admin-artist-arts-upload) | адмін (JWT) | `ARTIST_ARTS` | Завантажує зображення виконавця. |
| `GET` | [`/api/admin/audit`](#get-api-admin-audit) | адмін (JWT) | — | Журнал дій адміністраторів. |
| `GET` | [`/api/admin/background-music`](#get-api-admin-background-music) | адмін (JWT) | `JINGLES_UPLOADER` | Список фонових треків з пагінацією. |
| `GET` | [`/api/admin/background-music/:id/audio`](#get-api-admin-background-music-id-audio) | адмін (JWT) | `JINGLES_UPLOADER` | Аудіо фонового треку для прослуховування. |
| `POST` | [`/api/admin/background-music/:id/used`](#post-api-admin-background-music-id-used) | адмін (JWT) | `JINGLES_UPLOADER` | Вмикає або вимикає трек у доборі. |
| `POST` | [`/api/admin/background-music/batch-delete`](#post-api-admin-background-music-batch-delete) | адмін (JWT) | `JINGLES_UPLOADER` | Видаляє кілька фонових треків. |
| `POST` | [`/api/admin/background-music/batch-move`](#post-api-admin-background-music-batch-move) | адмін (JWT) | `JINGLES_UPLOADER` | Переносить фонові треки між режимами. |
| `GET` | [`/api/admin/background-music/counts`](#get-api-admin-background-music-counts) | адмін (JWT) | — | Скільки фонових треків доступно. |
| `GET` | [`/api/admin/background-music/file`](#get-api-admin-background-music-file) | адмін (bearer або query) | — | Віддає сам файл фонової музики з локального сховища. |
| `POST` | [`/api/admin/background-music/upload`](#post-api-admin-background-music-upload) | адмін (JWT) | `JINGLES_UPLOADER` | Завантажує фоновий трек. |
| `POST` | [`/api/admin/background-music/upload-check-duplicate`](#post-api-admin-background-music-upload-check-duplicate) | адмін (JWT) | `JINGLES_UPLOADER` | Перевіряє ім’я файлу до завантаження. |
| `GET` | [`/api/admin/donations/history`](#get-api-admin-donations-history) | адмін (JWT) | `DONATIONS_MANAGE` | Історія донатів з фільтром за періодом. |
| `GET` | [`/api/admin/donations/price-preview`](#get-api-admin-donations-price-preview) | адмін (JWT) | `DONATIONS_MANAGE` | Ціна першої черги для довільної тривалості — для попереднього перегляду в модалці налаштувань. |
| `GET` | [`/api/admin/donations/settings`](#get-api-admin-donations-settings) | адмін (JWT) | — | Поточні налаштування донатів і список провайдера. |
| `POST` | [`/api/admin/donations/settings`](#post-api-admin-donations-settings) | адмін (JWT) | `DONATIONS_MANAGE` | Зберігає налаштування донатів. |
| `GET` | [`/api/admin/history`](#get-api-admin-history) | адмін (JWT) | `STATS` | Повна історія програвань. |
| `GET` | [`/api/admin/jingles`](#get-api-admin-jingles) | адмін (JWT) | `JINGLES_UPLOADER` | Список джинглів з пагінацією та пошуком. |
| `GET` | [`/api/admin/jingles/:id/audio`](#get-api-admin-jingles-id-audio) | адмін (JWT) | `JINGLES_UPLOADER` | Аудіо джингла для прослуховування в адмінці. |
| `POST` | [`/api/admin/jingles/:id/used`](#post-api-admin-jingles-id-used) | адмін (JWT) | `JINGLES_UPLOADER` | Вмикає або вимикає джингл у ротації. |
| `POST` | [`/api/admin/jingles/batch-delete`](#post-api-admin-jingles-batch-delete) | адмін (JWT) | `JINGLES_UPLOADER` | Видаляє кілька джинглів за раз. |
| `POST` | [`/api/admin/jingles/batch-move`](#post-api-admin-jingles-batch-move) | адмін (JWT) | `JINGLES_UPLOADER` | Переносить кілька джинглів між денним і нічним режимом. |
| `GET` | [`/api/admin/jingles/counts`](#get-api-admin-jingles-counts) | адмін (JWT) | — | Скільки джинглів є і скільки з них придатні до ефіру. |
| `GET` | [`/api/admin/jingles/file`](#get-api-admin-jingles-file) | адмін (bearer або query) | — | Віддає сам файл джингла з локального сховища. |
| `POST` | [`/api/admin/jingles/upload`](#post-api-admin-jingles-upload) | адмін (JWT) | `JINGLES_UPLOADER` | Завантажує джингл. |
| `POST` | [`/api/admin/jingles/upload-check-duplicate`](#post-api-admin-jingles-upload-check-duplicate) | адмін (JWT) | `JINGLES_UPLOADER` | Перевіряє, чи є вже джингл з таким іменем файлу. |
| `POST` | [`/api/admin/login`](#post-api-admin-login) | публічний | — | Вхід адміністратора. |
| `POST` | [`/api/admin/logout`](#post-api-admin-logout) | публічний | — | Вихід: очищає куку з токеном. |
| `GET` | [`/api/admin/lyrics/audio-preview`](#get-api-admin-lyrics-audio-preview) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Посилання на аудіо для звірки таймкодів у редакторі. |
| `DELETE` | [`/api/admin/lyrics/cache`](#delete-api-admin-lyrics-cache) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Видаляє текст із кешу. |
| `PUT` | [`/api/admin/lyrics/cache`](#put-api-admin-lyrics-cache) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Зберігає відредагований текст. |
| `GET` | [`/api/admin/lyrics/cache-entry`](#get-api-admin-lyrics-cache-entry) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Текст одного треку. |
| `GET` | [`/api/admin/lyrics/cache-full`](#get-api-admin-lyrics-cache-full) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Повний кеш текстів. |
| `GET` | [`/api/admin/lyrics/cache-index`](#get-api-admin-lyrics-cache-index) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Легкий перелік того, для чого текст уже є. |
| `GET` | [`/api/admin/lyrics/offsets`](#get-api-admin-lyrics-offsets) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Усі збережені зсуви синхронізації текстів. |
| `GET` | [`/api/admin/lyrics/songs`](#get-api-admin-lyrics-songs) | адмін (JWT) | `EDITOR_LYRICS або EDITOR_META` | Треки зі станом текстів — вихідні дані для редактора. |
| `GET` | [`/api/admin/phrases`](#get-api-admin-phrases) | адмін (JWT) | `JINGLES_UPLOADER` | Список фраз з пагінацією та пошуком. |
| `GET` | [`/api/admin/phrases/:id/audio`](#get-api-admin-phrases-id-audio) | адмін (JWT) | `JINGLES_UPLOADER` | Аудіо фрази для прослуховування в адмінці. |
| `POST` | [`/api/admin/phrases/:id/used`](#post-api-admin-phrases-id-used) | адмін (JWT) | `JINGLES_UPLOADER` | Вмикає або вимикає фразу в ротації. |
| `POST` | [`/api/admin/phrases/batch-delete`](#post-api-admin-phrases-batch-delete) | адмін (JWT) | `JINGLES_UPLOADER` | Видаляє кілька фраз за раз. |
| `POST` | [`/api/admin/phrases/batch-move`](#post-api-admin-phrases-batch-move) | адмін (JWT) | `JINGLES_UPLOADER` | Переносить кілька фраз між денним і нічним режимом. |
| `GET` | [`/api/admin/phrases/counts`](#get-api-admin-phrases-counts) | адмін (JWT) | — | Скільки фраз є і скільки з них придатні до ефіру. |
| `GET` | [`/api/admin/phrases/file`](#get-api-admin-phrases-file) | адмін (bearer або query) | — | Віддає сам файл фрази з локального сховища. |
| `POST` | [`/api/admin/phrases/upload`](#post-api-admin-phrases-upload) | адмін (JWT) | `JINGLES_UPLOADER` | Завантажує фразу. |
| `POST` | [`/api/admin/phrases/upload-check-duplicate`](#post-api-admin-phrases-upload-check-duplicate) | адмін (JWT) | `JINGLES_UPLOADER` | Перевіряє, чи є вже фраза з таким іменем файлу. |
| `GET` | [`/api/admin/settings`](#get-api-admin-settings) | адмін (JWT) | — | Усі налаштування радіо. |
| `POST` | [`/api/admin/settings`](#post-api-admin-settings) | адмін (JWT) | — | Зберігає налаштування; кожна секція під своїм привілеєм. |
| `DELETE` | [`/api/admin/song-editor`](#delete-api-admin-song-editor) | адмін (JWT) | `EDITOR_META` | Видаляє трек із бібліотеки та сховища. |
| `POST` | [`/api/admin/song-editor/batch-delete`](#post-api-admin-song-editor-batch-delete) | адмін (JWT) | `EDITOR_META` | Видаляє кілька позначених треків. |
| `POST` | [`/api/admin/song-editor/batch-move`](#post-api-admin-song-editor-batch-move) | адмін (JWT) | `EDITOR_META` | Переносить кілька треків між режимами. |
| `GET` | [`/api/admin/song-editor/download`](#get-api-admin-song-editor-download) | адмін (JWT) | `EDITOR_META` | Завантажити вихідний файл треку. |
| `POST` | [`/api/admin/song-editor/move-mode`](#post-api-admin-song-editor-move-mode) | адмін (JWT) | `EDITOR_META` | Переносить трек між денним і нічним режимом. |
| `POST` | [`/api/admin/song-editor/save`](#post-api-admin-song-editor-save) | адмін (JWT) | — | Зберігає метадані, текст і зсув тексту для треку. |
| `GET` | [`/api/admin/song-groups`](#get-api-admin-song-groups) | адмін (JWT) | — | Усі групи пісень з кількістю треків і попереднім переглядом. |
| `POST` | [`/api/admin/song-groups`](#post-api-admin-song-groups) | адмін (JWT) | `SETTINGS_GROUPS` | Створює групу пісень. |
| `DELETE` | [`/api/admin/song-groups/:groupId`](#delete-api-admin-song-groups-groupid) | адмін (JWT) | `SETTINGS_GROUPS` | Видаляє групу пісень. |
| `PUT` | [`/api/admin/song-groups/:groupId`](#put-api-admin-song-groups-groupid) | адмін (JWT) | `SETTINGS_GROUPS` | Оновлює групу: назву або склад треків. |
| `POST` | [`/api/admin/song-groups/:groupId/insert`](#post-api-admin-song-groups-groupid-insert) | адмін (JWT) | `QUEUE_MANAGE + SETTINGS_GROUPS` | Ставить усю групу в чергу. |
| `GET` | [`/api/admin/song-groups/library`](#get-api-admin-song-groups-library) | адмін (JWT) | — | Пошук по бібліотеці для наповнення групи. |
| `GET` | [`/api/admin/songs`](#get-api-admin-songs) | адмін (JWT) | — | Уся бібліотека режиму зі статусом текстів. |
| `GET` | [`/api/admin/stats`](#get-api-admin-stats) | адмін (JWT) | `STATS` | Зведена статистика бібліотеки та ефіру. |
| `POST` | [`/api/admin/switch-mode`](#post-api-admin-switch-mode) | адмін (JWT) | `MODE_SWITCH` | Перемикає радіо між денним і нічним режимом. |
| `POST` | [`/api/admin/upload-batch-delete`](#post-api-admin-upload-batch-delete) | адмін (JWT) | `UPLOAD_SONGS` | Видаляє щойно завантажені треки. |
| `POST` | [`/api/admin/upload-batch-move`](#post-api-admin-upload-batch-move) | адмін (JWT) | `UPLOAD_SONGS` | Переносить щойно завантажені треки між режимами. |
| `POST` | [`/api/admin/upload-check-duplicate`](#post-api-admin-upload-check-duplicate) | адмін (JWT) | `UPLOAD_SONGS` | Перевіряє, чи такий трек уже є, до завантаження файлу. |
| `POST` | [`/api/admin/upload-song-commit`](#post-api-admin-upload-song-commit) | адмін (JWT) | `UPLOAD_SONGS` | Крок 3 завантаження: заносить трек у бібліотеку. |
| `POST` | [`/api/admin/upload-song-file`](#post-api-admin-upload-song-file) | адмін (JWT) | `UPLOAD_SONGS` | Крок 1 завантаження: кладе MP3 у сховище й читає теги. |
| `POST` | [`/api/admin/upload-song-lyrics`](#post-api-admin-upload-song-lyrics) | адмін (JWT) | `UPLOAD_SONGS` | Крок 2 завантаження: шукає текст пісні через LRCLIB. |
| `POST` | [`/api/admin/upload-song-url`](#post-api-admin-upload-song-url) | адмін (JWT) | `UPLOAD_SONGS` | Завантажує аудіо з YouTube у сховище. |
| `GET` | [`/api/admin/verify`](#get-api-admin-verify) | адмін (JWT) | — | Перевіряє сесію і повертає актуальні привілеї. |
| `POST` | [`/api/admin/youtube-cookies`](#post-api-admin-youtube-cookies) | адмін (JWT) | `UPLOAD_SONGS` | Зберігає куки YouTube для обходу вікової перевірки. |
| `POST` | [`/api/admin/youtube-track-info`](#post-api-admin-youtube-track-info) | адмін (JWT) | `UPLOAD_SONGS` | Читає перелік треків за посиланням на відео або плейлист. |
| `GET` | [`/api/admin/ytbdown-status`](#get-api-admin-ytbdown-status) | адмін (JWT) | `UPLOAD_SONGS` | Чи готовий інструмент завантаження з YouTube. |

## Клієнтські

| Метод | Шлях | Доступ | Привілей | Опис |
|---|---|---|---|---|
| `GET` | [`/api/art/url`](#get-api-art-url) | art-токен | — | Посилання на арт виконавця замість самих байтів. |
| `GET` | [`/api/artist-art/:artist`](#get-api-artist-art-artist) | art-токен | — | Зображення виконавця. |
| `GET` | [`/api/audio-key`](#get-api-audio-key) | art-токен | — | Обмінює art-токен на короткоживучий audio-токен. |
| `GET` | [`/api/audio/stream`](#get-api-audio-stream) | art + audio токен | — | Байти аудіо поточного або замовленого треку. |
| `GET` | [`/api/audio/stream/admin`](#get-api-audio-stream-admin) | адмін (bearer або query) | — | Аудіо треку для адмінських інтерфейсів. |
| `GET` | [`/api/audio/url`](#get-api-audio-url) | art + audio токен | — | Посилання на аудіо без віддавання самих байтів. |
| `GET` | [`/api/avatar/:filename`](#get-api-avatar-filename) | art-токен | — | Аватар слухача. |
| `GET` | [`/api/history`](#get-api-history) | публічний | — | Останні 10 зіграних пісень. |
| `GET` | [`/api/library`](#get-api-library) | публічний | — | Треки, доступні для замовлення в поточному режимі. |
| `GET` | [`/api/lyrics`](#get-api-lyrics) | art-токен | — | Синхронізований текст пісні. |
| `POST` | [`/api/lyrics/offset`](#post-api-lyrics-offset) | адмін (JWT) | — | Зберігає зсув синхронізації тексту для треку. |
| `GET` | [`/api/public/config`](#get-api-public-config) | публічний | — | Режим роботи сервера. Єдиний ендпоінт без будь-якої авторизації. |
| `GET` | [`/api/public/donations/:id/status`](#get-api-public-donations-id-status) | публічний | — | Поточний статус конкретного донату. |
| `POST` | [`/api/public/donations/create`](#post-api-public-donations-create) | публічний | — | Оформлює донат на пісню за обраною чергою. |
| `GET` | [`/api/public/donations/tiers`](#get-api-public-donations-tiers) | публічний | — | Розраховані ціни донатних черг для конкретної пісні. |
| `POST` | [`/webhooks/donations/:provider`](#post-webhooks-donations-provider) | публічний | — | Підтвердження оплати від платіжного провайдера. |

## Потік

| Метод | Шлях | Доступ | Привілей | Опис |
|---|---|---|---|---|
| `GET` | [`/api/stream`](#get-api-stream) | art-токен | — | Спільний MP3-потік радіо (лише stream-режим). |
| `GET` | [`/api/stream/public.mp3`](#get-api-stream-public-mp3) | публічний | — | Той самий потік, але без токена — постійне посилання для зовнішніх плеєрів. |

## Деталі

### `GET /api/admin/admins`

Список помічників та перелік можливих привілеїв.

**Відповідь:**

```js
{
  ok: true,
  admins: [{ adminId, login, privileges, authorized }],
  allPrivileges: ['queue_manage', '…'],
}
```

Хешів паролів у відповіді немає. `allPrivileges` зручно брати для побудови форми.

### `POST /api/admin/admins`

Створює помічника.

**Тіло запиту:**

```js
{ login: '…', password: '…', privileges: ['queue_manage'] }
```

**Відповідь:**

```js
{ ok: true, admin: { … }, message: { uk: '…', en: '…' } }
```

Пароль тут — **тимчасовий**: обліковий запис створюється з `authorized: false` і нічого не може, доки помічник не активує себе через `/admins/self/activate`.

### `DELETE /api/admin/admins/:id`

Видаляє помічника.

Якщо він онлайн, його з’єднання отримає `force_logout` з `reason: "admin_deleted"` і сесія обірветься негайно.

### `PUT /api/admin/admins/:id/privileges`

Змінює набір прав помічника.

**Тіло запиту:**

```js
{ privileges: ['queue_manage', 'stats'] }
```

Якщо помічник зараз онлайн, він одразу отримає подію `privileges_updated` — зміна діє **без повторного входу**.

### `PUT /api/admin/admins/:id/reset-password`

Скидає пароль помічника на новий тимчасовий.

**Тіло запиту:**

```js
{ newPassword: '…' }
```

Обліковий запис знову стає неавторизованим і потребує повторної активації.

### `POST /api/admin/admins/self/activate`

Активація помічником самого себе після створення.

**Тіло запиту:**

```js
{ tempPassword: '…', newPassword: '…' }
```

**Помилки:** `400` — для супер-адміна не застосовується, або тимчасовий пароль невірний

Єдина дія, доступна помічнику з `authorized: false`. Після успіху приходить подія `admin_authorized`.

### `PUT /api/admin/admins/self/login`

Зміна власного логіна.

**Тіло запиту:**

```js
{ newLogin: '…', currentPassword: '…' }
```

**Помилки:** `400` — для супер-адміна не застосовується, або пароль невірний

### `PUT /api/admin/admins/self/password`

Зміна власного пароля.

**Тіло запиту:**

```js
{ currentPassword: '…', newPassword: '…' }
```

**Помилки:** `400` — для супер-адміна не застосовується, або пароль невірний

Пароль супер-адміна змінюється лише через `ADMIN_PASS` у `.env`.

### `GET /api/admin/artist-arts`

Перелік виконавців із позначкою, у кого є арт.

Записи створюються автоматично при завантаженні денного треку.

### `DELETE /api/admin/artist-arts/:artist`

Видаляє арт виконавця.

Сам запис виконавця лишається, зникає тільки зображення.

### `GET /api/admin/artist-arts/file/:artist`

Файл арту для перегляду в адмінці.

На відміну від клієнтського `/api/artist-art/:artist`, віддається без XOR-обгортки.

### `POST /api/admin/artist-arts/upload`

Завантажує зображення виконавця.

**Заголовки:** `Content-Type: image/jpeg`

**Тіло запиту:**

```js
сирі байти JPEG, до 10 МБ
```

Приймається **лише JPEG** — PNG чи WebP дадуть помилку. Зображення очікується вже обрізаним під вертикальний формат: клієнт робить це перед надсиланням.

### `GET /api/admin/audit`

Журнал дій адміністраторів.

**Query:** `window` — `24h` та інші проміжки; `limit` (типово 30); `offset`

**Відповідь:**

```js
{ ok: true, entries: [ … ], total, offset, limit }
```

Читається з кешу в пам’яті, тож запит дешевий. Записи автоматично видаляються через `LOG_RETENTION_DAYS` днів. Окремого привілею не потребує — доступно кожному адміну.

### `GET /api/admin/background-music`

Список фонових треків з пагінацією.

Ведучий в ефірі бачить той самий список через подію `host_get_background_music_list`.

### `GET /api/admin/background-music/:id/audio`

Аудіо фонового треку для прослуховування.

Влаштований так само, як `/api/admin/jingles/:id/audio`: у хмарі — підписане посилання, локально — посилання на `/api/admin/background-music/file`.

### `POST /api/admin/background-music/:id/used`

Вмикає або вимикає трек у доборі.

### `POST /api/admin/background-music/batch-delete`

Видаляє кілька фонових треків.

**Тіло запиту:**

```js
{ ids: ['…'] }
```

### `POST /api/admin/background-music/batch-move`

Переносить фонові треки між режимами.

**Тіло запиту:**

```js
{ ids: ['…'], targetMode: 'day' | 'night' }
```

### `GET /api/admin/background-music/counts`

Скільки фонових треків доступно.

Доступно будь-якому адміну, як і лічильник джинглів.

### `GET /api/admin/background-music/file`

Віддає сам файл фонової музики з локального сховища.

**Query:** `mode` — `day` або `night`; `filename` — ім'я файлу; `adminToken` — токен адміна

Повний аналог `/api/admin/jingles/file` для фонової музики: потрібен лише при локальному сховищі, приймає токен у заголовку або в запиті.

### `POST /api/admin/background-music/upload`

Завантажує фоновий трек.

**Query:** `mode` — `day` або `night`

**Заголовки:** `X-File-Name`, `Content-Type: audio/mpeg`

**Тіло запиту:**

```js
сирі байти MP3, до 80 МБ
```

Після успіху йде подія `background_music_updated`.

### `POST /api/admin/background-music/upload-check-duplicate`

Перевіряє ім’я файлу до завантаження.

**Тіло запиту:**

```js
{ filename: 'ambient.mp3' }
```

### `GET /api/admin/donations/history`

Історія донатів з фільтром за періодом.

**Query:** `window` — `24h` \| `7d` \| `30d` \| `max` (усі, обмежені `DONATION_RETENTION_DAYS`); `limit`, `offset` — пагінація

**Відповідь:**

```js
{ entries: [{ id, uid, songId, songTitle, songArtist, provider, currency, amount, tier, status, createdAt, paidAt }], total, offset, limit }
```

Потребує `donations_manage`.

### `GET /api/admin/donations/price-preview`

Ціна першої черги для довільної тривалості — для попереднього перегляду в модалці налаштувань.

**Query:** `durationSeconds` — необов’язковий, за замовчуванням береться найдовший трек у бібліотеці

**Відповідь:**

```js
{ basePrice: 1 }
```

Потребує `donations_manage`. Рахує за поточними, ще не збереженими значеннями форми не можна — лише за вже збереженими налаштуваннями.

### `GET /api/admin/donations/settings`

Поточні налаштування донатів і список провайдера.

**Відповідь:**

```js
{
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
}
```

Доступно будь-якому адміну без окремого привілею — так само, як `GET /api/admin/settings`. Запис вимагає `donations_manage`.

### `POST /api/admin/donations/settings`

Зберігає налаштування донатів.

**Тіло запиту:**

```js
{ currency, pricingMode, fixedPrice, pricePerSecond, tiersEnabled, tierCeiling, blockDonationsWhileChatting }
```

**Відповідь:**

```js
{ settings: { … }, clamped: false }
```

Якщо `tiersEnabled` і найгірший сценарій (найдовший трек у бібліотеці для `calculated`, або `fixedPrice` для `fixed`) на верхній черзі перевищує максимальну суму транзакції провайдера — `tierCeiling` автоматично знижується, а відповідь позначається `clamped: true`.

### `GET /api/admin/history`

Повна історія програвань.

**Відповідь:**

```js
{ ok: true, entries: [ … ], total }
```

Потребує привілею `stats`. Записи автоматично видаляються через `LOG_RETENTION_DAYS` днів — тим самим розкладом, що й журнал адмін-дій.

### `GET /api/admin/jingles`

Список джинглів з пагінацією та пошуком.

Віддається з кешу в пам’яті, тож запит дешевий.

### `GET /api/admin/jingles/:id/audio`

Аудіо джингла для прослуховування в адмінці.

Повертає `{ url }`. У хмарі це підписане посилання на бакет, при локальному сховищі — абсолютне посилання на `/api/admin/jingles/file` з токеном у запиті.

### `POST /api/admin/jingles/:id/used`

Вмикає або вимикає джингл у ротації.

Вимкнений джингл лишається у сховищі, але в ефір не потрапляє. Так зручно тимчасово прибрати сезонний джингл, не видаляючи його.

### `POST /api/admin/jingles/batch-delete`

Видаляє кілька джинглів за раз.

**Тіло запиту:**

```js
{ ids: ['…', '…'] }
```

### `POST /api/admin/jingles/batch-move`

Переносить кілька джинглів між денним і нічним режимом.

**Тіло запиту:**

```js
{ ids: ['…'], targetMode: 'day' | 'night' }
```

Файли переміщуються у сховищі, тож операція не миттєва.

### `GET /api/admin/jingles/counts`

Скільки джинглів є і скільки з них придатні до ефіру.

**Відповідь:**

```js
{
  ok: true,
  day: 12, night: 8,          // усього
  dayUsable: 10, nightUsable: 6,  // позначені як активні
  minRequired: 3,             // мінімум для ротації
}
```

Єдиний ендпоінт розділу без `jingles_uploader` — щоб інтерфейс міг показати стан будь-якому адміну. Якщо придатних менше за `minRequired`, джингли в ефір не підставляються.

### `GET /api/admin/jingles/file`

Віддає сам файл джингла з локального сховища.

**Query:** `mode` — `day` або `night`; `filename` — ім'я файлу; `adminToken` — токен адміна

Потрібен лише при локальному сховищі: у хмарі клієнт іде за підписаним посиланням просто в бакет. Токен приймається і в заголовку, і в рядку запиту, бо програвач хвильової форми качає посилання звичайним `fetch` без заголовків. Вихід за межі теки джинглів дає `400`, відсутній файл — `404`.

### `POST /api/admin/jingles/upload`

Завантажує джингл.

**Query:** `mode` — `day` або `night` (типово `day`)

**Заголовки:** `X-File-Name`, `Content-Type: audio/mpeg`

**Тіло запиту:**

```js
сирі байти MP3, не multipart. Обмеження — 80 МБ
```

**Відповідь:**

```js
{ ok: true, jingle: { id, filename, mode, duration, used } }
```

**Помилки:** `400` — порожнє тіло, не MP3 або конфігурація не підходить; `409` — таке ім’я вже є

Як і при завантаженні треку, тіло надсилається сирими байтами. Новий джингл одразу активний (`used: true`). Якщо запис у базу не вдався, файл прибирається зі сховища — «осиротілих» файлів не лишається. Після успіху широкомовно йде подія `jingles_updated`.

### `POST /api/admin/jingles/upload-check-duplicate`

Перевіряє, чи є вже джингл з таким іменем файлу.

**Тіло запиту:**

```js
{ filename: 'jingle.mp3' }
```

Імена джинглів унікальні глобально, а не в межах режиму.

### `POST /api/admin/login`

Вхід адміністратора.

**Тіло запиту:**

```js
{ login: '…', password: '…' }
```

**Відповідь:**

```js
{ ok: true }              // in production
{ ok: true, token: '…' }  // in development
```

**Помилки:** `400` — не передано логін чи пароль; `401` — невірні дані

**У продакшені токена в тілі відповіді немає** — він приходить лише в httpOnly-куці `adminToken`. Тобто клієнт мусить надсилати запити з `credentials: "include"`, а його походження — бути в `CLIENT_ORIGIN`. Токен живе 12 годин. Кількість спроб входу обмежена.

### `POST /api/admin/logout`

Вихід: очищає куку з токеном.

**Відповідь:**

```js
{ ok: true }
```

### `GET /api/admin/lyrics/audio-preview`

Посилання на аудіо для звірки таймкодів у редакторі.

**Query:** `title` і `artist`

**Відповідь:**

```js
{ url: 'https://…' }
```

У cloud-режимі — тимчасове посилання R2; у local — посилання на `/api/audio/stream/admin`, який приймає адмінський токен і не потребує art/audio токенів.

### `DELETE /api/admin/lyrics/cache`

Видаляє текст із кешу.

**Query:** `title` і `artist`

**Відповідь:**

```js
{ ok: true, existed: true }
```

Після видалення текст буде перезапитано з LRCLIB при наступному зверненні.

### `PUT /api/admin/lyrics/cache`

Зберігає відредагований текст.

**Тіло запиту:**

```js
{ title: '…', artist: '…', entry: { synced: true, lines: [{ time, text }] } }
```

**Відповідь:**

```js
{ ok: true }
```

Ключ — пара «виконавець + назва», а не ідентифікатор треку.

### `GET /api/admin/lyrics/cache-entry`

Текст одного треку.

**Query:** `songId`, або пара `title` + `artist`

### `GET /api/admin/lyrics/cache-full`

Повний кеш текстів.

Віддає все одним шматком — для великої бібліотеки відповідь важка.

### `GET /api/admin/lyrics/cache-index`

Легкий перелік того, для чого текст уже є.

**Відповідь:**

```js
{ items: [ … ] }
```

Дешевша альтернатива `/cache-full`, коли потрібен лише перелік.

### `GET /api/admin/lyrics/offsets`

Усі збережені зсуви синхронізації текстів.

### `GET /api/admin/lyrics/songs`

Треки зі станом текстів — вихідні дані для редактора.

**Відповідь:**

```js
{ items: [ … ] }
```

### `GET /api/admin/phrases`

Список фраз з пагінацією та пошуком.

Віддається з кешу в пам’яті, тож запит дешевий.

### `GET /api/admin/phrases/:id/audio`

Аудіо фрази для прослуховування в адмінці.

Повертає `{ url }`. У хмарі це підписане посилання на бакет, при локальному сховищі — абсолютне посилання на `/api/admin/phrases/file` з токеном у запиті.

### `POST /api/admin/phrases/:id/used`

Вмикає або вимикає фразу в ротації.

### `POST /api/admin/phrases/batch-delete`

Видаляє кілька фраз за раз.

**Тіло запиту:**

```js
{ ids: ['…', '…'] }
```

### `POST /api/admin/phrases/batch-move`

Переносить кілька фраз між денним і нічним режимом.

**Тіло запиту:**

```js
{ ids: ['…'], targetMode: 'day' | 'night' }
```

Файли переміщуються у сховищі, тож операція не миттєва.

### `GET /api/admin/phrases/counts`

Скільки фраз є і скільки з них придатні до ефіру.

**Відповідь:**

```js
{
  ok: true,
  day: 5, night: 3,          // усього
  dayUsable: 4, nightUsable: 2,  // позначені як активні
  minRequired: 1,             // мінімум, щоб прапорець "Фрази в ефірі" можна було увімкнути
}
```

Єдиний ендпоінт розділу без `jingles_uploader` — щоб інтерфейс міг показати стан будь-якому адміну. На відміну від джинглів, налаштування "Фрази в ефірі" в адмінці буде заблоковано (не просто попереджено), доки в кожному активному режимі не буде хоча б `minRequired` придатних фраз.

### `GET /api/admin/phrases/file`

Віддає сам файл фрази з локального сховища.

**Query:** `mode` — `day` або `night`; `filename` — ім'я файлу; `adminToken` — токен адміна

Повний аналог `/api/admin/jingles/file` для фраз: потрібен лише при локальному сховищі, приймає токен у заголовку або в запиті.

### `POST /api/admin/phrases/upload`

Завантажує фразу.

**Query:** `mode` — `day` або `night` (типово `day`)

**Заголовки:** `X-File-Name`, `Content-Type: audio/mpeg`

**Тіло запиту:**

```js
сирі байти MP3, не multipart. Обмеження — 10 МБ
```

**Відповідь:**

```js
{ ok: true, phrase: { id, filename, mode, duration, used } }
```

**Помилки:** `400` — порожнє тіло, не MP3, тривалість довша за ~5 секунд або її не вдалося визначити, або конфігурація не підходить; `409` — таке ім’я вже є

На відміну від джинглів і фонової музики, тривалість тут перевіряється суворо: фраза довша за 5 секунд (з невеликим допуском) або без визначеної тривалості відхиляється. Нова фраза одразу активна (`used: true`). Якщо запис у базу не вдався, файл прибирається зі сховища. Після успіху широкомовно йде подія `phrases_updated`.

### `POST /api/admin/phrases/upload-check-duplicate`

Перевіряє, чи є вже фраза з таким іменем файлу.

**Тіло запиту:**

```js
{ filename: 'phrase.mp3' }
```

Імена фраз унікальні глобально, а не в межах режиму.

### `GET /api/admin/settings`

Усі налаштування радіо.

Доступно будь-якому адміну без окремого привілею — інтерфейсу потрібні ці дані для ініціалізації. Обмежується лише запис.

### `POST /api/admin/settings`

Зберігає налаштування; кожна секція під своїм привілеєм.

**Тіло запиту:**

```js
{
  branding:   { telegram_url, byLang: { uk: { dayRadioName, … } } },
  generation: { DAY_ALGORYTM, MAX_DAY_DURATION, GROUP_DEFS, … },
  radioHosts: { guestMaxDurationMinutes, specialGuestMaxDurationMinutes, backgroundMusicMode },
  songGroups: [ … ],   // ігнорується
}
```

**Помилки:** `403` — бракує привілею на секцію, яка змінюється; `400` — дані не пройшли валідацію

Авторизація йде за тим, що **реально змінюється**, а не за тим, що надіслано: адмінка завжди шле всі секції. `branding` потребує `settings_branding`, `generation` — `settings_algorithm`, `radioHosts` — `radio_moderator`. `songGroups` тут ігнорується: групи редагуються через `/api/admin/song-groups`. Деталі — у [Привілеях](/reference/privileges).

### `DELETE /api/admin/song-editor`

Видаляє трек із бібліотеки та сховища.

**Помилки:** `409` — трек звучить зараз або стоїть наступним

Потребує `editor_meta`. Якщо це був останній денний трек виконавця, заразом прибирається його запис арту. Для не-супер-адмінів діє добова квота видалень.

### `POST /api/admin/song-editor/batch-delete`

Видаляє кілька позначених треків.

Потребує `editor_meta`. Заблоковані треки пропускаються, а не валять усю операцію. Добова квота — 30 видалень для не-супер-адмінів; при перевищенні у відповіді буде залишок.

### `POST /api/admin/song-editor/batch-move`

Переносить кілька треків між режимами.

Потребує `editor_meta`. Працює на будь-якому сховищі.

### `GET /api/admin/song-editor/download`

Завантажити вихідний файл треку.

Потребує `editor_meta`. Віддає той самий MP3, що лежить у сховищі.

### `POST /api/admin/song-editor/move-mode`

Переносить трек між денним і нічним режимом.

Потребує `editor_meta`. Файл фізично переміщується між режимами — у префіксах бакета або в теках на диску, залежно від сховища. Ідентифікатор треку змінюється разом з режимом, бо містить його у своєму складі.

### `POST /api/admin/song-editor/save`

Зберігає метадані, текст і зсув тексту для треку.

**Тіло запиту:**

```js
{
  songId: 'day/artist - title.mp3',
  metadata: { title, artist, album, year },
  metadataChanged: false,   // прапорці визначають, які привілеї потрібні
  lyricsEntry: { … },  lyricsChanged: false,
  offset: 0,           offsetChanged: false,
}
```

**Помилки:** `400` — немає `songId` чи `metadata`; `403` — бракує привілею для того, що змінюється; `404` — трек не знайдено; `409` — трек заблоковано

Потрібний привілей залежить від прапорців: правка метаданих вимагає `editor_meta`, правка тексту — `editor_lyrics` або `editor_meta`. **`409` — очікувана відповідь**, а не збій: трек не можна редагувати, поки він звучить або стоїть наступним; причина приходить у полі `localized`. Зміна метаданих перезаписує ID3-теги у сховищі, тож ідентифікатор треку може змінитися.

### `GET /api/admin/song-groups`

Усі групи пісень з кількістю треків і попереднім переглядом.

**Відповідь:**

```js
{ items: [{ id, name, mode, songCount, songsPreview }] }
```

Читання доступне будь-якому адміну; зміни потребують `settings_groups`.

### `POST /api/admin/song-groups`

Створює групу пісень.

**Тіло запиту:**

```js
{ name: '…', mode: 'day' | 'night', songs: ['day/…'] }
```

Потребує `settings_groups`.

### `DELETE /api/admin/song-groups/:groupId`

Видаляє групу пісень.

Потребує `settings_groups`. На вже поставлені в чергу треки не впливає.

### `PUT /api/admin/song-groups/:groupId`

Оновлює групу: назву або склад треків.

**Тіло запиту:**

```js
ті самі поля, що й при створенні
```

Потребує `settings_groups`.

### `POST /api/admin/song-groups/:groupId/insert`

Ставить усю групу в чергу.

**Помилки:** `400` — група порожня, не вміщується до зміни режиму або діє кулдаун

Потребує **обох** привілеїв — `queue_manage` і `settings_groups`, — бо дія зачіпає і ефір, і склад груп. Наявності лише одного з них недостатньо. Те саме робить подія `admin_insert_song_group` з тими ж вимогами, тож обійти правило через сокет не вийде.

### `GET /api/admin/song-groups/library`

Пошук по бібліотеці для наповнення групи.

**Query:** `mode` (типово `day`), `query`, `offset` (0), `limit` (5)

### `GET /api/admin/songs`

Уся бібліотека режиму зі статусом текстів.

**Query:** `mode` — `day` або `night`; без нього береться поточний режим радіо

**Відповідь:**

```js
[{
  id: 'day/artist - title.mp3',
  title: 'Title', artist: 'Artist',
  filename: 'day/artist - title.mp3',
  lyricsStatus: 'synced' | 'plain' | 'none',
}]
```

На відміну від публічного `/api/library`, показує обидва режими на вибір і додає стан текстів. Окремого привілею не потребує — досить бути автентифікованим адміном.

### `GET /api/admin/stats`

Зведена статистика бібліотеки та ефіру.

**Відповідь:**

```js
об’єкт зі зведенням по режимах, групах і тривалостях
```

Потребує привілею `stats`. Обчислюється на льоту з поточного стану движка.

### `POST /api/admin/switch-mode`

Перемикає радіо між денним і нічним режимом.

**Тіло запиту:**

```js
{
  targetMode: 'day' | 'night',
  scheduledTime: '23:30',   // необов’язково, HH:MM у часовому поясі сервера
}
```

**Відповідь:**

```js
{ ok: true }
```

**Помилки:** `400` — `targetMode` не `day`/`night` або час не у форматі `HH:MM`; `409` — перемкнути зараз не можна (діє кулдаун або в черзі є донат)

Без `scheduledTime` перемикання відбувається одразу. Вказаний час, який уже минув сьогодні, трактується як завтрашній. При `409` у відповіді є прапорець `donated`, який пояснює причину.

### `POST /api/admin/upload-batch-delete`

Видаляє щойно завантажені треки.

Потребує `upload_songs`. Призначено для скасування свіжого завантаження, тоді як `song-editor/batch-delete` працює з усією бібліотекою і вимагає іншого привілею.

### `POST /api/admin/upload-batch-move`

Переносить щойно завантажені треки між режимами.

Потребує `upload_songs`.

### `POST /api/admin/upload-check-duplicate`

Перевіряє, чи такий трек уже є, до завантаження файлу.

**Тіло запиту:**

```js
{ trackId: 'day/artist - title.mp3' }
```

**Відповідь:**

```js
{ ok: true, exists: false }
```

Дешева перевірка перед довгим завантаженням. `trackId` будується як `<режим>/<ім’я файлу>`.

### `POST /api/admin/upload-song-commit`

Крок 3 завантаження: заносить трек у бібліотеку.

**Тіло запиту:**

```js
{
  metadata: { … },      // з кроку 1, з можливими правками користувача
  lyricsEntry: { … },   // з кроку 2, необов’язково
}
```

**Відповідь:**

```js
{ ok: true, track: { … }, lyricsStatus, lyricsFormat, lyricsMessage, message }
```

**Помилки:** `400` — бракує `metadata.filename` чи `metadata.mode`, або збій запису

Аж до цього кроку трек не бере участі в ефірі. Після успіху сервер широкомовно шле подію `library_updated` — оновіть свої списки за нею. Для денних треків заразом створюється запис арту виконавця.

### `POST /api/admin/upload-song-file`

Крок 1 завантаження: кладе MP3 у сховище й читає теги.

**Query:** `mode` — `day` або `night` (типово `day`)

**Заголовки:** `X-File-Name` — ім’я файлу у відсотковому кодуванні; `Content-Type: audio/mpeg`

**Тіло запиту:**

```js
сирі байти MP3, не multipart. Обмеження — 80 МБ
```

**Відповідь:**

```js
{
  ok: true,
  storageKey: 'day/artist - title.mp3',
  metadata: { artist, title, album, year, duration, mode, filename, storageKey },
}
```

**Помилки:** `400` — порожнє тіло або не MP3; `409` — трек із таким іменем уже існує; `400` — помилка запису у сховище

Тіло надсилається сирими байтами (`express.raw`), а **не** як `multipart/form-data` — це найчастіша причина `400` на цьому кроці. Метадані читаються з ID3-тегів; відсутні поля заповнюються запасними значеннями. У бібліотеку трек ще не потрапляє.

### `POST /api/admin/upload-song-lyrics`

Крок 2 завантаження: шукає текст пісні через LRCLIB.

**Тіло запиту:**

```js
{ title, artist, album?, duration? }
```

**Відповідь:**

```js
{
  ok: true,
  lyricsEntry: { synced: true, lines: [{ time, text }] },
  lyricsStatus: 'synced' | 'plain' | 'none',
  lyricsFormat: '…',
  message: { uk: '…', en: '…' },
}
```

**Помилки:** `400` — немає `title` чи `artist`; `500` — не вдалося звернутися до LRCLIB

Крок необов’язковий і не потребує жодних облікових даних: LRCLIB відкритий. Навіть при `500` у відповіді є придатний `lyricsEntry` з `notFound: true`, тож завантаження можна продовжити.

### `POST /api/admin/upload-song-url`

Завантажує аудіо з YouTube у сховище.

**Тіло запиту:**

```js
{ url: 'https://www.youtube.com/watch?v=…' }
```

Найдовша операція в усьому API: включає завантаження й перекодування через FFmpeg. Далі трек проходить ті самі кроки тексту й коміту, що й звичайне завантаження файлу.

### `GET /api/admin/verify`

Перевіряє сесію і повертає актуальні привілеї.

**Відповідь:**

```js
{
  ok: true,
  role: 'super_admin' | 'admin',
  adminId: '…', login: '…',
  privileges: ['queue_manage', '…'],
  authorized: true,
}
```

**Помилки:** `401` — сесія недійсна або обліковий запис видалено

Для помічників привілеї перечитуються з бази, а не беруться з токена — саме тому зміни прав діють без повторного входу. Викликайте це на старті адмінського інтерфейсу.

### `POST /api/admin/youtube-cookies`

Зберігає куки YouTube для обходу вікової перевірки.

**Тіло запиту:**

```js
{ cookies: '… # Netscape HTTP Cookie File …' }
```

**Помилки:** `400` — порожньо або рядок не містить `youtube.com`

Куки пишуться у тимчасову теку сервера і живуть до перезапуску. Потрібні лише для відео з обмеженнями. Це чутливі дані: вони дають доступ до облікового запису, з якого їх узято.

### `POST /api/admin/youtube-track-info`

Читає перелік треків за посиланням на відео або плейлист.

**Тіло запиту:**

```js
{ url: 'https://www.youtube.com/…', lang: 'uk' }
```

**Помилки:** `400` — посилання немає або воно не з YouTube; `503` — інструмент недоступний; `504` — плейлист читався надто довго

Нічого не завантажує — лише повертає, що знайдено за посиланням, щоб користувач обрав потрібне.

### `GET /api/admin/ytbdown-status`

Чи готовий інструмент завантаження з YouTube.

**Відповідь:**

```js
{ ok: true, … }
```

Викликайте перед показом форми імпорту: інструмент вимагає Python і FFmpeg, і на частині розгортань недоступний.

### `GET /api/art/url`

Посилання на арт виконавця замість самих байтів.

**Query:** `artist` — ім’я виконавця

**Заголовки:** `X-Art-Token` / `?token=`

**Відповідь:**

```js
{ url: 'https://…', ttl: 900 }
```

У `cloud`-режимі це тимчасове посилання R2 і зображення **не** зашифроване. У `local`-режимі повертає посилання на `/api/artist-art/:artist`, тобто відповідь усе одно доведеться розшифровувати.

### `GET /api/artist-art/:artist`

Зображення виконавця.

**Заголовки:** `X-Art-Token` / `?token=`

**Відповідь:**

```js
поксорені байти зображення; справжній MIME — у заголовку `X-Art-Mime`
```

**Помилки:** `400` — некоректне ім’я; `404` — арту немає

Заголовок `X-Art-Mime` відкритий через `Access-Control-Expose-Headers`, тож його видно з браузера. Ім’я виконавця нормалізується до нижнього регістру.

### `GET /api/audio-key`

Обмінює art-токен на короткоживучий audio-токен.

**Заголовки:** `X-Art-Token` і `X-Listener-Uid` — обидва обов’язкові

**Відповідь:**

```js
{ token: '<audioToken>', expiresIn: 900 }
```

**Помилки:** `400` — не надіслано `X-Listener-Uid`; `401` — art-токен недійсний або протух

Відповідь має `Cache-Control: no-store`. Оновлюйте токен завчасно: референсний клієнт робить це за 30 секунд до закінчення.

### `GET /api/audio/stream`

Байти аудіо поточного або замовленого треку.

**Query:** `track` — ідентифікатор треку з `sync` або `/api/library`

**Заголовки:** `X-Art-Token` + `X-Audio-Token`, або ті самі значення в query як `artToken` і `audioToken`

**Помилки:** `400` — немає `track`; `401` — недійсні токени; `404` — трек не знайдено

У режимі `local` віддає байти з підтримкою HTTP Range. У режимі `cloud` відповідає `302` на тимчасове посилання R2 — при завантаженні через `fetch` дозвольте редирект. Аудіо **не** шифрується XOR: токени тут лише перепустка. Для `<audio src>` доводиться передавати токени в query, бо заголовки там задати неможливо.

### `GET /api/audio/stream/admin`

Аудіо треку для адмінських інтерфейсів.

**Query:** `track` — ідентифікатор треку

Приймає адмінський токен у заголовку **або в query**, і не потребує art/audio токенів. Саме тому придатний для `<audio src>` у редакторі, де заголовки задати неможливо.

### `GET /api/audio/url`

Посилання на аудіо без віддавання самих байтів.

**Query:** `track` — ідентифікатор треку

**Заголовки:** ті самі, що й у `/api/audio/stream`

**Відповідь:**

```js
{ url: 'https://…', ttl: 900 }   // ttl in cloud mode only
```

Зручно, коли програвач хоче отримати посилання наперед. У `local`-режимі повертає посилання назад на `/api/audio/stream` з уже вбудованими токенами.

### `GET /api/avatar/:filename`

Аватар слухача.

**Заголовки:** `X-Art-Token` / `?token=`

**Відповідь:**

```js
поксорені байти зображення; MIME — у `X-Art-Mime`
```

**Помилки:** `400` — некоректне ім’я файлу; `404` — файлу немає

Ім’я файлу приходить у події `usersUpdate`, у полі `img`.

### `GET /api/history`

Останні 10 зіграних пісень.

**Відповідь:**

```js
[{ id, trackId, title, artist, album, mode: 'day' | 'night', playedAt }]
```

Без токенів. Не залежить від поточного режиму (день/ніч) — просто останні зіграні треки в хронологічному порядку.

### `GET /api/library`

Треки, доступні для замовлення в поточному режимі.

**Відповідь:**

```js
[{ id: 'day/artist - title.mp3', title: 'Title', artist: 'Artist' }]
```

Без токенів. Повертає лише треки поточного режиму (день або ніч), відсортовані за виконавцем. `id` — це те, що надсилається в `suggest_song`.

### `GET /api/lyrics`

Синхронізований текст пісні.

**Query:** `title` і `artist` обов’язкові, `album` — необов’язковий

**Заголовки:** `X-Art-Token` / `?token=`

**Відповідь:**

```js
// after XOR decoding — JSON:
{
  synced: true,
  lines: [{ time: 32.5, text: 'a line' }],
  offset: 0,        // timing correction for this track
  notFound: false,  // true when no lyrics were found
}
```

**Помилки:** `400` — немає `title` чи `artist`; `500` — `fetch_failed`

Тіло відповіді **поксорене** ключем з art-токена, `Content-Type` — `application/octet-stream`. Спочатку розшифруйте, потім `JSON.parse`. Якщо тексту немає в кеші, сервер спробує дістати його з LRCLIB — такий запит помітно повільніший.

### `POST /api/lyrics/offset`

Зберігає зсув синхронізації тексту для треку.

**Тіло запиту:**

```js
{ title: '…', artist: '…', offset: 0.5 }
```

**Помилки:** `400` — немає `title` чи `artist`

Зверніть увагу на шлях: він **без** префікса `/admin`, хоча вимагає адмінського токена. Зсув у секундах, може бути від’ємним.

### `GET /api/public/config`

Режим роботи сервера. Єдиний ендпоінт без будь-якої авторизації.

**Відповідь:**

```js
{
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
}
```

З цього починається будь-який клієнт: `streamMode` визначає, яким саме способом діставати звук, а `musicSource` — чи буде редирект на хмару. `capabilities` вмикає/вимикає окремі фічі залежно від конфігурації сервера (сховище, провайдер даних); `donationInfo` — `null`, якщо `capabilities.donations` вимкнено, інакше — активна конфігурація донатів для відображення ціни й черг ще до виклику `/donations/tiers`.

### `GET /api/public/donations/:id/status`

Поточний статус конкретного донату.

**Відповідь:**

```js
{
  status: 'pending' | 'paid' | 'paid_unqueued' | 'failed' | 'expired',
  tier: 2 | null,
  matchCode: 'F7BQFF' | null,
  expiresAt: 1700000000000 | null,
}
```

**Помилки:** `404` — донату з таким `id` немає, або він належить іншому `uid`

Належність перевіряється за `uid`, виведеним з IP запиту — тим самим, яким позначався донат при створенні. Призначений для сторінки повернення з оплати (`checkout`) або для опитування під час очікування коду (`matching`).

### `POST /api/public/donations/create`

Оформлює донат на пісню за обраною чергою.

**Тіло запиту:**

```js
{ songId: 'day/artist - title.mp3', tier?: 2 }
```

**Відповідь:**

```js
// flowType: 'checkout' (LiqPay, Stripe)
{ donationId: '…', flowType: 'checkout', redirectUrl: 'https://…' }

// flowType: 'matching' (Donatello, Ko-fi)
{
  donationId: '…', flowType: 'matching',
  pageUrl: 'https://…', matchCode: 'F7BQFF',
  amount: 40, currency: 'UAH', expiresAt: 1700000000000,
}
```

**Помилки:** `400` — донати вимкнено або обрана черга недоступна; `404` — пісні немає в бібліотеці; `409` — пісня зараз грає, буде наступною, або донати призупинено (`RADIO_HOSTS_MODE`)

Пісня потрапляє в чергу **лише** після серверного підтвердження оплати (вебхук для `checkout`/Ko-fi, опитування для Donatello) — ніколи напряму від клієнта. Для `matching`-провайдерів `redirectUrl` не повертається: покажіть `pageUrl` і попросіть вписати `matchCode` у коментар до донату; результат прийде подією `donation_result` або опитуванням `/donations/:id/status`.

### `GET /api/public/donations/tiers`

Розраховані ціни донатних черг для конкретної пісні.

**Query:** `songId` — обов’язковий, `id` з `/api/library`

**Відповідь:**

```js
{
  currency: 'UAH',
  pricingMode: 'fixed' | 'calculated',
  tiersEnabled: true,
  tiers: [{ tier: 1, price: 1 }, { tier: 2, price: 2 }, …],  // подвоюється з кожним tier
  flowType: 'checkout' | 'matching',
  chattingBlocked: false,
}
```

**Помилки:** `400` — донати вимкнено; `404` — пісні немає в бібліотеці; `409` — пісня зараз грає або буде наступною

`tiers` — порожній масив, якщо навіть перша черга перевищує максимальну суму транзакції активного провайдера. `flowType` каже, чого чекати від `POST /donations/create`: `checkout` одразу віддає `redirectUrl`, `matching` — сторінку автора й код підтвердження. `chattingBlocked` стосується лише `RADIO_HOSTS_MODE` — черга на паузі, і донати тимчасово не приймаються.

### `GET /api/stream`

Спільний MP3-потік радіо (лише stream-режим).

**Заголовки:** `X-Art-Token` / `?token=`

**Помилки:** `404` — сервер працює в sync-режимі; `503` — потік ще не готовий

Нескінченна відповідь: клієнт просто програє її як потік. Позиція для інтерфейсу береться подіями `stream_get_seek` і `stream_ping`. Заголовок `Icy-MetaData: 1` вмикає ICY-метадані (`icy-metaint` + `StreamTitle` в тілі потоку) для зовнішніх плеєрів на кшталт VLC чи foobar2000.

### `GET /api/stream/public.mp3`

Той самий потік, але без токена — постійне посилання для зовнішніх плеєрів.

**Помилки:** `404` — сервер працює в sync-режимі; `503` — потік ще не готовий

Без авторизації взагалі — це навмисно окремий шлях від `/api/stream`, який лишається токен-огородженим для власного веб-клієнта. Посилання можна вставити у VLC, автомагнітолу чи будь-який Shoutcast/Icecast-сумісний плеєр один раз і назавжди. Розширення `.mp3` у шляху навмисне: деякі плеєри (VLC, foobar2000, Winamp) обирають модуль для відкриття посилання за розширенням у URL, і без нього можуть відкрити його як звичайний файл замість живого ICY-стріму. Відповідь віддає повний набір `icy-*` заголовків (`icy-name`, `icy-genre`, `icy-br`, `Server: Icecast`) одразу, без чекання на `Icy-MetaData: 1` — так плеєр розпізнає стрім як Icecast-сумісний і сам перепідключається, щоб запросити вбудовані метадані (`icy-metaint` + `StreamTitle` у тілі потоку). Тіло — сирий, необмежений потік без `Transfer-Encoding: chunked` (`Connection: close`), як у справжніх Icecast/Shoutcast: ICY-парсер плеєра рахує байти напряму в тілі відповіді, і HTTP-обгортка chunked-кодування збиває цей підрахунок.

### `POST /webhooks/donations/:provider`

Підтвердження оплати від платіжного провайдера.

**Відповідь:**

```js
`200` завжди (навіть при відхиленні) — так провайдери не ретраять без потреби; `404` — невідомий/невлаштований провайдер
```

Не для виклику з клієнта. `:provider` — один з `liqpay`, `stripe`, `donatello`, `kofi`. Змонтований **до** `express.json()`, тож підпис перевіряється по сирому тілу запиту: HMAC для LiqPay/Stripe, `verification_token` для Ko-fi. Donatello сюди нічого не шле — там опитування, не вебхук.

