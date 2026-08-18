# Running your own server

The minimal configuration needs neither cloud storage nor a database — just
Node.js and a folder of music.

## Requirements

- Node.js 18+
- FFmpeg — only for stream mode and YouTube downloads
- Python 3 + `pip install -r server/src/tools/ytbdown/requirements.txt` — only for YouTube downloads

## Installation

```bash
git clone <repository>
cd Radio
npm run install-all
cp server/.env.example server/.env
cp client/.env.example client/.env
```

## Minimal `server/.env`

Three values are mandatory; the rest have working defaults:

```ini
JWT_SECRET=<long random string>
ADMIN_LOGIN=admin
ADMIN_PASS=<bcrypt hash>

DATA_PROVIDER=json
MEDIA_STORAGE=local
```

Generate the password hash with:

```bash
cd server && node scripts/hash-password.js
```

`ADMIN_PASS` must be the hash — the server does not accept a plain-text
password. Without `JWT_SECRET` it refuses to start at all.

## Allow your client's origin

The step most often missed:

```ini
CLIENT_ORIGIN=http://localhost:3000,http://localhost:5173
```

Values are comma-separated and apply to both HTTP and Socket.io. A client served
from any other origin will be blocked by the browser. Restart after changing it.

## Music

Place audio files in folders by mode:

```
server/media/music/day/     ← daytime rotation
server/media/music/night/   ← nighttime rotation
```

A track's identifier in the API is a path like `day/Artist - Title.mp3`.

If you do not need a night rotation, disable it and the radio runs the daytime
one around the clock:

```ini
NIGHT_MODE=false
```

## Running

```bash
npm run dev --prefix server    # backend in watch mode
npm run dev --prefix client    # Vite dev server
```

In production the client is built and served by the server itself:

```bash
npm run build-client
npm start
```

## Enabling more

| I want | I need |
|---|---|
| Multiple admins with roles | nothing — both providers store accounts |
| Uploading songs from the admin panel | nothing — local disk works too |
| Jingles between songs | `STREAM_MODE=true` (any storage) |
| Live broadcasting with a microphone | `STREAM_MODE=true` + `RADIO_HOSTS_MODE=true` |
| Automatic lyrics | nothing — LRCLIB needs no account or key |
| YouTube import | FFmpeg + `python3` with `ytbdown`'s `pip` dependencies (any storage) |

How to set each of these up is covered in
[Full configuration](/en/guide/full-configuration). Note that **no feature
requires cloud services** — everything works on a local disk and a local
database. The cloud and a remote database matter only when the host wipes its
filesystem on deploy (see
[Ephemeral hosting](/en/guide/full-configuration#ephemeral-hosting)).

`RADIO_HOSTS_MODE=true` without `STREAM_MODE=true` does not stop the server:
live hosts simply stay disabled and the rest of the radio runs.

The full list of variables is in `server/.env.example`, each with a comment.

## Documentation on its own subdomain

These docs are served by the **same service** as the radio: requests are routed
by hostname. Anything arriving on the documentation host gets the VitePress
build from `docs/.vitepress/dist`; everything else gets the radio client.

```ini
DOCS_HOST=docs.example.com
```

The variable is optional: left empty, documentation is served on any hostname
whose first label is `docs`.

Both sides have to be built:

```bash
npm run build     # client + documentation
npm start
```

Keeping them in one deployment is not only convenient. The API reference is
**generated from the server source**, so shipping them together is what
guarantees the reference describes the server that is actually running.

::: tip Deploying on Render
A single Web Service: `Build Command` is `npm run install-all && npm run build`,
`Start Command` is `npm start`. Add both domains to that same service (the main
one and the `docs.` one); certificates are issued automatically.

`install-all` passes `--include=dev` for the client and the docs: Render sets
`NODE_ENV=production`, and without that flag npm skips devDependencies, which is
where Vite and VitePress live.
:::
