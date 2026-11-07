# Agent Instructions

## Package Manager
- **ALWAYS use `bun`** - never use npm, yarn, or pnpm
- Use `bun add`, `bun install`, `bun run`, `bunx`
- Lock file is `bun.lock` (not package-lock.json or yarn.lock)

## Dependency Versions
- **ALWAYS pin exact versions** - no `^` or `~` prefixes
- Example: `"wrangler": "4.14.1"` not `"wrangler": "^4.14.1"`

## Tool Version Sync
- Tool versions are managed centrally in `.mise.toml` (single source of truth)
- Hugo and Bun versions are read from `.mise.toml` by:
  - Pre-built devcontainer images (via mise)
  - every CI and deploy job, via `jdx/mise-action` in `.github/actions/setup`
- When updating tool versions, only edit `.mise.toml`
- mise itself is not pinned on CI: `.github/actions/setup` installs the newest
  release at least 7 days old, verified against its signed packslip

## Pre-Completion Checks
Before finishing any feature or change, **ALWAYS run verification**:
- `bun run check` from root — lint, workflow lint (actionlint), format, Hugo
  template format, typecheck and production build. This is the exact gate CI runs; running the individual
  commands instead misses the format checks and ships a red build.
- `bun run test` from root — the go-live action tests, API unit tests and
  the Playwright suite.
