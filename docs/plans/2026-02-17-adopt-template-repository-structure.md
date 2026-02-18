# Adopt Template Repository Structure

## Overview

Restructure the gatezh.com monorepo to align with the SurgeGate template repository conventions. The primary change is moving from `apps/` to `services/` directory naming, along with adopting mise for tool version management, OXC for linting, and modernizing the devcontainer setup.

## Context

- Template remote: `template/master` (SurgeGate template)
- Current project: gatezh.com blog monorepo with Hugo site + email worker
- Files involved: Nearly all configuration files, CI workflows, devcontainer, docs
- This project does NOT have: api, app, packages/shared, postgres, neon-proxy (template-specific services to ignore)

## Development Approach

- Complete each task fully before moving to the next
- Test builds and type checks after each structural change
- No TDD needed - this is a restructuring task, not feature development

## Implementation Steps

### Task 1: Rename apps/ to services/

**Files:**
- Move: `apps/web/` -> `services/www/`
- Move: `apps/email-worker/` -> `services/email-worker/`

- [x] Create `services/` directory
- [x] Move `apps/web/` to `services/www/`
- [x] Move `apps/email-worker/` to `services/email-worker/`
- [x] Remove empty `apps/` directory
- [x] Update `package.json` workspaces from `["apps/*"]` to `["services/*"]`
- [x] Update `services/www/package.json` name from `@gatezh/web` to `www` (match template convention)
- [x] Update `services/email-worker/package.json` name from `@gatezh/email-worker` to `email-worker`
- [x] Update root `package.json` scripts to reference `services/www` and `services/email-worker` instead of `apps/web` and `apps/email-worker`
- [x] Run `bun install` to regenerate lockfile
- [x] Run `bun run build` to verify Hugo build works

### Task 2: Add .mise.toml for tool version management

**Files:**
- Create: `.mise.toml`
- Modify: `.github/workflows/deploy-web.yml` (use mise-action instead of hardcoded versions)
- Modify: `.github/workflows/deploy-email-worker.yml` (use mise-action instead of hardcoded versions)

- [x] Create `.mise.toml` with bun and hugo versions (no node needed for this project):
    - `bun = "1.3.2"` (current version used in CI)
    - `hugo = "0.152.2"` (current version used in CI)
- [x] Update `deploy-web.yml`: replace `oven-sh/setup-bun` and `peaceiris/actions-hugo` with `jdx/mise-action@v2`, remove hardcoded `HUGO_VERSION` and `BUN_VERSION` env vars
- [x] Update `deploy-email-worker.yml`: replace `oven-sh/setup-bun` with `jdx/mise-action@v2`, remove hardcoded `BUN_VERSION` env var
- [x] Update path triggers in workflows from `apps/` to `services/`

### Task 3: Modernize devcontainer with Dockerfile + mise

**Files:**
- Create: `.devcontainer/Dockerfile`
- Create: `.devcontainer/devcontainer.json` (replace hugo-dev/devcontainer.json as root config)
- Remove: `.devcontainer/hugo-dev/` directory (replaced by new setup)

- [x] Create `.devcontainer/Dockerfile` based on template (debian:trixie-slim, install mise, read tool versions from .mise.toml)
- [x] Create new `.devcontainer/devcontainer.json` with:
    - Build from Dockerfile (no pre-built image dependency)
    - Volume mounts for node_modules (services/www, services/email-worker)
    - VS Code extensions: bun, tailwind CSS, hugo extensions, OXC
    - postCreateCommand: `bun install`
- [x] Remove `.devcontainer/hugo-dev/` directory

### Task 4: Replace Prettier with OXC (oxlint)

**Files:**
- Create: `oxlint.json`
- Modify: root `package.json` (replace prettier dep and script with oxlint)
- Modify: `services/www/package.json` (remove prettier dependencies)
- Remove: `services/www/prettier.yml` (prettier config)

- [ ] Create `oxlint.json` at project root, adapted from template (remove react-specific rules since this project has no React):
    ```json
    {
      "rules": { "typescript": "warn", "import": "warn", "unicorn": "warn" },
      "ignorePatterns": ["**/node_modules", "**/dist", "**/.wrangler", "**/public", "services/www/themes", "services/www/static"]
    }
    ```
- [ ] Update root `package.json`: replace `prettier` devDep with `oxlint` (pinned exact version), replace `prettier` script with `lint` script
- [ ] Remove `prettier` and `prettier-plugin-go-template` and `prettier-plugin-tailwindcss` from `services/www/package.json` devDependencies
- [ ] Delete `services/www/prettier.yml`
- [ ] Add `lint` script to `services/email-worker/package.json`: `"lint": "oxlint src"`
- [ ] Run `bun install` to update lockfile
- [ ] Run `bunx oxlint` to verify linting works

### Task 5: Add root tsconfig.json and .claude/settings.json

**Files:**
- Create: `tsconfig.json` (root)
- Create: `.claude/settings.json`

- [ ] Create root `tsconfig.json` matching template (ES2022 target, ESNext module, bundler resolution, strict mode)
- [ ] Create `.claude/settings.json` with allowed bash commands matching template pattern:
    ```json
    {
      "permissions": {
        "allow": ["Bash(bun:*)", "Bash(wrangler:*)", "Bash(git:*)", "Bash(curl:*)", "Bash(mkdir:*)", "Bash(ls:*)"]
      }
    }
    ```
- [ ] Run `bunx tsc --noEmit` in services/email-worker to verify TypeScript works with root tsconfig

### Task 6: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] Modernize `.gitignore` to match template patterns:
    - Add: `dist/`, `.wrangler/`, `*.tsbuildinfo`, `coverage/`
    - Keep: Hugo-specific ignores, macOS ignores, ralphex progress logs
    - Remove: generated toptal.com boilerplate comments, `.aider*` (no longer used)
    - Consolidate environment file patterns

### Task 7: Update CLAUDE.md and documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/README.md`

- [ ] Update CLAUDE.md:
    - Change all `apps/web` references to `services/www`
    - Change all `apps/email-worker` references to `services/email-worker`
    - Update monorepo structure diagram
    - Replace Prettier references with OXC
    - Update Hugo/Bun version sync section to reference `.mise.toml` as single source of truth
    - Add linting to pre-completion checks
- [ ] Update `docs/DEPLOYMENT.md`: change all `apps/` paths to `services/`
- [ ] Update `docs/README.md` if it references directory paths

### Task 8: Verify everything works

- [ ] Run `bun install` from root
- [ ] Run `bun run build` (Hugo build)
- [ ] Run `bun run build:worker` (email worker build)
- [ ] Run `bunx tsc --noEmit` in services/email-worker
- [ ] Run `bunx oxlint` from root
