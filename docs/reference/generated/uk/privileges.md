<!-- ЗГЕНЕРОВАНО автоматично через `npm run extract`. Не редагувати вручну. -->
<!-- Джерело правди — код сервера. Описи додавайте у файли поза цією текою. -->

Усього привілеїв: **14**

| Привілей | Значення | Захищає ендпоінтів |
|---|---|---|
| `QUEUE_MANAGE` | `queue_manage` | 1 |
| `ARTIST_ARTS` | `artist_arts` | 4 |
| `UPLOAD_SONGS` | `upload_songs` | 10 |
| `EDITOR_LYRICS` | `editor_lyrics` | 8 |
| `EDITOR_META` | `editor_meta` | 14 |
| `SETTINGS_BRANDING` | `settings_branding` | 0 |
| `SETTINGS_GROUPS` | `settings_groups` | 4 |
| `SETTINGS_ALGORITHM` | `settings_algorithm` | 0 |
| `STATS` | `stats` | 2 |
| `MODE_SWITCH` | `mode_switch` | 1 |
| `JINGLES_UPLOADER` | `jingles_uploader` | 21 |
| `RADIO_HOST` | `radio_host` | 0 |
| `RADIO_MODERATOR` | `radio_moderator` | 0 |
| `DONATIONS_MANAGE` | `donations_manage` | 3 |

> Таблиця рахує лише HTTP-ендпоінти. Частина привілеїв — насамперед
> `RADIO_HOST` і `RADIO_MODERATOR` — перевіряється ще й на рівні Socket.io
> (`socket/context.js`), тож нуль у колонці не означає, що привілей не діє.

