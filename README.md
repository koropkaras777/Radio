# Radio

Synchronized online radio built with `Node.js` (`Express` + `Socket.io`) and `React` (`Vite`).
All listeners receive the same track and playback position in real time.

## Key Features

- Real-time player state sync across all clients via `Socket.io`.
- Two playback modes: **sync mode** (clients fetch audio directly) or **stream mode** (server FFmpeg broadcast).
- Scheduled `day/night` modes (`DAY_START_HOUR` / `NIGHT_START_HOUR`, `TIME_ZONE`).
- **Live radio hosts** (`RADIO_HOSTS_MODE`): mic mixing into the broadcast, guest room, queue pause, background music, chat mode UI.
- **Jingles** between songs in stream mode (cloud + SQL).
- **Phrases**: short voice tags (≤5s) mixed into a song a few seconds before it ends, without ducking the song (cloud + SQL).
- **Multi-admin RBAC** with granular privileges (SQL provider).
- **Full internationalization**: 17 locales across client and server, RTL support, pluralization, and a translation CLI.
- Listener **song suggestions** (free, admin-approved) and **paid donations** (`DONATIONS_ENABLED`): LiqPay/Stripe checkout or Donatello/Ko-fi code-matching, fixed or duration-based pricing, an optional doubling-price queue-tier ladder, synced **lyrics**, **Picture-in-Picture** mini player.
- Admin panel: upload (including YouTube), queue management, song editor, artist arts, settings, statistics, audit log.
- Two data providers: `json` or `sql` (Turso/libSQL).
- Two media storage backends: `local` (filesystem) or `cloud` (Cloudflare R2 presigned URLs).

## Routes

| Path | Description |
|---|---|
| `/` | Main radio player |
| `/adlogin` | Admin login |
| `/adpanel` | Admin panel |
| `/guest` | Guest landing page (request to join live broadcast) |

## Internationalization

The whole product — listener UI, admin panel, guest room, and every server-generated message — is localized.

### Supported locales

17 locales: `uk` (default), `en`, `pl`, `de`, `es`, `it`, `fr`, `pt`, `nl`, `tr`, `ja`, `he`, `ru`, `zh`, `ko`, `hi`, `ar`.

The locale list is **not hardcoded**: it is derived from the folders inside `client/src/i18n/` (via `import.meta.glob`) and `server/src/i18n/` (via `readdirSync`). Adding a folder adds a language.

### Client side (`client/src/i18n/`)

- Translations are split into namespaces — one JSON file per UI area (`radio.json`, `adminPanel.json`, `songEditor`-related files, `moderatorPanel.json`, …).
- `t('namespace.key', params, lang)` resolves a key, and `useNamespace(ns, lang)` returns a bound translator hook for a component.
- **Interpolation**: `{placeholder}` tokens are replaced from `params`. A param may itself be a localized object — it is resolved in the active language.
- **Pluralization**: when `params.count` is a number, `Intl.PluralRules` picks the category and the lookup falls back through `key_<category>` → `key_other` → `key`. This handles Slavic `one/few/many`, Arabic `zero/two`, and so on.
- **RTL** (`i18n/rtl.js`): `ar` / `he` (and the `iw` alias) switch `document.documentElement.dir` to `rtl`. `applyDirection()` runs on boot in `main.jsx`, and `useDirectionSync(lang)` keeps it in sync on change. Layouts use logical CSS utilities (`text-start`, `start-0` / `end-0`) so they mirror correctly.
- Missing keys log a warning and fall back to the key path, so nothing renders blank.

### Server side (`server/src/i18n/`)

The server does **not** guess the client's language. Instead, `t()` returns an object containing **every** locale at once:

```js
t('queue.songAdded', { title }) // → { uk: '…', en: '…', pl: '…', … }
```

- `withCode(code, key, params)` attaches a machine-readable `code` to the payload.
- `tError(code, params)` builds a localized error from the `errors` namespace.
- `makeError(key, params, { code, cause })` throws a normal `Error` whose `.localized` property carries all locales.
- The client unwraps these with `pickLocalized()` / `localizeServerMsg()` / `parseServerMsg()` from `i18n/serverMessage.js`, and `apiRequest()` automatically surfaces the localized error message for failed responses.

The upshot: a message emitted once over a socket renders in each listener's own language, without per-connection locale negotiation.

Server namespaces: `admins`, `artistArts`, `audit`, `auth`, `cloud`, `common`, `errors`, `guestRoom`, `liveHosts`, `lyrics`, `moderator`, `oligarchs`, `queue`, `radio`, `settings`, `songGroups`, `upload`, `validation`.

### Language selection

`LangSwitcher` (`client/src/components/shared/LangSwitcher.jsx`) renders every supported locale under its native name and is available on the player, the guest page, the admin login, and the admin panel. The choice persists in `localStorage` (`radio_lang` for listener/guest pages, `lang` for admin pages).

### Translation CLI (`server/scripts/translate-i18n.js`)

Manages both `client/src/i18n` and `server/src/i18n` in one pass. Run without arguments for an interactive menu, or use commands directly (from `server/`):

```bash
node scripts/translate-i18n.js status --verbose        # completion table + missing key paths
node scripts/translate-i18n.js translate pl            # fill missing keys via machine translation
node scripts/translate-i18n.js translate pl --from uk --force
node scripts/translate-i18n.js translate de --empty    # empty placeholders for manual translation
node scripts/translate-i18n.js sync                    # align keys across all languages
node scripts/translate-i18n.js sync --plural-aware --from uk
node scripts/translate-i18n.js remove ja               # delete a language (with confirmation)
```

| Command | Description |
|---|---|
| `translate <lang>` | Add or complete a language. `--from` picks the source, `--empty` writes blank placeholders, `--force` re-translates everything, `--missing-only` is the default. |
| `sync` | Fills gaps across every language. `--plural-aware` generates the correct plural categories per locale and requires `--from`. |
| `remove <lang>` | Deletes a locale from both client and server. |
| `status` | Completion table; `--verbose` lists exact missing keys. |

Every run backs up both i18n trees into `server/translate-history/backups/` and writes a log file next to it, so a bad translation pass is always revertible. Placeholders such as `{title}` are masked before translation so they survive intact.

## Admin Panel

### Core

- **Authentication**: login/logout with protected admin endpoints (`/api/admin/*`).
- **Radio control**: force or schedule switch between day/night modes.
- **Queue management**: view/search queue; add songs as Regular (`lastinline`) or Donate (`donated`, optionally tiered); remove; skip; respond to listener suggestions.
- **Song upload**: upload tracks to cloud storage, process lyrics/staging, commit to library. Optional **YouTube URL import** (requires FFmpeg + the bundled `ytbdown` tool, which itself needs `python3` and `pip install -r server/src/tools/ytbdown/requirements.txt`).
- **Song editor**: edit metadata/lyrics, waveform marker/offset handling, bulk actions, remove songs (locked while track is current or up next).
- **Artist arts manager**: upload, crop to phone format, preview, fetch, and delete artist art assets.
- **Settings**: branding (radio names, Telegram link), song groups (drag-and-drop group definitions), generation algorithm (durations, genre groups, jingles and phrases toggles).
- **Statistics**: library/radio stats (day/night split, grouped counts, searchable lists) with export to spreadsheet.
- **Audit log**: admin actions logged, filterable by category and time window, auto-purged after `LOG_RETENTION_DAYS`.

### Multi-admin (requires `DATA_PROVIDER=sql`)

- **Super admin**: credentials from `ADMIN_LOGIN` / `ADMIN_PASS` in `.env`; full access.
- **Helper admins**: created by super admin; start unauthorized and self-activate with a temporary password.
- **14 privileges**: queue, artist arts, upload, lyrics editor, metadata editor, branding settings, groups settings, algorithm settings, stats, mode switch, jingles/background music/phrases, radio host, radio moderator, donations.
- Privilege changes apply at runtime without re-login.

### Stream-mode extras

- **Jingles** (`JinglesModal`): upload/manage day/night jingles with waveform trimming; auto-insert between songs (requires `MEDIA_STORAGE=cloud`, `DATA_PROVIDER=sql`, `STREAM_MODE=true`).
- **Background music**: fills silence when hosts pause the queue (requires `RADIO_HOSTS_MODE=true` in addition).
- **Phrases** (same modal, third tab): upload/manage day/night phrases (≤5s each); one is mixed into a song a few seconds before it ends — random or a fixed pick, timing fixed at 15s or a custom 5-30s window capped by the shortest song in the library. Unlike jingles, "Phrases on air" stays disabled until every active mode has at least one usable phrase.
- **Live hosts** (`HostControlPanel`): go live, mic on/off, pause/resume queue, participant roster, guest queue, pick background music.
- **Moderation** (`ModeratorPanel`): guest queue, special-guest access codes, kick/mute/ban, IP ban list.

> Cloud upload buttons (songs, arts, jingles, phrases) appear only when `MEDIA_STORAGE=cloud`.

### Donations (`DONATIONS_ENABLED=true`)

- One active payment provider at a time, picked with `DONATIONS_PROVIDER`, each behind the same internal adapter interface so a fork can add another without touching the rest of the code. Two integration models:
  - **Checkout** (`liqpay`, `stripe`): the server creates a payment session for the exact tier price, the donor pays on a hosted checkout page, and a signed webhook confirms that specific order instantly. Both require a registered business to receive payouts.
  - **Matching** (`donatello`, `kofi`): no such API exists on either platform - the donor pays on the creator's own fixed page and is asked to type a short confirmation code into their donation comment. The server reconciles it back to the pending order by that code (plus amount/currency), via Ko-fi's webhook or by polling Donatello every `DONATELLO_POLL_INTERVAL_S`; unconfirmed orders expire after `DONATION_MATCH_EXPIRY_MIN`. Neither needs a registered business - this is the same model streamers already use for on-stream donation alerts.
- Settings modal (⚙ button next to the audit log, gated by the `donations` privilege): active provider, currency, **fixed** or **duration-calculated** pricing, an optional donation-**tier ladder** (queue priority 1-10, each tier double the price of the previous one, ceiling auto-lowered to the provider's max transaction amount), and, in `RADIO_HOSTS_MODE`, whether donations pause while the host is "Just Chatting". Includes a donation history tab (retained `DONATION_RETENTION_DAYS`, default 365).
- On the listener side, a **Donate** button next to each library track opens the tier price list; for checkout providers it redirects straight to payment, for matching providers it shows the creator's page link and confirmation code. Either way, the song is inserted into the queue only after server-side confirmation (never the browser), and the listener is notified in real time.
- While a donated song is queued, live hosts cannot pause the queue; and if `blockDonationsWhileChatting` is off (default), a donation paid while the queue is already paused resumes it automatically.

## Listener Features

- **Sync or stream playback** depending on server `STREAM_MODE`.
- **Song suggestions**: order a track from the library when an admin with queue access is online (5 min cooldown, 5 min expiry) - or, when donations are enabled, pay to skip the review queue entirely.
- **Synced lyrics**: fetched from LRCLIB (no account or key needed), XOR-encrypted over the wire; per-track offset; show/hide toggle.
- **Picture-in-Picture**: floating mini player (Chrome/Edge, HTTPS or localhost).
- **Chat mode UI**: when live hosts pause the queue, track info is replaced with a "just chatting" placeholder.
- **Listener roster**: anonymous avatars in the header, each assigned a localized "oligarch" nickname; admins marked.
- **Cover art modal**: links to YouTube Music / Spotify / Apple Music for the current track.
- **Preferences**: language, hide lyrics, dynamic cover colors, manual day color, day theme, cookie consent.
- **Easter eggs** and animated overlays tied to playback state.

## Project Structure

```text
Radio/
├── package.json                        # root scripts (install/build/start)
├── client/                             # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx                    # entry + path-based routing + SW registration
│   │   ├── components/
│   │   │   ├── admin/                  # admin panel, one folder per feature
│   │   │   │   ├── adminLogin/  adminManage/  adminSelf/
│   │   │   │   ├── artistArts/  auditLog/     jingles/
│   │   │   │   ├── donations/  hostControlPanel/  moderatorPanel/
│   │   │   │   ├── panel/              # AdminPanel shell: tabs/, ui/, side menu
│   │   │   │   ├── settings/           # settings modal + groupDefs/ editor
│   │   │   │   ├── songEditor/  stats/  uploadSongs/
│   │   │   │   ├── shared/             # dialogs, privilege gate, waveform DSP
│   │   │   │   └── hooks/
│   │   │   ├── radio/                  # player page
│   │   │   │   ├── RadioPage.jsx  RadioPlayer.jsx  LyricsPlayer.jsx  …
│   │   │   │   ├── hooks/              # audio/stream player, socket, PiP, lyrics, colors
│   │   │   │   └── utils/              # theme, cover art, encrypted audio, storage
│   │   │   ├── guestRoom/              # guest landing, guest panels, live mic hooks
│   │   │   ├── shared/                 # LangSwitcher, Footer, ScrollToTop
│   │   │   └── utils/
│   │   ├── config/                     # constants, easter-egg constants
│   │   └── i18n/                       # 17 locale folders + index.js, rtl.js, serverMessage.js
│   ├── .env.example
│   └── package.json
├── docs/                                # VitePress docs: guide/, protocol/, reference/ (uk + en/)
└── server/                             # Node.js backend
    ├── index.js
    ├── src/
    │   ├── setupApp.js
    │   ├── config/                     # env, db, paths, privileges, oligarchs
    │   ├── data/
    │   │   ├── dataProvider/           # json / sql access, split into domains/ + shared/
    │   │   └── mediaProvider/          # local / cloud media access
    │   ├── donations/                  # provider adapters (liqpay, stripe, donatello, kofi), matching, reconciliation
    │   ├── engine/                     # RadioEngine, playlist builder, lyrics, suggestions
    │   ├── http/routes/                # REST API: admin/ (+ songs/), auth/, client/, media/, webhooks/
    │   ├── socket/handlers/            # connection, listener, admin queue, live host, guest, moderator
    │   ├── stream/                     # FFmpeg broadcast, host mic mixer, WebRTC monitor
    │   ├── session/                    # session store, guest room state
    │   ├── tokens/                     # art / audio / guest-host token signing
    │   ├── middleware/  audit/  bin/  tools/ytbdown/
    │   └── i18n/                       # 17 locale folders + index.js
    ├── db/                             # SQL model reference (documentation only, not imported)
    ├── scripts/                        # migrations, password hashing, i18n CLI
    ├── data/json/                      # JSON provider data + caches (gitignored)
    ├── data/sql/                       # local SQLite file (gitignored)
    ├── media/                          # local storage: music/, jingles/, background/, phrases/ (day/night), arts/ (gitignored)
    ├── public/avatars/                 # app assets, kept in the repo
    ├── .env.example
    └── package.json
```

> `server/db/` holds representative model definitions for documentation purposes — the runtime accesses the database through `src/data/dataProvider/sql/`.

## Quick Start

### 1) Install Dependencies

Requires Node.js 18 or newer.

From the project root:

```bash
npm run install-all
```

Manual alternative:

```bash
npm install --prefix server
npm install --prefix client --include=dev
```

### 2) Configure Environment

Copy the example files and fill in your values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

#### Server (`server/.env`)

**Required:**

| Variable | Description |
|---|---|
| `JWT_SECRET` | Random secret for admin JWT tokens. Server refuses to start without it. |
| `ADMIN_LOGIN` | Admin username. |
| `ADMIN_PASS` | bcrypt hash of the admin password. Generate with `node scripts/hash-password.js` (run from `server/`). |
| `DATA_PROVIDER` | `json` (default) or `sql`. |
| `MEDIA_STORAGE` | `local` (default) or `cloud`. |

**When `DATA_PROVIDER=sql`:**

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | `file:./data/sql/radiosmihun.db` for local SQLite, or `libsql://…` for remote Turso. |
| `TURSO_AUTH_TOKEN` | Turso auth token (required by server for `DATA_PROVIDER=sql`). |

**When `MEDIA_STORAGE=cloud`:**

| Variable | Description |
|---|---|
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint. |
| `R2_BUCKET` | R2 bucket name. |
| `R2_ACCESS_KEY_ID` | R2 API access key. |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key. |
| `R2_PUBLIC_BASE_URL` | Optional; used for legacy public track URLs. |
| `R2_PRESIGN_TTL_S` | Presigned URL lifetime in seconds (default: `900`). |
| `R2_ARTS_PREFIX` | R2 key prefix for artist arts (default: `arts`). |
| `R2_REGION` | R2 region (default: `auto`). |

**When `DONATIONS_ENABLED=true`:**

| Variable | Description |
|---|---|
| `DONATIONS_PROVIDER` | `liqpay`, `stripe`, `donatello`, or `kofi` — exactly one active provider. |
| `PUBLIC_SERVER_URL` | Public base URL of the server; required by `liqpay` and `stripe` to receive their webhook. |
| `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY` | Required when `DONATIONS_PROVIDER=liqpay`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Required when `DONATIONS_PROVIDER=stripe`. |
| `DONATELLO_API_TOKEN`, `DONATELLO_PAGE_URL` | Required when `DONATIONS_PROVIDER=donatello`. |
| `DONATELLO_POLL_INTERVAL_S` | How often to poll Donatello for matching donations, in seconds (default `30`, minimum `10`). |
| `KOFI_VERIFICATION_TOKEN`, `KOFI_PAGE_URL` | Required when `DONATIONS_PROVIDER=kofi`. |
| `DONATION_RETENTION_DAYS` | Days to keep donation history (default `365`, range `7`-`3650`). |
| `DONATION_MATCH_EXPIRY_MIN` | Minutes before an unconfirmed `donatello`/`kofi` donation expires (default `15`, range `3`-`60`). |

**Playback & schedule:**

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port. |
| `NODE_ENV` | `development` | Set to `production` for prod builds. |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin(s), comma-separated. |
| `TIME_ZONE` | `Europe/Kyiv` | IANA timezone for schedule and log purge. |
| `DAY_START_HOUR` | `6` | Hour when day mode begins. |
| `NIGHT_START_HOUR` | `0` | Hour when night mode begins. |
| `NIGHT_MODE` | `true` | `false` disables night mode entirely (24/7 day). |
| `STREAM_MODE` | `false` | `true` enables server-side FFmpeg HTTP stream. |
| `FFMPEG_PATH` | `ffmpeg` | Path to FFmpeg binary (stream mode, YouTube download). |

**Live hosts (optional):**

| Variable | Default | Description |
|---|---|---|
| `RADIO_HOSTS_MODE` | `false` | Enable live hosts, guest room, mic mixing. **Requires `STREAM_MODE=true`.** |
| `MAX_LIVE_HOST_SLOTS` | `1` | Max simultaneous live participants (hosts + guests). |
| `HOST_MONITOR_ICE_PORT_MIN` | `40000` | WebRTC ICE UDP port range start (host personal monitor). |
| `HOST_MONITOR_ICE_PORT_MAX` | `40099` | WebRTC ICE UDP port range end. |
| `HOST_MONITOR_STUN_URL` | `stun:stun.l.google.com:19302` | STUN server for host monitor WebRTC. |

**Other optional:**

| Variable | Default | Description |
|---|---|---|
| `LYRICS_PREFETCH` | `false` | Look up lyrics for every uncached track at startup. Off by default: lyrics are fetched on demand anyway, and a full warm-up delays the first broadcast. |
| `ART_TOKEN_SECRET` | - | Secret for signed artist-art / media tokens. |
| `LOG_RETENTION_DAYS` | `7` | Days to keep audit log entries. |
| `LOG_PURGE_HOUR` | `4` | Hour (in `TIME_ZONE`) when old log entries are purged. |
| `CONFIRM_TRACK_CLEANUP` | `false` | At startup, local storage reconciles itself against the data provider automatically; `true` also lets it remove cached tracks whose file has disappeared from disk (default just warns and keeps the stale record). |
| `YTBDOWN_PATH` | auto-detected | Override path to the bundled `ytbdown` tool used for YouTube import. |
| `EPHEMERAL_STORAGE` | `false` | `true` declares that local disk writes do not survive a restart. The server still starts and only disables the features whose results would be lost — see [Ephemeral hosting](#ephemeral-hosting). |

> `MUSIC_SOURCE` is accepted as a backward-compatible alias for `MEDIA_STORAGE`.

#### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3001` | Backend URL (used by Vite proxy). |
| `VITE_PORT` | `3000` | Vite dev server port. |

### 3) Run in Development

Server:

```bash
npm run dev --prefix server
```

Client:

```bash
npm run dev --prefix client
```

Or run the server from the root:

```bash
npm run dev
```

## Production Mode

```bash
npm run build     # client + documentation
npm start
```

- Server: `http://localhost:3001` (or `PORT` from `server/.env`)
- Client (dev): `http://localhost:3000` (or `VITE_PORT`)

In production the server serves the built client from `client/dist`.

### Documentation on its own subdomain

One service serves both. Requests are routed by hostname: anything arriving on
the documentation host gets the VitePress build from `docs/.vitepress/dist`,
everything else gets the radio client. `DOCS_HOST` names that host; left empty,
any hostname whose first label is `docs` will do.

This keeps the docs in lockstep with the code: the API reference is generated
from `server/src`, so shipping them together is what guarantees the reference
describes the server actually running.

**Deploying on Render** — a single Web Service:

| Setting | Value |
|---|---|
| Build Command | `npm run install-all && npm run build` |
| Start Command | `npm start` |

Then add both custom domains to that same service — `radiosmihun.com` and
`docs.radiosmihun.com` — and point each at Render with the CNAME it gives you.
Certificates are issued per domain automatically. Set `DOCS_HOST` in the
service's environment if you want the host matched exactly.

> `npm run install-all` passes `--include=dev` for the client and the docs.
> Render sets `NODE_ENV=production` during the build, and without that flag npm
> skips devDependencies — which is where Vite and VitePress live, so the build
> would fail at the first build step.

### Ephemeral hosting

On platforms that wipe the filesystem on every deploy, set `EPHEMERAL_STORAGE=true`
so the server warns about it instead of losing data silently. The server **still
starts on any configuration** — radio is first of all a broadcast, and a poor
storage choice is not a reason to take listeners off the air. At startup it checks
whether the data provider and the media storage actually survive a restart (a
remote Turso database and R2 do; local JSON, local SQLite, and local media do
not) and disables only the features whose writes would be lost:

| Works | Disabled |
|---|---|
| Statistics, incl. export | Uploading/editing tracks, jingles, background music, phrases, artwork |
| Song queue control | Helper admins, admin account editor |
| Day/night switch | Saving settings (viewing stays available) |
| Broadcast, lyrics, sync | Audit log, playback history |
| | Donations, even with a provider configured |

The two axes are independent — a remote database with local media keeps admin
accounts and settings working and disables only what touches files. The client
learns the restrictions from `capabilities` in `/api/public/config` and hides
the corresponding buttons, while the routes enforce them independently, since
hiding a button is not a restriction by itself.

## Playback Modes

### Sync mode (default, `STREAM_MODE=false`)

The server emits a `sync` event every 2 seconds with the current track and position.
Clients fetch encrypted audio directly and adjust playback when drift is detected.
When a track ends, the server advances the playlist.

### Stream mode (`STREAM_MODE=true`)

The server decodes tracks via FFmpeg, mixes live host microphones (when `RADIO_HOSTS_MODE=true`), encodes a shared MP3 stream, and serves it at `GET /api/stream` (art-token auth).
Clients play the HTTP stream and sync UI seek via `stream_get_seek` / `stream_ping` socket events.
Requires FFmpeg on the server (or `FFMPEG_PATH` in `.env`).
Changes take effect only after server restart.

## Feature Requirements

| Feature | Required configuration |
|---|---|
| Sync playback | `STREAM_MODE=false` |
| FFmpeg HTTP stream | `STREAM_MODE=true`, FFmpeg installed |
| Live hosts / guest room / chat mode | `STREAM_MODE=true` + `RADIO_HOSTS_MODE=true` |
| Jingles on air | `STREAM_MODE=true` + `DATA_PROVIDER=sql` + `MEDIA_STORAGE=cloud` |
| Background music (during host pause) | Above + `RADIO_HOSTS_MODE=true` |
| Phrases on air | `STREAM_MODE=true` + `DATA_PROVIDER=sql` + `MEDIA_STORAGE=cloud` |
| Multi-admin RBAC | `DATA_PROVIDER=sql` |
| Cloud song/art upload | `MEDIA_STORAGE=cloud` |
| YouTube import | FFmpeg + `ytbdown` (needs `python3` + its `pip` deps) — storage/data provider don't matter |
| Auto lyrics | nothing — LRCLIB needs no credentials |
| Donations (checkout) | `DONATIONS_ENABLED=true` + `DONATIONS_PROVIDER=liqpay\|stripe` + that provider's credentials + `PUBLIC_SERVER_URL` |
| Donations (code-matching, no business needed) | `DONATIONS_ENABLED=true` + `DONATIONS_PROVIDER=donatello\|kofi` + that provider's page URL/token |

## Data and Migrations

Every migration runs through one CLI, `server/scripts/migrate.js` (run from `server/`).
It works either through commands or interactively — running it with no arguments
opens a menu:

```bash
npm run migrate                 # interactive menu
npm run migrate -- status       # what data and media are present
npm run migrate -- help         # full usage
```

| Command | Description |
|---|---|
| `status` | Reports the media layout and library contents. |
| `layout` | Moves media from the pre-`media/` layout into `server/media`. |
| `data` | Copies the whole dataset between any two storages — `json`↔`sql`, or one database into another. |
| `media` | Copies media files between local storage and the cloud bucket, in either direction. |
| `scan` | Registers jingles, background music, and phrases that already sit in cloud storage but have no record yet in the data provider. Local storage reconciles this automatically at every startup, so `scan` only matters for cloud storage. |

```bash
# Local JSON files into a local SQLite database
node scripts/migrate.js data --from json --to sql --sql-url file:./data/sql/radio.db

# A remote database into a local one, for testing against real data
node scripts/migrate.js data --from sql --to sql \
  --source-sql-url libsql://<database>.turso.io --source-sql-token <token> \
  --target-sql-url file:./data/sql/radio.db

# The media library up to the bucket, previewing first
node scripts/migrate.js media --from local --to cloud --dry-run \
  --r2-endpoint https://<account>.r2.cloudflarestorage.com --r2-bucket <bucket> \
  --r2-access-key-id <id> --r2-secret-access-key <key>

# Register cloud jingles/background music/phrases that have no data-provider record yet
node scripts/migrate.js scan --provider sql \
  --sql-url libsql://<database>.turso.io --sql-token <token>
```

Both sides of `data` may be the same provider; each then needs its own location,
given as `--source-sql-url` / `--target-sql-url` (and the matching `-token` and
`--*-json-dir` forms). A per-side option wins over the shared `--sql-url`.

**Credentials are never read from `.env`.** A remote database or bucket is reached
only when its URL, token or keys are given on the command line, so a mistaken
command cannot touch a deployed radio's storage. Every command supports
`--dry-run`, and `media` never deletes on either side — it skips files already
present at the same size, so an interrupted run can simply be repeated.

Other helper scripts in `server/scripts`:

| Script | Description |
|---|---|
| `generate-artist-arts-json.js` | Generates/updates `artist_arts.json` from local art files. |
| `hash-password.js` | Generates a bcrypt hash for `ADMIN_PASS`. |
| `translate-i18n.js` | i18n translation CLI (see [Internationalization](#internationalization)). |

JSON provider data lives in `server/data/json/`, the local SQLite file in `server/data/sql/`. Both are gitignored.

Migration logs are written to `server/migration-history/`, i18n backups and logs to `server/translate-history/`.

To switch providers, set `DATA_PROVIDER=json` or `DATA_PROVIDER=sql` and restart the server.

## Useful Commands

| Command | Description |
|---|---|
| `npm run install-all` | Install server and client dependencies. |
| `npm run build-client` | Build frontend into `client/dist`. |
| `npm run start` / `npm start` | Run backend (production). |
| `npm run dev --prefix server` | Backend in watch mode. |
| `npm run dev --prefix client` | Vite dev server. |
| `node scripts/hash-password.js` | Generate bcrypt hash for `ADMIN_PASS` (from `server/`). |
| `node scripts/translate-i18n.js status` | i18n completion report (from `server/`). |
| `npm run migrate --prefix server` | Migration CLI: interactive menu, or `-- <command>` (see [Data and Migrations](#data-and-migrations)). |

## Security

- Never commit real secrets (`JWT_SECRET`, `TURSO_AUTH_TOKEN`, R2 keys, `ART_TOKEN_SECRET`, donation provider keys/tokens) to git.
- Use `.env.example` templates for onboarding without real tokens.
- `ADMIN_PASS` must be a bcrypt hash, not a plain-text password.
- In production with live hosts, open UDP ports `HOST_MONITOR_ICE_PORT_MIN`–`HOST_MONITOR_ICE_PORT_MAX` for WebRTC host monitor.

## Support

If this project is useful to you, donations are welcome:

- **Donatello**: [donatello.to/RadioSmihun](https://donatello.to/RadioSmihun)
- **Crypto (USDT)**:

| Network | Address |
|---|---|
| Tron (TRC20) | `TC5rLcwx8fuixAygXxvFFTM1q46i6XCzcS` |
| Ethereum (ERC20) | `0x6D7A457F7892AF9B316a3262eFDc2056C3f435ef` |
| Solana | `2dLfnrjUCJsfTEQyaq1t3WupJPyfckHBWvcUsvxxFjUv` |

## License

[MIT](LICENSE) — run your own radio, modify it, build on it. The only condition
is keeping the copyright notice.
