---
description: Monorepo structure and configuration format conventions
---

# Monorepo Structure

This is a Bun monorepo for gatezh.com:
- `services/www` - Hugo static website (custom terminal theme with Tailwind CSS v4)
- `services/email-worker` - Cloudflare Worker for contact form emails

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
│   ├── deploy-www.yml          # Website deployment
│   └── deploy-email-worker.yml # Email worker deployment
│
├── .claude/                    # Claude Code configuration
│   ├── CLAUDE.md               # Critical rules
│   ├── settings.json           # Permissions
│   └── rules/                  # Modular topic rules
├── .devcontainer/              # Dev container configs (pre-built GHCR images)
│   ├── devcontainer.json       # Default devcontainer
│   └── claude-code/            # Sandbox variant (network-restricted)
├── docs/                       # Documentation and ADRs
├── .mise.toml                  # Tool versions (bun, hugo)
├── oxlint.json                 # OXC linter configuration
├── tsconfig.json               # Root TypeScript configuration
└── package.json                # Root workspace config
```

# Configuration Formats

- Hugo configuration: **YAML** format (`services/www/hugo.yaml`, use `.yaml` not `.yml`)
- Worker configuration: **JSONC** format (`services/email-worker/wrangler.jsonc`)
