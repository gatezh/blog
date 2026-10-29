# gatezh.com

Personal blog and portfolio website built with Hugo and deployed to Cloudflare Workers.

## Project Structure

This is a Bun monorepo containing:

- **services/www** - Hugo static website using custom terminal theme
- **services/api** - Cloudflare Worker for contact form emails

## Quick Start

```bash
# Install dependencies
bun install

# Set up the local environment (Turnstile test keys that always pass)
cp .env.example .env.local

# Start development server
bun run dev

# Build for production
bun run build
```

## Development

### Prerequisites

- [mise](https://mise.run) - Tool version manager (installs correct Bun and Hugo versions from `.mise.toml`)

Or install [Bun](https://bun.sh) and [Hugo Extended](https://gohugo.io)
manually, at the versions pinned in [`.mise.toml`](.mise.toml) — that file is
the single source of truth and the only place versions should be edited.

### Available Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `bun run dev`     | Start Hugo development server  |
| `bun run dev:api` | Start the API Worker locally   |
| `bun run build`   | Build Hugo site for production |
| `bun run lint`    | Run oxlint linter              |

### Local Environment

Both services read a single gitignored `.env.local` at the repository root:

```bash
cp .env.example .env.local
```

The committed defaults work as-is for contact-form development: the form posts
to the local API Worker (`bun run dev:api`), and the Turnstile widget uses
Cloudflare's public test keys, which always pass. The production keys are
hostname-bound and do not render on `localhost`. Add `RESEND_API_KEY`,
`TO_EMAIL` and `FROM_EMAIL` only when a submission should actually send email.

### Adding Content

All Hugo commands should be run from `services/www/`:

```bash
cd services/www

# Create a regular blog post (page bundle with images/ directory)
hugo new posts/name-of-a-post

# Create a learning log post (page bundle with images/ directory)
hugo new ever-learning/name-of-a-post
```

#### Content Types

| Type         | Directory        | Archetype       |
| ------------ | ---------------- | --------------- |
| Blog posts   | `posts/`         | `default`       |
| Learning log | `ever-learning/` | `ever-learning` |

## Deployment

See [docs/deployment.md](./docs/deployment.md) for complete deployment instructions.

### Quick Overview

1. Configure GitHub secrets (`CLOUDFLARE_API_TOKEN`)
2. Configure GitHub variables (`CLOUDFLARE_ACCOUNT_ID`)
3. Set up Cloudflare Turnstile for contact form
4. Set up Resend for email delivery
5. Set the per-environment variables and secrets — see [docs/deployment.md](docs/deployment.md)
6. Push to `master` branch to trigger deployment

## Documentation

- [Deployment Guide](./docs/deployment.md) - Full deployment setup
- [Architecture Decision Records](./docs/README.md) - Project decisions

## License

All rights reserved.
