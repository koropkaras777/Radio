# The admin song editor

[The rest of the admin workflows](/en/guide/admin-workflows#the-track-editor)
covers the endpoint contract — request bodies, privileges, error codes. This
page covers something else: how the editor itself is built in
`admin/songEditor/` — so you can match its functionality, not just hit the
same routes.

## The library

The modal opens with no track selected — the list comes first. Two things load
in one pass: `GET /api/admin/lyrics/songs` (every track with its lyrics status
— `synced` / `plain` / `none`) and `GET /api/admin/lyrics/offsets` (an
offset map keyed by artist+title). The list is filtered locally, with no
repeat requests to the server:

- a text search across title and artist (every token has to match, in any
  order);
- an "unsynced only" toggle;
- in day/night mode, a filter by the track's broadcast mode.

Display is paged 5 at a time (`SEARCH_PAGE`); "show more" pulls the next batch
from the already-loaded array, not from the server — the library is fetched
whole, in one request.

### Multi-select

A long press (~1s) or a right click on a track enters selection mode —
checkboxes instead of the usual open-on-click. Two batch actions are available
there, both going through `BulkConfirmModal`:

- **Delete** — `POST /api/admin/song-editor/batch-delete`. If everything in
  the library is selected, the confirmation hides the track list (it would not
  fit anyway) and gates the button behind a 15-second countdown before
  allowing confirmation.
- **Move day↔night** — `POST /api/admin/song-editor/batch-move`, available
  only when the selected tracks belong to a **single** broadcast mode: a mixed
  selection shows a hint instead of a silent no-op.

In both cases the server can skip some tracks (busy on air — see below), so
the client checks `results[].ok` and shows a separate toast for a partial
failure rather than one blanket "done".

## The song card

Selecting a track from the list loads `GET /api/admin/lyrics/cache-entry` and
shows `SongCard` — until "edit" is pressed it is just a preview: the first few
lines of lyrics (`LyricsLine`), without timecodes in plain mode, with them in
synced mode.

### Three independent save flags

The save button figures out what actually changed and sends only that —
`metadataChanged`, `lyricsChanged` (`entryChanged` in the code),
`offsetChanged`. The comparison is exact: the new lyrics entry is serialized
and compared byte-for-byte against the original, not "did you touch a field".
If none of the three changed, no request goes to the server at all — just a
"nothing changed" toast.

Moving day/night is a **separate, fourth** call
(`POST /api/admin/song-editor/move-mode`), and it runs **after** the main save,
sequentially, because it changes the `songId` (the path depends on mode) that
the second request needs to operate on.

::: warning `409` needs handling, not a generic error message
A track that is currently playing or queued next cannot be edited — the server
returns `409` with a localized explanation in `error.localized`. The editor
shows that field as-is (`pickLocalized`), not its own "something went wrong"
text; the same goes for `403`, when `*Changed: true` was sent for a field the
admin has no privilege for.
:::

## The synced lyrics format

A synced lyrics line is an LRC-like `[minutes:seconds.hundredths] text`
format, checked against the regex
`/^\[(\d{2}):(\d{2})\.(\d{2,3})\] ?(.*)$/`. Before saving, the client checks
on its own that **every** non-empty line matches the format
(`isSyncedFormat`) — if not, no request goes to the server at all, the editor
shows the format error right away. The fractional part can be two or three
digits (`SS` or `SSS`) — old imported lyrics sometimes carry milliseconds
instead of hundredths, and the parser accepts both.

Toggling "synced" in either direction does not lose data silently:

- **turning sync off** — the timecodes are simply stripped
  (`stripTimecodes`), the line text stays;
- **turning it on** over text that has no timecodes yet — a confirmation
  appears: "generate timecodes automatically?". Accepting lays out one line
  per second as a rough scaffold (`generateTimecodes`); declining just enables
  the mode over the bare text — either way the timecodes still need manual
  editing, the difference is only the starting point.

## Waveform and marker (`WaveformPlayer`)

Audio for checking timings comes from
`GET /api/admin/lyrics/audio-preview`, which returns a link (a temporary
bucket URL in the cloud, locally a stream route with a token) rather than the
file itself. The waveform is drawn for real: the audio is decoded through Web
Audio (`decodeAudioToWave` — the same utility the jingle editor uses) into 600
columns of RMS amplitude. If `AudioContext` is unavailable or the file fails
to load, a procedural placeholder pattern is drawn instead of a real waveform
— this is tracked as its own state (`audioAvailable: false`), not a silent
blank canvas.

The key point: **the playhead and the marker are two different things**. The
playhead (a white line) is the playback position, draggable across the canvas
like an ordinary scrubber. The marker (amber, with an arrow on top) is an
independent time bookmark, placed next to a line of text in
`SyncedTextarea`: clicking the little arrow next to a line jumps the marker to
that line's timecode, it does not start playback. This split lets you listen
around one spot (moving the playhead) while still holding a reference point
for where the next timecode should go.

Keyboard shortcuts (active only when focus is not in a text field): `Space` —
play/pause, `←`/`→` — nudge the marker by 0.1s, with `Shift` — a whole second.

## The line-by-line editor (`SyncedTextarea`)

In synced mode the lyrics are not edited as one `<textarea>` but line by line:
each line is a separate timecode chip plus a text field.

- Clicking the chip opens it for editing as a bare `[mm:ss.cc]`; `Enter`
  applies it, `Escape` cancels.
- **Changing the minute of one timecode carries the new minute forward to
  every following line** (`propagateMinuteForward`). This is not a blanket
  rewrite — only the minute component changes, the seconds and hundredths of
  each following line stay their own. It targets a common situation: you
  notice the timecodes drift by a whole minute from some point in the song
  onward, and would rather not retype every line by hand.
- `Enter` in a line's text field inserts a new empty line right below it, with
  the same empty `[00:00.00]` placeholder timecode if the line above it was
  synced.
- Pasting multi-line text (Ctrl+V) splits it into separate editor lines; if
  the first pasted line has no timecode of its own, it inherits the timecode
  of the line it was pasted into.
