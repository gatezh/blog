---
title: "Upstream"
layout: showcase
comments: false
description: "Issues and pull requests Serge Gatezh has filed on projects he doesn't own, from Cloudflare and Bun to Playwright and Better Auth, and what came of each."
keywords: [open-source, upstream, cloudflare, bun, playwright, better-auth, devcontainers]
# One entry per issue or pull request on a repository I do not own, newest
# first; groups on the page follow the first appearance of each project. The
# link is built from `project`, `kind` and `number`, so an entry with any of
# them missing fails the build (layouts/_partials/upstream-log.html). `state`
# is open, fixed (closed as completed), merged, or declined (closed as not
# planned); `closed` is the date that happened. `note` is one line on what the
# report was about; the state line says what came of it. Once a month
# .github/workflows/upstream.yml opens a pull request with a stub for each
# item filed since the oldest entry here and the close date of each closed
# one (scripts/upstream-sync.ts); to reach further back, add the older entry
# by hand.
upstream:
  - project: umputun/agterm
    kind: issue
    number: 915
    title: "Live sessions: quit-time capture keeps no command for any pane when the single 0.1 s zmx list times out, so a reboot restores bare shells"
    filed: 2026-11-06
    state: fixed
    closed: 2026-11-06
    note: "At quit, agterm gave the session listing 0.1 s to answer. When it ran over, no pane's running command was saved, so after a reboot the panes came back as bare shells."
  - project: cloudflare/cloudflare-docs
    kind: issue
    number: 34799
    title: "Durable Objects migrations reference: \"versions upload fails fast\" with exports is outdated"
    filed: 2026-10-30
    state: open
    note: "The migrations page says `versions upload` fails fast when the config has `exports`. Current Wrangler stores them on the version and reconciles at the next deploy; the issue cites the source."
  - project: samuelgursky/davinci-resolve-mcp
    kind: pr
    number: 315
    title: "fix(installer): skip Blackmagic Disk Speed Test's sandbox container"
    filed: 2026-10-22
    state: merged
    closed: 2026-10-23
    note: "The installer took Disk Speed Test's container for a sandboxed Resolve and wrote the bridge scripts and their auth token into it. The fix tightens the container match."
  - project: cloudflare/cf
    kind: issue
    number: 390
    title: "`cf workers …` API commands fail without workerd: workers module statically imports miniflare"
    filed: 2026-10-22
    state: fixed
    closed: 2026-11-04
    note: "`cf workers scripts list` is an API read, but the module imported miniflare at load time, so it failed wherever workerd was not installed, such as a slim devcontainer image."
  - project: oven-sh/bun
    kind: issue
    number: 45563
    title: "install.globalStore: share entries whose peer is typed by `@types/*`, instead of keeping them project-local"
    filed: 2026-10-16
    state: open
    note: "After the `@types/*` peer fix, React projects stopped sharing most of their dependencies through the global store: 82 MB to 300 MB of project-local files on one monorepo. Proposes sharing those entries."
  - project: cloudflare/cf
    kind: issue
    number: 252
    title: "Support loading cloudflare.config.ts when cf runs on Bun"
    filed: 2026-10-09
    state: declined
    closed: 2026-10-20
    note: "With a `cloudflare.config.ts` in the directory, every command failed under Bun, including account-level ones that never read it. Node stays required."
  - project: cloudflare/cf
    kind: issue
    number: 251
    title: "cloudflare.config.ts can't opt out of dependency metadata upload (dependencies_instrumentation dropped by cf migrate)"
    filed: 2026-10-09
    state: fixed
    closed: 2026-10-12
    note: "A Wrangler project could opt out of uploading its npm dependency metadata. `cf migrate` dropped that setting and the new config had nowhere to put it."
  - project: microsoft/playwright
    kind: issue
    number: 42203
    title: "captureGitInfo diff capture shallows the user's repository via `git fetch --depth=1`"
    filed: 2026-08-11
    state: fixed
    closed: 2026-08-11
    note: "Collecting report metadata on a pull request ran `git fetch --depth=1` and turned a full clone into a shallow one. Reported with a one-test repository that fails on exactly that."
  - project: microsoft/playwright-mcp
    kind: issue
    number: 1599
    title: "`ensureTab()` returns a crashed page reference, leaving the server stuck reporting \"Page crashed\" until restart"
    filed: 2026-05-04
    state: fixed
    closed: 2026-05-05
    note: "After the Chromium renderer crashed under memory pressure, the server kept handing out the dead page, so every tool call failed until the process was restarted."
  - project: rtk-ai/rtk
    kind: issue
    number: 1307
    title: "`rtk init` hangs in non-interactive environments (v0.36.0 telemetry consent gate)"
    filed: 2026-04-14
    state: fixed
    closed: 2026-07-20
    note: "`rtk init` waited on stdin for a telemetry consent answer, which hung every Docker image build and CI job that ran it."
  - project: better-auth/better-auth
    kind: issue
    number: 9156
    title: "`dash` plugin insight incorrectly flags custom defaultRole as non-existent"
    filed: 2026-04-13
    state: fixed
    closed: 2026-04-15
    note: "The infrastructure dashboard warned that a custom `defaultRole` did not exist, although it was a key of the admin plugin's own `roles` map."
  - project: umputun/ralphex
    kind: issue
    number: 72
    title: "Docker wrapper binds port even without `--serve`, preventing multiple concurrent instances"
    filed: 2026-02-06
    state: fixed
    closed: 2026-02-07
    note: "The Docker wrapper always published port 8080, so a second instance in another project failed to start even when nothing was serving."
  - project: umputun/ralphex
    kind: issue
    number: 62
    title: "Docker wrapper mounts ~/.config/ralphex as read-only, causing startup failure"
    filed: 2026-02-03
    state: fixed
    closed: 2026-02-03
    note: "The wrapper mounted the config directory read-only, and the first run died writing its own defaults into it."
---

When something I build on breaks, I file it where it can be fixed for
everyone. This is the log: each entry links to the issue or pull request,
says what it was about and what came of it. My own projects are on the
[projects](/projects/) page.

{{< upstream >}}
