# gatezh.com

Personal blog and portfolio website built with Hugo and deployed to Cloudflare Workers.

## Project Structure

This is a Bun monorepo containing:

- **services/www** - Hugo static website using custom terminal theme
- **services/email-worker** - Cloudflare Worker for contact form emails

## Quick Start

```bash
# Install dependencies
bun install

# Set up local environment (ships with Turnstile test keys that always pass)
cp .env.example .env.local

# Start development server
bun run dev

# Build for production
bun run build
```

## Development

### Prerequisites

- [mise](https://mise.run) - Tool version manager (installs correct Bun and Hugo versions from `.mise.toml`)

Or install tools manually:
- [Bun](https://bun.sh) (v1.3.10+)
- [Hugo Extended](https://gohugo.io) (v0.157.0+)

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Hugo development server |
| `bun run dev:worker` | Start email worker locally |
| `bun run build` | Build Hugo site for production |
| `bun run lint` | Run oxlint linter |
| `bun run deploy` | Deploy both www and worker |

### Local Environment

Both services read a single gitignored `.env.local` at the repository root:

```bash
cp .env.example .env.local
```

The committed defaults work as-is for contact-form development. They point the
form at your local Worker and use Cloudflare's public Turnstile test keys, which
always pass verification — the production keys are hostname-scoped and will not
render on `localhost`. Only add a `RESEND_API_KEY` if you need submissions to
actually deliver email.

`bun run dev` starts both services together; `bun run dev:www` and
`bun run dev:worker` start them individually.

> **Run these from the repository root.** `bun --env-file` loads variables into
> bun's own process but does not export them to `bun x` children, so only the
> root scripts propagate `.env.local`. Running `bun run dev` from inside
> `services/www` starts a server that silently falls back to the production
> Turnstile sitekey and the deployed Worker URL.

### Adding Content

Content-scaffolding commands are run from `services/www/` (unlike the dev
servers above, which must be started from the repository root):

```bash
cd services/www

# Create a regular blog post (page bundle with images/ directory)
hugo new posts/name-of-a-post

# Create a learning log post (page bundle with images/ directory)
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
