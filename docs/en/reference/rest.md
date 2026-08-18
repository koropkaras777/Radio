# REST API

Every HTTP endpoint. The tables below are generated from the server source, so
they match the current branch.

## Reading the "Access" column

| Value | What to send |
|---|---|
| `public` | nothing |
| `art token` | `X-Art-Token` or `?token=` |
| `art + audio token` | `X-Art-Token` + `X-Audio-Token`, or `?artToken=&audioToken=` |
| `admin (JWT)` | `Authorization: Bearer <token>` from `/api/admin/login` |
| `admin (bearer or query)` | same, but the token is also accepted in the query — for `<audio src>` |
| `super admin only` | the `.env` account; helper admins are refused |

## Reading the "Privilege" column

Three notations that mean different things:

| Notation | Meaning |
|---|---|
| `A + B` | **both** privileges required |
| `A or B` | **either** is enough |
| `…` *(per section)* | which privilege applies depends on what the request changes |

Privileges apply **in addition** to the JWT: the account must be either the
super admin or hold that privilege.

## Error format

Errors come back in an `error` field, and its value is **not always a string** —
many endpoints return an object containing every locale. Read
[Message format and i18n](/en/protocol/messages) before writing error handling.

## How this page is maintained

The tables are generated from the server source in both languages, so the list
is always complete and always matches the code. Descriptions are written by hand
in `reference/annotations/endpoints.mjs` and translated in
`reference/annotations/en/endpoints.mjs`; anything untranslated falls back to
Ukrainian rather than going missing.

`npm run check` fails if the generated tables drift from the code, if a
description refers to an endpoint that no longer exists, or if a translation key
has no counterpart in the base file.

<!--@include: ../../reference/generated/en/endpoints.md-->
