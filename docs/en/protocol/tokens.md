# Tokens and access

Four independent access mechanisms coexist in this server. Confusing them is the
most common cause of `401` while writing a client.

## Overview

| Token | Who gets it | Lifetime | What it opens |
|---|---|---|---|
| `artToken` | any listener | 1 hour | art, avatars, lyrics, the XOR key |
| `audioToken` | a listener holding `artToken` | short | access to audio |
| Admin JWT | after login | session | everything under `/api/admin/*` |
| Guest token | an invited guest | session | entry to the guest room |

## `artToken`

Issued **over the socket**, not over HTTP: the client sends `listener_init` and
receives `listener_uid` with the token inside.

The token is bound to a `uid` that the server derives from the connection's IP
address. Clients cannot choose their identity, and listeners behind a shared NAT
all receive the same `uid`.

Sent as the `X-Art-Token` header or a `?token=` query parameter.

## `audioToken`

Exchanged for an `artToken`:

```http
GET /api/audio-key
X-Art-Token:    <artToken>
X-Listener-Uid: <uid>
```

The response includes `expiresIn` in seconds. Refresh early — the reference
client does so 30 seconds before expiry.

Audio endpoints require **both** tokens together.

## The XOR wrapper

Artist art, avatars and lyrics are not served as plain bytes: they are XOR-ed
with a key derived from the `artToken`.

The key is the middle segment of the token, base64url-encoded:

```js
export const xorDecrypt = (buf, token) => {
  const b64    = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const keyRaw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const enc    = new Uint8Array(buf);
  const dec    = new Uint8Array(enc.length);
  for (let i = 0; i < enc.length; i++) dec[i] = enc[i] ^ keyRaw[i % keyRaw.length];
  return dec;
};
```

The real MIME type of a decoded image arrives in the `X-Art-Mime` header, which
is exposed via `Access-Control-Expose-Headers` so browsers can read it.

::: warning Audio is not wrapped this way
Despite the name, `audioToken` does **not** encrypt audio files. There it is
only a pass, and the bytes are served as-is. The XOR applies to art, avatars and
lyrics, keyed by the `artToken`.
:::

::: danger This is obfuscation, not encryption
The key is handed to the client on request and the algorithm is public. It
deters casual scraping of assets by other pages, but it is not a security
measure and must not be treated as one. Do not rely on it for anything that
actually needs to stay private.
:::

## Admin JWT

```http
POST /api/admin/login
{ "login": "…", "password": "…" }
```

Then `Authorization: Bearer <token>` on everything under `/api/admin/*`. Some
endpoints also accept the token in the query string — that exists for `<audio
src>` tags, where headers cannot be set.

::: warning In production the token is not in the response body
It arrives only in an httpOnly `adminToken` cookie that JavaScript cannot read.
Send requests with `credentials: 'include'` and make sure your origin is listed
in `CLIENT_ORIGIN`. The token lasts 12 hours.
:::

Beyond the JWT, most admin endpoints also check a privilege — see
[Privileges](/en/reference/privileges).

## Authentication is split in two

Worth stating explicitly, because it causes silent failures: a successful HTTP
login does **not** make your socket an admin socket. The socket must send the
`admin_active` event separately. Until it does, the server treats the connection
as an ordinary listener and ignores admin events **without any reply**.
