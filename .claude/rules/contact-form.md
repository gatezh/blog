---
description: Contact form configuration and email worker secrets
globs: services/email-worker/**
---

# Contact Form Configuration

The contact form requires:
1. **Turnstile Site Key** - Set in `services/www/hugo.yaml` as `turnstileSiteKey`
2. **Worker URL** - Set in `services/www/hugo.yaml` as `contactWorkerUrl`
3. **Worker Secrets** - Set via `wrangler secret put`:
   - `RESEND_API_KEY` - Resend API key for sending emails
   - `TURNSTILE_SECRET_KEY` - Turnstile secret for verification
   - `TO_EMAIL` - Email recipient for contact form submissions
   - `FROM_EMAIL` - Email sender (must be from a verified domain in Resend)

## Local Development

Copy `.env.example` to `.env.local` at the **repository root** — both services
read that single file. Never create `services/email-worker/.dev.vars`; wrangler
is pointed at the root file via `--env-file` in the worker's `dev` script.

`.env.local` overrides the production values in `hugo.yaml` through Hugo's
`HUGO_PARAMS_*` convention (env vars take precedence over config files):

| Variable | Overrides | Local value |
|---|---|---|
| `HUGO_PARAMS_TURNSTILESITEKEY` | `turnstileSiteKey` | `1x00000000000000000000AA` (always passes) |
| `HUGO_PARAMS_CONTACTWORKERURL` | `contactWorkerUrl` | `http://localhost:8787` |
| `TURNSTILE_SECRET_KEY` | Worker secret | `1x0000000000000000000000000000000AA` (always passes) |

The production Turnstile keys cannot be used locally: the sitekey is
hostname-scoped in the Cloudflare dashboard, and the sitekey/secret must be a
matched pair. Keep the production values in `hugo.yaml` — CI builds rely on them.

Wrangler needs its own `--env-file` to create `c.env` bindings — it only
auto-discovers `.env` / `.dev.vars` next to `wrangler.jsonc` and never searches
parent directories. Process env vars alone do **not** become bindings.

**Always start dev servers from the repository root** (`bun run dev`,
`bun run dev:www`, `bun run dev:worker`). `bun --env-file` loads variables into
bun's own process but does not export them to `bun x` children, so only the root
scripts propagate `.env.local`. Running `bun run dev` inside `services/www`
silently serves the production sitekey and the deployed Worker URL.
