# Playback modes

The server runs in one of two modes, and your client needs to know which. Read
it from `GET /api/public/config` → `streamMode`. It is set in `.env` only and
requires a server restart to change.

## Sync mode (`STREAM_MODE=false`)

The client fetches the audio itself; the server only says what to play and from
which second.

```
server ──sync (every 2 s)──> client ──GET /api/audio/stream──> file
```

The server sends `sync` with `track`, `seek` and `serverTimeMs`. The client
compares its own position against `seek` and snaps if the gap exceeds a
threshold (the reference client uses 0.35 s).

**Upsides:** quality does not depend on the server's bandwidth, seeking is
instant.
**Cost:** synchronisation is approximate, and every client downloads files
separately.

## Stream mode (`STREAM_MODE=true`)

The server decodes tracks through FFmpeg, mixes in live host microphones when
enabled, encodes one shared MP3 and serves it as a single stream.

```
FFmpeg ──mixer──> shared MP3 ──GET /api/stream──> all clients
```

The client simply plays the HTTP stream. Position for the UI comes from the
`stream_get_seek` and `stream_ping` events — needed only to display a timer,
since the audio itself is synchronous by construction.

The stream endpoint is protected by the art token.

**Upsides:** true synchronisation, and live broadcasting becomes possible.
**Cost:** constant CPU and bandwidth load on the server, and FFmpeg is required.

## The queue is the server's business

In both modes the server decides when a track ends, using durations from its own
metadata and its own playback clock. The client takes **no part** in this: there
is no event for reporting that a track finished or for suggesting its duration.

In practice your client does not need to do anything on the `<audio>` element's
`ended` event — just wait for the next `sync` carrying a new `track`.

## What a client should support

At minimum one mode, and it should say so honestly if the server runs the other.
A complete client checks `streamMode` at startup and picks a branch.

| | Sync | Stream |
|---|---|---|
| Audio source | `/api/audio/stream?track=…` | `/api/stream` |
| `audioToken` required | yes | no, art token only |
| Position | from the `sync` event | `stream_get_seek` / `stream_ping` |
| Live hosts | unavailable | available |

## Live hosts

Work **only** in stream mode and only when `RADIO_HOSTS_MODE=true` — there is no
mix to inject a microphone into otherwise.

When a host pauses the queue, `title` in `sync` becomes `"Just chatting"`,
`artist` becomes empty, and background music fills the silence. Your client
should render something instead of track metadata, or the interface will look
broken.

In stream mode you also get precise markers — `stream_chat_mode_start`,
`stream_jingle_start`, `stream_track_start` — which arrive immediately rather
than within the two-second `sync` interval.

## Synced lyrics (karaoke)

Lyrics are fetched separately from the audio — `GET /api/lyrics?title=…&artist=…`
with an `X-Art-Token` header, the response body encrypted with that same token
(XOR). The synced format is `{ synced: true, lines: [{ time, text }], offset }`;
`offset` is the manual, per-song calibration in seconds set by an admin in the
[song editor](/en/guide/admin-song-editor#the-synced-lyrics-format), and it has
to be added to every `time` before comparing against the current position.

In sync mode, highlighting the active line is trivial: the current position is
just `seek` from `sync`, no correction needed. The client fetches the file
itself, so whatever is coming out of `<audio>` is the same moment the server
considers current.

::: warning In stream mode, "the server's position" ≠ "what is audible"
`stream_get_seek` returns the FFmpeg decoder's position on the server — the
moment a sample was **just encoded**, not the moment it reached the listener
and actually played. Between those two moments sits the `<audio>` element's
own buffer (how much is already downloaded but not yet played) and network
latency. In practice this can be several seconds, and the value is not
constant — it depends on the network and on how the browser happens to buffer
the stream.

The reference client measures this gap rather than ignoring it: `hearLag` =
(how much audio is already buffered in `<audio>` but hasn't played yet) +
(half the RTT, from `stream_ping`), smoothed exponentially so the line does
not jitter back and forth on brief network blips. The position used for
karaoke is the server's position **minus** this `hearLag`, not the raw value.
Without that correction, lines highlight several seconds before the song
actually gets there.
:::

**Jingles pause the clock, not just the music.** While a jingle plays, the
server does not advance the current track's position — but the client's own
clock, which extrapolates position forward from the last known `seek` (so it
does not need to poll every second), has no way to know that on its own. The
client has to listen for `stream_jingle_start` / `stream_jingle_end`
explicitly and freeze the extrapolation for that stretch — otherwise the
lyrics "drift" ahead of the real clock while a jingle plays instead of the
song.

**Phrases are not the same thing as jingles.** A jingle replaces the whole
stream between songs: the clock stops, `track` does not change, and the
listener hears silence in the music followed by the full jingle instead. A
phrase, by contrast, is mixed **on top of** the music a few seconds before
the song ends — the same way a host's voice is, just without ducking the
song's own volume. To a client this is invisible: no event fires, and
`track`/`seek`/lyrics never change, because as far as the protocol is
concerned the same song is still playing, just with a voice layered over it
in its final seconds.

::: warning `Just chatting` does not hide lyrics by itself
While a chat pause is active, `track` in `sync` **does not change** — it is
still the same track, just paused, so the simplest check ("the track changed,
refresh the lyrics") will not fire here: `title`/`artist` go empty, but
`track` stays the same identifier. If your client decides whether to show
lyrics purely based on having a current track, the previous song's lyrics will
stay on screen during the pause, and the clock (if nothing stops it) will run
the highlight down to the last line and freeze it there for the rest of the
pause. Listen for `stream_chat_mode_start` / `stream_chat_mode_end` themselves
and hide lyrics on that flag directly, rather than on the absence of a track.
:::
