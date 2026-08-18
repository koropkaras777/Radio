# Socket.io events

The primary channel. Radio state is broadcast here and nowhere else — there is
no REST endpoint that returns it.

## Connecting

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001', { withCredentials: true });
```

Your client's origin must be listed in `CLIENT_ORIGIN` on the server, or the
connection will not be established.

## What arrives immediately

The server sends these on its own, without any request:

- `sync` — the full radio state;
- `radio_hosts_mode` — whether live hosts are enabled;
- `usersUpdate` — active listeners;
- `radio_hosts_online` — only when host mode is enabled.

To obtain an `artToken` the client must send `listener_init` — see
[Build a client in 15 minutes](/en/guide/quickstart-client#step-3-get-an-arttoken).

## Reading the "Sent to" column

| Value | Meaning |
|---|---|
| `everyone` | broadcast to all connections |
| `single socket` | addressed to one client |
| `room …` | only to members of a room, e.g. live hosts |

Your client will not receive room events until it joins the corresponding
role — for an ordinary listener that is expected.

## Reserved events

Socket.io's own events — `connect`, `disconnect`, `connect_error` and so on —
are not listed. They behave as usual and are documented by Socket.io itself.

`message` and `error` are filtered out for the same reason: in this codebase
they belong to the WebRTC monitoring UDP socket, which also happens to be named
`socket`, not to the Socket.io connection.

## How this page is maintained

The event list is generated from the server source, so it is always complete.
Descriptions are written by hand in `reference/annotations/events.mjs` and
translated in `reference/annotations/en/events.mjs`; anything untranslated falls
back to Ukrainian rather than going missing.

Describing an event that does not exist in the code makes `npm run check` fail —
that is how renames get caught.

<!--@include: ../../reference/generated/en/socket-events.md-->
