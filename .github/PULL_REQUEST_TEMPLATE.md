## What changed and why

## How to test

## Checklist

- [ ] `npm run install-all && npm run build` succeeds
- [ ] If any user-facing string changed: ran `node scripts/translate-i18n.js sync --plural-aware --from uk` (from `server/`)
- [ ] If a route, socket event, or privilege changed: `npm run check` in `docs/` passes
- [ ] No secrets, `.env` files, or real credentials included in the diff
