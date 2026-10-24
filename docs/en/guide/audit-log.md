# Detailed admin audit log

`GET /api/admin/audit` and the Socket.IO event `audit_new_entry` return the
same entry format. The server records successful changes; there is no API for
clients to append arbitrary entries. Access and retention rules are unchanged.

## API format

```js
{
  id: 123,
  adminId: '…', adminLogin: 'editor',
  operationType: 'edit_song_lyrics',
  createdAt: 1790000000000, // Unix milliseconds
  data: {
    title: 'Song', artist: 'Artist',
    action: 'update', // lyrics: update | clear | offset
    details: {       // optional, version 1
      version: 1,
      changes: [
        { field: 'lyrics', before: 'Old lyrics', after: 'New lyrics' },
        { field: 'lyricsStatus', before: 'plain', after: 'synced' },
        { field: 'offset', before: 0, after: -1.5 }
      ],
      info: { source: 'bulk', force: false }
    }
  }
}
```

`changes` contains changed fields only; `info` contains operation context.
Values may be strings, numbers, booleans, arrays, or `null` for absent values.
`failureReason` may contain a localized message object. Field identifiers and
enum values are independent of language; clients translate their presentation.

The UI offers ▼/▲ only when details exist, preserves lyrics line breaks and
timecodes, and gives long blocks their own scrollbar. Old entries without
`details` remain readable. Clients should fall back to the operation identifier
for unknown operation types.

## Operations and details

- `edit_song_lyrics`: `lyrics`, `lyricsStatus` (`none`, `plain`, `synced`),
  `offset` in seconds. Clearing lyrics and offset-only edits have distinct
  labels. Also covers `PUT /api/admin/lyrics/cache` and `DELETE /api/admin/lyrics/cache`.
- `edit_song_meta`: changed `title`, `artist`, `album`, `year`. Moving a song
  includes `movedFrom` and `movedTo` (`day`/`night`) in `data`.
- `settings_save`: one entry per save, with changed sections in `data.sections`.
  Paths include `branding.byLang.uk.dayRadioName`, `branding.telegram_url`,
  `generation.MAX_DAY_DURATION`, `generation.GROUP_DEFS.A`,
  `radioHosts.backgroundMusicMode`, and `artistArts.dayEnabled`.
  Object key ordering is ignored. Artist arrays show previous/new membership
  and added/removed members. Jingles and phrases have their own display groups.
  Broadcast duration is stored in seconds, guest session durations in minutes.
  Selected phrases include their filenames when available.
- Donation settings use `settings_save` with `sections: ['donations']`:
  `currency`, `pricingMode`, `fixedPrice`, `pricePerSecond`, `tiersEnabled`,
  `tierCeiling`, `blockDonationsWhileChatting`. `info.clamped` records automatic
  adjustment to the payment provider's tier ceiling limit.
- `group_create`: name, mode and songs in `info`. `group_edit`: changes to name,
  mode, membership and song order. `group_delete`: group name. `group_insert`:
  name, actual count and actual insertion order. Song labels contain title,
  artist and ID to distinguish otherwise identical records.
- `admin_create`: initial privileges. `admin_privileges`: `privilegesAdded`
  and `privilegesRemoved` in `info`. `admin_login_change`: previous/new `login`.
  `admin_password_reset` identifies password resets; changing one's own password,
  activation and deletion remain short events.
- `artist_art_upload`: `data.replaced` distinguishes replacement from addition.
  Replacement `info` contains `previousFile`, `file`, and the new file's
  `bytes`, `width`, `height`. Image copies are not stored in audit entries.
- `jingle_edit`, `background_music_edit`, `phrase_edit`: changes to `used`
  (on-air selection) or `mode`. Batch operations log each successfully changed file.
- `queue_add` and `queue_remove`: song identity and position. Skips, accepting/
  rejecting suggestions, and media uploads/deletions remain short events.
- `mode_switch`: `fromMode`, `targetMode`, `scheduledAt` (Unix ms or `null`),
  `timeZone` and optional `scheduledTime`. This records an accepted request for
  a scheduled time or as soon as possible after the current track, rather than
  confirmation that switching has completed.
- `participant_mute`: participant and changed `muted` state; includes moderator
  actions and a host muting a guest. `host_queue_pause`, `host_queue_resume`:
  successful main queue state changes. `host_background_music`: previous/new
  `backgroundTrack`.
- `guest_code_generate`, `guest_code_regenerate`: lifetime and `expiresAt`.
  Deactivation, kicks, bans, unbans and session starts/ends remain short events.
- `donation_insert_failed`: amount, currency, order ID and localized failure
  reason in `info`; clients show a general explanation if the reason is unknown.

Saving metadata and lyrics together creates two entries. Unchanged saves do
not produce edit entries. Previous values are captured before changes; new
values come from server persistence after normalization.

## Request contract additions

`POST /api/admin/song-editor/save` accepts optional
`auditContext: { source: 'bulk', force: boolean }`. This is an audit origin hint
only: it does not change authorization, search for lyrics, or force an update
on the server. The batch lyrics client includes it when saving.

`POST /api/admin/song-groups/:groupId/insert` additionally returns
`insertedSongIds: string[]` in actual insertion order alongside `insertedCount`.
The `admin_insert_song_group` event also writes the same audit entry; its input
payload remains unchanged.

Details use the existing operation data JSON field for both JSON and SQL
providers, so no table migration is required. Passwords, hashes, tokens,
access codes and payment secrets are excluded. Personal microphone toggles
and gain adjustments are not audited.
