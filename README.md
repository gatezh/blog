# gatezh.com

Personal blog and portfolio website built with Hugo and deployed to Cloudflare Workers.

## Project Structure

This is a Bun monorepo containing:

- **apps/web** - Hugo static website using custom terminal theme
- **apps/email-worker** - Cloudflare Worker for contact form emails

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## Development

### Prerequisites

- [Bun](https://bun.sh) (v1.3.2+)
- [Hugo](https://gohugo.io) Extended (v0.152.2+)

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Hugo development server |
| `bun run dev:worker` | Start email worker locally |
| `bun run build` | Build Hugo site for production |
| `bun run deploy` | Deploy both web and worker |

### Adding Content

All Hugo commands should be run from `apps/web/`:

```bash
cd apps/web

# Create a regular blog post
hugo new posts/name-of-a-post

# Create a learning log post
hugo new ever-learning/name-of-a-post
```

#### Content Types

| Type | Directory | Archetype |
|------|-----------|-----------|
| Blog posts | `posts/` | `default` |
| Learning log | `ever-learning/` | `ever-learning` |

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment instructions.

### Quick Overview

1. Configure GitHub secrets (`CLOUDFLARE_API_TOKEN`)
2. Configure GitHub variables (`CLOUDFLARE_ACCOUNT_ID`)
3. Set up Cloudflare Turnstile for contact form
4. Set up Resend for email delivery
5. Configure worker secrets via `wrangler secret put`
6. Push to `master` branch to trigger deployment

## Documentation

- [Deployment Guide](./docs/DEPLOYMENT.md) - Full deployment setup
- [Architecture Decision Records](./docs/README.md) - Project decisions

## License

All rights reserved.
