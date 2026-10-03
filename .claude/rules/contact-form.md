---
description: Contact form configuration and API Worker secrets
globs: services/api/**
---

# Contact Form Configuration

All contact-form configuration lives in the `staging` / `production` GitHub
Environments — never in `hugo.yaml`, `wrangler.jsonc` or `wrangler secret put`.
Full tables in `docs/deployment.md`.

- **Variables:** `HUGO_PARAMS_APIURL` (form POST target, also the Worker CSP's
  `connect-src`), `HUGO_PARAMS_TURNSTILESITEKEY`, `ALLOWED_ORIGIN` (required).
- **Secrets:** `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `TO_EMAIL`,
  `FROM_EMAIL`.
- **This repo is public and so are its Actions logs.** Variable values are
  printed there; secret values are masked. Email addresses and anything else
  not meant to be public are secrets, never variables.
- Turnstile: set the site key and secret together, or neither. One widget per
  environment (they are hostname-bound).
- Local dev reads the repo-root `.env.local` (see `.env.example`).
