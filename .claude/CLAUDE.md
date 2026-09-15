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
  - `.github/workflows/deploy.yml` (via `jdx/mise-action`)
- When updating tool versions, only edit `.mise.toml`

## Pre-Completion Checks
Before finishing any feature or change, **ALWAYS run verification**:
- `bun run check` from root — lint, format, Hugo template format, typecheck
  and production build. This is the exact gate CI runs; running the individual
  commands instead misses the format checks and ships a red build.
- `bun run test` from root — API unit tests plus the Playwright suite.
