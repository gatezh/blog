# PR #97 stack — review (PRs #97 → #117 → #119 → #121 → #122 → #123 → #124 → #125)

Reviewed the eight open PRs **as pushed** on GitHub, `master` (`32d4018`) to the top of
the stack (`8de6014`), in a detached worktree pinned to that commit. No plan or spec covers
this stack, so the review checks the code against the PR descriptions, ADR-005 and
`.claude/rules/*`.

| PR   | Branch                                      | Range              |
| ---- | ------------------------------------------- | ------------------ |
| #97  | `fix/local-turnstile-dev`                   | `32d4018..69cab0e` |
| #117 | `feat/canonical-turnstile-posthog`          | `69cab0e..a6be948` |
| #119 | `feat/identity-hub`                         | `a6be948..a101b6f` |
| #121 | `fix/static-assets-only`                    | `a101b6f..6ffb447` |
| #122 | `ci/harden-release-workflows`               | `6ffb447..95b982e` |
| #123 | `chore/devcontainer-credentials-and-skills` | `95b982e..bf5f505` |
| #124 | `chore/bun-1.4-parallel-tests`              | `bf5f505..12eebd4` |
| #125 | `seo/product-engineer-positioning`          | `12eebd4..8de6014` |

During the review, a local, unpushed amendment of #124 appeared (`0306318`, with #125
restacked as `c189c6e`). It bumps `@types/bun` to 1.4.4 and adds
`minimumReleaseAgeExcludes = ["@types/bun", "bun-types"]`. This round does not review that
amendment, apart from finding 22.

**Installed versions checked against** (latest published version in brackets):

- Hugo extended 0.164.0 (0.169.0)
- Bun 1.4.4
- wrangler 4.114.0 (4.155.0), `compatibility_date` 2026-07-29
- @playwright/test 1.61.1 (1.64.1)
- TypeScript 7.0.2
- Tailwind 4.3.3
- oxlint 1.75.0 (1.90.0), oxfmt 0.60.0 (0.75.0)
- @types/bun 1.4.3
- gotmplfmt v0.4.1
- Claude Code 2.1.312 (devcontainer image)
- GitHub Actions pins: checkout v7.0.1, cache v6.1.0, wrangler-action v4.1.3,
  mise-action v4.3.0. All four SHAs match their tags.

**Probes run:**

- `bun run check` on `8de6014`: exit 0.
- Hugo builds in production, in staging, and in production with the test keys. All JSON-LD
  blocks parsed: 0 failures.
- `wrangler dev --local` (assets only) with `curl -I`, plus Chromium (Playwright and
  agent-browser) listening for `securitypolicyviolation`.
- actionlint 1.7.12 and zizmor 1.31.1: clean.
- shellcheck: clean.
- Bun 1.4.4 `minimumReleaseAge` install probes.
- Public GitHub API for job timings, caches, environments and releases.

## Review Round 1

### Summary

The stack is sound and worth merging. Two pieces of its architecture are well chosen:
assets-only Workers with a Hugo-generated `_headers`, and a CI that runs before every deploy
through `$/` composite actions. Both are the platform's own mechanisms, and each was
verified against the docs and by probes. No security problem blocks the merge: least
privilege, SHA pins, secret handling and the CSP's coverage of the 404, 301 and 304
responses all check out.

Four Important findings, all fixable in a few lines:

1. One of #125's headline features never renders.
2. #121's GA policy is behind Google's current doc and blocks GA's fallback beacon.
3. `bun run test` cannot pass in the sandbox devcontainer.
4. #123 re-declares plugin configuration in two places when the image's managed settings
   or project settings already own it.

The Minor findings are mostly native-first trims in CI and the devcontainer, plus a few
tests and docs that claim more than they check.

### Important

#### 1. Article `keywords` and `article:tag` never render (#125)

`services/www/layouts/_partials/seo.html:86-90`, `services/www/themes/terminal/layouts/_partials/head.html:61-63`

Both read `.GetTerms "tags"`, but no content file has `tags:` front matter (0 files). Twelve
use `keywords:` and a few old posts use `categories:`. In the production build, no post's
Article JSON-LD contains `keywords` and no post emits `article:tag`. A probe post with
`tags:` gets both, so the code works but has nothing to read. The PR body says "Article
gains … `keywords` (from its tags). Posts emit `article:section` / `article:tag`". Only
`article:section` is true.

**Fix:** use Hugo's built-in [`.Keywords`](https://gohugo.io/methods/page/keywords/),
which returns `[]string` from the `keywords` front matter:

```go-html-template
{{ with .Keywords }}{{ $article = merge $article (dict "keywords" .) }}{{ end }}
{{ range .Keywords }}<meta property="article:tag" content="{{ . }}">{{ end }}
```

Also:

- Drop the hand-built loop and the arbitrary `first 6`.
- Add a test that a known post has a non-empty `keywords` and at least one `article:tag`,
  so this can't silently go dead again.
- Switch `head.html:45` (`.Params.keywords | default …`) to `.Keywords` too. Hugo 0.169
  deprecates `.Params.keywords`.

#### 2. The GA4 policy doesn't match Google's current doc, so the fallback beacon is blocked (#121)

`services/www/layouts/home._outputformat_headers_.txt:81` (comment at `:11-14`), `docs/CSP.md:22-23`

The template comment says it follows "Google's documented GA4 policy". It doesn't. The
template's `connect-src` is
`https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com`.
[Google's guide](https://developers.google.com/tag-platform/security/guides/csp), "GA4
without any Ads features", currently says
`connect-src https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com`.

**Probe:**

- When the primary hit to `www.google-analytics.com/g/collect` fails (route aborted), gtag
  retries at `https://www.google.com/g/collect`.
- The CSP blocks that retry. This happened in 9 of 9 runs, across `/`, `/contact/` and a
  post.
- Replacing `*.analytics.google.com` with `*.google.com` removes the violation.

In production this affects visitors whose google-analytics.com request fails (filter
lists, flaky networks). Their hit is lost and a violation fires.

**Fix:** in `$connect`, replace `https://*.analytics.google.com` with `https://*.google.com`.
It is a superset. Update CSP.md to match. Finding 7 adds the test that would have caught
this.

#### 3. `bun run test` can't pass in the sandbox devcontainer (#117 test, #123 allowlist)

`.devcontainer/claude-sandbox/allowed-domains.txt`, `services/www/tests/assets.spec.ts:200-227`

The Turnstile test loads the real `https://challenges.cloudflare.com/turnstile/v0/api.js`
and waits for a real token. It stubs only GA, PostHog and the local API. The image's
firewall defaults allow npm, Anthropic, the VS Code hosts, MDN and GitHub's meta ranges.
They don't allow Cloudflare. So in the sandbox variant, `bun run test`, which `CLAUDE.md`
requires before finishing any change, fails.

**Fix:** add `challenges.cloudflare.com` to `allowed-domains.txt` with the comment
`# Playwright Turnstile test (services/www/tests/assets.spec.ts)`.

#### 4. Plugin configuration is declared in places the image or project settings already own (#123)

`.claude/settings.json:21-26,28-33,36-38`, `.devcontainer/init-plugins.sh:20-39,50-54,94-96,107-124`

| Piece                                                                              | Who already owns it                                                                                                                                                                                                                          | Evidence                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gatezh` marketplace + `dev@gatezh` (in `settings.json` **and** `init-plugins.sh`) | The image's `/etc/claude-code/managed-settings.json`, which declares both and force-enables `dev@gatezh`                                                                                                                                     | Verified in this container. Upstream README: "No per-project setup or init-plugins.sh entry". When two files define the same marketplace name, the highest-precedence entry wins whole ([settings reference](https://code.claude.com/docs/en/settings-reference)) |
| `typescript-native-lsp` (in `settings.json` **and** `init-plugins.sh`)             | Project `extraKnownMarketplaces` + `enabledPlugins`. A plugin listed by relative path loads from the marketplace copy once the folder is trusted ([plugins/org](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)) | Marketplace lists it at `source: "./"`                                                                                                                                                                                                                            |
| `DISABLED_PLUGINS` loop                                                            | `settings.json:38` already sets `typescript-lsp@claude-plugins-official: false`, and project settings outrank user settings                                                                                                                  | settings reference, `enabledPlugins`                                                                                                                                                                                                                              |
| 17 lines of `jq` that seed `cleanupPeriodDays`                                     | The `cleanupPeriodDays` key, scope "Any file"                                                                                                                                                                                                | settings reference                                                                                                                                                                                                                                                |

**Fix:**

- Remove the `gatezh` and `dev@gatezh` lines from `init-plugins.sh`. That matches upstream
  exactly.
- Remove them from `settings.json` too, unless you want people who clone this **public**
  repo and run Claude Code on the host to be offered your personal marketplace.
- Keep `typescript-native-lsp` only in `settings.json`, add `"autoUpdate": true` (third-party
  marketplaces default to false), and delete its `init-plugins.sh` lines and the
  `DISABLED_PLUGINS` block.
- Move `cleanupPeriodDays: 365` into `settings.json`.

This removes roughly 40 lines of shell. The OAuth race the script works around
(gatezh/devcontainers#58) doesn't apply to settings files. A wider change would be a
declarative `settings.json` replacing almost all of `init-plugins.sh`; only `posthog` and
`superpowers` use external sources. Propose that upstream rather than diverge here.

### Minor

#### 5. A local `bun run deploy` now ships the always-pass Turnstile key (#97 makes an older hazard worse)

`.env.example:40-41`, `services/www/package.json:9`, `package.json:21-23`

`services/www` `deploy` runs `bun run build && bunx wrangler deploy`, and `build` reads
`../../.env.local`. With the test keys now on by default, a local deploy bakes
`1x00000000000000000000AA` into production HTML. The production secret rejects dummy
tokens, so the contact form breaks. That path already shipped a localhost `baseURL`.

CI is unaffected:

- `.env.local` is gitignored.
- Bun ignores a missing `--env-file` (probe: rc 0).
- Process env beats the file (probe), so GitHub Environment values win.

The keys themselves match [Cloudflare's testing doc](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

**Fix:** delete the local `deploy` / `deploy:*` scripts. `.claude/rules/deployment.md`
already makes deploys CI-only, so also update its lines 13, 18 and 22 and `README.md:46`.

#### 6. The CSP tests send real page views to the production GA property (#117, moved by #121)

`services/www/tests/assets.spec.ts:166-176`

The "raises no CSP violations" loop stubs PostHog but not GA. The assets project builds in
production, so the real `gtag.js` loads, and every CI run sends `page_view`s from
`127.0.0.1` to `G-96MLGN850Y`. The two vendor-snippet tests at `:186` do stub GA, so the
file is inconsistent.

**Fix:** in that loop, add `await stub(page, "https://*.googletagmanager.com/**")` and
`page.route("**/g/collect**", r => r.fulfill({ status: 204 }))`, or a shared `beforeEach`.

#### 7. The CSP tests only see first-hop requests, but their comment claims full coverage (#117/#121)

`services/www/tests/assets.spec.ts:164-165`, `docs/CSP.md` ("Adding a third-party service", step 3)

The comment says "A violation is reported before any network fetch, so this holds offline
too." That is true only for the top-level `<script src>`. Second hops (GA's beacons and
fallback, PostHog's recorder and `worker-src`) never run, either because `array.js` is
stubbed empty or because the primary GA hit succeeds. That is how finding 2 got past these
tests: the committed spec passed 5/5 against a build where finding 2 reproduces.

**Fix:**

- Add one test that aborts the primary `/g/collect` request and asserts no violation.
- Reword the comment and CSP.md step 3 to say what the tests prove: the first hop is
  allowed.

#### 8. Production CSP violations go nowhere (#121)

`services/www/layouts/home._outputformat_headers_.txt:83-86`

Moving from a nonce to a host allowlist makes vendor drift the main way this policy fails,
as finding 2 shows. Nothing reports it.
[PostHog ingests CSP reports](https://posthog.com/docs/csp-tracking), and PostHog is
already in the stack.

**Fix:** inside the existing `if site.Params.posthogKey` branch, append
`report-uri https://us.i.posthog.com/report/?token=<key>; report-to posthog` and emit a
`Reporting-Endpoints: posthog="…"` header. The token is public by design.

#### 9. `params.mainSections` is the legacy spelling (#125)

`services/www/hugo.yaml:180`, `services/www/layouts/home.rss.xml:6`

Hugo 0.164's `config/allconfig/alldecoders.go:298-300` says: "Before Hugo 0.112.0 this was
configured via site Params". Hugo copies the value to the top-level key, and the fallback
still exists in 0.169. The current docs use top-level `mainSections` read through
[`site.MainSections`](https://gohugo.io/methods/site/mainsections/). Their example is this
exact RSS filter.

**Fix:**

- Move the key to the top level and use `site.MainSections` in `home.rss.xml`. Probe: same
  11 items, no warnings.
- The `llms*.txt` templates hard-code the same two sections
  (`llms._outputformat_llmtext_.txt:27,30`, `llms-full…:28-29`) and could range over
  `site.MainSections`.
- The `eq .Section "posts"` checks that decide Article JSON-LD and `og:type article`
  (`seo.html:71`, `head.html:50,56`) define "article" differently from `mainSections`. See
  nit 32.

#### 10. The title and description length test skips posts, the pages that break the rule (#125)

`services/www/tests/seo.spec.ts:112-124`

The test covers only the five structural pages. In the production build:

- 6 of 10 post `<title>`s are 62–95 characters.
- The Docker post's description is 185 characters, which breaks `.claude/rules/seo.md`
  ("under 160 characters").

**Fix:**

- Drive the description check from the sitemap, and fix the Docker post.
- Decide whether the 60-character title limit applies to posts. If it does, add a
  `<title>` override such as `params.seoTitle`; if not, say so in the test.
- The assertion is `toBeLessThan(160)` but the message says "over 160". Pick one.

#### 11. `queue: max` on staging adds a queue and no safety (#122)

`.github/workflows/deploy-staging.yml:20-26`, `docs/deployment.md:46-47`

The comment says cancelling "can leave www and api on different commits". With
`cancel-in-progress: false`, the default `queue: single` never cancels a _running_ deploy.
It only replaces a _pending_ run, which hasn't started any job
([changelog 2026-05-07](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/)).

With `max`, merging this stack one PR at a time deploys every intermediate commit in turn,
each after about 4 minutes of CI: roughly 30 minutes of queue to reach the state the last
merge already describes.

**Fix:** drop `queue: max` from staging and correct the deployment.md rationale. Keep it on
`release.yml`, where every dispatch is deliberate.

#### 12. The mise binary that installs Bun and Hugo is unpinned (pre-existing; now in #122's composite)

`.github/actions/setup/action.yml:10`

`jdx/mise-action@v4.3.0` without `version` downloads the latest mise with no checksum. It
runs in the jobs that hold `CLOUDFLARE_API_TOKEN`. That contradicts the reason
`dependabot.yml` gives for SHA pins ("they run next to the Cloudflare deploy token") and the
7-day release gate.

**Fix:**

- Set `with: { version: <exact>, sha256: <…> }`.
- Commit a `mise.lock` (`mise lock`). The action then adds `--locked`, which pins tool URLs
  and checksums.
- mise-action v5 (2026-09-28) adds a 24-hour minimum age by default. Dependabot will offer
  it.

#### 13. `wrangler-action` wraps one command and adds nothing this repo uses (#122)

`deploy-staging.yml:71-81,130-142`, `release.yml:157-167,211-222`

For a Workers `deploy`, the action's only extra is a `deployment-url` output, which nothing
reads. GitHub deployments and job summaries are created for Pages only (the action's
`commandOutputParsing.ts` and `service/github.ts`). The workflows already work around it:
`--secrets-file` goes through `command:`, and the implicit `--var` depends on the command
starting with `deploy`. Meanwhile `setup` already installs the pinned wrangler 4.114.0.

**Fix:** use
`run: bunx wrangler deploy --env <env> --secrets-file "$RUNNER_TEMP/secrets.json" --var "ALLOWED_ORIGIN:$ALLOWED_ORIGIN" --message "$GITHUB_SHA"`,
with the token and account ID in `env:`. That removes one third-party action from the job
that holds the deploy token.

**Recommendation:** do it, unless the other projects on this stack standardise on
`wrangler-action`. In that case change all of them together or none.

#### 14. Verify jobs record a fake deployment on every run (#121/#122)

`deploy-staging.yml:152`, `release.yml:233`

These jobs use `environment:` only to read variables, but each run adds an entry to the
environment's Deployments history.

**Fix:** `environment: { name: production, deployment: false }`. It keeps the environment's
variables and secrets and its branch policy
([docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)).
actionlint 1.7.12 accepts it.

#### 15. One network blip fails the post-deploy verify (#121/#122)

`deploy-staging.yml:175-180`, `release.yml:248-253`

The `fetch` and `status` helpers make about 10 single-shot `curl` calls after the deploy has
already succeeded. One connection reset turns the run red.

**Fix:** add `--retry 3 --retry-all-errors --retry-delay 2` to both helpers. Keep the custom
build-commit poll loop, because `curl --retry` can't retry on a body mismatch.

#### 16. The Playwright browser cache never hits and fills the cache quota (pre-existing, ci.yml carried by #122)

`.github/workflows/ci.yml:53-78`

Playwright's [CI docs](https://playwright.dev/docs/ci) say: "Caching browser binaries is not
recommended". Across the stack's 8 PR runs, "Install Playwright browsers" ran every time
(17–23 s). Each run then saved a 273 MB cache scoped to its own `refs/pull/N/merge`, about
2.2 GB of the 10 GB quota (public caches API). On a hit, the `install-deps` step undoes most
of the saving anyway.

**Fix:** replace the version-extract, cache and two install steps with
`bunx playwright install --with-deps chromium`. That also follows the bun-only rule;
`npx` appears today.

#### 17. The sandbox allowlist carries dead and unwanted exits (#123)

`.devcontainer/claude-sandbox/allowed-domains.txt:13-18`

- `statsig.anthropic.com` isn't in Claude Code's
  [required hosts](https://code.claude.com/docs/en/network-config).
- `auth.openai.com`, `api.openai.com` and `chatgpt.com` were removed on purpose before. See
  the checked item in `docs/plans/completed/2026-03-25-devcontainer-and-project-cleanup.md:53`.
  This PR brings them back as "carried over".
- In a container where the agent runs without permission prompts, every unneeded host is a
  data exit.

**Fix:**

- Delete all four lines.
- Upstream (not this repo): `platform.claude.com` and `downloads.claude.ai` are in Claude
  Code's required-hosts table but not in the image's defaults. I haven't verified the
  impact.

#### 18. In the sandbox, `gh auth login` hands a full-scope token to a prompt-less agent (#123)

`.devcontainer/claude-sandbox/devcontainer.json:125`, `GIT_CONFIG_*` in `containerEnv`

The sandbox now persists `~/.config/gh` and routes github.com git credentials through `gh`.
`gh auth login` stores a `repo`, `read:org` and `gist` OAuth token in plaintext, since there
is no keyring. An agent running with `allowDangerouslySkipPermissions` can read it, and
GitHub is on the allowlist.

**Fix:** have the sandbox README recommend a fine-grained PAT limited to this repo
(`gh auth login --with-token` or `GH_TOKEN`), as upstream already advises for `cf`. Also
say in one line that HTTPS pushes fail until `gh auth login` runs, because VS Code's
forwarded credential helper is replaced.

#### 19. The Cloudflare login this project actually uses isn't persisted (#123)

`.devcontainer/devcontainer.json`, `.devcontainer/docker-compose.yml`

This project uses Wrangler (it has a `wrangler.jsonc` and no `cloudflare.config.ts`). The
new volume persists `~/.config/cloudflare`, which is `cf`'s directory. Wrangler 4.114 keeps
its OAuth token in `~/.config/.wrangler/config/default.toml`
(`wrangler-dist/cli.js:868-881,124738-124742`), so `wrangler login` still doesn't survive a
rebuild. The impact is low, because deploys are CI-only.

**Fix:** mount `gatezh-com-wrangler-config-…` at `/home/node/.config/.wrangler`, adding it
to `chown-volumes` upstream. Or have the README say that only `cf` persists.

#### 20. The devcontainer READMEs describe an older image (#123)

`.devcontainer/README.md:11,44-47`, `.devcontainer/claude-sandbox/README.md:11`

- rtk was removed from all images (upstream `51c2628`; `command -v rtk` finds nothing).
- `patch-playwright-mcp` is now a no-op. The image sets `PLAYWRIGHT_MCP_*` instead.
- The sandbox now ships agent-browser.

**Fix:**

- Correct those three statements.
- Optionally, add the READMEs to the sync skill's manifest so it catches this drift next
  time.

#### 21. `sandbox-fetch-docs` now triggers in the default container, where it gives wrong instructions (#123)

`.claude/skills/sandbox-fetch-docs/SKILL.md:3,14`

The new description triggers on any "check the docs" or "official documentation". The body
then says the environment "only has network access to GitHub and npm registry" and forbids
"blocked approaches". Project skills load in both variants, so in the default container it
steers the agent away from vendor docs. This file is byte-identical to upstream.

**Fix:** scope the description to the sandbox variant, or make the first step a reachability
probe that falls back to WebFetch. File the same fix upstream.

#### 22. #124 applies the 7-day gate unevenly (#124; partly fixed by the unpushed `0306318`)

`.mise.toml:5`, `services/api/package.json`, `bunfig.toml`

- **@types/bun.** The PR held it at 1.4.3 because 1.4.4 was too new, but the runtime it
  types is 1.4.4.
  - The local amendment adds `minimumReleaseAgeExcludes = ["@types/bun", "bun-types"]`.
  - That is right and is the canonical tool: [Bun's bunfig docs](https://bun.com/docs/runtime/bunfig)
    use `@types/bun` as their own example. Both names are needed (probe: excluding
    `@types/bun` alone fails with `bun-types … blocked by minimum-release-age`).
  - These are type-only packages that run no code. **Push it.**
- **The Bun runtime.** It was adopted at 6.5 days old (released 2026-10-22T10:11Z) and runs
  in every job, including those holding the deploy token.
  - Mise doesn't enforce the gate for exact pins.
  - Either merge #124 after 2026-10-29T10:11Z, or state in `.mise.toml` that tool upgrades
    follow the same 7 days by hand.
- `go = "1.26"` (`.mise.toml:10`) is a fuzzy pin. It predates this stack.

### Nits

- 23 (#121) `home._outputformat_headers_.txt:31`, `docs/CSP.md:21`: the stated reason for
  `style-src 'unsafe-inline'` is wrong.
  - Probe: with `style-src 'self'`, `/`, `/about/` and `/contact/` (Turnstile included)
    raised 0 violations.
  - Posts need it, for Chroma's inline colors (`markup.highlight.noClasses` defaults to
    true) and the `cfimage` shortcode.
  - Keep the directive; fix the comment.
- 24 (#121) `theme-toggle.ts:2-3` still says Turnstile listens for `themechange`. Nothing
  has since #117.
- 25 (#121) wrangler skips a `_headers` line over 2,000 characters with only a warning
  (`cli.js:191527-191531`), which would silently drop the CSP. Today's line is 523
  characters. Add `{{ if gt (len $line) 2000 }}{{ errorf … }}{{ end }}`.
- 26 (#121) `assets.spec.ts:103` bans `" https: "` with surrounding spaces, so a trailing
  `https:` passes. `:132`'s `\bsrc=` also matches `data-src=`.
- 27 (#122) actionlint runs nowhere in CI, so `.github/actionlint.yaml` serves only local
  runs. Add it to the Lint job; zizmor is optional and currently has 0 findings.
- 28 (#122) `setup/action.yml:25`: `bun ci` is the documented equivalent of
  `bun install --frozen-lockfile`.
- 29 (#122) `release.yml:104-117`: "Re-run all jobs" on a finished release bumps again and
  tags the same commit twice. Reuse the tag if
  `git tag --points-at "$GITHUB_SHA"` already lists `vX.Y.Z`.
- 30 (#122) Two notes on `docs/deployment.md:41-44`:
  - "a redeploy ships what was released" isn't true yet. The only release, v0.0.1, has
    `"immutable": false`, because immutability applies only to releases published after
    it was enabled.
  - `redeploy` accepts any `v*` tag that is an ancestor of `master`, including a tag
    pushed by hand.
- 31 (#124) `playwright.config.ts:26-28`: 2 workers is already the default on a 4-core
  public runner. The comment should say this deliberately departs from Playwright's
  1-worker CI advice. Consider `failOnFlakyTests: !!process.env.CI`, so `retries: 2`
  doesn't hide parallelism flakes.
- 32 (#125) `hugo.yaml:178` calls `mainSections` the "sections whose pages are articles",
  but only `posts` gets Article JSON-LD and `og:type article`. Either reword the comment
  (WebPage may be deliberate for ever-learning) or test `in site.MainSections .Section`.
- 33 (#125) `home.rss.xml:2-3` and `hugo.yaml:178-179` say the change keeps `/contact/` out
  of the feed. It was never in it, because `/contact/` is a section. Only `/about/` and
  `/early-projects/` drop out.
- 34 (#125) `head.html:60`: `.FirstSection.LinkTitle` replaces
  `(site.GetPage .Section).LinkTitle`.
- 35 (#125) `.claude/rules/seo.md` doesn't mention the new `Cache-Control` rules, the
  `home.rss.xml` override or BreadcrumbList.
- 36 (#119) `seo.html:61-66`: ProfilePage lacks Google's recommended `dateModified`
  ([profile-page doc](https://developers.google.com/search/docs/appearance/structured-data/profile-page)).
  Add `.Lastmod`.
- 37 (#123) `init-plugins.sh`:
  - `:13`: the onboarding `jq` call has no guard, so under `set -e` a corrupt
    `.claude.json` aborts the script.
  - `:13,28`: fixed `/tmp` names plus a cross-filesystem `mv` aren't atomic. Use `mktemp`
    in the target directory.
  - The script mixes `$HOME/.claude` with `${CLAUDE_CONFIG_DIR:-…}`.
  - The "SSH first" comment (`:51-53`) is moot: `containerEnv` rewrites to HTTPS, and the
    documented setting is `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`.
- 38 (#123) `project-structure.md:51` leaves `sandbox-fetch-docs` out of the skills list.
  `devcontainer-upstream-sync` writes issue drafts to `docs/upstream-issue-*.md` inside
  this public repo; the scratchpad would be safer.
- 39 (pre-existing) `/contact/index.xml` is an empty RSS feed that the contact page
  advertises with `<link rel=alternate>`. Drop RSS from that section's `outputs`.

### Native-first audit

| Custom piece                                                                          | Built-in checked (where)                                                                                                          | Verdict                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_headers` rendered by a Hugo output format                                           | Workers static assets `_headers` ([CF docs](https://developers.cloudflare.com/workers/static-assets/headers/)); no Hugo built-in  | **Keep**: it is the platform's own mechanism. Probes confirmed same-pattern rules replace each other, different patterns merge, splats cross `/`, and the CSP reaches 404, 301, 307 and 304 responses |
| Assets-only Worker (no `main`)                                                        | Workers static assets routing and pricing docs                                                                                    | **Keep**: canonical and free                                                                                                                                                                          |
| `js.html` (`js.Build` + fingerprint + SRI)                                            | `js.Build`, `js.Batch` (gohugo.io)                                                                                                | **Keep**: `js.Batch` emits ESM, where `document.currentScript` is null                                                                                                                                |
| `data-*` + `document.currentScript`                                                   | `js.Build` `params` / `@params`                                                                                                   | **Keep**: `params` fits site constants, but the per-page title still needs `data-*`; no real gain                                                                                                     |
| `analytics.ts`                                                                        | Hugo's internal `google_analytics.html`                                                                                           | **Keep**: on 0.164 it renders an inline `<script>`, which this CSP blocks                                                                                                                             |
| `posthog.ts` (verbatim loader)                                                        | PostHog npm SDK                                                                                                                   | **Keep**: the vendor-recommended snippet                                                                                                                                                              |
| `theme-init.ts`, `theme-toggle.ts`                                                    | `color-scheme` + `light-dark()`                                                                                                   | **Keep**: explicit overrides still need JS (pre-existing design)                                                                                                                                      |
| `mobile-menu.ts`                                                                      | `popover` / `popovertarget` (Baseline: Chrome 114, Firefox 125, Safari 17)                                                        | **Optional replace**: deletes the script but needs restyling as a top-layer overlay (pre-existing)                                                                                                    |
| Turnstile implicit rendering + `reset("#contact-turnstile")`                          | [Turnstile client-side rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)                 | **Keep**: canonical; a selector in `reset()` is undocumented but proven by the test                                                                                                                   |
| Tag → keywords loop (`seo.html:86-90`, `head.html:61`)                                | `PAGE.Keywords`                                                                                                                   | **Replace** (#1)                                                                                                                                                                                      |
| `layouts/home.rss.xml` override                                                       | Embedded `rss.xml` 0.164 (no filter, ignores `mainSections`); `build.list: local` also removes pages from the sitemap             | **Keep**, switch to `site.MainSections` (#9). Byte-identical embedded template through 0.169, so no drift                                                                                             |
| `params.mainSections`                                                                 | Top-level `mainSections` / `site.MainSections`                                                                                    | **Replace** (#9)                                                                                                                                                                                      |
| BreadcrumbList via `.Ancestors.Reverse`                                               | Hugo `Ancestors` breadcrumb example                                                                                               | **Keep**: canonical                                                                                                                                                                                   |
| `(site.GetPage .Section).LinkTitle`                                                   | `.FirstSection`                                                                                                                   | **Replace** (nit 34)                                                                                                                                                                                  |
| JSON-LD via `dict` + `jsonify`                                                        | none                                                                                                                              | **Keep**: a hostile probe title (`</script>…`) stays valid JSON with no breakout                                                                                                                      |
| `$/` composite actions                                                                | [Self-repository syntax](https://github.blog/changelog/2026-07-30-reference-same-repository-actions-with-self-repository-syntax/) | **Keep**: GitHub's recommended mechanism                                                                                                                                                              |
| `ci.yml` via `workflow_call`                                                          | Reusable workflows                                                                                                                | **Keep**                                                                                                                                                                                              |
| `setup` composite (mise-action + Bun cache)                                           | `oven-sh/setup-bun` (can't read `.mise.toml`; Hugo needs mise anyway)                                                             | **Keep**; pin mise (#12), `bun ci` (nit 28)                                                                                                                                                           |
| `wrangler-action`                                                                     | `bunx wrangler deploy` (action source)                                                                                            | **Replace** (#13), subject to sibling alignment                                                                                                                                                       |
| Verify build-commit poll loop                                                         | `curl --retry` can't check content                                                                                                | **Keep**                                                                                                                                                                                              |
| `fetch` / `status` helpers                                                            | `curl --retry-all-errors`                                                                                                         | **Keep**, add retry flags (#15)                                                                                                                                                                       |
| Playwright version extract + browser cache                                            | Playwright CI docs: don't cache browsers                                                                                          | **Replace** (#16)                                                                                                                                                                                     |
| `secrets.json` via `jq` + `rm`                                                        | `wrangler deploy --secrets-file`; `RUNNER_TEMP` is emptied per job                                                                | **Keep**; the `rm` is redundant but harmless                                                                                                                                                          |
| `GIT_CONFIG_*` credential env                                                         | `gh auth setup-git`                                                                                                               | **Keep**: same keys, outranks the gitconfig the VS Code extension copies over, no file edits (probe: only `gh auth git-credential` runs for github.com)                                               |
| `init-plugins.sh`: gatezh, typescript-native-lsp, `DISABLED_PLUGINS`, cleanup seeding | Managed settings, project `extraKnownMarketplaces` / `enabledPlugins`, `cleanupPeriodDays`                                        | **Replace** (#4)                                                                                                                                                                                      |
| `init-plugins.sh` builtin enable via CLI                                              | Project `enabledPlugins` would override a user's `/plugin disable`                                                                | **Keep**                                                                                                                                                                                              |
| Deleted project `init-firewall.sh`                                                    | Image `/usr/local/sbin/init-firewall`                                                                                             | Correct to delete                                                                                                                                                                                     |

### Upgrade opportunities

- **Hugo 0.169:** deprecates `.Params.keywords` in favour of `.Keywords`. Fixing #1 covers
  this ahead of time. Nothing else in 0.165–0.169 affects this stack.
- **jdx/mise-action v5:** a 24-hour minimum age for unpinned mise by default. Pair it with
  #12.
- **Dependabot `bun` ecosystem** with `cooldown.default-days: 7` and grouped updates. It
  matches bunfig's gate exactly and would surface wrangler 4.114 → 4.155, Playwright
  1.61 → 1.64 and oxlint/oxfmt as reviewable PRs. It goes against the documented
  "deliberate upgrades" policy, so this one is your call; I'd adopt it.

### Checked and correct

- **`_headers`:** production and staging outputs, rule order, staging `noindex` inside `/*`,
  `immutable` on `/js/*` always and on `/css/*` only in production. Every file under those
  paths is fingerprinted where the rule applies. Production HTML has no `X-Robots-Tag`.
- **CSP coverage:** Remark42, Turnstile (`script-src` + `frame-src` per Cloudflare's doc)
  and PostHog (its base policy exactly; `img-`, `style-` and `font-src` are toolbar-only).
  Dropping the nonce and `'strict-dynamic'` is not material for a static site whose
  comments live in an iframe.
- **Template injection:** every value that reaches a `data-*` attribute or JSON-LD is
  escaped.
- **`contact.ts`:** handles a missing `apiUrl`, invalid JSON, network errors and a submit
  before `api.js` loads.
- **Identity hub (#119):** JSON-LD per page kind is correct. The shared `@id` is identical
  in production, staging and with a slash-less base URL. ProfilePage's required fields are
  present. `rel="me"` renders.
- **Canonical:** `site.Home.Permalink` equals the canonical in every environment.
- **New SEO tests:** not vacuous. The sitemap, RSS and breadcrumb tests assert non-empty
  input.
- **CI security:**
  - top-level `contents: read`, with `contents: write` only on `release`;
  - `persist-credentials: false` everywhere;
  - no `pull_request_target`, and no `${{ }}` in `run:`;
  - SHA pins verified;
  - emails only in secrets, and wrangler masks secrets in its output;
  - environments restricted to `master`.
- **Release gating:** a failed CI leaves no tag. Deploys and verifies gate on
  `needs.*.result`.
- **Cost:** about 4 job-minutes per CI. Standard runners are free on public repos; the cost
  is wall-clock only, and simplicity justifies it.
- **Dependabot:** `cooldown` and `directories` globs are valid.
- **`actionlint.yaml` ignores:** exactly the three errors actionlint 1.7.12 raises for
  `queue` and `$/`.
- **Devcontainer:** both variants match upstream apart from intended customisations.
  Volumes are project-scoped. The sandbox firewall is enforced and fails closed. The
  `settings.json` shapes are valid.
- **Copied skills:** byte-identical to upstream, with branch names correct (`master`).
- **TypeScript 7:** `typescript-native-lsp` is correct. TS 7.0.2 ships no `tsserver`, and
  `tsc --lsp` answers JSON-RPC.
- **Pre-completion gate:** `bun run check` passes on `8de6014`.

## Round 1 resolution

Every finding was re-checked against its layer before it was fixed. Each fix is committed
on the PR it belongs to, and the stack was restacked locally with
`gh stack rebase --no-trunk`. Nothing is pushed yet.

**Verification:**

- `bun run check` exits 0 on all eight branches.
- On the top of the stack, `CI=1 bun run test` passes 18/18 API tests and 326/326 Playwright
  tests.

| #   | Outcome                    | Commit (PR)                        | What was done, and how it was verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fixed                      | `a91010a` (#125)                   | `.Keywords` feeds the Article `keywords` and `article:tag`. A `diff -r` of production builds before and after changes only the 10 posts, and the keywords meta is byte-identical on every page. New test: "a post's keywords reach its Article and its article:tag metas".                                                                                                                                                                                                                                    |
| 2   | Fixed                      | `07a9edc` (#121)                   | `connect-src` now has `https://*.google.com` in place of `*.analytics.google.com`, per Google's GA4 (no Ads) policy. New test, "gtag's fallback beacon is allowed when its primary hit fails". **Mutation-checked:** with the old host restored, it fails on the blocked `connect-src https://www.google.com/g/collect…`.                                                                                                                                                                                     |
| 3   | Fixed                      | `60286e9` (#123)                   | `challenges.cloudflare.com` is in the sandbox allowlist. **Not run inside the sandbox:** the firewall only reads the list when the container starts, so this needs a sandbox rebuild to confirm.                                                                                                                                                                                                                                                                                                              |
| 4   | Fixed, with two deviations | `a7ab4b3` (#123)                   | Removed `gatezh` and `dev@gatezh` from `settings.json` and `init-plugins.sh`; `/etc/claude-code/managed-settings.json` owns them. `typescript-native-lsp` is now only in `settings.json`, with `autoUpdate: true`. **Kept:** the `DISABLED_PLUGINS` loop, which is upstream template content (verbatim at gatezh/devcontainers `7afe5c2`), not a project duplicate. Also kept: `cleanupPeriodDays` seeding, because in project settings it would override the value for everyone who clones this public repo. |
| 5   | Fixed                      | `3dcfb0b` (#97)                    | Removed the local `deploy`, `deploy:www` and `deploy:api` scripts from the root, www and api packages. `.claude/rules/deployment.md` and the README now say deploys are CI-only, and why.                                                                                                                                                                                                                                                                                                                     |
| 6   | Fixed                      | `44621ee` (#121)                   | The `stubGoogleAnalytics()` helper stubs gtag and answers `/g/collect` with a 204. The CSP loop and both vendor tests use it.                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | Fixed                      | `07a9edc`, `44621ee` (#121)        | Added the fallback test (see #2). The test comment and CSP.md step 3 now say the loop proves the first hop only.                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | Fixed                      | `007954c` (#121)                   | Only when a PostHog key is set: `report-uri https://us.i.posthog.com/report/?token=…; report-to posthog` plus `Reporting-Endpoints`. The CSP line is 685 characters, under the 2,000 limit. A new test pins it, and staging builds emit no reporting.                                                                                                                                                                                                                                                         |
| 9   | Fixed                      | `07c78cb` (#125)                   | Top-level `mainSections`, read through `site.MainSections` in `home.rss.xml` and `llms-full`. The full production build is byte-identical. `llms.txt` stays as it is, because its heading isn't the section title.                                                                                                                                                                                                                                                                                            |
| 10  | Fixed                      | `1a78136` (#125)                   | The description check now covers every sitemap URL (< 160 characters, none missing). The Docker post's description went from 185 to 156 characters. The title check stays on structural pages, with a comment saying why posts are exempt. The assertion messages now match.                                                                                                                                                                                                                                  |
| 11  | Fixed                      | `93f78ac` (#122)                   | Dropped `queue: max` from staging and corrected the comments and `docs/deployment.md`. `release.yml` keeps it.                                                                                                                                                                                                                                                                                                                                                                                                |
| 12  | Fixed                      | `38f1fa6`, `12e9429` (#122)        | mise-action gets `version: 2026.10.17` (released 2026-10-21) and the `sha256` of the extracted linux-x64 binary. The hash was checked against mise's minisign-verified `SHASUMS256.txt`. Dependabot doesn't bump these values, so the comment says to bump both together.                                                                                                                                                                                                                                     |
| 13  | Skipped                    | n/a                                | The closest project on this stack uses `cloudflare/wrangler-action@v4` too. Change it in all the projects together or in none.                                                                                                                                                                                                                                                                                                                                                                                |
| 14  | Fixed                      | `1b646df` (#122)                   | Verify jobs use `environment: { name: …, deployment: false }`. actionlint 1.7.12 is clean.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 15  | Fixed                      | `1b646df` (#122), `618735a` (#125) | Added `--retry 3 --retry-all-errors --retry-delay 2` to `fetch` and `status`, and to #125's AI-crawler loop, which calls `curl` directly. A local probe: a 503 is retried, a 404 is not.                                                                                                                                                                                                                                                                                                                      |
| 16  | Fixed                      | `0aad6df` (#122)                   | One step, `bunx playwright install --with-deps --only-shell chromium`. Every project uses headless Chromium. **Only a real CI run can confirm this step.**                                                                                                                                                                                                                                                                                                                                                    |
| 17  | Fixed                      | `60286e9` (#123)                   | Removed `statsig.anthropic.com` and the three OpenAI hosts.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 18  | Fixed                      | `491aa51` (#123)                   | The sandbox README recommends a fine-grained, repo-scoped token (`gh auth login --with-token` or `GH_TOKEN`), and says pushes fail until gh is signed in.                                                                                                                                                                                                                                                                                                                                                     |
| 19  | Fixed                      | `491aa51` (#123)                   | Both READMEs say only `cf`'s login persists, not Wrangler's `~/.config/.wrangler`. No new volume.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 20  | Fixed                      | `491aa51` (#123)                   | rtk removed, `PLAYWRIGHT_MCP_*` described, and the sandbox listed as shipping agent-browser.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 21  | Fixed                      | `81ffef5` (#123)                   | The description is scoped to the firewalled sandbox, and a docs-URL reachability probe falls back to WebFetch. This now diverges from upstream (see below).                                                                                                                                                                                                                                                                                                                                                   |
| 22  | Fixed                      | `1b5f14c`, `f32bc51` (#124)        | **@types/bun:** the earlier amendment (`minimumReleaseAgeExcludes` for `@types/bun` and `bun-types`, plus 1.4.4) is kept. **Go:** pinned to `1.26.10` (released 2026-10-20). **Bun runtime:** ships at 1.4.4 now, by decision, without waiting out the 7-day gate (it would have cleared at 2026-10-29T10:11Z). Bun never runs in production; the gate's concern was the CI jobs that hold the deploy token.                                                                                                  |
| 23  | Fixed                      | `f3802e9` (#121)                   | The `style-src 'unsafe-inline'` rationale now names Chroma's inline colours and the `cfimage` shortcode.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 24  | Fixed                      | `f3802e9` (#121)                   | `theme-toggle.ts` says only `comments.ts` listens for `themechange`.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 25  | Fixed                      | `364b979` (#121)                   | `errorf` fires if the CSP line exceeds 2,000 characters. Tested by lowering the threshold to 200, which failed the build.                                                                                                                                                                                                                                                                                                                                                                                     |
| 26  | Fixed                      | `4b9e349` (#121)                   | `script-src` is compared token by token, a separate check catches any nonce source, and the inline-script regex uses `\ssrc=`.                                                                                                                                                                                                                                                                                                                                                                                |
| 27  | Fixed                      | `e04ccf6` (#122)                   | `"aqua:rhysd/actionlint" = "1.7.12"` in `.mise.toml`, and `lint:actions` is part of `bun run check`. A broken workflow makes it exit 1.                                                                                                                                                                                                                                                                                                                                                                       |
| 28  | Fixed                      | `ef360a8` (#122)                   | The setup action runs `bun ci`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 29  | Fixed                      | `5fe83ec` (#122)                   | When `GITHUB_RUN_ATTEMPT > 1`, the release reuses a `vX.Y.Z` tag already on `GITHUB_SHA`. Probed in a scratch repo.                                                                                                                                                                                                                                                                                                                                                                                           |
| 30  | Fixed                      | `5fe83ec` (#122)                   | `docs/deployment.md`: immutability starts with the next release (v0.0.1 has `immutable: false`), and redeploy accepts any `v*` tag on `master`.                                                                                                                                                                                                                                                                                                                                                               |
| 31  | Fixed (comment only)       | `f32bc51` (#124)                   | The workers comment now explains the deliberate departure from Playwright's one-worker CI advice. **`failOnFlakyTests` not applied:** the live Turnstile test depends on Cloudflare's network, so an outside blip would turn CI red. Retries still show up as "flaky" in the report.                                                                                                                                                                                                                          |
| 32  | Fixed                      | `07c78cb` (#125)                   | The `mainSections` comment no longer claims every page in those sections is an Article.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 33  | Fixed                      | `07c78cb` (#125)                   | The comments name only `/about/` and `/early-projects/` as the pages kept out of the feed.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 34  | Fixed                      | `a91010a` (#125)                   | `article:section` uses `.FirstSection.LinkTitle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 35  | Fixed                      | `8ceae51` (#125)                   | `.claude/rules/seo.md` covers keywords, JSON-LD by page kind including BreadcrumbList, the feed override and the immutable `Cache-Control`.                                                                                                                                                                                                                                                                                                                                                                   |
| 36  | Fixed                      | `e8ac2fb` (#119)                   | ProfilePage `dateModified` from `.Lastmod`, omitted when it is zero. The about page's ProfilePage test asserts it.                                                                                                                                                                                                                                                                                                                                                                                            |
| 37  | Fixed                      | `a79fc98` (#123)                   | A guarded onboarding update, a `jq_in_place` helper (`mktemp` beside the target, then rename), one `CLAUDE_DIR`. shellcheck is clean, and a corrupt `.claude.json` now only warns.                                                                                                                                                                                                                                                                                                                            |
| 38  | Partly fixed               | `46ed190` (#123)                   | `project-structure.md` lists `sandbox-fetch-docs`. **Not changed here:** `devcontainer-upstream-sync`'s draft location. The skill is byte-identical to upstream, so it goes upstream (below).                                                                                                                                                                                                                                                                                                                 |
| 39  | Fixed                      | `c705c0d` (#125)                   | `content/contact/_index.md` sets `outputs: [HTML, Markdown]`. `/contact/index.xml` and its alternate link are gone, and nothing referenced them.                                                                                                                                                                                                                                                                                                                                                              |

### For upstream (gatezh/devcontainers)

These were drafted during the fixes and are not filed:

1. `devcontainer-upstream-sync` writes issue drafts to `docs/upstream-issue-*.md` inside the
   project. In a public repo a stray `git add -A` publishes them. Write them to a scratch or
   gitignored path instead.
2. `sandbox-fetch-docs` triggers in the default variant and forbids WebFetch there. Upstream
   should take the scoping from #21.
3. The image's firewall defaults lack `platform.claude.com` and `downloads.claude.ai`, which
   Claude Code's network-config page lists as required. The impact is not verified.
4. Optional: the hardening of `init-plugins.sh` (#37).
