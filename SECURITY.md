# Security Policy

## Supported versions

This is a single, continuously-deployed application rather than a library
with maintained release branches. Security fixes land on `master`; if you're
self-hosting, staying reasonably close to the latest commit/release is the
best way to receive them.

## Reporting a vulnerability

Please report security issues privately, **not** in a public GitHub issue —
this project handles admin authentication (JWT), donation payment webhooks
(LiqPay, Stripe, Donatello, Ko-fi), and signed media/session tokens, so a
public report could be exploited before it's fixed.

Use GitHub's private vulnerability reporting for this repository: open the
**Security** tab → **Report a vulnerability**. This opens a private
conversation with the maintainer and is the preferred channel.

Please include:

- What the vulnerability allows (e.g. privilege escalation, auth bypass,
  data exposure).
- Steps to reproduce, or a proof of concept if you have one.
- Which part of the system is affected (admin panel, donation webhooks,
  live-host streaming, etc.).

There's no bug bounty — this is a hobby project — but reports are taken
seriously and credited in the fix unless you'd rather stay anonymous.

## Scope notes

- Self-hosters are responsible for their own deployment: keeping
  `JWT_SECRET`, `TURSO_AUTH_TOKEN`, R2 keys, and donation provider
  credentials out of version control, and running behind HTTPS in
  production.
- Third-party services this project integrates with (Turso, Cloudflare R2,
  LiqPay, Stripe, Donatello, Ko-fi, LRCLIB) have their own security
  policies; issues in those services themselves should go to them directly.
