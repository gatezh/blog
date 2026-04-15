---
description: Build commands, deployment workflow, and required GitHub secrets/variables
---

# Build Commands

## Root Level (Monorepo)
- `bun install` - Install all workspace dependencies
- `bun run dev` - Run Hugo dev server
- `bun run dev:worker` - Run email worker locally
- `bun run build` - Build Hugo site
- `bun run build:worker` - Build worker (dry-run)
- `bun run deploy` - Deploy both web and worker

## Web App (services/www)
- `bun run dev` - Development server with drafts
- `bun run build` - Production build
- `bun run deploy` - Deploy to Cloudflare Workers

## Email Worker (services/email-worker)
- `bun run dev` - Run worker locally (needs .dev.vars)
- `bun run deploy` - Deploy to Cloudflare Workers

# Deployment

Deployment is handled via GitHub Actions. See `docs/DEPLOYMENT.md` for complete setup instructions.

## GitHub Secrets Required
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permission

## GitHub Variables Required
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
