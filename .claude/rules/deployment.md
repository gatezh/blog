---
description: Build commands, deployment workflow, and required GitHub secrets/variables
---

# Build Commands

## Root Level (Monorepo)
- `bun install` - Install all workspace dependencies
- `bun run dev` - Run Hugo dev server
- `bun run dev:api` - Run the API Worker locally
- `bun run build` - Build Hugo site
- `bun run build:api` - Build the API Worker (dry-run)

## Web App (services/www)
- `bun run dev` - Development server with drafts
- `bun run build` - Production build

## API Worker (services/api)
- `bun run dev` - Run worker locally (reads the repo-root `.env.local`)

# Deployment

Deployment is handled via GitHub Actions only. There is deliberately no local
`deploy` script: a local build reads `.env.local`, whose localhost `baseURL` and
always-pass Turnstile test keys must never reach a deployed Worker. See
`docs/deployment.md` for the full setup and the planned Worker rename.

- `deploy-staging.yml` — push to `master` (or dispatch) → staging
  (`staging-www.gatezh.com`, `staging-api.gatezh.com`).
- `release.yml` — manual dispatch → `v*` tag → production. **The only
  production path**; `action: redeploy` rolls back to an earlier tag, and
  `wrangler rollback` / the dashboard rolls back instantly.
- Both deploy in two phases: `wrangler versions upload` for www and api, then
  `promote` (`versions deploy` + `triggers deploy`, api first) only when both
  uploads succeeded. Nothing rolls back on its own; a failed promote or verify
  prints the rollback command. CI cannot create a Worker — create it in the
  dashboard first (docs/deployment.md, "Upload, then promote").
- Both run the whole of `ci.yml` (`workflow_call`) before deploying.
- Shared steps live in composite actions under `.github/actions/` (`setup`,
  `check-deploy-config`), referenced as `uses: $/...` — GitHub's
  self-repository syntax, which loads them from the workflow's own commit even
  when a job has checked out an older tag.
- Only the Release workflow's tagging job gets `contents: write`; every
  checkout sets `persist-credentials: false`.

Deployed Worker names are `gatezh-com` and `gatezh-com-email-worker` and do not
match the directory names. Renaming them (to `gatezh-www-*` / `gatezh-api-*`,
with the API on `api.gatezh.com`) is planned in docs/deployment.md ("Remaining") —
a cutover, not an edit. Only `staging` has an `env` block in
`wrangler.jsonc` until then, deliberately.

## Configuration

Every runtime value comes from the `staging` / `production` GitHub
Environment the deploy job runs in — tables in `docs/deployment.md`. Nothing
deployed reads `hugo.yaml`'s `baseURL`/`apiUrl`; those are local-dev defaults.
The www Worker has no script and no `vars`: staging differs from production
only by being built with `HUGO_ENVIRONMENT=staging` (adds noindex to
`_headers`).

**This repo is public and so are its Actions logs.** Variable values are printed
there; secret values are masked. Anything not meant to be public — email
addresses included — is a secret, never a variable.

Cloudflare credentials:
- `CLOUDFLARE_API_TOKEN` (secret, per environment) - Workers Admin + gatezh.com Workers Routes Edit; see docs/deployment.md
- `CLOUDFLARE_ACCOUNT_ID` (variable)
