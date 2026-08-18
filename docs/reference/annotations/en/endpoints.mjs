export const ENDPOINT_DOCS = {
  // ── Public ────────────────────────────────────────────────────────────────

  'GET /api/public/config': {
    response: `{
  dataProvider:   'json' | 'sql',
  musicSource:    'local' | 'cloud',
  nightMode:      true,     // whether a night mode exists at all
  streamMode:     false,    // false = sync mode, true = shared MP3 stream
  radioHostsMode: false,    // whether live broadcasting is possible
  allPrivileges:  ['queue_manage', '…'],
  timeZone:       'Europe/Kyiv',
  capabilities:   { uploadTracks: true, editSettings: true, … },
}`,
  },

  // ── Admin accounts ────────────────────────────────────────────────────────

  'GET /api/admin/admins': {
    summary: 'Helper admins and the list of grantable privileges.',
    notes:
      'Password hashes are never included. `allPrivileges` is convenient for ' +
      'building the permission form.',
  },
  'POST /api/admin/admins': {
    summary: 'Creates a helper admin.',
    notes:
      'The password here is **temporary**: the account starts with ' +
      '`authorized: false` and can do nothing until the helper activates it through ' +
      '`/admins/self/activate`.',
  },
  'PUT /api/admin/admins/:id/privileges': {
    summary: 'Changes a helper admin\'s permissions.',
    notes:
      'If the helper is online they immediately receive a `privileges_updated` ' +
      'event — the change applies **without logging in again**.',
  },
  'PUT /api/admin/admins/:id/reset-password': {
    summary: 'Resets a helper admin\'s password to a new temporary one.',
    notes: 'The account becomes unauthorized again and must be re-activated.',
  },
  'DELETE /api/admin/admins/:id': {
    summary: 'Deletes a helper admin.',
    notes:
      'If they are online, their connection receives `force_logout` with ' +
      '`reason: "admin_deleted"` and the session ends at once.',
  },
  'POST /api/admin/admins/self/activate': {
    summary: 'A helper admin activates their own account.',
    errors: '`400` — not applicable to the super admin, or the temporary password is wrong',
    notes:
      'The only action available to a helper with `authorized: false`. On success ' +
      'an `admin_authorized` event follows.',
  },
  'PUT /api/admin/admins/self/login': {
    summary: 'Changes your own login name.',
    errors: '`400` — not applicable to the super admin, or the password is wrong',
  },
  'PUT /api/admin/admins/self/password': {
    summary: 'Changes your own password.',
    errors: '`400` — not applicable to the super admin, or the password is wrong',
    notes: 'The super admin\'s password can only be changed via `ADMIN_PASS` in `.env`.',
  },

  // ── Lyrics ────────────────────────────────────────────────────────────────
  'GET /api/admin/lyrics/songs': {
    summary: 'Tracks with their lyrics status — the editor\'s input data.',
  },
  'GET /api/admin/lyrics/cache-index': {
    summary: 'A lightweight index of which tracks already have lyrics.',
    notes: 'Cheaper than `/cache-full` when you only need the list.',
  },
  'GET /api/admin/lyrics/cache-full': {
    summary: 'The complete lyrics cache.',
    notes: 'Returns everything in one go — a heavy response for a large library.',
  },
  'GET /api/admin/lyrics/cache-entry': {
    summary: 'Lyrics for a single track.',
    query: '`songId`, or the `title` + `artist` pair',
  },
  'PUT /api/admin/lyrics/cache': {
    summary: 'Saves edited lyrics.',
    notes: 'Keyed by the artist + title pair, not by track identifier.',
  },
  'DELETE /api/admin/lyrics/cache': {
    summary: 'Removes lyrics from the cache.',
    query: '`title` and `artist`',
    notes: 'After deletion the lyrics are fetched from LRCLIB again on next access.',
  },
  'GET /api/admin/lyrics/offsets': {
    summary: 'All stored lyrics timing offsets.',
  },
  'GET /api/admin/lyrics/audio-preview': {
    summary: 'A URL for audio playback while aligning timings in the editor.',
    query: '`title` and `artist`',
    notes:
      'In cloud mode a temporary R2 URL; in local mode a URL to ' +
      '`/api/audio/stream/admin`, which accepts the admin token and needs no ' +
      'art/audio tokens.',
  },
  'POST /api/lyrics/offset': {
    summary: 'Stores the lyrics timing offset for a track.',
    errors: '`400` — `title` or `artist` missing',
    notes:
      'Note the path: it has **no** `/admin` prefix even though it requires an ' +
      'admin token. The offset is in seconds and may be negative.',
  },

  // ── Song groups ───────────────────────────────────────────────────────────
  'GET /api/admin/song-groups': {
    summary: 'All song groups with track counts and a preview.',
    notes: 'Any admin may read; changing them requires `settings_groups`.',
  },
  'GET /api/admin/song-groups/library': {
    summary: 'Searches the library to populate a group.',
    query: '`mode` (default `day`), `query`, `offset` (0), `limit` (5)',
  },
  'POST /api/admin/song-groups': {
    summary: 'Creates a song group.',
    notes: 'Requires `settings_groups`.',
  },
  'PUT /api/admin/song-groups/:groupId': {
    summary: 'Updates a group: its name or its tracks.',
    body: 'the same fields as on creation',
    notes: 'Requires `settings_groups`.',
  },
  'DELETE /api/admin/song-groups/:groupId': {
    summary: 'Deletes a song group.',
    notes: 'Requires `settings_groups`. Tracks already queued are unaffected.',
  },
  'POST /api/admin/song-groups/:groupId/insert': {
    summary: 'Queues an entire group.',
    errors: '`400` — the group is empty, does not fit before the mode switch, or a cooldown applies',
    notes:
      'Requires **both** `queue_manage` and `settings_groups`, because the action ' +
      'touches both the broadcast and the group definitions. Holding only one is ' +
      'not enough. The `admin_insert_song_group` event does the same thing with the ' +
      'same requirements, so the rule cannot be bypassed over the socket.',
  },

  // ── Track operations ──────────────────────────────────────────────────────
  'GET /api/admin/songs': {
    summary: 'The whole library for a mode, with lyrics status.',
    query: '`mode` — `day` or `night`; without it, the radio\'s current mode',
    notes:
      'Unlike the public `/api/library`, this lets you pick either mode and adds ' +
      'lyrics state. No special privilege is needed beyond being an authenticated ' +
      'admin.',
  },
  'POST /api/admin/upload-check-duplicate': {
    summary: 'Checks whether a track already exists, before uploading the file.',
    notes:
      'A cheap check ahead of a long upload. `trackId` is built as ' +
      '`<mode>/<filename>`.',
  },
  'POST /api/admin/upload-song-file': {
    summary: 'Upload step 1: stores the MP3 and reads its tags.',
    query: '`mode` — `day` or `night` (default `day`)',
    headers: '`X-File-Name` — percent-encoded filename; `Content-Type: audio/mpeg`',
    body: 'raw MP3 bytes, not multipart. Limit: 80 MB',
    errors:
      '`400` — empty body or not an MP3; `409` — a track with that filename exists; ' +
      '`400` — storage write failed',
    notes:
      'The body is sent as raw bytes (`express.raw`), **not** as ' +
      '`multipart/form-data` — that is the most common cause of a `400` here. ' +
      'Metadata is read from ID3 tags, with fallbacks for missing fields. The track ' +
      'does not enter the library yet.',
  },
  'POST /api/admin/upload-song-lyrics': {
    summary: 'Upload step 2: looks the lyrics up through LRCLIB.',
    errors: '`400` — `title` or `artist` missing; `500` — LRCLIB could not be reached',
    notes:
      'This step is optional and needs no credentials at all: LRCLIB is open. ' +
      'Even on `500` the response contains a usable `lyricsEntry` with ' +
      '`notFound: true`, so the upload can continue.',
  },
  'POST /api/admin/upload-song-commit': {
    summary: 'Upload step 3: puts the track into the library.',
    body: `{
  metadata: { … },      // from step 1, possibly edited by the user
  lyricsEntry: { … },   // from step 2, optional
}`,
    errors: '`400` — `metadata.filename` or `metadata.mode` missing, or the write failed',
    notes:
      'Until this step the track takes no part in the broadcast. On success the ' +
      'server broadcasts a `library_updated` event — refresh your lists from it. ' +
      'For daytime tracks an artist artwork record is created as well.',
  },
  'POST /api/admin/song-editor/save': {
    summary: 'Saves metadata, lyrics and lyrics offset for a track.',
    body: `{
  songId: 'day/artist - title.mp3',
  metadata: { title, artist, album, year },
  metadataChanged: false,   // the flags decide which privileges are required
  lyricsEntry: { … },  lyricsChanged: false,
  offset: 0,           offsetChanged: false,
}`,
    errors:
      '`400` — `songId` or `metadata` missing; `403` — missing the privilege for ' +
      'what is being changed; `404` — track not found; `409` — the track is locked',
    notes:
      'Which privilege is needed depends on the flags: editing metadata requires ' +
      '`editor_meta`, editing lyrics requires `editor_lyrics` or `editor_meta`. ' +
      '**`409` is an expected answer**, not a failure: a track cannot be edited ' +
      'while it is playing or up next, and the reason arrives in the `localized` ' +
      'field. Changing metadata rewrites the ID3 tags in storage, so the track ' +
      'identifier may change.',
  },
  'GET /api/admin/song-editor/download': {
    summary: 'Downloads the track\'s source file.',
    notes: 'Requires `editor_meta`. Serves the same MP3 that sits in storage.',
  },
  'POST /api/admin/song-editor/move-mode': {
    summary: 'Moves a track between day and night mode.',
    notes:
      'Requires `editor_meta`. The file is physically moved between modes - ' +
      'between bucket prefixes or between folders on disk, depending on the ' +
      'storage. The track identifier changes with the mode, since it contains ' +
      'the mode.',
  },
  'DELETE /api/admin/song-editor': {
    summary: 'Deletes a track from the library and from storage.',
    errors: '`409` — the track is playing now or is up next',
    notes:
      'Requires `editor_meta`. If it was the artist\'s last daytime track, their ' +
      'artwork record is removed too. Non-super-admins have a daily deletion quota.',
  },
  'POST /api/admin/song-editor/batch-delete': {
    summary: 'Deletes several selected tracks.',
    notes:
      'Requires `editor_meta`. Locked tracks are skipped rather than failing the ' +
      'whole operation. The daily quota is 30 deletions for non-super-admins; the ' +
      'response reports the remainder when exceeded.',
  },
  'POST /api/admin/song-editor/batch-move': {
    summary: 'Moves several tracks between modes.',
    notes: 'Requires `editor_meta`. Works on any storage.',
  },
  'POST /api/admin/upload-batch-delete': {
    summary: 'Deletes just-uploaded tracks.',
    notes:
      'Requires `upload_songs`. Meant for undoing a fresh upload, whereas ' +
      '`song-editor/batch-delete` works on the whole library and needs a different ' +
      'privilege.',
  },
  'POST /api/admin/upload-batch-move': {
    summary: 'Moves just-uploaded tracks between modes.',
    notes: 'Requires `upload_songs`.',
  },
  'GET /api/audio/stream/admin': {
    summary: 'Track audio for admin interfaces.',
    query: '`track` — the track identifier',
    notes:
      'Accepts the admin token in a header **or in the query**, and needs no ' +
      'art/audio tokens. That is what makes it usable for `<audio src>` in the ' +
      'editor, where headers cannot be set.',
  },

  // ── YouTube import ────────────────────────────────────────────────────────
  'GET /api/admin/ytbdown-status': {
    summary: 'Whether the YouTube download tool is ready.',
    notes:
      'Call this before showing the import form: the tool needs Python and FFmpeg ' +
      'and is unavailable on some deployments.',
  },
  'POST /api/admin/youtube-track-info': {
    summary: 'Reads the track list behind a video or playlist URL.',
    errors:
      '`400` — URL missing or not a YouTube link; `503` — the tool is unavailable; ' +
      '`504` — reading the playlist took too long',
    notes:
      'Downloads nothing — it only reports what the URL contains so the user can ' +
      'choose.',
  },
  'POST /api/admin/upload-song-url': {
    summary: 'Downloads audio from YouTube into storage.',
    notes:
      'The longest operation in the whole API: it includes downloading and ' +
      're-encoding through FFmpeg. The track then goes through the same lyrics and ' +
      'commit steps as a normal file upload.',
  },
  'POST /api/admin/youtube-cookies': {
    summary: 'Stores YouTube cookies for age-restricted videos.',
    errors: '`400` — empty, or the string does not contain `youtube.com`',
    notes:
      'Cookies are written to the server\'s temp directory and live until restart. ' +
      'They are only needed for restricted videos. This is sensitive data: it grants ' +
      'access to the account it came from.',
  },

  // ── Artist artwork ────────────────────────────────────────────────────────
  'GET /api/admin/artist-arts': {
    summary: 'Artists, flagged by whether artwork exists.',
    notes: 'Records are created automatically when a daytime track is uploaded.',
  },
  'GET /api/admin/artist-arts/file/:artist': {
    summary: 'The artwork file for preview in an admin UI.',
    notes: 'Unlike the client-facing `/api/artist-art/:artist`, it is served unwrapped.',
  },
  'POST /api/admin/artist-arts/upload': {
    summary: 'Uploads an artist image.',
    headers: '`Content-Type: image/jpeg`',
    body: 'raw JPEG bytes, up to 10 MB',
    notes:
      '**JPEG only** — PNG or WebP are rejected. The image is expected to be ' +
      'already cropped to a portrait format: the client does that before sending.',
  },
  'DELETE /api/admin/artist-arts/:artist': {
    summary: 'Deletes an artist\'s artwork.',
    notes: 'The artist record itself remains; only the image goes away.',
  },

  // ── Broadcast control ─────────────────────────────────────────────────────
  'POST /api/admin/switch-mode': {
    summary: 'Switches the radio between day and night mode.',
    body: `{
  targetMode: 'day' | 'night',
  scheduledTime: '23:30',   // optional, HH:MM in the server's time zone
}`,
    errors:
      '`400` — `targetMode` is not `day`/`night`, or the time is not `HH:MM`; ' +
      '`409` — switching now is not allowed (a cooldown applies, or a donated track ' +
      'is queued)',
    notes:
      'Without `scheduledTime` the switch happens immediately. A time that has ' +
      'already passed today is treated as tomorrow. On `409` the response carries a ' +
      '`donated` flag explaining the reason.',
  },
  'GET /api/admin/stats': {
    summary: 'Aggregate statistics for the library and the broadcast.',
    response: 'an object summarising modes, groups and durations',
    notes: 'Requires the `stats` privilege. Computed on the fly from engine state.',
  },
  'GET /api/admin/audit': {
    summary: 'The admin action log.',
    query: '`window` — `24h` and other spans; `limit` (default 30); `offset`',
    notes:
      'Served from an in-memory cache, so the query is cheap. Entries are purged ' +
      'automatically after `LOG_RETENTION_DAYS` days. No special privilege — every ' +
      'admin may read it.',
  },
  'GET /api/admin/history': {
    summary: 'The full playback history.',
    notes:
      'Requires the `stats` privilege. Entries are purged automatically after ' +
      '`LOG_RETENTION_DAYS` days — the same schedule as the admin action log.',
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  'GET /api/admin/settings': {
    summary: 'All radio settings.',
    notes:
      'Available to any admin without a special privilege — the interface needs this ' +
      'data to initialise. Only writing is restricted.',
  },
  'POST /api/admin/settings': {
    summary: 'Saves settings; each section under its own privilege.',
    body: `{
  branding:   { telegram_url, byLang: { uk: { dayRadioName, … } } },
  generation: { DAY_ALGORYTM, MAX_DAY_DURATION, GROUP_DEFS, … },
  radioHosts: { guestMaxDurationMinutes, specialGuestMaxDurationMinutes, backgroundMusicMode },
  songGroups: [ … ],   // ignored
}`,
    errors: '`403` — missing the privilege for a section that changes; `400` — validation failed',
    notes:
      'Authorization is based on what **actually changes**, not on what was sent: ' +
      'the admin panel always posts every section. `branding` needs ' +
      '`settings_branding`, `generation` needs `settings_algorithm`, `radioHosts` ' +
      'needs `radio_moderator`. `songGroups` is ignored here: groups are edited ' +
      'through `/api/admin/song-groups`. See [Privileges](/en/reference/privileges).',
  },

  // ── Jingles ───────────────────────────────────────────────────────────────
  'GET /api/admin/jingles/counts': {
    summary: 'How many jingles exist and how many are usable on air.',
    response: `{
  ok: true,
  day: 12, night: 8,              // total
  dayUsable: 10, nightUsable: 6,  // marked as active
  minRequired: 3,                 // minimum needed for rotation
}`,
    notes:
      'The only endpoint in this section that does not need `jingles_uploader`, so ' +
      'any admin can see the state. If fewer than `minRequired` are usable, jingles ' +
      'are not inserted into the broadcast.',
  },
  'GET /api/admin/jingles': {
    summary: 'Jingles, paginated and searchable.',
    notes: 'Served from an in-memory cache, so the query is cheap.',
  },
  'POST /api/admin/jingles/upload-check-duplicate': {
    summary: 'Checks whether a jingle with that filename already exists.',
    notes: 'Jingle filenames are unique globally, not per mode.',
  },
  'POST /api/admin/jingles/upload': {
    summary: 'Uploads a jingle.',
    query: '`mode` — `day` or `night` (default `day`)',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'raw MP3 bytes, not multipart. Limit: 80 MB',
    errors:
      '`400` — empty body, not an MP3, or the configuration does not support ' +
      'jingles; `409` — that filename already exists',
    notes:
      'As with track uploads, the body is raw bytes. A new jingle is active right ' +
      'away (`used: true`). If the database write fails the file is removed from ' +
      'storage, so no orphans are left behind. On success a `jingles_updated` event ' +
      'is broadcast.',
  },
  'GET /api/admin/jingles/:id/audio': {
    summary: 'Jingle audio for previewing in an admin UI.',
    notes:
      'Returns `{ url }`. In the cloud that is a presigned link straight to the ' +
      'bucket; on local storage it is an absolute link to ' +
      '`/api/admin/jingles/file` carrying the token as a query parameter.',
  },

  'GET /api/admin/jingles/file': {
    summary: 'Serves the jingle file itself from local storage.',
    query: '`mode` — `day` or `night`; `filename` — the file name; `adminToken` — the admin token',
    notes:
      'Only needed on local storage: in the cloud the client follows a presigned ' +
      'link to the bucket instead. The token is accepted in the header or in the ' +
      'query string, because the waveform player fetches the URL with a plain ' +
      '`fetch` and no headers. Escaping the jingles directory gives `400`, a ' +
      'missing file `404`.',
  },
  'POST /api/admin/jingles/:id/used': {
    summary: 'Enables or disables a jingle in rotation.',
    notes:
      'A disabled jingle stays in storage but never goes on air — handy for parking ' +
      'a seasonal jingle without deleting it.',
  },
  'POST /api/admin/jingles/batch-delete': {
    summary: 'Deletes several jingles at once.',
  },
  'POST /api/admin/jingles/batch-move': {
    summary: 'Moves several jingles between day and night mode.',
    notes: 'Files are moved in storage, so the operation is not instant.',
  },

  // ── Background music ──────────────────────────────────────────────────────
  'GET /api/admin/background-music/counts': {
    summary: 'How many background tracks are available.',
    notes: 'Open to any admin, like the jingle counter.',
  },
  'GET /api/admin/background-music': {
    summary: 'Background tracks, paginated.',
    notes:
      'A host on air sees the same list through the ' +
      '`host_get_background_music_list` event.',
  },
  'POST /api/admin/background-music/upload-check-duplicate': {
    summary: 'Checks the filename before uploading.',
  },
  'POST /api/admin/background-music/upload': {
    summary: 'Uploads a background track.',
    query: '`mode` — `day` or `night`',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'raw MP3 bytes, up to 80 MB',
    notes: 'On success a `background_music_updated` event follows.',
  },
  'GET /api/admin/background-music/:id/audio': {
    summary: 'Background track audio for previewing.',
    notes:
      'Works exactly like `/api/admin/jingles/:id/audio`: a presigned link in the ' +
      'cloud, a link to `/api/admin/background-music/file` locally.',
  },

  'GET /api/admin/background-music/file': {
    summary: 'Serves the background music file itself from local storage.',
    query: '`mode` — `day` or `night`; `filename` — the file name; `adminToken` — the admin token',
    notes:
      'The direct counterpart of `/api/admin/jingles/file`: only needed on local ' +
      'storage, and accepts the token in the header or the query string.',
  },
  'POST /api/admin/background-music/:id/used': {
    summary: 'Enables or disables a track in the selection pool.',
  },
  'POST /api/admin/background-music/batch-delete': {
    summary: 'Deletes several background tracks.',
  },
  'POST /api/admin/background-music/batch-move': {
    summary: 'Moves background tracks between modes.',
  },

  // ── Phrases ────────────────────────────────────────────────────────────────
  'GET /api/admin/phrases/counts': {
    summary: 'How many phrases exist and how many are usable on air.',
    response: `{
  ok: true,
  day: 5, night: 3,               // total
  dayUsable: 4, nightUsable: 2,   // marked as active
  minRequired: 1,                 // minimum needed to enable "Phrases on air"
}`,
    notes:
      'The only endpoint in this section that does not need `jingles_uploader`, so ' +
      'any admin can see the state. Unlike jingles, the "Phrases on air" setting in ' +
      'the admin panel stays disabled (not just warned) until every active mode has ' +
      'at least `minRequired` usable phrases.',
  },
  'GET /api/admin/phrases': {
    summary: 'Phrases, paginated and searchable.',
    notes: 'Served from an in-memory cache, so the query is cheap.',
  },
  'POST /api/admin/phrases/upload-check-duplicate': {
    summary: 'Checks whether a phrase with that filename already exists.',
    notes: 'Phrase filenames are unique globally, not per mode.',
  },
  'POST /api/admin/phrases/upload': {
    summary: 'Uploads a phrase.',
    query: '`mode` — `day` or `night` (default `day`)',
    headers: '`X-File-Name`, `Content-Type: audio/mpeg`',
    body: 'raw MP3 bytes, not multipart. Limit: 10 MB',
    errors:
      '`400` — empty body, not an MP3, longer than ~5 seconds, duration could not ' +
      'be determined, or the configuration does not support phrases; `409` — that ' +
      'filename already exists',
    notes:
      'Unlike jingles and background music, duration is strictly enforced here: a ' +
      'phrase longer than 5 seconds (with a small tolerance), or one whose duration ' +
      'could not be read at all, is rejected outright. A new phrase is active right ' +
      'away (`used: true`). If the database write fails the file is removed from ' +
      'storage. On success a `phrases_updated` event is broadcast.',
  },
  'GET /api/admin/phrases/:id/audio': {
    summary: 'Phrase audio for previewing in an admin UI.',
    notes:
      'Returns `{ url }`. In the cloud that is a presigned link straight to the ' +
      'bucket; on local storage it is an absolute link to ' +
      '`/api/admin/phrases/file` carrying the token as a query parameter.',
  },
  'GET /api/admin/phrases/file': {
    summary: 'Serves the phrase file itself from local storage.',
    query: '`mode` — `day` or `night`; `filename` — the file name; `adminToken` — the admin token',
    notes:
      'The direct counterpart of `/api/admin/jingles/file`: only needed on local ' +
      'storage, and accepts the token in the header or the query string.',
  },
  'POST /api/admin/phrases/:id/used': {
    summary: 'Enables or disables a phrase in rotation.',
  },
  'POST /api/admin/phrases/batch-delete': {
    summary: 'Deletes several phrases at once.',
  },
  'POST /api/admin/phrases/batch-move': {
    summary: 'Moves several phrases between day and night mode.',
    notes: 'Files are moved in storage, so the operation is not instant.',
  },
};
