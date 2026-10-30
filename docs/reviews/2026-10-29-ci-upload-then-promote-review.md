# Upload, then promote — review (branch `ci/upload-then-promote`, no PR yet)

Reviewed: commit `535a922` ("ci: upload both Workers as versions, then promote
them together") on top of the #125 merge. It changes
`.github/workflows/deploy-staging.yml`, `.github/workflows/release.yml`,
`docs/deployment.md`, `docs/seo.md` and `.claude/rules/deployment.md`. There is
no plan or spec document, so the review measures the change against its commit
message and the "Upload, then promote" section it adds to `docs/deployment.md`.

Versions every finding was checked against:

- **Wrangler 4.114.0** (`bun.lock`, catalog pin). Behaviour was read from the
  installed bundle, `node_modules/wrangler/wrangler-dist/cli.js`. The latest
  published version is 4.155.0.
- **cloudflare/wrangler-action v4.1.3** (`953926a`, the SHA the old steps
  pinned). Read with `gh api`.
- **actionlint 1.7.12**, with shellcheck present on the PATH.

## Review Round 1

### Summary

The design is right and should stay. Uploading both Workers as inactive
versions and promoting them only when both uploads succeed is the canonical use
of Worker versions. It removes the failure that split v0.1.0: a Cloudflare
outage on `assets-upload-session` (workers-sdk#16447, server-side, still open,
and not fixed by any Wrangler release). Every Wrangler flag and output the
workflows rely on exists in 4.114.0 and behaves as the comments say.

Three problems matter:

1. **The rollback command is missing in the failure where it matters most.**
   Verify prints it only for checks that set `fail=1`. A build-commit mismatch
   or a failed fetch exits before the print.
2. **The automatic rollback can leave the split it exists to prevent.** The one
   realistic partial promotion is "api promoted, www failed". Rollback calls www
   first, and `set -e` then skips the api restore.
3. **No CI path can create a Worker or apply a route any more.** The planned
   Worker rename depends on both. The docs' remedy, "a one-off
   `wrangler deploy`", contradicts the project's rule that only GitHub Actions
   deploys.

### Important

#### 1. A failed build-commit check or fetch skips the rollback command

`.github/workflows/release.yml:352-355`, `:443-456`;
`.github/workflows/deploy-staging.yml:243-245`, `:297-310`

The run summary gets the "Verification failed" block only at the end of the
script, inside `if [ "${fail}" != "0" ]`. Two paths fail the step without
reaching it:

- **The build-commit poll.** It runs `exit 1` directly
  (`release.yml:354`, `deploy-staging.yml:245`). This is the one check about
  the deploy itself, and so the one case where rolling back actually helps. The
  commit message says "a failure prints the exact rollback command".
- **Any `fetch` failure.** The step runs under `bash -eo pipefail`, so for
  example a CORS preflight that returns a 5xx after three retries exits through
  `set -e`.

Verified by reading both scripts. All other checks go through `fail=1`.

**Fix (native):** restore the original last line
(`[ "${fail}" = "0" ] || exit 1`). Move the summary block into its own step
with `if: failure()`, which GitHub runs whenever an earlier step in the job
failed, however it exited:

```yaml
- name: Print the rollback command
  if: failure()
  env:
    WWW_PREVIOUS: ${{ needs.upload-www.outputs.previous }}
    API_PREVIOUS: ${{ needs.upload-api.outputs.previous }}
  run: |
    {
      echo "## Verification failed — nothing was rolled back"
      ...
    } >> "$GITHUB_STEP_SUMMARY"
```

The diff gets smaller, and the main script goes back to being only checks.

#### 2. Rollback restores www first, so a www failure skips the api restore

`.github/workflows/release.yml:471-497`;
`.github/workflows/deploy-staging.yml:316-342`

Promote runs api first, then www. So a part-way failure almost always means:
api is on the new version, and www's `versions deploy` failed. #16447's reports
show this kind of failure can be specific to one Worker and last for hours.

The rollback step then:

1. Calls www first. www was never changed, so this is a no-op deployment
   request to the same Worker API that just failed. It can fail again.
2. Exits on that failure under `set -e`, so the api restore never runs.

The result is api on the new release and www on the old one, which is the split
the PR sets out to prevent. `docs/deployment.md:49` promises they "never stay
on different releases".

Wrangler confirms the mechanism. `versions deploy` creates the deployment
before it syncs the non-versioned settings (`cli.js:360398-360413`), and any
failure exits non-zero. The step has no `|| true`, and there is no second
attempt.

The split it leaves is the benign one. "api first: the new site may post to an
api change, never the reverse" already requires every api change to work with
the old site. That observation is the basis for the recommendation.

**Recommendation: delete the `rollback` job in both workflows.** On a failed
`promote`, print the same rollback command that verify prints, with the
`if: failure()` step from #1. The reasons:

- The split state is already safe by the api-first rule.
- `versions deploy <id>@100%` is idempotent, so **Re-run failed jobs**
  completes the promotion once the API recovers.
- An automatic rollback depends on the same API that just failed.

This matches the PR's own decision for verify ("for a person to decide"). It
removes about 50 lines across the two workflows and the `SC2086` disables, and
the docs' guarantee becomes true when reworded to "a failed promote never
leaves the site newer than the api".

If an automatic rollback must stay, make it restore only what changed. Before
each `versions deploy`, compare `deployments status --json` with the recorded
`previous` and skip the call when they are equal. Keep the order www then api,
so a still-new www never meets an old api.

#### 3. No CI path can create a Worker or apply a route

`docs/deployment.md:55`, `:193-205`, `:239-242`;
`release.yml` / `deploy-staging.yml` upload steps

`wrangler deploy` applied routes, custom domains and `workers_dev` from
`wrangler.jsonc` on every run, and could create a Worker that did not exist
yet. The new flow can do neither:

- **New Workers fail at the first step.** `wrangler deployments status` throws
  `The Worker <name> has no deployments.` (`cli.js:360756`) for a Worker
  without a deployment, and the step runs under `bash -eo pipefail`. So the
  upload job fails for any new Worker. That includes the "Remaining: rename the
  Workers" plan, which says "deploy with `environment: production`". It also
  includes the token paragraph's "a deploy that creates a Worker (the first
  staging deploy, and the planned Worker rename)".
- **Routes are no longer applied.** `versions upload` does not apply triggers.
  Wrangler's own output says so (`cli.js:145119`: "Changes to triggers (routes,
  custom domains, cron schedules, etc) must be applied with the command
  `wrangler triggers deploy`"). The rename's `api.gatezh.com` custom domain is
  exactly such a change.
- **The documented remedy breaks a project rule.** "A one-off
  `wrangler deploy`" means a local deploy. `.claude/rules/deployment.md` and
  `docs/deployment.md` say there is deliberately no local deploy, because a
  local build reads `.env.local` (a localhost `baseURL` and the test Turnstile
  keys).

**Fix:**

1. In `promote`, after each `versions deploy`, run
   `bunx wrangler triggers deploy --cwd services/<svc> --env <env>`. This is
   what Wrangler's own message prescribes alongside `versions upload`, and it
   keeps routes config-driven as `wrangler deploy` did. It reads the same
   top-level config, so production (no `routes`, `workers_dev` unset) is
   treated exactly as the old deploy treated it. The command is still labelled
   _experimental_ in 4.114.0 (`cli.js` `triggersDeployCommand`), but it is
   maintained (fixed in 4.x, see `wrangler-CHANGELOG`, #14897). Say so in the
   docs.
2. Let the upload step record an empty `previous` when the Worker has no
   deployment yet, matching `has no deployments` rather than ignoring every
   error. The hint (and the rollback, if kept) then skips an empty `previous`.
3. **Unverified:** whether `versions upload` itself can create a Worker. The
   bundle posts to `/workers/scripts/<name>/versions` and has no local guard.
   Check it on the staging half of the rename first. Then rewrite "Remaining:
   rename the Workers" and the token paragraph to describe whichever path
   works.

### Minor

#### 4. `services/api/wrangler.jsonc` comments still describe the old deploy

`services/api/wrangler.jsonc:26`, `:32`

These two lines are not in the diff and are now wrong:

- "uploaded with the code via `wrangler deploy --secrets-file`" should say
  `versions upload --secrets-file`.
- "Vars (passed via wrangler-action `vars:`)" should say `--var` in the upload
  step.

#### 5. Release `rollback` checks out a different commit from `promote`

`.github/workflows/release.yml:286-292` vs `:478-481`

`promote` checks out `needs.release.outputs.commit_sha`, and `rollback` checks
out the workflow's own commit. The difference matters because `versions deploy`
reads more than the Worker name from the config. After deploying, it pushes
`observability`, `logpush` and `tail_consumers` from that config
(`maybePatchSettings`, `cli.js:359969-359996`). So on a redeploy of an older
tag, the two jobs push different settings. Removing the job (#2) makes this
moot. If the job stays, check out `commit_sha` in it too.

#### 6. "Re-run all jobs" after a failed verify points the hint at the new versions

`release.yml` upload steps; `docs/deployment.md:20-27`

`previous` is recorded when the upload runs. Suppose promote succeeded and
verify failed, and then someone uses "Re-run all jobs". The docs suggest that
on a release, to deploy the same tag again. The upload jobs then record the
just-promoted versions as `previous`, and the printed rollback command restores
nothing. Add one line to "Rolling back": after a failed verify, use **Re-run
failed jobs**, or roll back by release tag in the dashboard.

### Nits

- The "record `previous`, upload, parse `version_id`" block is copied four
  times (two services × two workflows), and the jq filter is the part that will
  drift. A small composite action next to `check-deploy-config` would hold it
  once. This is optional, since the two workflows already duplicate `verify`
  wholesale.
- `.claude/rules/deployment.md:36`: "Routes are not" breaks the line early.
  Re-wrap the bullet.
- `.github/workflows/deploy-staging.yml:129`: the reworded comment line runs
  past the file's wrap width. Re-flow the paragraph.
- `--yes` on `versions deploy` with positional specs is redundant: specs
  already accept prompt defaults (`cli.js:360322`). It is harmless and states
  the intent, so keep it.

### Native-first audit

| Custom piece                                       | Built-in checked (where)                                                                                                                 | Verdict                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Two-phase upload → promote                         | Worker versions and deployments (CF docs, linked in `release.yml`); `versions upload` / `versions deploy`, Wrangler 4.114.0              | **Keep**: canonical                                   |
| `bunx wrangler` instead of wrangler-action         | Action `src/wranglerAction.ts:366-369` adds `--var` only to `deploy`/`publish`/`preview`; `action.yml` outputs have no version id        | **Keep**: the stated reasons are true                 |
| Version id via `WRANGLER_OUTPUT_FILE_PATH` + jq    | `writeOutput({ type: "version-upload", version_id })`, `cli.js:361543`                                                                   | **Keep**: documented machine output                   |
| Promote by id, not `--version-tag`                 | `--version-tag` exists in 4.114.0 and throws when a tag matches more than one version (`resolveTagsToVersions`)                          | **Keep**: re-runs and redeploys create duplicate tags |
| Record `previous` with `deployments status --json` | `wrangler rollback` (one version only, and steps back from the latest deployment, which would move an unchanged www to an older version) | **Keep** the recording; see #3 for new Workers        |
| `rollback` job                                     | Idempotent re-run of `promote` + the api-first rule                                                                                      | **Remove** (#2)                                       |
| Rollback hint inside the verify script             | Step-level `if: failure()`                                                                                                               | **Replace** (#1)                                      |
| `--env=""` for production                          | Wrangler's own multi-env warning recommends it (`cli.js:237990`)                                                                         | **Keep**: canonical                                   |
| "One-off `wrangler deploy`" for routes             | `wrangler triggers deploy`                                                                                                               | **Replace** (#3)                                      |

### Upgrade opportunities

Wrangler 4.114.0 → 4.155.0. Bump `compatibility_date` together with it, as the
config comments require.

- **4.132.0:** asset uploads retry 502/503/504 more patiently (lower
  concurrency, longer waits).
- **4.149.0:** asset uploads honour `Retry-After`.

Both make a transient upload failure less likely. Neither covers #16447's
500/10013. The 4.153.0 dotenv expansion in `--secrets-file` applies to dotenv
files only; the JSON file used here is unaffected.

### Checked and correct

- **Secrets:** `versions upload --secrets-file` always inherits secrets the
  file omits (`keepSecrets: true`, `cli.js:~144930`). So "a deploy only ever
  adds or replaces secrets" still holds.
- **Reading the live state:** `deployments status --json` prints the raw
  deployment with `versions[].version_id` / `percentage`, and suppresses the
  banner under `--json`. The jq filter and the `id@N%` spec format match what
  `versions deploy` parses.
- **`--cwd`:** a global flag in 4.114.0 (`cli.js:366530`).
- **Non-versioned settings:** `observability`, `logpush` and `tail_consumers`
  are synced by `versions deploy` (`maybePatchSettings`). So the docs only
  needed to name triggers as not applied.
- **Job conditions:** promote runs only when both uploads succeed; verify only
  when promote succeeds; rollback only on promote failure, not on cancel. Each
  matches the comments.
- **Security:** the release version and SHA now reach Wrangler through `env:`
  instead of `${{ }}` inside the command, which removes an expression-injection
  path. The token sits only in the env of the steps that call Wrangler. The
  secrets file is still `umask 077` and deleted with `if: always()`. Version ids
  in the public summary are not sensitive.
- **Lint:** actionlint 1.7.12 with shellcheck passes on both workflows.
- **Cost:** two extra short ubuntu jobs per run, free on a public repo.

## Round 1 resolution

Fixed in `1b85428` (workflows, docs, rules) and `29055a6` (api config comments).
`bun run check` passes, including actionlint with shellcheck.

`bun run test`: 321 passed, 5 failed. All five failures are `seo.spec.ts`
whole-site crawls (sitemap, descriptions, trailing slashes, related posts) that
time out at 30 s. The sitemap test fails the same way on the base checkout
(`d080ffb`), and this change touches no file the Hugo build reads, so these
failures predate it and come from this container.

| #                          | Outcome                    | What was done / why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1                          | Fixed                      | The verify scripts end with `[ "${fail}" = "0" ] \|\| exit 1` again. A new `rollback-command` job prints the commands when `promote` or `verify` fails, gated on `needs.<job>.result == 'failure'`. That covers the early `exit 1` and any failed fetch. A separate job rather than an `if: failure()` step, so one job covers both promote and verify.                                                                                                                                                                                                                                                                                                                                                                                          |
| 2                          | Fixed (recommended option) | Re-checked: the api-first comment states the invariant the split relies on. The `rollback` job is removed from both workflows, along with its `SC2086` disables. The printed command restores www first. Docs: "a failed promote never leaves the site newer than the api".                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3                          | Fixed, in part changed     | `promote` now runs `wrangler triggers deploy` after each `versions deploy`. It calls the same `triggersDeploy()` that `wrangler deploy` called (`cli.js:144831` vs `:356177`). A dry run with `--env staging` and `--env=""` succeeds with only the "experimental" warning. Re-checking changed part 2: Cloudflare's docs say `versions upload` "the first time you upload a Worker will fail" (Deployment management → Limits → First upload). That also answers the unverified part 3. So tolerating "has no deployments" would be dead code. The docs instead create a new Worker in the dashboard before its first release, and "Remaining: rename the Workers" and the token paragraph now say so. No local `wrangler deploy` is suggested. |
| 4                          | Fixed                      | `services/api/wrangler.jsonc` comments now name `versions upload --secrets-file` and `--var`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5                          | Moot                       | The `rollback` job is gone (#2). `rollback-command` checks out nothing and reads no config.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6                          | Fixed                      | "Rolling back" says to use **Re-run failed jobs** after a failed verify, and why.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Nit: composite action      | Not done                   | The copied block is three lines. A composite action would have to carry `--env=""` and the api's `--secrets-file`/`--var` through string inputs, which is more fragile than the duplication.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Nit: rules wrap            | Fixed                      | The bullet was rewritten (and now describes the new flow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Nit: staging comment width | Fixed                      | Re-flowed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Nit: `--yes`               | Kept                       | As recommended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
