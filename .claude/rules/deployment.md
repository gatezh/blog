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
- `bun run dev` - Run worker locally (needs .dev.vars)
- `bun run deploy` - Deploy to Cloudflare Workers

# Deployment

Deployment is handled via GitHub Actions. See `docs/deployment.md` for the full
setup, including the cutover runbook.

- `deploy.yml` — push to `master` → production. **The active path today.**
- `release.yml` — manual dispatch → `v*` tag → production. Available, opt-in.
- `deploy-staging.yml` — manual dispatch → staging. Blocked until the `staging`
  GitHub Environment and DNS exist; the push trigger is commented out on purpose.

Deployed Worker names are `gatezh-com` and `gatezh-com-email-worker` and do not
match the directory names. Renaming them is a cutover, not an edit — only
`staging` has an `env` block in `wrangler.jsonc`, deliberately.

## GitHub Secrets Required
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permission

## GitHub Variables Required
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
