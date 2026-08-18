# Privileges

The admin permission model. Works the same on both data providers: `json`
stores helper admins and their privileges just like `sql` does.

## Two roles

**Super admin** — credentials from `ADMIN_LOGIN` and `ADMIN_PASS` in
`server/.env`. Passes any privilege check regardless of the list.

**Helper admins** — created by the super admin. They start unauthorized and
activate themselves with a temporary password, and hold only the privileges
explicitly granted. Changes take effect without logging in again.

## How they are checked

In HTTP routes the privilege sits as middleware right after authentication:

```js
router.post('/switch-mode',
  requireAdmin,
  requirePrivilege(PRIVILEGES.MODE_SWITCH),
  handler);
```

Some checks live at the Socket.io layer (`socket/context.js`) — that is how
`RADIO_HOST` and `RADIO_MODERATOR` work, which is why the table below shows zero
HTTP endpoints for them.

<!--@include: ../../reference/generated/en/privileges.md-->

## Per-section checking on `POST /api/admin/settings`

One endpoint writes three groups of settings governed by different privileges:

| Body section | Privilege | Contents |
|---|---|---|
| `branding` | `SETTINGS_BRANDING` | radio names, links |
| `generation` | `SETTINGS_ALGORITHM` | durations, mode, genre groups |
| `radioHosts` | `RADIO_MODERATOR` | guest and special-guest limits |

Authorization is based on **what actually changes**, not on what was submitted.
The admin panel always posts every section, including ones the current admin did
not edit, so the mere presence of a section means nothing.

The server runs both the incoming data and the current state through the same
validation pipeline and compares the results: if a section matches after
normalization, no privilege is needed for it. Unit conversion, whitespace
trimming or a different key order therefore never look like an edit.

If a section the admin may not touch does change, the whole request is rejected
with `403` — there is no partial save. Changed sections are recorded in the
audit log.

::: tip For authors of alternative admin panels
`songGroups` is ignored in that request: song groups are edited through the
separate `/api/admin/song-groups` endpoints under `SETTINGS_GROUPS`.
:::
