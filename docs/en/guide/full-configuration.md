# Full configuration

[Running your own server](/en/guide/self-hosting) covers the simplest setup:
JSON, local files, sync mode. This page covers everything else — the database,
cloud storage, streaming and live broadcasting.

## What depends on what

The first thing to take away: **the provider you pick changes nothing**. Both
data providers do everything, and so do both media providers. Admin roles,
jingles, the ban list, uploading songs — all of it works on `json` with local
files exactly as it does on Turso with the cloud.

Only two kinds of dependency remain: technical ones (something needs a stream or
an external tool) and durability (on ephemeral hosting there is no point writing
what will vanish).

| I want | What is actually required |
|---|---|
| Basic radio | nothing |
| Multiple admins with roles | nothing |
| Uploading songs and artwork | nothing |
| IP moderation | `RADIO_HOSTS_MODE=true` |
| A shared stream | `STREAM_MODE=true` + FFmpeg |
| Jingles between songs | `STREAM_MODE=true` |
| Live broadcasting | `STREAM_MODE=true` + `RADIO_HOSTS_MODE=true` |
| Background music during pauses | `STREAM_MODE=true` + `RADIO_HOSTS_MODE=true` |
| YouTube import | FFmpeg and the `ytbdown` downloader (needs `python3` and its `pip` dependencies) |

The two storage axes are independent: `DATA_PROVIDER` decides **where metadata
lives**, `MEDIA_STORAGE` decides **where files live**. Mix them freely — it does
not affect what the radio can do, only where the bytes physically land.

::: tip Then why have a cloud and a remote database at all
For **durability**, not features. On a host that wipes its disk on deploy, local
files do not survive a restart, and some admin actions are switched off because
their results would have vanished anyway. That is the only case where the
storage choice changes anything: [Ephemeral hosting](#ephemeral-hosting).
:::

::: warning One hard dependency
`RADIO_HOSTS_MODE=true` without `STREAM_MODE=true` makes no sense: there is
nowhere to mix a host's microphone into if no shared stream exists. The server
does not stop — it warns in the log and leaves live broadcasting disabled.
:::

## Database

Not needed for any feature: `json` does the same things. You pick it for other
reasons — a database handles concurrent writes, does not rewrite a whole file on
every change, and above all can live somewhere other than the server's disk.

::: warning One process per directory
The JSON provider serialises writes within a process. Several server instances
over one directory is not supported; that scenario needs `sql`.
:::

### A local file — no cloud services at all

This is the part most often missed: `DATA_PROVIDER=sql` **does not require a
Turso account**. A local SQLite file is enough:

```ini
DATA_PROVIDER=sql
TURSO_DATABASE_URL=file:./data/sql/radio.db
# TURSO_AUTH_TOKEN is not needed for file:
```

The token is only required for remote addresses (`libsql://`, `https://`): a
local file has nothing to authenticate against. Point it at a remote address
without a token and the server refuses to start, saying so explicitly.

In other words, multiple admins with granular privileges need no cloud at all.

### Remote Turso

```ini
DATA_PROVIDER=sql
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=<token>
```

Worth it when the server runs somewhere with an ephemeral filesystem — typical
of container hosts that wipe the disk on every deploy.

### Tables create themselves

There is no schema to apply or migrate: every domain runs
`CREATE TABLE IF NOT EXISTS` during initialisation. An empty database is a
working state — the server sets itself up.

Reference model definitions live in `server/db/`, but they are documentation
only: the runtime goes through `src/data/dataProvider/sql/`.

### Migrating existing data

If the radio already ran on `json` and accumulated a library:

```bash
cd server
node scripts/migrate.js data --from json --to sql --sql-url file:./data/sql/radio.db
```

The reverse direction is the same command with `--from` and `--to` swapped. A
remote database takes a token alongside its URL:

```bash
node scripts/migrate.js data --from sql --to json \
  --sql-url libsql://<database>.turso.io --sql-token <token>
```

Credentials are **never read from `.env`**: a remote database is reached only
when its URL and token are given on the command line, so a mistaken command
cannot touch a deployed radio's storage. Start with `--dry-run`, which reports
what would be copied and does not even open the target database.

### Between two databases

A radio running on SQL alone usually has two databases: a local one to try things
on and a remote one serving listeners. Moving between them is the same command,
with each side pointed somewhere of its own:

```bash
node scripts/migrate.js data --from sql --to sql \
  --source-sql-url libsql://<database>.turso.io --source-sql-token <token> \
  --target-sql-url file:./data/sql/radio.db
```

The per-side options (`--source-sql-url`, `--target-sql-url`, their `-token`
counterparts, and `--source-json-dir` / `--target-json-dir`) take precedence over
the shared `--sql-url` and `--json-dir`. The shared form is enough when there is
one database; when there are two, no shared option could tell them apart.

Source and target must not point at the same storage: the target is emptied
before it is refilled, so a self-copy is refused.

The whole dataset moves: tracks, lyrics, offsets, artwork, settings, jingles,
background music, phrases, banned addresses, admins (password hashes included), the
audit log and the playback history. After writing, the CLI reopens the target
on a fresh connection and reports how many records actually landed.

Migration logs are written to `server/migration-history/`.

Switching back to `json` is just a variable change and a restart: provider data
is not overwritten.

## Local storage

Everything the media provider owns lives under a single directory that mirrors
the bucket layout, so both providers are arranged identically:

```text
server/
├── data/                     ← metadata
│   ├── json/
│   └── sql/
├── media/                    ← the media provider
│   ├── music/day/
│   ├── music/night/
│   ├── jingles/day/
│   ├── jingles/night/
│   ├── background/day/
│   ├── background/night/
│   ├── phrases/day/
│   ├── phrases/night/
│   └── arts/
└── public/avatars/           ← application assets, kept in the repository
```

Listener avatars are deliberately left outside: they ship with the repository
and change by hand, so they are not user data.

::: warning For installations that ran before this change
Music used to live in `server/music/` and artwork in `server/public/arts/`. The
server detects the old layout and refuses to start, rather than coming up with
an empty library. Migrating is one command, run from the `server` directory:

```bash
node scripts/migrate.js layout --dry-run   # show the plan
node scripts/migrate.js layout             # move the files
```

Files are moved rather than copied, and the emptied old directories are left in
place for you to delete.
:::

### Reconciling with disk at startup

Every start checks these folders against what the active data provider knows,
and writes the difference itself — there is no need to run `migrate.js scan`
by hand after dropping files straight onto disk:

| What gets checked | Adds a missing record | Removes a record with no file |
|---|---|---|
| Tracks (`music/day`, `music/night`) | yes, with ID3 tags | yes, **only with `CONFIRM_TRACK_CLEANUP=true`** |
| Artist arts | yes (`hasArt: true`) | no |
| Jingles, background music, phrases | yes, with duration | no |

Removing tracks is the only destructive direction of the four, and the only
one off by default: if a file disappears from disk (a volume not mounted yet,
a disk hiccup), the server just warns in the log and keeps the stale record
instead of pruning the library. Turn on actual removal with
`CONFIRM_TRACK_CLEANUP=true`.

::: tip Local storage only
There is no such reconciliation for `MEDIA_STORAGE=cloud` at all: listing a
bucket's contents means real, billed requests to R2, and doing that on every
start would not be worth it. For cloud storage, reconciling stays a manual
step: [`migrate.js data`](#migrating-existing-data) for metadata, `migrate.js
scan` to register jingles, background music and phrases that are already in
the bucket but have no record in the data provider.
:::

## Cloud storage

Also not needed for any feature: the local provider does all of it — uploading
songs, artwork, jingles, background music, phrases. You pick the cloud when the server's
disk is not dependable, or to take file serving off the server itself.
Cloudflare R2 is used through its S3-compatible API.

```ini
MEDIA_STORAGE=cloud
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=radio
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_REGION=auto
R2_PRESIGN_TTL_S=900
R2_ARTS_PREFIX=arts
```

Create the credentials in R2 as an **S3 API token** with read and write access
to the bucket.

### Bucket layout

The server arranges files like this and creates the paths itself:

```text
<bucket>/
├── day/Artist - Title.mp3          ← key = the track identifier
├── night/Artist - Title.mp3
├── arts/artist.jpg                 ← prefix from R2_ARTS_PREFIX
├── jingles/day/…mp3
├── jingles/night/…mp3
├── background/day/…mp3
├── background/night/…mp3
├── phrases/day/…mp3
└── phrases/night/…mp3
```

The audio key is literally the `track` value from the `sync` event, so you can
populate the bucket by hand as long as you follow this scheme.

### Access and URLs

The bucket **does not need to be public**: clients receive temporary presigned
URLs that live for `R2_PRESIGN_TTL_S` seconds (15 minutes by default). Signing
is done by the server itself, without an SDK.

`R2_PUBLIC_BASE_URL` is optional and only exists for compatibility with older
public URLs.

::: tip Checking without the admin panel
If uploads fail in the admin panel, first make sure all four variables
(`R2_ENDPOINT`, `R2_BUCKET` and both keys) are non-empty — with any of them
missing the R2 client does not even initialise.
:::

### Moving media between local storage and the cloud

```bash
cd server
node scripts/migrate.js media --from local --to cloud --dry-run \
  --r2-endpoint https://<account>.r2.cloudflarestorage.com --r2-bucket <bucket> \
  --r2-access-key-id <id> --r2-secret-access-key <key>
```

The reverse direction is `--from cloud --to local`. Drop `--dry-run` and the
command asks for confirmation before it starts copying.

This is a **copy, not a mirror**: nothing is deleted on either side. A file
already at the destination with the same size is skipped, so an interrupted run
can simply be repeated and picks up only what is still missing. When the size
matches but the content does not, use `--overwrite`.

`--category` limits the run to part of the library — artwork only, for example:

```bash
node scripts/migrate.js media --from cloud --to local --category arts …
```

::: warning Music is laid out differently
Locally, tracks live under `media/music/`; in the bucket they are simply `day/`
and `night/`, because an object key *is* the track identifier. The command
accounts for that difference — copying files by hand is where it gets missed.
:::

## Streaming

```ini
STREAM_MODE=true
FFMPEG_PATH=ffmpeg
```

FFmpeg must be installed. If it is not on `PATH`, give the full path in
`FFMPEG_PATH` — the same variable is used for YouTube downloads.

Switching modes takes effect **only after a server restart**: the audio delivery
path is decided at startup.

What changes for clients is covered in
[Playback modes](/en/protocol/playback-modes) — in short, they listen to
`/api/stream` instead of `/api/audio/stream`, and take position from events.

## Live broadcasting

```ini
STREAM_MODE=true
RADIO_HOSTS_MODE=true
MAX_LIVE_HOST_SLOTS=2

HOST_MONITOR_ICE_PORT_MIN=40000
HOST_MONITOR_ICE_PORT_MAX=40099
HOST_MONITOR_STUN_URL=stun:stun.l.google.com:19302
```

`MAX_LIVE_HOST_SLOTS` counts hosts and guests **together**: at `1` the host
takes the only slot and no guest can join.

### Networking

The host's personal monitoring runs over WebRTC, and it is the only part of the
project that needs open **UDP** ports:

```
UDP 40000–40099 (or your range) — inbound
```

Without them the broadcast still works, but the host hears themselves with the
shared stream's delay, which makes conversation awkward. Why the channel exists
at all is explained in
[Live broadcast](/en/guide/live-broadcast#personal-monitoring).

If the server sits behind NAT, a public STUN server is usually enough. More
awkward networks would need a TURN server, which the project does not support
yet.

### Permissions

Going on air requires the `radio_host` privilege, moderation requires
`radio_moderator`. The super admin creates helpers holding them, and that works
**on either data provider**: `json` stores accounts just as `sql` does.

One limit remains, and it is not about storage: **one session per account**. Two
people on air means two separate accounts — not a particular provider.

IP moderation is available everywhere too: both providers store the ban list.

## Donations

One active provider at a time — `DONATIONS_PROVIDER` picks which, and each
one only needs its own variables:

```ini
DONATIONS_ENABLED=true
DONATIONS_PROVIDER=liqpay   # liqpay | stripe | donatello | kofi

# checkout: the server creates a payment for the exact price itself and gets
# an instant webhook - needs a registered business for payouts
LIQPAY_PUBLIC_KEY=
LIQPAY_PRIVATE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PUBLIC_SERVER_URL=https://your-domain.example   # LiqPay needs this for its callback

# matching: the donor pays on the creator's own page and types a code into
# their comment - no registered business needed, the same model streamers use
DONATELLO_API_TOKEN=
DONATELLO_PAGE_URL=https://donatello.to/your_page
DONATELLO_POLL_INTERVAL_S=30
KOFI_VERIFICATION_TOKEN=
KOFI_PAGE_URL=https://ko-fi.com/your_page
DONATION_MATCH_EXPIRY_MIN=15

DONATION_RETENTION_DAYS=365
```

::: warning Built exactly to the providers' documentation, not battle-tested against live payments
All four provider integrations (LiqPay, Stripe, Donatello, Ko-fi) are
implemented exactly per their official API documentation — request shapes,
webhook signature checks, error codes. None of them, however, has been through
a full cycle of real payments in production. Before turning donations on for a
live radio, run the whole chain yourself — through the provider's test mode
where one exists, or with a minimal real amount — and be ready for some edge
case in the payment provider's actual behavior to have gone unaccounted for.
:::

`DONATIONS_ENABLED=true` without a properly configured provider is not fatal:
the server only warns in the log, and `capabilities.donations` stays off until
every required variable for the chosen provider is filled in.

::: tip Why two kinds of providers
`liqpay`/`stripe` are ordinary checkout gateways: the server sets the exact
price itself and learns about payment instantly via a webhook, but payouts
need a registered business. `donatello`/`kofi` are built for creators without
one — at the cost of precision: the donor types in the amount themselves, and
the server reconciles the payment against the order using a confirmation
code. For how that changes client behavior, see
[Donations](/en/guide/admin-workflows#donations).
:::

Just like the audit log, `DONATION_RETENTION_DAYS` (7-3650, 365 by default)
decides how long donation history survives in the database — and it does not
rescue an ephemeral disk either: if the active storage configuration does not
survive a restart, `capabilities.donations` switches off entirely, no matter
how correctly the payment provider itself is configured.

## Recommended order

Enable things in this order, because each step can be verified on its own:

1. **Basic radio** on `json` + `local`. Confirm that music plays.
2. **Admins**: create a helper and check that the privileges apply. No provider
   change is needed for this.
3. **Uploads**: put one song and one piece of artwork in through the panel.
4. **Streaming**: `STREAM_MODE=true`. Check that `/api/stream` serves audio.
5. **Jingles**: the condition is now met.
6. **Live broadcasting**: `RADIO_HOSTS_MODE=true` and open UDP ports.

Changing storage — to `sql` or to `cloud` — can be done **at any point and
independently** of this list: it enables nothing and disables nothing, until the
host is declared ephemeral. Data moves with
[`migrate.js data`](#migrating-existing-data), files with `migrate.js media`.

Restart the server after each step and read the log: most configuration
mistakes are reported explicitly at startup.

## Ephemeral hosting

Some platforms wipe the filesystem on every deploy. To stop the server from
losing data silently, declare it:

```ini
EPHEMERAL_STORAGE=true
```

The server **starts on any configuration** — radio is first of all a broadcast,
and a poor storage choice is no reason to take listeners off the air. Instead, at
startup it checks both axes, prints a warning listing the reasons, and **disables
the features whose results would not survive a restart**.

The key point: durability is a property of **where the bytes physically land**,
not of the provider's name.

| Setting | Survives a restart |
|---|---|
| `DATA_PROVIDER=sql` + `libsql://…` | yes |
| `DATA_PROVIDER=sql` + `file:…` | **no** — it is the same disk |
| `DATA_PROVIDER=json` | no |
| `MEDIA_STORAGE=cloud` | yes |
| `MEDIA_STORAGE=local` | no |

A local SQLite file does not save you on ephemeral hosting: it vanishes with the
disk like everything else.

### What stays available

| Works | Disabled |
|---|---|
| Statistics, including the export | Uploading tracks, jingles, background music, phrases, artwork |
| Song queue control | The track, jingle, background music and phrase editors |
| Day/night switch | Helper admins and the admin account editor |
| Viewing settings | Saving settings |
| The broadcast, lyrics, sync | The audit log and the playback history |
| | Donations (even with a provider enabled and configured) |

Settings stay **visible but read-only**: seeing what the radio is currently doing
is useful either way.

The restrictions apply at two levels. The client receives them in the
`capabilities` field of [`/api/public/config`](/en/reference/rest) and stops
offering the buttons, while the routes themselves refuse independently — hiding
a button is not a restriction, because the endpoint stays reachable directly.

The two axes are counted separately: a remote database with local media keeps
admins, the audit log and settings working, and disables only what touches files.

If the disk really is persistent, simply leave the flag off and every feature is
available on any combination of providers.

## Variables that are easy to forget

| Variable | Why it matters |
|---|---|
| `CLIENT_ORIGIN` | without your origin the browser blocks both requests and the socket |
| `ART_TOKEN_SECRET` | signs the media access tokens |
| `LYRICS_PREFETCH` | `true` looks up lyrics for the whole library at startup; off by default |
| `TIME_ZONE` | drives the day/night schedule and log purging |
| `LOG_RETENTION_DAYS` | how long audit entries and playback history live |
| `CONFIRM_TRACK_CLEANUP` | lets the startup reconciliation remove tracks whose files disappeared from disk |

The full list with comments is in `server/.env.example`.
