---
description: Monorepo structure and configuration format conventions
---

# Monorepo Structure

This is a Bun monorepo for gatezh.com:
- `services/www` - Hugo static website (custom terminal theme with Tailwind CSS v4)
- `services/api` - Cloudflare Worker for contact form emails

```
├── services/
│   ├── www/                    # Hugo website, served as Workers static assets
│   │   ├── content/            # Site content (Markdown)
│   │   ├── assets/js/          # Site scripts (contact form, Turnstile)
│   │   ├── tests/              # Playwright: blog, seo, agents, assets
│   │   ├── layouts/            # Site-specific layouts (override theme),
│   │   │                       #   incl. the generated _headers/_redirects
│   │   ├── themes/terminal/    # Custom terminal theme
│   │   │   ├── assets/css/     # Tailwind CSS styles
│   │   │   ├── assets/js/      # Theme scripts (js.Build, no inline scripts)
│   │   │   └── layouts/        # Theme layouts and partials
│   │   ├── static/             # Static assets
│   │   ├── hugo.yaml           # Hugo configuration
│   │   ├── package.json        # Web app dependencies
│   │   ├── wrangler.jsonc      # Workers static assets config (no Worker code)
│   │   └── tsconfig.json       # TypeScript config for assets/js
│   │
│   └── api/                    # Cloudflare Worker
│       ├── src/
│       │   └── index.ts        # Worker entry point
│       ├── package.json        # Worker dependencies
│       ├── wrangler.jsonc      # Cloudflare Workers config
│       └── tsconfig.json       # TypeScript configuration
│
├── .github/workflows/          # GitHub Actions
│   ├── ci.yml                  # CI checks (lint, typecheck, build)
│   ├── deploy-staging.yml      # push to master → staging
│   └── release.yml             # dispatch → v* tag → production
│
├── .claude/                    # Claude Code configuration
│   ├── CLAUDE.md               # Critical rules
│   ├── settings.json           # Permissions
│   └── rules/                  # Modular topic rules
├── .devcontainer/              # Dev container configs (pre-built GHCR images)
│   ├── devcontainer.json       # Default devcontainer ("Local Development")
│   ├── docker-compose.yml      # Default compose (image only; pull via initializeCommand)
│   ├── init-plugins.sh         # Claude Code marketplaces, plugins, rtk (postCreateCommand)
│   └── claude-sandbox/         # Sandbox variant (network-restricted)
├── docs/                       # Documentation and ADRs
├── .mise.toml                  # Tool versions (bun, hugo)
├── oxlint.json                 # OXC linter configuration
├── tsconfig.json               # Root TypeScript configuration
└── package.json                # Root workspace config
```

# Configuration Formats

- Hugo configuration: **YAML** format (`services/www/hugo.yaml`, use `.yaml` not `.yml`)
- Worker configuration: **JSONC** format (`services/api/wrangler.jsonc`)
