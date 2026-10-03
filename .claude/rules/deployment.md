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
- `bun run deploy` - Deploy both web and worker

## Web App (services/www)
- `bun run dev` - Development server with drafts
- `bun run build` - Production build
- `bun run deploy` - Deploy to Cloudflare Workers

## API Worker (services/api)
- `bun run dev` - Run worker locally (reads the repo-root `.env.local`)
- `bun run deploy` - Deploy to Cloudflare Workers

# Deployment

Deployment is handled via GitHub Actions. See `docs/deployment.md` for the full
setup and the planned Worker rename.

- `deploy-staging.yml` — push to `master` (or dispatch) → staging
  (`staging-www.gatezh.com`, `staging-api.gatezh.com`).
- `release.yml` — manual dispatch → `v*` tag → production. **The only
  production path**; `action: redeploy` rolls back to an earlier tag.

Deployed Worker names are `gatezh-com` and `gatezh-com-email-worker` and do not
match the directory names. Renaming them (to `gatezh-www-*` / `gatezh-api-*`,
with the API on `api.gatezh.com`) is planned in docs/deployment.md ("Remaining") —
a cutover, not an edit. Only `staging` has an `env` block in
`wrangler.jsonc` until then, deliberately.

## Configuration

Every runtime value comes from the `staging` / `production` GitHub
Environment the deploy job runs in — tables in `docs/deployment.md`. Nothing
deployed reads `hugo.yaml`'s `baseURL`/`apiUrl` or `vars` in `wrangler.jsonc`;
those are local-dev defaults.

**This repo is public and so are its Actions logs.** Variable values are printed
there; secret values are masked. Anything not meant to be public — email
addresses included — is a secret, never a variable.

Cloudflare credentials:
- `CLOUDFLARE_API_TOKEN` (secret, per environment) - Workers Admin + gatezh.com Workers Routes Edit; see docs/deployment.md
- `CLOUDFLARE_ACCOUNT_ID` (variable)
