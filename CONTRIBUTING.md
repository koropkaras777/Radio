# Contributing

Thanks for considering a contribution. This is a solo-maintained, self-hosted
project — response times may vary, but PRs and issues are welcome.

## Getting set up

The [README](README.md#quick-start) covers installing dependencies,
configuring `server/.env` / `client/.env`, and running the dev servers. Start
there; this file only covers conventions specific to contributing.

## Code style

- Comments are kept to a minimum. The one style that is welcome is a section
  separator to break up a long file:

  ```js
  // ─── FormField ────────────────────────────────────────────────────────────
  ```

  Everything else — "why this way" notes, JSDoc over functions, line-by-line
  explanations — is skipped. If something genuinely needs explaining, it
  belongs in `docs/`, not in a code comment.
- All comments are in English, regardless of the surrounding code. Localized
  *content* (`i18n/uk/`, documentation pages, annotation descriptions) stays
  in whatever language it's written in — that's data, not a comment.
- Environment variables are read in exactly one place, `server/src/config/env.js`.
  No other module should call `process.env` directly; import the normalized
  constant instead. This keeps defaults, validation, and type coercion in one
  spot instead of scattered across the codebase.
- The server must never refuse to start over a configuration problem it can
  work around. If a combination of settings makes some admin feature
  pointless (see `EPHEMERAL_STORAGE`, or a missing cloud/SQL requirement for
  jingles/phrases), the fix is to disable that feature — server-side, not just
  hidden in the UI — and keep broadcasting. `process.exit(1)` is reserved for
  configuration that is truly unrecoverable (e.g. no `JWT_SECRET`).
- The client never drives playback or queue order. It reflects state the
  server pushes over `sync` / socket events; it never advances the playlist
  or infers the next track on its own.

## i18n

If you add or change any user-facing string, run the translation CLI from
`server/` to keep all 17 locales in sync before opening a PR:

```bash
node scripts/translate-i18n.js sync --plural-aware --from uk
```

`--plural-aware` matters whenever a string uses `{count}` — it generates the
correct plural categories per locale (Slavic `one/few/many`, Arabic
`zero/two`, etc.) instead of a single flat string.

## Docs

`docs/reference/generated/` (endpoints, socket events, privileges) is
generated from annotations in `docs/reference/annotations/` plus the server
source — never hand-edit the generated files. After changing a route, event,
or privilege, run from `docs/`:

```bash
npm run check
```

This is also enforced in CI (`.github/workflows/docs.yml`): a PR that touches
`server/src/**` without updating the matching annotation fails the build.

## Data and media safety

`server/scripts/migrate.js` never reads credentials from `.env` — a remote
database or R2 bucket is only ever touched when its URL/token/keys are passed
explicitly on the command line. Keep it that way; it's what stops a mistyped
migration command from touching someone's live radio. Don't add a fallback to
environment variables in that script.

## Pull requests

- Keep PRs focused — one feature or fix per PR is much easier to review than
  a bundle of unrelated changes.
- Make sure `npm run install-all && npm run build` succeeds from the project
  root before opening a PR.
- Describe *what* changed and *why* in the PR description; the diff already
  shows *how*.
