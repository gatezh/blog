# Deployment Guide

How gatezh.com is configured and deployed.

## Deployment model

| Path                 | Trigger                    | Target     |
| -------------------- | -------------------------- | ---------- |
| `deploy-staging.yml` | push to `master`, dispatch | staging    |
| `release.yml`        | manual dispatch → `v*` tag | production |

Same model as the other projects on this stack: merging to `master` deploys
staging; production only ever runs a tagged release.

Both deploy workflows run the whole of CI (`ci.yml`: `bun run check` and
`bun run test`) on the commit they ship before deploying it, so nothing reaches
staging or production without the checks and tests a pull request runs.

**Releasing:** Actions → **Release** → Run workflow (from `master`) →
`action: create` and a bump level. It runs CI, then tags `master` and
generates release notes, deploys both Workers and verifies production. A CI
failure leaves no tag behind. Each Worker version is labelled with the release
tag (`wrangler deploy --tag`), so the dashboard's **Deployments** list says
which release every version is.

### Rolling back

- **Instantly:** Workers & Pages → the Worker → **Deployments** → the version
  tagged with the previous release → **Rollback**, or
  `bunx wrangler rollback <version-id>` from `services/www` or `services/api`.
  No rebuild; Cloudflare keeps the last 100 versions. Roll back both Workers.
  The next release replaces the rollback.
- **Through a release:** the same workflow with `action: redeploy` and an
  earlier version (e.g. `1.4.2`). It rebuilds and redeploys that tag and
  verifies it, without re-running CI — a rollback must not wait on, or be
  blocked by, today's checks against an old tree. Only tags on `master` are
  accepted.

### Why release-anchored production

A release is a tag you can point at, and redeploying an existing tag is a
first-class action rather than a revert commit. **Immutable releases** are on
(Settings → General → Releases), so a published release's tag cannot be moved
or deleted, and a redeploy ships what was released.

Neither deploy workflow cancels a running deploy (`cancel-in-progress: false`):
a cancelled deploy can leave `www` and `api` on different commits. GitHub keeps
one pending run per group and replaces it when a newer one arrives. Staging
relies on that: a pending run has not started any job, and the newer push
already contains its commit. Release sets `concurrency.queue: max` instead, so
every dispatch runs in turn, because each one names a release or a tag on
purpose.

Only the Release workflow's tagging job holds a token that can write to the
repository; every job that runs `bun install`, the build or a deploy action has
read-only access, and no checkout keeps credentials on disk.

### Worker names

`services/www` deploys as `gatezh-com` and `services/api` as
`gatezh-com-email-worker`. Those names are historical. **Renaming them is a
cutover, not an edit** — a renamed Worker is a new Worker, the old one keeps
serving the custom domain until the domain is moved, and the contact form breaks
in between. Only `staging` has an `env` block in `wrangler.jsonc` for exactly
this reason; there is no `production` block.

| Surface | staging                                                      | production                                  |
| ------- | ------------------------------------------------------------ | ------------------------------------------- |
| www     | `gatezh-com-staging` → `staging-www.gatezh.com`              | `gatezh-com` → `gatezh.com`                 |
| api     | `gatezh-com-email-worker-staging` → `staging-api.gatezh.com` | `gatezh-com-email-worker` → `*.workers.dev` |

The flat `staging-api` / `staging-www` prefixes rather than nested
`api.staging` are deliberate: the Cloudflare universal certificate covers one
level of subdomain. Workers custom domains create their own DNS records on first
deploy — there is no DNS to add by hand.

## Configuration

**The GitHub Environment is the single source of truth.** Every deploy job runs
in the `staging` or `production` environment and reads its values from there.
Nothing deployed reads `hugo.yaml`'s `apiUrl`/`baseURL` — those are
local-development defaults. Local development reads
the repo-root `.env.local` (copy `.env.example`).

> **This repository is public, and so are its Actions logs.** GitHub prints
> variable values in the logs; secret values are masked. Anything that should not
> be public — including email addresses — is a **secret**, never a variable.

### Variables

| Name                           | Used by                                           | staging                           | production                                           |
| ------------------------------ | ------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`        | every deploy (repository-level)                   | inherited                         | inherited                                            |
| `HUGO_BASEURL`                 | Hugo build — canonical, sitemap, JSON-LD          | `https://staging-www.gatezh.com/` | `https://gatezh.com/`                                |
| `HUGO_PARAMS_APIURL`           | contact form POST target, CSP connect-src         | `https://staging-api.gatezh.com`  | `https://gatezh-com-email-worker.gatezh.workers.dev` |
| `HUGO_PARAMS_TURNSTILESITEKEY` | contact form widget                               | the staging widget's site key     | the production widget's site key                     |
| `HUGO_PARAMS_POSTHOGKEY`       | PostHog analytics — optional, see docs/posthog.md | — (never plumbed into staging)    | the PostHog project token                            |
| `ALLOWED_ORIGIN`               | api Worker CORS — **required**                    | `https://staging-www.gatezh.com`  | `https://gatezh.com`                                 |
| `CLOUDFLARE_ZERO_CLIENT_ID`    | staging verify, only behind Access                | optional                          | —                                                    |

A deploy **fails** without `HUGO_BASEURL` (every URL would be localhost) or
`ALLOWED_ORIGIN` (every request would fail CORS). Everything else is optional.

### Secrets

| Name                            | Used by                                            | Notes                                                  |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`          | every deploy                                       | same token in both; see [below](#cloudflare-api-token) |
| `RESEND_API_KEY`                | contact form                                       | separate key per environment                           |
| `TO_EMAIL`                      | contact form — where submissions are sent          | a secret only to keep it out of the logs               |
| `FROM_EMAIL`                    | contact form — sender, on a Resend-verified domain | staging: use a distinct sender                         |
| `TURNSTILE_SECRET_KEY`          | bot gate — pair with the site key above            | separate widget per environment                        |
| `CLOUDFLARE_ZERO_CLIENT_SECRET` | staging verify, only behind Access                 | optional                                               |

The Worker degrades one feature at a time, and each api deploy reports what is
missing (`.github/actions/check-deploy-config`) instead of failing:

- Contact form needs `RESEND_API_KEY` + `TO_EMAIL` + `FROM_EMAIL`. Without all
  three, `POST /` returns 503.
- Bot gate needs `TURNSTILE_SECRET_KEY` + `HUGO_PARAMS_TURNSTILESITEKEY`. **Set
  both or neither** — half a bot gate either accepts submissions unverified or
  rejects every one.

Secrets go up with the code, in the same Worker version
(`wrangler deploy --secrets-file`). A deploy only ever **adds or replaces**
secrets: one GitHub does not hold is left alone on the Worker. So deleting a
GitHub secret does not remove it from the Worker — do that as well:

```bash
cd services/api && bunx wrangler secret delete TURNSTILE_SECRET_KEY            # production
cd services/api && bunx wrangler secret delete TURNSTILE_SECRET_KEY --env staging
```

## Cutover history

Production moved from push-to-deploy to tagged releases on 2026-10-03:
environments and variables configured, a staging Turnstile widget created, the
first staging deploy verified, the triggers flipped, and the zone's legacy
**CSP** Transform Rule removed so production serves the site's own policy (see
[CSP.md](CSP.md)). Production's Worker credentials were moved into the
`production` environment at the same time. After the first release
(`v0.0.1`), the untagged push-to-production workflow (`deploy.yml`) was
deleted; its post-deploy indexability checks moved into `release.yml`.

## Remaining: rename the Workers

**Rename the Workers and move the API to `api.gatezh.com`** — the
layout the other projects on this stack use. This Cloudflare account is
shared with other projects, so the names carry a `gatezh-` prefix rather than
the bare `www`/`api` a dedicated account can use.

- **API first — no downtime.** Add a `production` env block to
  `services/api/wrangler.jsonc` with `"name": "gatezh-api-production"` and a
  custom domain `api.gatezh.com`, and deploy with `environment: production`.
  The new Worker serves alongside the old one. Point production's
  `HUGO_PARAMS_APIURL` at `https://api.gatezh.com` and release; once the
  contact form submits through it, delete `gatezh-com-email-worker`.
- **www — about a minute of downtime.** The same with
  `"name": "gatezh-www-production"` and custom domain `gatezh.com`. A custom
  domain belongs to one Worker at a time, so detach `gatezh.com` from
  `gatezh-com` immediately before the release, then delete `gatezh-com`.
  Purely a rename; skip it if the name does not bother you.
- Give staging the matching names (`gatezh-api-staging`,
  `gatezh-www-staging`) in the same change, and delete the old staging
  Workers.

## Zone settings

Two settings no deploy can enforce. `release.yml` reports both on every run.

- **Always Use HTTPS** (SSL/TLS → Edge Certificates): on.
- **HSTS** (same page): off. Browsers cache it for its whole `max-age`, so
  enable it deliberately; `includeSubDomains` covers every subdomain, including
  the comments tunnel.

Also under SSL/TLS: the encryption mode should be **Full (strict)** and the
minimum TLS version **1.2**. Both are safe here — the Workers and the Remark42
tunnel do not use the zone's origin connection settings.

## Cloudflare API token

One **account-owned** token, `gatezh-github-actions`, stored as the
`CLOUDFLARE_API_TOKEN` secret in **both** GitHub Environments. An account token
survives changes to individual members; a user token (My Profile → API Tokens)
stops working if that user is removed.

Only a **Super Administrator**, or a member with the **API Token Provisioning**
role, can create one — an Administrator gets _Unauthorized to access requested
resource_ at the last step. A token can only hold a subset of its creator's
permissions.

1. [Manage Account → **Account API Tokens**](https://dash.cloudflare.com/?to=/:account/api-tokens)
   → **Create Token** → **Create Custom Token**. Not the _Edit Cloudflare
   Workers_ template: it pre-fills **Workers Scripts**, now a legacy permission.
2. Name: `gatezh-github-actions`. This account hosts other projects, so the
   name says which one it serves.
3. **Policy 1** — scope **Entire Account**: **Workers → Admin**. Admin rather
   than Editor because a deploy that creates a Worker (the first staging deploy,
   and the planned Worker rename) needs it; per-Worker roles cannot apply to
   a Worker that does not exist yet.
4. **Policy 2** — scope **Specified Domains → `gatezh.com`**: **Workers Routes →
   Edit**, which attaches custom domains. No DNS permission is needed — the
   custom domain creates its own record.
5. Leave **Client IP Address Filtering** empty (GitHub runners' IPs change) and
   expiry at your rotation preference → **Continue to summary** → **Create
   Token**. Copy it now; it is not shown again.
6. Add it as the environment secret `CLOUDFLARE_API_TOKEN` in `staging` and
   `production`. Every job that deploys names its environment, so no workflow
   reads a repository-level token — delete that one and revoke the token it held.
7. Restrict both environments' **Deployment branches** to `master`. On a public
   repository GitHub enforces this on every plan, so a pushed branch cannot
   reach the token.

**Blast radius.** Workers Admin at account scope reaches every Worker in this
shared account, not only this project's. Narrowing it to **Specified Workers**
with **Editor** is possible once every Worker the workflows deploy exists, but
the token would then fail at the planned rename, and Custom Domains do not yet
support per-Worker roles. Revisit after the rename.

Sources: [Workers roles and permissions](https://developers.cloudflare.com/workers/authorization/workers/),
[account-owned tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/).

The account ID is the repository variable `CLOUDFLARE_ACCOUNT_ID`.

## Resend

Verify `gatezh.com` at the domain level in Resend (any `*@gatezh.com` sender then
works), and create one **Sending access** API key per environment. `FROM_EMAIL`
must be on that verified domain.

## Local development

```bash
cp .env.example .env.local   # ports, plus optional Turnstile test keys and Resend
bun install
bun run dev                  # www on WWW_PORT, api on API_PORT
```

Local URLs are derived from the ports: the www dev server points the contact
form at `http://localhost:${API_PORT}`, and the api allows
`http://localhost:${WWW_PORT}` as its CORS origin.

## Troubleshooting

### Contact form not working

1. Browser console — a `Refused to connect` CSP error means the page and its
   `_headers` came from different builds, or a zone Transform Rule is overriding
   the CSP (see [CSP.md](CSP.md)). Both are built from `HUGO_PARAMS_APIURL`.
2. The deploy run's step summary — the feature table says which credential is
   missing.
3. Worker logs in the Cloudflare dashboard.

### Emails not sending

Check the Resend dashboard, that `FROM_EMAIL` is on the verified domain, and the
api Worker's logs for Resend errors.

### Build fails with "Set HUGO_BASEURL"

The deploy job's environment has no `HUGO_BASEURL`. Add it — see the variables
table above.
