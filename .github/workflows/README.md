# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated CI/CD.

## Workflows

### `deploy-worker.yml` - Worker Deployment

Automatically deploys the Cloudflare Worker when changes are pushed to the `worker/` directory.

**Triggers:**
- Push to `master` branch with changes in `worker/**`
- Pull requests with changes in `worker/**`

**Steps:**
1. Checkout code
2. Setup Bun runtime
3. Install worker dependencies
4. Run tests
5. Deploy to Cloudflare Workers (only on push to master)

**Required Secrets:**

Add the following secret to your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add: `CLOUDFLARE_API_TOKEN`

**Getting your Cloudflare API Token:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template or create custom token with:
   - Permissions:
     - Account → Workers Scripts → Edit
     - Account → Workers KV Storage → Edit (if using KV)
   - Account Resources: Include → Your Account
4. Copy the token and add it as `CLOUDFLARE_API_TOKEN` secret in GitHub

**Deployment Behavior:**

- **Pull Requests**: Runs tests only (no deployment)
- **Push to master**: Runs tests and deploys if tests pass
- **Other branches**: Only triggers if `worker/` files change

**Manual Deployment:**

You can also trigger deployment manually:
```bash
cd worker
bun run deploy
```
