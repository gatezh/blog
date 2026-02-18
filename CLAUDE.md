# Agent Instructions

This is a Bun monorepo for gatezh.com containing:
- **services/www** - Hugo static website (custom terminal theme with Tailwind CSS v4)
- **services/email-worker** - Cloudflare Worker for contact form emails

## Critical Rules

### Package Manager
- **ALWAYS use `bun`** - never use npm, yarn, or pnpm
- Use `bun add`, `bun install`, `bun run`, `bunx`
- Lock file is `bun.lock` (not package-lock.json or yarn.lock)

### Dependency Versions
- **ALWAYS pin exact versions** - no `^` or `~` prefixes
- Example: `"wrangler": "4.14.1"` not `"wrangler": "^4.14.1"`

### Tool Version Sync
- Tool versions are managed centrally in `.mise.toml` (single source of truth)
- Hugo and Bun versions are read from `.mise.toml` by:
  - `.devcontainer/Dockerfile` (via mise)
  - `.github/workflows/deploy-web.yml` (via `jdx/mise-action`)
  - `.github/workflows/deploy-email-worker.yml` (via `jdx/mise-action`)
- When updating tool versions, only edit `.mise.toml`

### Pre-Completion Checks
Before finishing any feature or change, **ALWAYS run verification**:
- **TypeScript**: `bunx tsc --noEmit` in any workspace with TypeScript
- **Linting**: `bunx oxlint` from root to check for lint errors
- **Build**: `bun run build` to ensure production build works
- **Tests**: `bun run test` if tests exist for the changed code

## Monorepo Structure

```
├── services/
│   ├── www/                    # Hugo website
│   │   ├── content/            # Site content (Markdown)
│   │   ├── layouts/            # Site-specific layouts (override theme)
│   │   ├── themes/terminal/    # Custom terminal theme
│   │   │   ├── assets/css/     # Tailwind CSS styles
│   │   │   └── layouts/        # Theme layouts and partials
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
│   ├── deploy-web.yml          # Website deployment (path: services/www/**)
│   └── deploy-email-worker.yml # Email worker deployment (path: services/email-worker/**)
│
├── docs/                       # Documentation and ADRs
├── .mise.toml                  # Tool versions (bun, hugo)
├── oxlint.json                 # OXC linter configuration
├── tsconfig.json               # Root TypeScript configuration
├── package.json                # Root workspace config
└── CLAUDE.md                   # This file
```

## Project Conventions

### Configuration Format
This project uses **YAML** format for Hugo configuration files:
- `services/www/hugo.yaml` - Main Hugo configuration
- Use `.yaml` extension (not `.yml`)

Worker configuration uses JSONC:
- `services/email-worker/wrangler.jsonc`

### Hugo Theme
- Uses custom terminal theme in `services/www/themes/terminal/`
- Theme uses Tailwind CSS v4 via Hugo's `css.TailwindCSS` function
- Site-specific layouts in `services/www/layouts/` override theme (e.g., contact.html)
- Theme features:
  - Three-position theme switcher (light/dark/system)
  - Terminal-inspired aesthetic with monospace typography
  - Remark42 comments integration with theme synchronization

## Build Commands

### Root Level (Monorepo)
- `bun install` - Install all workspace dependencies
- `bun run dev` - Run Hugo dev server
- `bun run dev:worker` - Run email worker locally
- `bun run build` - Build Hugo site
- `bun run build:worker` - Build worker (dry-run)
- `bun run deploy` - Deploy both web and worker

### Web App (services/www)
- `bun run dev` - Development server with drafts
- `bun run build` - Production build
- `bun run deploy` - Deploy to Cloudflare Workers

### Email Worker (services/email-worker)
- `bun run dev` - Run worker locally (needs .dev.vars)
- `bun run deploy` - Deploy to Cloudflare Workers

## Contact Form Configuration

The contact form requires:
1. **Turnstile Site Key** - Set in `services/www/hugo.yaml` as `turnstileSiteKey`
2. **Worker URL** - Set in `services/www/hugo.yaml` as `contactWorkerUrl`
3. **Worker Secrets** - Set via `wrangler secret put`:
   - `RESEND_API_KEY` - Resend API key for sending emails
   - `TURNSTILE_SECRET_KEY` - Turnstile secret for verification

## Deployment

Deployment is handled via GitHub Actions. See `docs/DEPLOYMENT.md` for complete setup instructions.

### GitHub Secrets Required
- `CLOUDFLARE_API_TOKEN` - API token with Workers edit permission

### GitHub Variables Required
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
