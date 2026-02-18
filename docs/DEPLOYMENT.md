# Deployment Guide

This document explains the deployment architecture and setup process for gatezh.com.

## Architecture Overview

This is a Bun monorepo containing:

- **services/www** - Hugo static website deployed to Cloudflare Workers
- **services/email-worker** - Cloudflare Worker for contact form emails

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
cd services/email-worker

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

The GitHub Actions workflows will:

1. **deploy-web.yml**: Build Hugo and deploy the website to Cloudflare Workers
2. **deploy-email-worker.yml**: Deploy the email worker to Cloudflare Workers

Each workflow only runs when its respective app changes (path filtering).

## Monitoring Deployments

### GitHub Actions

View deployment status at:
`https://github.com/<your-org>/blog/actions`

### Cloudflare Dashboard

- **Website**: Dashboard > Workers & Pages > gatezh-com
- **Email Worker**: Dashboard > Workers & Pages > gatezh-com-email-worker

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

### Email Worker

```bash
cd services/email-worker
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
