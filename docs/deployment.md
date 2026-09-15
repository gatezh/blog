# Deployment Guide

This document explains the deployment architecture and setup process for gatezh.com.

## Deployment model

Two paths, deliberately different in how much ceremony they carry.

| Path                 | Trigger                    | Target     | Status                       |
| -------------------- | -------------------------- | ---------- | ---------------------------- |
| `deploy.yml`         | push to `master`           | production | **active today**             |
| `release.yml`        | manual dispatch → `v*` tag | production | available, opt-in            |
| `deploy-staging.yml` | manual dispatch            | staging    | **blocked on setup** (below) |

The target model is: `master` push → staging, release dispatch → production. The
repo is not there yet, on purpose — see [Cutover runbook](#cutover-runbook).
Nothing below changes how production deploys today.

### Why release-anchored production

A release is a tag you can point at, and redeploying an existing tag is a
first-class action (`action: redeploy`) rather than a revert commit. The
`concurrency` group does not cancel in progress: a cancelled production deploy
can leave `www` and `api` on different commits.

### Worker names

`services/www` deploys as `gatezh-com` and `services/api` as
`gatezh-com-email-worker`. Those names are historical and do not match the
directory layout. **Renaming them is a cutover, not an edit** — a renamed Worker
is a new Worker, the old one keeps serving the custom domain until the domain is
moved, and the contact form breaks in between. Only `staging` has an `env` block
in `wrangler.jsonc` for exactly this reason; there is no `production` block.

## Cutover runbook

Run these in order when you are ready to adopt the staging/release model. Each
step is independently reversible.

1. **Create the `staging` GitHub Environment.** Settings → Environments → New.
   Restrict deployments to the `master` branch.
2. **Add staging DNS.** A proxied record for `staging.gatezh.com` and
   `staging-api.gatezh.com`. The flat `staging-api` prefix rather than a nested
   `api.staging` is deliberate: the Cloudflare universal certificate covers one
   level of subdomain, so `api.staging.gatezh.com` would need an advanced
   certificate.
3. **Set staging environment variables.** `CLOUDFLARE_ACCOUNT_ID`,
   `CONTACT_WORKER_URL`, `TURNSTILE_SITE_KEY`, `TO_EMAIL`, `FROM_EMAIL`; secrets
   `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`. Every one of
   them is optional except the Cloudflare pair — the Worker degrades one feature
   at a time and the deploy job reports what is missing rather than failing.
4. **Dispatch `Deploy (staging)` manually** and confirm `staging.gatezh.com`
   serves the build. The `verify` job asserts the deployed commit matches.
5. **Enable the push trigger** in `deploy-staging.yml` (uncomment the `push:`
   block at the top) and **remove the push trigger from `deploy.yml`**. Master
   pushes now reach staging only.
6. **Dispatch `Release`** to deploy production. Confirm `gatezh.com` still
   serves and the contact form still submits.
7. **Optional, later — rename the Workers.** Add a `production` env block to both
   `wrangler.jsonc` files, deploy, move the `gatezh.com` custom domain from
   `gatezh-com` to `www-production` in the Cloudflare dashboard, repoint
   `HUGO_PARAMS_CONTACTWORKERURL`, then delete the orphaned Workers. Do this in
   one sitting; the site is split-brained until the domain moves.

Rollback at any point: re-enable the `push:` trigger in `deploy.yml`.

## Architecture Overview

This is a Bun monorepo containing:

- **services/www** - Hugo static website deployed to Cloudflare Workers
- **services/api** - Cloudflare Worker for contact form emails

Deployment is handled via GitHub Actions with path-based triggers.

## Prerequisites

Before deploying, you need:

1. **Cloudflare Account** with:

   - A registered domain (gatezh.com)
   - Access to Workers

2. **Resend Account** for email delivery (free tier: 3,000 emails/month)

3. **GitHub Repository** with Actions enabled

## Setup Steps

### 1. Create Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > My Profile > API Tokens
2. Click "Create Token"
3. Find **Edit Cloudflare Workers** and click "Use Template"
4. Under "Account Resources", select your account
5. Click "Continue to summary", then "Create Token"
6. Copy the token (you won't see it again)

### 2. Get Cloudflare Account ID

1. Go to any Zone in Cloudflare Dashboard
2. Find "Account ID" in the right sidebar under "API"
3. Copy the Account ID

### 3. Set Up Turnstile Widget

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Turnstile
2. Click "Add Site"
3. Configure:
   - **Site Name**: gatezh.com
   - **Hostname**: gatezh.com
   - **Widget Mode**: Managed
4. Copy the **Site Key** (public, goes in hugo.yaml) and **Secret Key** (private, goes in worker secrets)

### 4. Set Up Resend

1. **Create account** at [resend.com](https://resend.com)

   - Free tier includes 3,000 emails/month

2. **Add and verify your domain**:

   - Go to [Resend Domains](https://resend.com/domains)
   - Click "Add Domain" and enter `gatezh.com`
   - Add the DNS records Resend provides (SPF, DKIM, etc.)
   - Wait for verification (usually a few minutes)

3. **Create API key**:
   - Go to [Resend API Keys](https://resend.com/api-keys)
   - Click "Create API Key"
   - Name: `gatezh-com-email-worker`
   - Permission: "Sending access"
   - Copy the API key (you won't see it again)

### 5. Configure Email Destination

Set the following environment variables in the Cloudflare Dashboard under Workers & Pages > `gatezh-com-email-worker` > Settings > Variables:

| Variable     | Description                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- |
| `TO_EMAIL`   | Where to receive contact form emails (e.g., `hello@yourdomain.com`)                       |
| `FROM_EMAIL` | Sender address, must be from a domain verified in Resend (e.g., `contact@yourdomain.com`) |

> **Note:** Do not add these to `wrangler.jsonc` — values in the config file override dashboard settings on every deploy.

### 6. Configure GitHub Secrets and Variables

Go to your repository > Settings > Secrets and variables > Actions

**Secrets tab** - Add:

| Secret Name            | Description           |
| ---------------------- | --------------------- |
| `CLOUDFLARE_API_TOKEN` | API token from step 1 |

**Variables tab** - Add:

| Variable Name           | Description            |
| ----------------------- | ---------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from step 2 |

### 7. Configure Worker Secrets

Deploy the worker first to create it, then add secrets:

```bash
cd services/api

# Set Resend API key
bunx wrangler secret put RESEND_API_KEY
# Enter your Resend API key when prompted

# Set Turnstile secret key
bunx wrangler secret put TURNSTILE_SECRET_KEY
# Enter your Turnstile secret key when prompted
```

### 8. Update Hugo Configuration

After deploying the worker, update `services/www/hugo.yaml`:

```yaml
params:
  # Turnstile site key (public, safe to commit)
  turnstileSiteKey: "0x4AAAAAAA..."
  # Worker URL (get from Cloudflare Dashboard > Workers & Pages > gatezh-com-email-worker)
  contactWorkerUrl: "https://gatezh-com-email-worker.<your-subdomain>.workers.dev"
```

### 9. Deploy

Push to the `master` branch to trigger deployment:

```bash
git add .
git commit -m "Configure deployment"
git push origin master
```

A single workflow, `deploy.yml`, runs four jobs:

1. `check` — lint, format, typecheck and build, gating everything below
2. `deploy-www` — build Hugo and deploy the website Worker
3. `deploy-api` — deploy the API Worker
4. `verify` — assert the deployed site's health and indexability invariants

Both deploy jobs run on every push to `master` that is not excluded by the
workflow's `paths-ignore` list; there is no per-app path filtering.

## Monitoring Deployments

### GitHub Actions

View deployment status at:
`https://github.com/<your-org>/blog/actions`

### Cloudflare Dashboard

- **Website**: Dashboard > Workers & Pages > gatezh-com
- **API Worker**: Dashboard > Workers & Pages > `gatezh-com-email-worker`

View logs, analytics, and errors for each worker.

## Local Development

### Website (Hugo)

```bash
# From repository root
bun install
bun run dev

# Or from services/www
cd services/www
bun install
bun run dev
```

### API Worker

```bash
cd services/api
bun install

# Create .dev.vars for local testing (copy from .dev.vars.example)
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual values

# Run locally
bun run dev
```

## Troubleshooting

### Contact Form Not Working

1. Check browser console for errors
2. Verify `turnstileSiteKey` and `contactWorkerUrl` in hugo.yaml
3. Check Worker logs in Cloudflare Dashboard
4. Verify CORS settings (ALLOWED_ORIGIN in wrangler.jsonc)

### Emails Not Sending

1. Check Resend dashboard for delivery status
2. Verify domain is verified in Resend
3. Check Worker logs for Resend API errors
4. Verify RESEND_API_KEY secret is set
5. Ensure FROM_EMAIL uses a verified domain

### Build Failures

1. Check GitHub Actions logs
2. Verify all secrets are configured
3. Ensure Hugo and Bun versions match locally

## Security Considerations

- Never commit API keys or secrets to the repository
- Use environment-specific secrets (dev vs production)
- Regularly rotate API tokens
- Monitor Worker analytics for abuse patterns
- Consider rate limiting on the Worker for production
