# Stability and compatibility

An honest account of what you can rely on if you are writing your own client.

## There is no API version yet

The server does not advertise a protocol version, and there are no formal
compatibility guarantees. An event name or a response shape can change with any
commit.

The practical conclusion: **pin yourself to the server version you deploy**, and
re-read this documentation after upgrading. Since the typical setup is
self-hosting from your own fork, you control when that happens.

## Making your client more resilient

A few habits that make upgrades cheaper.

**Detect capabilities, not versions.** `GET /api/public/config` tells you how
the server is configured. Branch on `streamMode`, `musicSource` and
`radioHostsMode` rather than assuming.

**Do not parse message text.** Localized strings change whenever a translation
is improved. Where a `code` field exists, branch on that — see
[Message format](/en/protocol/messages).

**Ignore unknown fields.** Fields get added to `sync` and other responses over
time. A client that throws on an unfamiliar key will break on the first upgrade.

**Do not rely on ordering.** Track order in `playlist` is meaningful; key order
in objects is not.

**Expect events to disappear.** It has happened: `trackEnd` and `trackDuration`
were removed once queue advancement became purely server-side. Your client
should tolerate an event that simply stops arriving.

## What changes least

These parts of the protocol are load-bearing and unlikely to change without a
strong reason:

- `sync` as the single source of radio state;
- the `listener_init` → `listener_uid` → `/api/audio-key` exchange;
- audio requiring both tokens;
- server messages arriving as objects containing every locale.

## What may change

- The field set in `sync` — fields get added.
- Admin endpoints and events: there are the most of them and they move fastest.
- The XOR wrapper around assets — it is obfuscation rather than security, so the
  mechanism may well be replaced.

::: tip If you host a server for other people
Consider versioning it yourself: add a version field to `/api/public/config` and
bump it on every breaking change. Third-party clients can then tell the user
honestly that the server is newer than they are, instead of silently
misbehaving.
:::
