# Agent Instructions

This is a Bun monorepo for gatezh.com containing:
- **apps/web** - Hugo static website (PaperMod theme)
- **apps/email-worker** - Cloudflare Worker for contact form emails

## Critical Rules

### Package Manager
- **ALWAYS use `bun`** - never use npm, yarn, or pnpm
- Use `bun add`, `bun install`, `bun run`, `bunx`
- Lock file is `bun.lock` (not package-lock.json or yarn.lock)

### Dependency Versions
- **ALWAYS pin exact versions** - no `^` or `~` prefixes
- Example: `"wrangler": "4.14.1"` not `"wrangler": "^4.14.1"`

### Hugo Version Sync
- Hugo version must be synchronized across:
  - `.devcontainer/hugo-dev/devcontainer.json` (image tag)
  - `.github/workflows/deploy-web.yml` (env.HUGO_VERSION)

### Bun Version Sync
- Bun version must be synchronized across:
  - `.github/workflows/deploy-web.yml` (env.BUN_VERSION)
  - `.github/workflows/deploy-email-worker.yml` (env.BUN_VERSION)

## Monorepo Structure

```
├── apps/
│   ├── web/                    # Hugo website
│   │   ├── content/            # Site content (Markdown)
│   │   ├── layouts/            # Custom layouts (overrides theme)
│   │   ├── static/             # Static assets
│   │   ├── hugo.yaml           # Hugo configuration
│   │   ├── package.json        # Web app dependencies
│   │   └── wrangler.jsonc      # Cloudflare Workers config
│   │
│   └── email-worker/           # Cloudflare Worker
│       ├── src/
│       │   └── index.ts        # Worker entry point
│       ├── package.json        # Worker dependencies
│       ├── wrangler.jsonc      # Cloudflare Workers config
│       └── tsconfig.json       # TypeScript configuration
│
├── .github/workflows/          # GitHub Actions
│   ├── deploy-web.yml          # Website deployment (path: apps/web/**)
│   └── deploy-email-worker.yml # Email worker deployment (path: apps/email-worker/**)
│
├── docs/                       # Documentation and ADRs
├── package.json                # Root workspace config
└── CLAUDE.md                   # This file
```

## Project Conventions

### Configuration Format
This project uses **YAML** format for Hugo configuration files:
- `apps/web/hugo.yaml` - Main Hugo configuration
- Use `.yaml` extension (not `.yml`)

Worker configuration uses JSONC:
- `apps/email-worker/wrangler.jsonc`

### Hugo Theme
- Uses PaperMod theme via Hugo modules (go.mod)
- Custom layouts in `apps/web/layouts/` override theme
- Theme provides extension points: `extend_head.html`, `extend_footer.html`

## Build Commands

### Root Level (Monorepo)
- `bun install` - Install all workspace dependencies
- `bun run dev` - Run Hugo dev server
- `bun run dev:worker` - Run email worker locally
- `bun run build` - Build Hugo site
- `bun run build:worker` - Build worker (dry-run)
- `bun run deploy` - Deploy both web and worker

### Web App (apps/web)
- `bun run dev` - Development server with drafts
- `bun run build` - Production build
- `bun run deploy` - Deploy to Cloudflare Workers

### Email Worker (apps/email-worker)
- `bun run dev` - Run worker locally (needs .dev.vars)
- `bun run deploy` - Deploy to Cloudflare Workers

## Contact Form Configuration

The contact form requires:
1. **Turnstile Site Key** - Set in `apps/web/hugo.yaml` as `turnstileSiteKey`
2. **Worker URL** - Set in `apps/web/hugo.yaml` as `contactWorkerUrl`
3. **Worker Secrets** - Set via `wrangler secret put`:
   - `RESEND_API_KEY` - Resend API key for sending emails
   - `TURNSTILE_SECRET_KEY` - Turnstile secret for verification

## Deployment

Deployment is handled via GitHub Actions. See `docs/DEPLOYMENT.md` for complete setup instructions.

### GitHub Secrets Required
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permission

### GitHub Variables Required
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
