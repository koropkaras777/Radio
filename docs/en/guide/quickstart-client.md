# Build a client in 15 minutes

This page takes you from an empty file to sound coming out of the speakers. By
the end you will have a client that connects to the server, shows the current
track, and plays it in sync with every other listener.

It assumes the server is already running. If it isn't, start with
[Running your own server](/en/guide/self-hosting).

## Three things to know first

These shape the whole client. Skipping them costs hours.

**Radio state arrives over Socket.io, not REST.** The HTTP endpoints serve
supporting resources — library, lyrics, audio. The current track and playback
position arrive in a `sync` event every two seconds.

**Audio is behind two tokens.** You first obtain an `artToken` over the socket,
then exchange it for an `audioToken`. Audio is not served without both.

**The server has two playback modes.** In sync mode the client fetches the file
and keeps its own position; in stream mode the server serves one shared MP3.
`/api/public/config` tells you which — your client must support at least one.

::: warning CORS
The server only serves origins listed in `CLIENT_ORIGIN` in `server/.env`. Until
your client's address is there, the browser blocks both requests and the socket.
Multiple values are comma-separated:

```ini
CLIENT_ORIGIN=http://localhost:3000,http://localhost:5173
```

The server must be restarted after changing it.
:::

## Step 1. Ask the server how it is configured

The only endpoint that needs no authentication at all:

```http
GET /api/public/config
```

```json
{
  "dataProvider": "json",
  "musicSource": "local",
  "nightMode": true,
  "streamMode": false,
  "radioHostsMode": false,
  "allPrivileges": ["queue_manage", "..."],
  "timeZone": "Europe/Kyiv",
  "capabilities": { "uploadTracks": true, "editSettings": true, "...": true }
}
```

`capabilities` only matters for an admin client — the full field list is in
[The rest of the admin workflows](/en/guide/admin-workflows#start-by-asking-what-is-available).
A listener client needs none of it. What matters here is `streamMode`. The path below covers `streamMode: false` — the
harder one, and the one worth implementing first. For `streamMode: true` see
[Playback modes](/en/protocol/playback-modes).

## Step 2. Connect the socket

```js
import { io } from 'socket.io-client';

const SERVER = 'http://localhost:3001';
const socket = io(SERVER, { withCredentials: true });
```

Immediately after connecting, **without any request from you**, the server
sends:

| Event | Payload |
|---|---|
| `sync` | full radio state (see step 4) |
| `radio_hosts_mode` | `true` / `false` — whether live hosts are enabled |
| `usersUpdate` | array of active listeners |

## Step 3. Get an `artToken`

This is the step you cannot guess. The client has to send `listener_init`
itself:

```js
let artToken = null;
let listenerUid = null;

socket.on('connect', () => socket.emit('listener_init'));

socket.on('listener_uid', (data) => {
  listenerUid = data.uid;
  artToken = data.artToken;
  // data.artTokenExpiresIn — seconds until expiry (3600 by default)
  // data.cooldownSecsLeft  — wait before the next song request
});
```

::: tip Identity is derived from the IP address
The server derives `uid` from the connection's IP — the client cannot choose it.
As a result, listeners behind the same NAT share one `uid`, and therefore one
token and one song-request cooldown. This is not a bug in your client.
:::

The `artToken` lives for **one hour**. Your client must reconnect or send
`listener_init` again to get a fresh one.

## Step 4. Read the radio state

The `sync` event arrives every two seconds and describes the state completely:

```js
socket.on('sync', (state) => {
  console.log(state.title, '—', state.artist, '@', state.seek);
});
```

```json
{
  "track": "day/artist - title.mp3",
  "title": "Title",
  "artist": "Artist",
  "album": "Album",
  "year": 2020,
  "duration": 214.5,
  "seek": 87.2,
  "isPlaying": true,
  "playlist": [{ "id": "…", "title": "…", "artist": "…", "orderType": "…" }],
  "mode": "day",
  "serverTimeMs": 1754899200000,
  "uiSettings": { "…": "…" }
}
```

Key fields:

- **`track`** — the identifier used to request audio, shaped like `day/…` or
  `night/…`.
- **`seek`** — position in seconds as of `serverTimeMs`. The difference between
  your local position and this value is the drift you have to correct.
- **`playlist`** — up to 10 upcoming tracks.
- **`isPreparing: true`** — the server is switching modes; `track` will be
  `null`.

When hosts pause the queue, `title` becomes `"Just chatting"` and `artist`
becomes an empty string. Show something other than track metadata in that case.

## Step 5. Exchange `artToken` for `audioToken`

```http
GET /api/audio-key
X-Art-Token:     <artToken>
X-Listener-Uid:  <uid>
```

```json
{ "token": "<audioToken>", "expiresIn": 900 }
```

Both headers are required — without `X-Listener-Uid` the server answers `400`.

The token is short-lived, so refresh it early. The reference client does so 30
seconds before expiry.

## Step 6. Play the audio

```js
const url = new URL(`${SERVER}/api/audio/stream`);
url.searchParams.set('track',      state.track);
url.searchParams.set('artToken',   artToken);
url.searchParams.set('audioToken', audioToken);

const audio = new Audio(url.toString());
audio.currentTime = state.seek;
await audio.play();
```

Tokens go either in headers (`X-Art-Token`, `X-Audio-Token`) or in the query
string (`artToken`, `audioToken`). For `<audio src>` only the second option
works, since headers cannot be set there.

::: info The audio is not encrypted
A common misreading of the source: `audioToken` looks like an encryption key but
is not one — it is a pass. Audio bytes are served as-is and `<audio>` plays them
directly.

The XOR wrapper in this project applies **not to audio** but to artist art,
avatars and lyrics — and the key there is the `artToken`. See
[Tokens and access](/en/protocol/tokens).
:::

Behaviour depends on `musicSource` from step 1, and it affects your client:

| `musicSource` | What `/api/audio/stream` does |
|---|---|
| `local` | serves bytes with HTTP Range support |
| `cloud` | answers `302` redirecting to a temporary Cloudflare R2 URL |

Both are transparent to `<audio>`, but if you fetch manually, allow redirects.

An alternative is `GET /api/audio/url`, which returns `{ url, ttl }` without the
bytes — useful when your player wants the URL up front.

## Step 7. Stay in sync

Minimal drift correction: on every `sync`, compare your position with the
server's and snap if the gap is too large.

```js
const DRIFT_TOLERANCE = 0.35; // seconds

socket.on('sync', (state) => {
  if (!state.isPlaying || state.track !== currentTrackId) return;
  if (Math.abs(audio.currentTime - state.seek) > DRIFT_TOLERANCE) {
    audio.currentTime = state.seek;
  }
});
```

The 0.35 s threshold comes from the reference client: smaller values cause
audible jumps on every network hiccup. For finer correction, factor in
`serverTimeMs` and the event's delivery time.

::: info You do not advance the queue
The server decides when a track ends, using durations from its own metadata.
There is no event for reporting "the track finished" — just wait for the next
`sync` with a new `track`. Advancement happens within two seconds of the real
end.
:::

## What's next

The minimal client is done. The next layers, each with its own endpoint:

| Feature | Where to look |
|---|---|
| Track library | `GET /api/library` — public, no tokens |
| Lyrics | `GET /api/lyrics` — art token, XOR-wrapped |
| Artist art | `GET /api/artist-art/:artist` — art token, XOR-wrapped |
| Requesting a song | `suggest_song` event, 5-minute cooldown |
| Listener roster | `usersUpdate` event |
| Live hosts and guests | `radio_hosts_mode`, see the event reference |

::: danger Localized messages
The server returns errors and messages as an **object containing every
language**, not a string. A client expecting `error: "text"` will receive an
object and break. Read
[Message format and i18n](/en/protocol/messages) before writing error handling.
:::
