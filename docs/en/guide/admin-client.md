# Build an admin client

The other half of the protocol: controlling the broadcast. This page walks the
whole path from logging in to managing the queue.

It assumes you have read
[Build a client in 15 minutes](/en/guide/quickstart-client) — an admin
connection is built on top of an ordinary listener one.

## Authentication has two halves

The most common cause of "nothing works, and there are no errors either": an
admin authenticates **twice, separately**.

| Channel | How | What it grants |
|---|---|---|
| HTTP | `POST /api/admin/login` → cookie or bearer | access to `/api/admin/*` |
| Socket.io | the `admin_active` event | admin events and their results |

A successful HTTP login does **not** make your socket an admin socket. Until
`admin_active` is sent, the server treats the connection as an ordinary
listener.

## Step 1. Log in

```http
POST /api/admin/login
Content-Type: application/json

{ "login": "admin", "password": "…" }
```

```json
{ "ok": true }              // in production
{ "ok": true, "token": "…" } // in development
```

::: warning In production the token is not in the response body
It arrives only in the httpOnly `adminToken` cookie, which JavaScript cannot
read. Send requests with `credentials: 'include'`, and add your client's origin
to `CLIENT_ORIGIN` on the server. The token lasts 12 hours, and login attempts
are rate-limited.
:::

## Step 2. Upgrade the socket

```js
socket.emit('admin_active');            // token taken from the cookie
socket.emit('admin_active', jwtToken);  // or pass it explicitly

socket.on('admin_confirmed', ({ role, privileges, authorized }) => {
  // build the interface from this list
});

socket.on('admin_error', (raw) => {
  const msg = JSON.parse(raw); // an object containing every locale
});
```

::: danger Authorization errors here are silent
If the socket has not been upgraded, admin events are **ignored with no
reply** — no error, no callback. Your client will look frozen. Always wait for
`admin_confirmed` before showing any controls.
:::

`authorized: false` means a helper admin who has not yet activated themselves
with a temporary password; until then they can do nothing.

## Step 3. Build the interface from privileges

`privileges` is an array of strings, and it is more authoritative than the token
contents: the server re-reads permissions from the database on every
`admin_active`, which is why changes apply without logging in again.

```js
const can = (p) => privileges.includes(p);
if (can('queue_manage')) renderQueueControls();
```

The full list is in the [privileges reference](/en/reference/privileges). The
super admin holds all 13.

::: tip Permissions in the UI are convenience, not security
The server checks the privilege independently on every operation. Hiding buttons
is useful, but relying on it is neither safe nor necessary.
:::

## Step 4. The queue

```js
socket.emit('get_queue', { offset: 0, limit: 20 }, ({ items, total }) => {
  // items: [{ id, title, artist, orderType }]
});
```

Reads use callbacks; writes do not. The result of any change arrives as a
separate event:

```js
socket.on('admin_success', (raw) => showToast(pickLocalized(JSON.parse(raw))));
socket.on('admin_error',   (raw) => showError(pickLocalized(JSON.parse(raw))));
```

Note that the payload is a **string** that has to be `JSON.parse`d first, and
only then localized. Success messages often carry a `code` field
(`QUEUE_SONG_ADDED` and so on) — branch on that rather than on the text.

Queue operations:

```js
socket.emit('admin_add_song', { id, title, artist, orderType: 'lastinline' });
socket.emit('admin_remove_song', position);  // offset from the current track
socket.emit('admin_skip_song');
socket.emit('admin_insert_song_group', { groupId });
```

`orderType` is either `'lastinline'` (ordinary) or `'donated'`, which places the
track ahead of ordinary requests.

::: info Cooldowns are a normal response, not a failure
Adding, removing and skipping each have their own delay. The server returns an
error with the number of seconds to wait — show it to the user instead of
retrying.
:::

Take the position for `admin_remove_song` from `search_queue`: each item there
already carries a `position` field.

## Step 5. Listener requests

Admins with `queue_manage` receive the request list and its updates:

```js
socket.on('suggestions_update', (list) => {
  // [{ uid, song: { id, title, artist }, addedAt }]
});

socket.emit('admin_suggestion_action', { uid, action: 'add' }); // or 'reject'
```

A request lives for 5 minutes and expires on its own — the listener then gets
`suggestion_result` with `auto: true`. Accepting an already-expired request
returns a "not found" error, so refresh the list from the event rather than
caching it for long.

## Step 6. Uploading a track

This is not one request but a pipeline of three sequential steps — and the track
does not go on air until the last one completes. Requires the `upload_songs`
privilege.

```
upload-check-duplicate  →  upload-song-file  →  upload-song-lyrics  →  upload-song-commit
      (optional)              file to storage        song lyrics         into the library
```

```js
// 1. A cheap check before a long upload
await post('/api/admin/upload-check-duplicate', { trackId: `day/${filename}` });

// 2. The file — RAW BYTES, not multipart
const { metadata } = await fetch(`${SERVER}/api/admin/upload-song-file?mode=day`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'audio/mpeg',
    'X-File-Name': encodeURIComponent(file.name),
  },
  body: file,          // Blob or ArrayBuffer
}).then((r) => r.json());

// 3. Lyrics (optional — LRCLIB, no credentials needed)
const { lyricsEntry } = await post('/api/admin/upload-song-lyrics', {
  title: metadata.title, artist: metadata.artist,
  album: metadata.album, duration: metadata.duration,
});

// 4. Only now does the track appear in the library
await post('/api/admin/upload-song-commit', { metadata, lyricsEntry });
```

::: warning The file is sent as raw bytes
Step 2 reads the body through `express.raw`, not as `multipart/form-data`.
`FormData` will get you a `400`. The filename goes in the `X-File-Name` header,
because a raw body carries no name. The limit is 80 MB.
:::

Between steps 2 and 4 you can show the metadata to the user for editing — it was
read from ID3 tags and often needs correcting. Pass the corrected object to
`commit`.

After a successful commit the server broadcasts `library_updated`, which tells
every client to re-read its lists.

## What's next

**Live broadcasting** is a separate topic with its own ordering: going on air,
microphones, the guest queue, moderation. It is written up with sequence
diagrams in [Live broadcast walkthrough](/en/guide/live-broadcast).

The rest of the admin surface — the track editor, lyrics, settings, groups, the
audit log and accounts — is walked through in
[The rest of the admin workflows](/en/guide/admin-workflows). Exact request
bodies and required permissions are in the
[REST reference](/en/reference/rest) and the
[event reference](/en/reference/socket-events).
