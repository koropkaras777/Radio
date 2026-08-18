---
layout: home

hero:
  name: Radio Smihun
  text: Documentation — synchronized online radio
  tagline: Server documentation (docs) and client implementation guide. Every listener hears the same track at the same second.
  actions:
    - theme: brand
      text: Build a client in 15 minutes
      link: /en/guide/quickstart-client
    - theme: alt
      text: API reference
      link: /en/reference/rest

features:
  - title: A protocol, not a library
    details: Radio state is broadcast over Socket.io, audio is served over HTTP behind tokens. A client can be written in any language, not just React.
  - title: Two playback modes
    details: Client-side synchronisation with drift correction, or one shared MP3 stream encoded by FFmpeg on the server.
  - title: Live hosts
    details: A host's microphone is mixed into the broadcast, guests join through a queue, and the track queue can be paused mid-show.
  - title: 17 languages built in
    details: The server returns messages in every locale at once, so clients choose a language without negotiating with the server.
---

## Where to start

**Writing your own client.** Start with
[Build a client in 15 minutes](/en/guide/quickstart-client) — the end-to-end
path from connecting to hearing sound. Then read
[Tokens and access](/en/protocol/tokens) and
[Message format and i18n](/en/protocol/messages); those two carry the traps that
cost the most time.

**Controlling the broadcast.** [Build an admin client](/en/guide/admin-client)
covers logging in, permissions, the queue and uploads;
[Live broadcast walkthrough](/en/guide/live-broadcast) covers going on air,
guests and moderation, with sequence diagrams.

**Running your own radio.** See
[Running your own server](/en/guide/self-hosting). The minimal setup needs
neither cloud storage nor a database.

## Reference

The endpoint, event and privilege tables are **generated from the server
source** by `docs/scripts/extract-api.mjs`, so they always match the code. Every
entry is described, and every description is translated:

- [REST API](/en/reference/rest) — 84 endpoints
- [Socket.io events](/en/reference/socket-events) — 77 events
- [Privileges](/en/reference/privileges) — the admin permission model

## Translation status

| Page | English |
|---|---|
| Build a client in 15 minutes | ✅ |
| Running your own server | ✅ |
| Tokens and access | ✅ |
| Message format and i18n | ✅ |
| Playback modes | ✅ |
| Stability and compatibility | ✅ |
| Build an admin client | ✅ |
| Live broadcast walkthrough | ✅ |
| REST, events and privileges reference | ✅ |

Everything is translated. Pages are written by hand, not machine-translated: a
plausible-sounding but wrong protocol description is worse than none.

## Open source

The code is open source and hosted on GitHub:
[github.com/koropkaras777/radio](https://github.com/koropkaras777/radio).
Issues and pull requests are welcome.

## Support the project

- Donatello: [donatello.to/RadioSmihun](https://donatello.to/RadioSmihun)
- Crypto (USDT): Tron (TRC20) `TC5rLcwx8fuixAygXxvFFTM1q46i6XCzcS`,
  Ethereum (ERC20) `0x6D7A457F7892AF9B316a3262eFDc2056C3f435ef`,
  Solana `2dLfnrjUCJsfTEQyaq1t3WupJPyfckHBWvcUsvxxFjUv`
