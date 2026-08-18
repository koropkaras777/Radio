export const EVENT_DOCS = {
  // ── Client → server ───────────────────────────────────────────────────────
  stream_get_seek: {
    summary: 'Asks for the current position of the shared stream (stream mode only).',
    payload: 'clientTs: number — the client\'s local time',
    notes:
      'Only needed to display a timer: in stream mode the audio itself is ' +
      'synchronous by construction. Outside stream mode the server does not reply ' +
      'at all.',
  },

  stream_ping: {
    summary: 'Measures round-trip latency to the server.',
    payload: 'clientTs: number',
    notes:
      'The server echoes your `clientTs` unchanged — the round-trip difference ' +
      'gives you a latency estimate for more accurate positioning.',
  },

  // ── Server → listener ─────────────────────────────────────────────────────
  sync: {
    payload: `{
  track: 'day/artist - title.mp3',  // null while the mode is switching
  title: 'Title', artist: 'Artist', album: 'Album', year: 2020,
  duration: 214.5,
  seek: 87.2,                       // position as of serverTimeMs
  isPlaying: true,
  playlist: [ /* up to 10 upcoming tracks */ ],
  currentIndex: 3, totalTracks: 42,
  mode: 'day',                      // 'day' | 'night'
  pendingModeSwitch: null,
  skipCooldownSecsLeft: 0,
  uiSettings: { /* branding */ },
  serverTimeMs: 1754899200000,
  dayStartHour: 6, nightStartHour: 0,
}`,
  },
  listener_uid: {
    payload: `{
  uid: '…',                 // derived from the IP; the client does not choose it
  artToken: '…',
  artTokenExpiresIn: 3600,  // seconds
  cooldownSecsLeft: 0,      // until the next song request is allowed
}`,
  },
  usersUpdate: {
    payload: `[{ name: 'Name', img: 'file.png', color: '#a3f01c' }]`,
    summary: 'The list of active listeners, for the header roster.',
    notes:
      'Listeners are anonymous: the server assigns each connection a random name ' +
      'from an "oligarchs" set and a random colour. The name arrives already ' +
      'localized.',
  },

  radio_hosts_mode: {
    summary: 'Whether the server was built with live host support.',
    payload: 'boolean',
    notes: 'Sent immediately on connect, without a request.',
  },

  radio_hosts_online: {
    summary: 'Whether anyone is on air right now.',
    payload: 'boolean',
    notes: 'Only sent when `radio_hosts_mode` is enabled.',
  },

  suggestion_result: {
    summary: 'The admin\'s decision on your song request.',
    notes:
      '`auto: true` means the request expired on a timer rather than being ' +
      'rejected by hand. Sent only to the socket that made the request.',
  },

  suggest_cooldown_update: {
    summary: 'Seconds left before another song can be requested.',
    payload: 'number — seconds, 0 when a request is allowed',
    notes:
      'Sent to every connection sharing the same `uid`, so multiple tabs show the ' +
      'same countdown.',
  },

  admin_online: {
    summary: 'Whether an admin able to accept requests is online.',
    payload: 'boolean',
    notes:
      'Broadcast to all listeners. `false` means `suggest_song` will fail with ' +
      '`no_admin`, so the request button is worth hiding.',
  },

  admin_error: {
    summary: 'An admin action failed.',
    payload: 'a JSON string containing a locale object',
    notes:
      'The payload is a **string**, not an object: `JSON.parse` it first, then ' +
      'pick a language. The same applies to `admin_success`.',
  },

  admin_success: {
    summary: 'An admin action succeeded.',
    payload: 'a JSON string containing a locale object',
    notes: 'Often carries a `code` field for machine handling. See `admin_error`.',
  },

  // ── Admin session and queue ───────────────────────────────────────────────
  admin_active: {
    summary: 'Upgrades the connection to an admin socket and confirms the session.',
    payload: 'token?: string — JWT; taken from the `adminToken` cookie if omitted',
    notes:
      'The mandatory first step for an admin client: until it happens the socket ' +
      'counts as an ordinary listener and all admin events are ignored ' +
      '**silently**. The reply is `admin_confirmed` or `admin_error`. Privileges ' +
      'are re-read from the database rather than taken from the token, so ' +
      'permission changes apply without logging in again. A previous session of ' +
      'the same admin is disconnected automatically — only one connection per ' +
      'account stays alive.',
  },

  admin_confirmed: {
    payload: `{
  role: 'super_admin' | 'admin',
  privileges: ['queue_manage', '…'],
  authorized: true,   // false = the helper has not activated themselves yet
}`,
    summary: 'Session confirmed; carries the current permissions.',
    notes:
      'Build your interface from this list rather than from the token contents. ' +
      '`authorized: false` means a helper admin still has to set their own password.',
  },

  get_queue: {
    ack: `{
  items: [{ id, title, artist, orderType }],
  total: 42,   // tracks ahead in total
}`,
    summary: 'A page of the upcoming queue.',
    payload: '{ offset?: number = 0, limit?: number = 10 }',
    notes: 'The reply arrives in the callback. The current track is not included.',
  },

  search_queue: {
    summary: 'Searches the upcoming queue.',
    payload: '{ query?: string }',
    notes:
      '`position` is the offset from the current track, and it is exactly what ' +
      '`admin_remove_song` expects. An empty query returns the whole queue.',
  },

  admin_add_song: {
    summary: 'Adds a track from the library to the queue.',
    notes:
      'Requires the `queue_manage` privilege. `donated` places the track ahead of ' +
      'ordinary requests. The result arrives as `admin_success` or `admin_error`, ' +
      'not in a callback. A cooldown applies between additions, and the server also ' +
      'refuses if the same track is already adjacent in the queue or the queue no ' +
      'longer fits before the mode switch.',
  },

  admin_remove_song: {
    summary: 'Removes a track from the queue by position.',
    payload: 'position: number — offset from the current track, as in `search_queue`',
    notes:
      'Requires `queue_manage`. Has its own cooldown — calling too often returns an ' +
      'error with the number of seconds to wait.',
  },

  admin_skip_song: {
    summary: 'Skips the current track.',
    payload: 'no arguments',
    notes:
      'Requires `queue_manage`. In stream mode the server refuses while a jingle is ' +
      'playing or the queue is paused by a host. Shares a cooldown with adding ' +
      'tracks.',
  },

  admin_insert_song_group: {
    summary: 'Inserts a predefined group of songs into the queue.',
    payload: '{ groupId: string }',
    notes:
      'Requires **both** `queue_manage` and `settings_groups`, exactly like ' +
      '`POST /api/admin/song-groups/:groupId/insert`. Groups are configured ' +
      'separately through `/api/admin/song-groups`. Has a longer cooldown than ' +
      'single tracks.',
  },

  admin_suggestion_action: {
    summary: 'Accepts or rejects a listener\'s song request.',
    notes:
      'Requires `queue_manage`. `add` queues the track as `lastinline`. The ' +
      'listener receives `suggestion_result`. If the request already expired, a ' +
      '"not found" error comes back.',
  },

  suggestions_update: {
    summary: 'The current list of listener song requests.',
    notes:
      'Sent only to admins holding `queue_manage` — on connect, on every change to ' +
      'the list, and when the radio switches to day mode and all requests are ' +
      'cleared.',
  },

  // ── Live broadcast: hosts ─────────────────────────────────────────────────
  admin_go_live: {
    ack: `{
  ok: true,
  queuePaused: false,
  hosts: [ /* who is on air right now */ ],
  pendingGuests: [ /* the queue of guest requests */ ],
  backgroundMusicMode: 'random' | 'hostChoice',
  selectedBackgroundMusicId: null,
}
{ error: { uk: '…', en: '…' } }`,
    summary: 'Puts an admin on air as a host.',
    payload: 'no data (the first argument is ignored)',
    notes:
      'Requires the `radio_host` privilege and `RADIO_HOSTS_MODE=true` on the ' +
      'server. The number of on-air slots is capped by `MAX_LIVE_HOST_SLOTS`, and a ' +
      'full room returns an error. Calling it again while already live simply ' +
      'confirms the state. On success the socket joins the hosts room and starts ' +
      'receiving its events.',
  },

  admin_leave_live: {
    summary: 'Ends the host\'s broadcast.',
    payload: 'no arguments',
    notes: 'The slot is freed immediately. Disconnecting has the same effect.',
  },

  host_mic_toggle: {
    summary: 'Turns the on-air microphone on or off.',
    payload: '{ on: boolean }',
    notes:
      'While the microphone is off the server discards audio chunks from this ' +
      'socket. Applies to both hosts and guests.',
  },

  host_mic_gain: {
    summary: 'Changes your microphone level in the mix.',
    payload: '{ gain: number }',
  },

  host_audio_chunk: {
    summary: 'A chunk of microphone audio to mix into the broadcast.',
    payload: 'Buffer / ArrayBuffer — raw audio data',
    notes:
      'Accepted only while the microphone is enabled via `host_mic_toggle` — ' +
      'otherwise chunks are silently dropped. This is the hottest channel in the ' +
      'protocol: it streams continuously while the host speaks.',
  },

  host_pause_queue: {
    summary: 'Pauses the track queue — "just chatting" mode.',
    payload: 'no arguments',
    notes:
      'Available to hosts only, not guests. Background music fills the silence, and ' +
      'in every listener\'s `sync` the `title` becomes `"Just chatting"`.',
  },

  host_resume_queue: {
    summary: 'Resumes queue playback.',
    payload: 'no arguments',
  },

  host_get_background_music_list: {
    summary: 'A page of available background music.',
    payload: '{ offset?: number = 0, limit?: number = 5 }',
    notes:
      'The list depends on the radio\'s current mode. `limit` is capped at 50. ' +
      'Non-hosts receive an empty list.',
  },

  host_set_background_music: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Chooses the track that plays while the queue is paused.',
    payload: '{ trackId: string | null }',
    notes:
      '`null` restores random selection. Only meaningful when ' +
      '`backgroundMusicMode` is `hostChoice`.',
  },

  live_hosts_roster: {
    summary: 'Who is currently on air: hosts and guests.',
    notes:
      'Sent to the hosts room on every change of line-up. Ordinary listeners never ' +
      'receive it.',
  },

  host_queue_pause_state: {
    summary: 'The queue has been paused or resumed.',
    payload: '{ paused: boolean }',
    notes: 'Hosts room only. Listeners see this state through `sync`.',
  },

  background_music_now_playing: {
    payload: `{ trackId: '…', filename: '…' }   // both null when background music is stopped`,
    summary: 'Which track is currently filling the pause.',
  },

  host_force_disconnect: {
    summary: 'The host\'s broadcast was ended externally.',
    notes:
      'Arrives on removal by a moderator or a forced session end. The client must ' +
      'tear down the broadcast UI and stop capturing the microphone.',
  },

  monitor_answer: {
    summary: 'WebRTC answer for the host\'s personal monitoring channel.',
    payload: '{ sdp: … }',
    notes:
      'A private low-latency channel for hearing the broadcast — separate from the ' +
      'shared MP3 stream, which lags. Requires the UDP ports ' +
      '`HOST_MONITOR_ICE_PORT_MIN`–`MAX` to be open.',
  },

  monitor_ice_candidate: {
    summary: 'An ICE candidate for the monitoring channel.',
    payload: 'a WebRTC candidate object',
  },

  // ── Live broadcast: guests ────────────────────────────────────────────────
  guest_request: {
    summary: 'A listener asks to join the broadcast.',
    payload: '{ nickname: string }',
    notes:
      'The request joins a queue shown to hosts; the decision arrives as ' +
      '`guest_request_result`. Admins cannot submit one. A cooldown and an IP ban ' +
      'check apply.',
  },

  guest_check_ban: {
    summary: 'Whether this IP address is banned from the broadcast.',
    payload: 'no data',
    notes: 'Worth calling before showing the request form, to avoid false hope.',
  },

  guest_connect: {
    summary: 'Connects an approved guest to the broadcast.',
    payload: 'no data',
    notes:
      'Only succeeds once a host has approved the session and a slot is free. ' +
      '`expiresAt` is when the session will be cut off; the duration comes from the ' +
      'radio settings. From then on the guest uses the same microphone events as a ' +
      'host.',
  },

  special_guest_connect: {
    ack: '{ ok: true, … } or { error: … }',
    summary: 'Joins the broadcast with a one-off code, skipping the queue.',
    payload: '{ code: string, nickname: string }',
    notes:
      'The code is issued by a moderator. Attempts are rate-limited, and an expired ' +
      'or deactivated code returns an error.',
  },

  guest_leave_live: {
    summary: 'The guest leaves the broadcast.',
    payload: 'no arguments',
  },

  guest_pending_status: {
    summary: 'The state of a guest\'s request while they wait.',
  },

  guest_request_result: {
    summary: 'The decision on a guest\'s request.',
    notes:
      '`reason: "room_full"` means the slot was taken while the request waited. ' +
      'After `accepted: true` the client must send `guest_connect`.',
  },

  guest_queue_update: {
    summary: 'The queue of guest requests.',
    notes: 'Sent only to admins holding the `radio_host` privilege.',
  },

  admin_guest_action: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Approves or rejects a guest request.',
    notes:
      'Requires `radio_host`. If the slot was taken between request and decision, ' +
      'the guest is refused with `reason: "room_full"`.',
  },

  host_guest_mute: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Mutes a guest\'s microphone.',
  },

  host_guest_kick: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Removes a guest from the broadcast.',
  },

  guest_force_disconnect: {
    summary: 'The guest\'s participation was ended externally.',
    notes:
      'Causes: removal, a ban, or the `expiresAt` time limit. The client must stop ' +
      'the microphone and tear down the broadcast UI.',
  },

  // ── Moderation ────────────────────────────────────────────────────────────
  moderator_get_live_roster: {
    summary: 'Who is on air right now.',
    payload: 'no data',
    notes: 'Without the privilege an empty roster is returned, not an error.',
  },

  moderator_mute: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Mutes any participant of the broadcast.',
    notes: 'Unlike `host_guest_mute`, this also works on hosts.',
  },

  moderator_kick: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Removes a participant from the broadcast.',
    notes: 'The participant receives `host_force_disconnect` or `guest_force_disconnect`.',
  },

  moderator_get_banlist: {
    summary: 'The list of banned IP addresses.',
    notes: 'Requires `DATA_PROVIDER=sql` — otherwise the list is unavailable.',
  },

  moderator_ban_participant: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Bans a broadcast participant by IP.',
    notes: 'Works for guests only: hosts cannot be banned. Requires the SQL provider.',
  },

  moderator_ban_ip: {
    ack: '{ ok: true, entry: { … } } or { error: … }',
    summary: 'Bans an IP address manually.',
  },

  moderator_unban_ip: {
    ack: '{ ok: true } or { error: … }',
    summary: 'Lifts a ban on an IP address.',
  },

  moderator_get_guest_code: {
    ack: '{ code: "…" } — or { code: null } when no code is active',
    summary: 'The current special-guest access code.',
    payload: 'no data',
  },

  moderator_generate_guest_code: {
    summary: 'Creates a special-guest access code.',
    payload: '{ ttlHours?: number }',
    notes:
      'If an active code already exists an error is returned — deactivate it first, ' +
      'or use `moderator_regenerate_guest_code`. The code lets someone join the ' +
      'broadcast without queueing, via `special_guest_connect`.',
  },

  moderator_regenerate_guest_code: {
    summary: 'Replaces the current access code with a new one.',
    payload: '{ ttlHours?: number }',
    notes: 'The old code stops working immediately.',
  },

  moderator_deactivate_guest_code: {
    summary: 'Deactivates the current access code.',
    payload: 'no data',
  },

  guest_code_updated: {
    summary: 'The special-guest access code has changed.',
    notes:
      'A signal for other admins to refresh the code they display, so two ' +
      'moderators do not dictate different codes.',
  },

  // ── Update signals and sessions ───────────────────────────────────────────
  privileges_updated: {
    summary: 'This admin\'s permissions have just changed.',
    notes:
      'Sent to the admin whose permissions the super admin changed. This is the ' +
      'event that makes permission changes take effect **without logging in ' +
      'again** — rebuild your interface from the new list.',
  },

  admin_authorized: {
    summary: 'A helper admin has activated their account with a password of their own.',
    notes: 'Until then the account has `authorized: false` and can do nothing.',
  },

  force_logout: {
    summary: 'The session was terminated externally.',
    notes:
      'The account was deleted or revoked. The client should clear its state and ' +
      'return the user to the login screen.',
  },

  queue_updated: {
    summary: 'The queue has changed.',
    notes:
      'A broadcast signal to re-read the queue via `get_queue`. Listeners still get ' +
      'the radio state itself through `sync`.',
  },

  audit_new_entry: {
    summary: 'A new entry in the audit log.',
    payload: 'an entry object — the same shape as in `GET /api/admin/audit`',
    notes: 'Lets you append to the log live instead of re-fetching the whole list.',
  },

  library_updated: {
    summary: 'The library changed: a track was added, edited, moved or deleted.',
    payload: 'no data — it is only a signal to re-read',
    notes:
      'Broadcast to **everyone**, not just admins. The signal does not say what ' +
      'changed, so simply re-request the list you need — `/api/admin/songs` for an ' +
      'admin UI or `/api/library` for a listener. Emitted from several places: ' +
      'after an upload, after saving in the editor, after a mode change and after ' +
      'bulk operations.',
  },

  jingles_updated: {
    summary: 'The set of jingles has changed.',
    notes:
      'A signal to re-read the list. Jingles only exist in the cloud + sql + stream ' +
      'configuration.',
  },

  background_music_updated: {
    summary: 'The background music library has changed.',
    notes: 'A signal to re-read the list via `host_get_background_music_list`.',
  },

  phrases_updated: {
    summary: 'The set of phrases has changed.',
    notes:
      'A signal to re-read the list. Unlike jingles, there is no ' +
      '`stream_phrase_start`/`stream_phrase_end`: a phrase is mixed into the song ' +
      'rather than replacing it, so listener-facing track metadata never changes.',
  },

  background_music_selection_changed: {
    summary: 'A host picked a different background track.',
    notes: 'Keeps the choice in sync between multiple hosts on air.',
  },

  // ── Stream mode markers ───────────────────────────────────────────────────
  stream_track_start: {
    summary: 'A new track started in the shared stream.',
    notes:
      '`serverTs` is the start moment on the server\'s clock. Combined with your own ' +
      'latency measurement via `stream_ping` this gives an accurate position within ' +
      'the track.',
  },

  stream_jingle_start: {
    summary: 'A jingle between songs has started.',
    notes: 'Time to hide track metadata: what is playing is not a song.',
  },

  stream_jingle_end: {
    summary: 'The jingle has finished.',
  },

  stream_chat_mode_start: {
    summary: 'Hosts paused the queue — conversation has begun.',
    payload: '{ serverTs: … }',
    notes:
      'Duplicates what `sync` shows as `title: "Just chatting"`, but arrives ' +
      'instantly rather than within two seconds.',
  },

  stream_chat_mode_end: {
    summary: 'The conversation ended and the queue resumes.',
  },
};
