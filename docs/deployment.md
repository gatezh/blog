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
tag (`wrangler versions upload --tag`), so the dashboard's **Deployments** list
says which release every version is. **Re-run all jobs** on a release that
already tagged its commit deploys that same release again instead of bumping a
second tag onto the commit.

### Upload, then promote

Both deploy workflows run in stages, and change their environment in two
phases with Cloudflare's
[Worker versions](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/):

1. `preflight` checks the environment's variables and secrets
   (`.github/actions/check-deploy-config`) before CI or anything else runs. In
   staging it also skips CI when a pull request run already passed on exactly
   the same tree: `ci.yml`'s lint job uploads a `tested-tree-<tree hash>`
   artifact on every pull request run, and a merge commit with that tree has the
   same files. The run summary links the pull request run it relied on. Only a
   run from one of this repository's branches counts: a pull request from a
   fork runs the fork's `ci.yml`, which could upload a marker for any tree. In a
   stack of pull requests only the top one runs the browser tests and leaves a
   marker
   ([stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests)),
   so merging part of a stack runs CI in full.
2. `upload` builds www and uploads both services with `wrangler versions
upload`: new versions that serve no traffic.
3. `go-live` runs only when the upload succeeded. It reads which version each
   Worker serves at 100% (`wrangler deployments status --json`), then deploys
   each new version at **0%** beside it, api first
   (`wrangler versions deploy <new>@0% <live>@100%`). A version upload does not
   apply routes, custom domains or workers.dev, so it first runs
   `wrangler triggers deploy` (still labelled experimental) for each Worker, as
   `wrangler deploy` did. That uploads no assets (`versions upload` did), but it
   fails unless www's `assets.directory` exists, so `go-live` creates an empty
   `public/` first.
4. It then checks the staged versions on the real hostnames. Every request
   carries a
   [`Cloudflare-Workers-Version-Overrides`](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/)
   header naming both Workers, which reaches a version at 0%. An override that
   is not applied falls back to the live version without any error, so the
   checks first wait until www's `build-id` meta (the run id and attempt that
   built it) and the api's `Worker-Version` header (its `version_metadata`
   binding) both name the new versions. Not the commit: a redeploy of the live
   commit would let the live version pass for the new one. Only
   when every check passes does it promote both to 100%, api first, and confirm
   that plain requests reach them.
5. A failed check promotes nothing: visitors stay on what they had, and the
   staged versions sit at 0% until the next deploy replaces them. Only a failed
   or cancelled promote can leave something to restore, and then a step prints
   the exact `wrangler versions deploy` commands that put back what was live. A
   part-way promote leaves at most the api newer than the site, which the
   api-first order already requires to work, and re-running `go-live` finishes
   it.

Both workflows run steps 3 to 5 through one composite action,
`.github/actions/go-live`. Only the checks themselves stay in each workflow,
because they differ (staging must be noindex, production indexable). The
action's script, `go-live.sh`, is tested by `go-live.test.ts`
(`bun run test:deploy`) against stubbed wrangler and curl. The stubbed
Cloudflare applies an override only for the Worker names that
`wrangler.jsonc` deploys, so a wrong name in a workflow fails the test.

`go-live` reads what is live itself, so re-running it on any run (including an
older one, to roll back) stages beside what is live now.

While the checks run, anyone who sends the override with the staged versions'
ids reaches them, on production too. The ids are not secret: this repository's
Actions logs are public, and `upload` (wrangler's `Worker Version ID:`) and
`go-live` print them. That exposure is accepted. The staged versions are the
ones about to be promoted, built from a public commit, and the window lasts as
long as the checks, about a minute. Nothing Cloudflare offers restricts who
may send an override.

So a failed upload, for example a Cloudflare API error during the asset upload,
leaves the environment untouched: re-run the failed jobs, unless a later run
has deployed since. A failed promote never leaves the site newer than the api.

Each job adds its own runner start-up and setup (checkout, mise, `bun
install`), so a step that marks no new stage stays a step: `preflight` decides whether CI runs, `upload` changes nothing live, and
`go-live` is the one job that does. Every job below `ci` states its condition on
its direct `needs`: with the default `success()`, a skipped `ci` would skip
every job after it.

Two consequences:

- **A Worker must exist before CI can upload to it.** Cloudflare rejects
  `versions upload` as a Worker's first upload
  ([Limits → First upload](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/#first-upload)).
  Create a new Worker in the dashboard first (see the rename below).
- Wrangler runs directly (`bunx wrangler`), not through
  `cloudflare/wrangler-action`, unlike the other projects on this stack: the
  action adds `--var` only to `deploy` commands, and the version id comes from
  Wrangler's machine-readable output (`WRANGLER_OUTPUT_FILE_PATH`).

### Rolling back

A failed check promotes nothing, so it needs no rollback. A failed promote
prints the restore command in the run summary (see above). To go back from a
version that passed its checks:

- **Staging, by re-run:** re-run `go-live` on the newest successful run that
  is older than the run of the commit staging serves now. It stages that run's
  versions at 0% beside today's, checks them and promotes them; no Cloudflare
  token is needed. Read the live commit from the site itself: runs are listed
  by creation and a re-run keeps its place, so the newest successful run is
  not always the live one. GitHub re-runs only runs under 30 days old.

  ```bash
  # Add the CF-Access-Client-Id/-Secret headers once staging-www sits behind Access.
  live=$(curl -sf https://staging-www.gatezh.com/ | grep -o 'build-commit[^>]*' | grep -oE '[0-9a-f]{40}' | head -1)
  # Errors when no recent run deployed that commit: roll back by hand (below).
  gh run list --workflow deploy-staging.yml -L 30 --json databaseId,headSha,conclusion,createdAt --jq "
    (map(.headSha) | index(\"${live:?no build-commit}\")) as \$i
    | if \$i == null then error(\"no recent run deployed ${live}\") else .[\$i+1:] end
    | map(select(.conclusion == \"success\" and .headSha != \"${live}\")) | first"
  gh run rerun <run-id> --job <go-live job id>   # job ids: gh run view <run-id> --json jobs
  ```

  If `go-live`'s log says "already serves" for both Workers, that run was the
  live one and nothing changed.

  A re-run uses the workflow file from that run's own commit. A run from
  before staged deploys promotes first and verifies after, and its restore
  summary names the versions live at its own upload. You can tell such a run
  because its `go-live` has no "Stage both versions at 0% of traffic" step:

  ```bash
  gh run view <run-id> --json jobs --jq '.jobs[] | select(.name == "go-live") | .steps[].name'
  ```

  For those runs, use the instant rollback below.

- **Production, through a release:** the Release workflow with
  `action: redeploy` and an earlier version (e.g. `1.4.2`). It rebuilds that
  tag, stages and checks it at 0%, then promotes it, without re-running CI — a
  rollback must not wait on, or be blocked by, today's checks against an old
  tree. It accepts any `vX.Y.Z` tag whose commit is on `master`, including one
  pushed by hand with no GitHub release behind it. To see which release is
  live: `git tag --points-at <build-commit of https://gatezh.com/>`.
- **Instantly, either environment:** Workers & Pages → the Worker →
  **Deployments** → the version tagged with the previous release →
  **Rollback**, or `bunx wrangler rollback <version-id>` from `services/www` or
  `services/api`. No rebuild and no checks; Cloudflare keeps the last 100
  versions. Always name the version: after a run that stopped before
  promoting, a bare `wrangler rollback` picks the live one again. Roll back
  both Workers, www first, so a new site never meets an old api. The next
  deploy replaces the rollback.

### Why release-anchored production

A release is a tag you can point at, and redeploying an existing tag is a
first-class action rather than a revert commit. **Immutable releases** are on
(Settings → General → Releases), so a published release's tag cannot be moved
or deleted, and a redeploy ships what was released. That holds only for
releases published after the setting was turned on: `v0.0.1` predates it and
is not immutable, so the guarantee starts with the next release.

Neither deploy workflow cancels a running deploy (`cancel-in-progress: false`):
a deploy cancelled while `go-live` promotes can leave `www` and `api` on different
commits (a cancel during `upload` changes nothing). GitHub keeps
one pending run per group and replaces it when a newer one arrives. Staging
relies on that: a pending run has not started any job, and the newer push
already contains its commit. Staging's group includes the ref: a dispatch from
another branch joins its group before the environment's branch policy refuses
its jobs, so in a shared group it could replace a waiting `master` deploy and
then deploy nothing. Release sets `concurrency.queue: max` instead, so
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
(`wrangler versions upload --secrets-file`). A deploy only ever **adds or replaces**
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

CI cannot create a Worker (see "Upload, then promote"). Before each step, create
the new Worker in the dashboard under its exact name (**Workers & Pages →
Create**, any starter). The release then uploads into it, and `go-live`'s
`triggers deploy` attaches the custom domain from `wrangler.jsonc`.

- **API first — no downtime.** Add a `production` env block to
  `services/api/wrangler.jsonc` with `"name": "gatezh-api-production"` and a
  custom domain `api.gatezh.com`, and deploy it with a release.
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
   than Editor because per-Worker roles cannot apply to a Worker that does not
   exist yet, and the planned rename adds new Workers (created in the
   dashboard; CI then uploads to them).
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

Within a job, the token is set only on the steps that call the Cloudflare API
(the two `versions upload` steps, and `go-live`'s stage and promote), never on
the job: `bun ci` and the Hugo build run third-party npm code, and a job-level
`env` would hand it the token.

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
