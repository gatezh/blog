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
- Both run `preflight → ci → upload → go-live` (release adds `release` after
  `ci`). `preflight` checks the environment's config before CI; in staging it
  also skips CI when a pull request run already passed on the same tree (a
  `tested-tree-*` artifact from `ci.yml`'s lint job, from a same-repo branch
  only: a fork's PR runs its own `ci.yml`). `upload` puts www and api
  up with `wrangler versions upload`; `go-live` reads what is live, stages both
  new versions at 0% (`triggers deploy` first, api first), verifies them
  through a `Cloudflare-Workers-Version-Overrides` header, then promotes both
  to 100%. The checks first wait for www's `build-id` meta (run id and
  attempt, not the commit, which a redeploy of the live commit shares) and the
  api's `Worker-Version` header to name the new versions: a missed override falls
  back to the live version silently. A failed check promotes nothing, and
  restore takes the staged versions out again; only a failed promote prints
  the restore command. `CLOUDFLARE_API_TOKEN` goes on the steps that call
  Cloudflare, never a job's `env` (setup and the build run npm code; a step
  is not an isolation boundary, see docs/deployment.md). CI
  cannot create a Worker — create it in the dashboard first (docs/deployment.md, "Upload, then
  promote").
- Every job below one that can be skipped needs an explicit
  `if: ${{ !cancelled() && needs.<job>.result == 'success' }}`: the default
  `success()` covers the whole `needs` chain, so a skipped `ci` would skip the
  deploy.
- Both run the whole of `ci.yml` (`workflow_call`) before deploying, unless
  staging's `preflight` finds a passing run of the same tree.
- Shared steps live in composite actions under `.github/actions/` (`setup`,
  `check-deploy-config`, `go-live`), referenced as `uses: $/...` — GitHub's
  self-repository syntax, which loads them from the workflow's own commit even
  when a job has checked out an older tag. `go-live`'s logic is
  `go-live/go-live.sh`, tested by `go-live.test.ts` (`bun run test:deploy`,
  part of `bun run test`) against stubbed wrangler and curl; change the
  shared deploy steps there, not in the workflows.
- Only the Release workflow's tagging job gets `contents: write`; every
  checkout sets `persist-credentials: false`.

Deployed Worker names are `gatezh-com` and `gatezh-com-email-worker` and do not
match the directory names. Renaming them (to `gatezh-www-*` / `gatezh-api-*`)
is planned in docs/deployment.md ("Remaining") — a cutover, not an edit. Only
`staging` has an `env` block in `wrangler.jsonc` until then, deliberately.
Production's api is on `api.gatezh.com`. Every Worker sets `workers_dev` and
`preview_urls` to false in `wrangler.jsonc`; a dashboard toggle does not
survive a deploy.

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
