# The rest of the admin workflows

[Build an admin client](/en/guide/admin-client) takes you as far as queue
control and uploading a track. This page covers everything else the panel does:
the track editor, lyrics, settings, groups, the audit log and accounts.

It assumes your socket is already upgraded and that you know your privilege set
from `admin_confirmed`.

## Start by asking what is available

Privileges say **whether this admin is allowed to**. That is a different
question from **whether the server can**: the same panel on a different
configuration has fewer features, and no privilege changes that.

```js
const { capabilities } = await fetch(`${SERVER}/api/public/config`).then(r => r.json());

// { uploadTracks, editTrackMetadata, moveTrackMode, deleteTracks, artistArts,
//   helperAdmins, adminAccount, ipModeration, editSettings, auditLog, history,
//   jingles, backgroundMusic, phrases }
```

Show a button only when **both** conditions hold:

```js
const canShowEditor = privileges.includes('editor_meta') && capabilities.editTrackMetadata;
```

A capability is off for one of two reasons. Either the configuration lacks
something technical — jingles have nowhere to go without `STREAM_MODE`. Or the
storage does not survive a restart: on a host with `EPHEMERAL_STORAGE=true` and
local files an upload would work and then vanish with the next deploy, so the
server does not offer it. See
[Ephemeral hosting](/en/guide/full-configuration#ephemeral-hosting).

::: tip This is not only about the UI
The routes check the same thing regardless of the client. A hidden button
protects nothing — an unavailable feature answers `400` with an explanation in
`error`. So `capabilities` is a way to avoid offering what would not work, not a
security mechanism.
:::

## The track editor

The endpoint contract in short: `POST /api/admin/song-editor/save` accepts
`metadata`, `lyricsEntry` and `offset` together with three flags
(`metadataChanged`, `lyricsChanged`, `offsetChanged`) — the server checks the
privilege for what **actually changes** (`editor_meta` for metadata,
`editor_lyrics` or `editor_meta` for lyrics), and a track that is currently
playing or queued next is refused with `409` and an explanation in
`error.localized`.

The full implementation — how the client decides which of the three things
changed, how it handles the timecode format, and what it shows on `409` — is
documented separately: [The admin song editor](/en/guide/admin-song-editor).

## Lyrics and timings

Lyrics live separately from tracks and are keyed by the **artist + title** pair,
not by track identifier. That is why renaming an artist in the metadata carries
the lyrics along.

| What you need | Endpoint |
|---|---|
| Lightweight index of what already has lyrics | `GET /api/admin/lyrics/cache-index` |
| Lyrics for one track | `GET /api/admin/lyrics/cache-entry` |
| Save edited lyrics | `PUT /api/admin/lyrics/cache` |
| Forget them (to re-fetch) | `DELETE /api/admin/lyrics/cache` |
| Every offset | `GET /api/admin/lyrics/offsets` |

`GET /api/admin/lyrics/cache-full` returns everything in one piece — a heavy
response on a large library, so use `cache-index` for the list.

For aligning timings there is `GET /api/admin/lyrics/audio-preview`: it returns
a URL you can feed straight to `<audio src>`. In the cloud that is a temporary
bucket link; locally it is a link to the admin stream route with the token in
the query. The client cannot tell the difference.

The offset is stored separately, and its path has **no** `/admin` even though an
admin token is required:

```js
await post('/api/lyrics/offset', { title, artist, offset: -0.4 });
```

The offset is in seconds and may be negative.

## Settings

`GET /api/admin/settings` is open to any authenticated admin. `POST` is too, but
authorisation is **per section**, based on what actually differs from what is
stored:

| Section | Privilege |
|---|---|
| `branding` | `settings_branding` |
| `generation` | `settings_algorithm` |
| `radioHosts` | `radio_moderator` |

The panel always sends every section in full, so the check cannot rely on what
was submitted — otherwise every admin would need all three privileges. The
content is what gets compared.

The `songGroups` field in this body is **ignored**: groups have endpoints of
their own.

If `capabilities.editSettings` is off, `GET` still works. That is deliberate:
seeing what the radio is currently doing is useful even when nothing can be
changed — the reference panel shows a read-only form in that case.

## Song groups

A group is a named set of tracks in one mode that can be queued in a single
action.

```js
await post('/api/admin/song-groups', {
  name: 'Morning block',
  mode: 'day',
  songs: ['day/Artist - Title.mp3', '…'],
});
```

Any admin may read groups; changing them requires `settings_groups`. To find
tracks while populating one, `GET /api/admin/song-groups/library` is paginated.

Queueing a group requires **both** privileges — `queue_manage` and
`settings_groups` — because the action touches both the broadcast and the group
definitions. One is not enough, and the `admin_insert_song_group` event does the
same thing under the same requirements, so the rule cannot be side-stepped over
the socket.

## The audit log

```js
const { entries, total } = await get('/api/admin/audit?window=24h&offset=0&limit=50');
```

Windows: `1h`, `6h`, `24h`, `7d`. The log is read from an in-memory cache, so
paging is cheap.

Entries are written by the server itself — there is no "append to the audit"
endpoint, and there cannot be one. Each entry carries `operationType`,
`adminLogin` and `data`; what `data` holds depends on the operation.

The whole section switches off when storage does not survive a restart: the log
would be written into something the next deploy discards, and would show a
misleading fraction of what actually happened.

## Playback history

```js
const { entries, total } = await get('/api/admin/history');
```

Unlike the audit log, this needs the `stats` privilege — no dedicated one was
added, it reuses the same one as statistics. There is no pagination: the volume
is already bounded by the same `LOG_RETENTION_DAYS` as the audit log.

There is also a public, unauthenticated variant — the last 10 entries, used by
both the radio client itself and third-party apps:

```js
const recent = await fetch(`${SERVER}/api/history`).then(r => r.json());
```

It switches off under the same rule as the audit log: writing into storage
that will not survive a restart is pointless.

## Accounts

Two independent branches with different requirements.

### Helper admins — super admin only

```js
const { admins, allPrivileges } = await get('/api/admin/admins');
await post('/api/admin/admins', { login: 'helper', password: 'Temp1234', privileges: ['stats'] });
```

The password here is **temporary**. The account is created with
`authorized: false` and can do nothing until the helper activates it. Password
hashes are never returned.

A privilege change applies **without logging in again**: if the helper is
online, they immediately receive a `privileges_updated` event. Deletion sends
them `force_logout` with `reason: "admin_deleted"`, ending the session at once.

### Your own account

```js
await post('/api/admin/admins/self/activate', { tempPassword, newPassword });
await put('/api/admin/admins/self/login',    { newLogin, currentPassword });
await put('/api/admin/admins/self/password', { currentPassword, newPassword });
```

Activation is the only action available to a helper with `authorized: false`.
On success an `admin_authorized` event follows.

::: warning The super admin is an exception here
Their login and password come from environment variables (`ADMIN_LOGIN`,
`ADMIN_PASS`), so the `/self` branch answers `400` for them. Changing those is a
server configuration matter.
:::

## Donations

A donation is a paid song request that skips moderation entirely: only the
server moves the queue, once payment is confirmed — never the client directly.
The whole section switches off when `capabilities.donations` is off — no
provider is configured, or storage does not survive a restart, the same rule
as the [audit log](#the-audit-log).

Reading settings is open to any admin, same as `GET /api/admin/settings`;
writing them, and reading history, need the `donations_manage` privilege:

```js
const { settings, provider, historyCurrencies } = await get('/api/admin/donations/settings');
await post('/api/admin/donations/settings', {
  ...settings,
  tiersEnabled: true,
  tierCeiling: 5,
});
```

### Two provider shapes, two client behaviors

`provider` (from that same response, and from `donationInfo` in
`/api/public/config`) tells you what to expect from
`POST /api/public/donations/create` — branch on `flowType`, not on a specific
`provider.id`, since more adapters can be added later:

| `flowType` | Providers | What to do with the response |
|---|---|---|
| `checkout` | LiqPay, Stripe | `location.href = redirectUrl` right away |
| `matching` | Donatello, Ko-fi | show `pageUrl` and `matchCode`, then wait for `donation_result` or poll `/donations/:id/status` |

`matching` exists because neither service has a "create a payment for exactly
X" API: the donor pays on their own page and types the code into their
comment. No exact amount is enforced, so a donation is accepted on an
"at-least-the-expected-price" basis, not "exactly this much".

::: tip Tiers are a multiplier, not a separate choice
When `tiersEnabled`, each tier costs **twice** the previous one, and the first
tier's price is `fixedPrice` or `pricePerSecond × duration`, depending on
`pricingMode`. `tierCeiling` caps how many tiers exist (2-10), and the server
lowers it itself on save if the most expensive tier would exceed the
provider's transaction limit — the `POST` response flags that with
`clamped: true`.
:::

### History

```js
const { entries, total } = await get('/api/admin/donations/history?window=7d&limit=50');
```

Windows share their shape with the audit log (`24h`, `7d`), plus `30d` and
`max` — the latter bounded by `DONATION_RETENTION_DAYS` (365 days by default,
not `LOG_RETENTION_DAYS`: donations are kept longer than the action log). Each
entry has a `status`: `pending`, `paid`, `paid_unqueued`, `failed`, or
`expired` — `paid_unqueued` means the payment was accepted but the song could
not be queued, and needs a manual look.

::: warning Donations and queue pause (`RADIO_HOSTS_MODE`) are mutually exclusive
While the queue holds even one donated song, `host_pause_queue` is refused —
the host sees `host_queue_pause_state` with `denied: true`. Conversely, if the
queue is already paused and `blockDonationsWhileChatting` is off (the
default), a successful donation **resumes it itself**, so the paid song does
not wait behind "Just Chatting" forever.
:::

## What next

- [Full configuration](/en/guide/full-configuration) — what each capability depends on
- [Privileges](/en/reference/privileges) — the complete list and what each one opens
- [REST API](/en/reference/rest) — exact request bodies, responses and error codes
