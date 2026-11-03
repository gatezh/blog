# Preflight, upload and go-live: follow-up fixes — review (PR #139)

Reviewed: the uncommitted follow-up to `ci/preflight-upload-go-live` at
`b712aba`. It drops the `www-public` artifact, runs the browser tests only on
the top pull request of a stack, adds `// empty` to the id lookups, moves
`preflight` and `release` to `ubuntu-slim`, and keys staging's concurrency
group by ref. There is no plan document, so this checks the change against the
request it implements and PR #139's description.

Checked against: Wrangler 4.114.0 (installed and pinned in the root `catalog`,
latest 4.156.2), actionlint 1.7.12, `actions/upload-artifact` v7.0.2, and the
GitHub docs as of 2026-11-02.

## Review Round 1

### Summary

The change is correct and removes more than it adds: two artifact steps per
workflow go, replaced by one `mkdir -p`. Each new condition matches GitHub's
documented expression. No important findings. One minor one: the deployment
docs justify job count by billing, but this public repository is not billed for
standard runners.

### Minor

#### 1. "Each job bills at least a minute" is not true for this repository

`docs/deployment.md:68`

GitHub's runner reference says "Use of the standard GitHub-hosted runners is
free and unlimited on public repositories"
([GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
`ubuntu-slim` is in that public-repository table. What a job costs here is its
runner start-up and setup (checkout, mise, `bun install`) and the wall-clock
time those add, not money. The argument for fewer jobs still holds, but on
time. `ubuntu-slim` is still right for `preflight` and `release`: they need
only Bash, Git, jq and `gh`, and fit well inside its 15-minute job cap.

Fix: say "each job adds its own runner start-up and setup" instead of "bills".

### Nits

- The top-of-stack condition is written out three times in `ci.yml` (the job
  `if` on `test-browser` and both marker steps). YAML anchors can't join it to
  the marker steps' extra `github.event_name == 'pull_request'` term. Moving
  the marker steps into `test-browser` would leave one condition but would
  separate the marker from the lint job's checkout. Keep it as is: the request
  named those exact steps, and the comment explains the pairing.

### Native-first audit

| Custom piece                                            | Built-in checked (where)                                                                                                                                                                                                                                                                     | Verdict                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `mkdir -p services/www/public` before `triggers deploy` | A Wrangler flag to skip the check: `resolveTriggersInput` passes `args: { assets: void 0 }` to `getAssetsOptions` (`cli.js:185415`), so no CLI option reaches `validateAssetsOptions` (`:185275`). Committing a placeholder in `public/` would put a tracked file inside Hugo's build output | **Keep**: smallest way to satisfy a `statSync` |
| `www-public` upload and download (removed)              | `versions upload` already uploads the assets (`versionsUpload` → `syncAssets`, `cli.js:144895`); `triggersDeploy` (`:140386`–`:140649`) has no asset code                                                                                                                                    | **Removed**                                    |
| Top-of-stack `if:`                                      | GitHub's documented `stack.position == stack.size` ([stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests)); `stack == null \|\|` is its complement for non-stacked PRs                             | **Keep**: canonical                            |
| `.version_id // empty`, `.workflow_run.id // empty`     | jq's alternative operator                                                                                                                                                                                                                                                                    | **Keep**: canonical                            |
| `deploy-staging-${{ github.ref }}`                      | Workflow `concurrency.group` expressions                                                                                                                                                                                                                                                     | **Keep**: canonical                            |

### Checked and correct

- **`triggers deploy` with an empty `public/`.** `validateAssetsOptions` only
  calls `statSync`. `resolveAssetOptions` reads `_headers`/`_redirects` only if
  present, and the route validation reads only `directory` and `routerConfig`.
  A local `wrangler triggers deploy --env staging --dry-run` with www's config
  fails with "does not exist" without `public/` and exits 0 with an empty one.
  The check runs before the dry-run exit.
- **Stack fields.** `position` is 1-based from the bottom and `size` is the
  stack's length (GitHub docs). The REST API returns them for the open stack's
  four PRs (1–4 of 4) and `null` for #139. A size-1 stack runs everything.
  Under `workflow_call`, `github.event` is the caller's push or dispatch
  payload, so `pull_request` is null and the deploy's CI runs every job.
- **Marker and browser tests use the same condition**, from the same event
  payload, so no run can leave a marker without its browser tests. Partial
  stack merges therefore run CI in full on staging.
- **Required checks.** `master` has no branch protection and no rulesets, so a
  skipped `Test (Browser)` on a lower PR blocks nothing.
- **`ubuntu-slim`.** Its image has Bash, Git, jq, the GitHub CLI and Node
  (actions/runner-images, `images/ubuntu-slim`). `preflight` (bash
  `check-deploy-config`, `gh api`) and `release` (checkout, git, `gh release`)
  need nothing else, and `timeout-minutes: 5` is under the 15-minute cap.
  actionlint 1.7.12 accepts the label.
- **Concurrency.** No other workflow uses the `deploy-staging` group. A
  dispatch from `master` shares the push group (`refs/heads/master`).
- **No leftover references** to `www-public` outside review records and ADRs.
- **Security.** No new inputs, secrets or permissions. Steps get no new
  tokens.

## Round 1 resolution

| #   | Status | What was done                                                                                                                                                           |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fixed  | `docs/deployment.md` now says each job "adds its own runner start-up and setup" instead of "bills at least a minute". `ubuntu-slim` stays on `preflight` and `release`. |
| Nit | Kept   | The top-of-stack condition stays written out on `test-browser` and both marker steps, as the nit recommends.                                                            |
