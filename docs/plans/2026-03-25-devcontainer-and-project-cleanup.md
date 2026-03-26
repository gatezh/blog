# Devcontainer and Project Cleanup

## Overview
- Migrate both devcontainer variants (default + claude-code sandbox) from local Dockerfile builds to pre-built GHCR images from `gatezh/devcontainer-images`
- Clean up all non-Claude agent configuration (`.agents/`, Codex references, OpenAI extensions/firewall domains)
- Modernize CLAUDE.md into `.claude/CLAUDE.md` + `.claude/rules/` modular structure per latest Claude Code standards
- Move stray ralphex progress files from project root to `.ralphex/progress/`

## Context (from discovery)
- **Files/components involved**:
  - `.devcontainer/` — Dockerfile, docker-compose.yml, devcontainer.json, init-plugins.sh, .env.example, README.md
  - `.devcontainer/claude-code/` — Dockerfile, devcontainer.json, init-firewall.sh, init-plugins.sh, README.md
  - `.agents/skills/agent-browser/` — entire directory tree (to be removed)
  - `CLAUDE.md` — root-level, to be restructured into `.claude/`
  - `.github/workflows/build-devcontainer.yml` — builds default image locally (to be removed/updated)
  - `.gitignore` — has `.codex` and progress file patterns
  - Root progress files: `progress-2026-02-02-terminal-theme-redesign.txt`, `progress-plan-redesign-using-frontend-design-skill.txt`
- **Pre-built images from upstream**: `ghcr.io/gatezh/devcontainer-images/claude-code` (default target) and `ghcr.io/gatezh/devcontainer-images/claude-code-sandbox` (sandbox target)
- **User has already updated**: `.mise.toml` (only `bun` and `hugo`, removed `hugo-extended`/ralphex/rtk)
- **No `.codex`, `.gemini`, or `AGENTS.md`** files exist — only references in devcontainer postStartCommand

## Development Approach
- **Testing approach**: Regular (config migration, no code to unit-test)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: update this plan file when scope changes during implementation**
- Verify configuration files are valid JSON/YAML after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Move stray ralphex progress files
- [x] Move `progress-2026-02-02-terminal-theme-redesign.txt` to `.ralphex/progress/`
- [x] Move `progress-plan-redesign-using-frontend-design-skill.txt` to `.ralphex/progress/`
- [x] Verify files exist in `.ralphex/progress/` and are removed from root

### Task 2: Remove non-Claude agent configuration
- [x] Delete `.agents/` directory entirely (agent-browser skill, references, templates)
- [x] Remove `.codex` symlink reference from `.devcontainer/devcontainer.json` postStartCommand
- [x] Remove `.codex` symlink reference from `.devcontainer/claude-code/devcontainer.json` postStartCommand
- [x] Remove OpenAI Codex extension (`openai.chatgpt`) from `.devcontainer/claude-code/devcontainer.json`
- [x] Remove OpenAI/Codex domains (`auth.openai.com`, `api.openai.com`, `chatgpt.com`) from `init-firewall.sh` allowlist
- [x] Remove the "added permissions for Codex" comment from `init-firewall.sh`
- [x] Verify no remaining references to `.codex`, `openai`, or `AGENTS.md` in the project

### Task 3: Migrate default devcontainer to pre-built image
- [ ] Remove `.devcontainer/Dockerfile` (local build no longer needed)
- [ ] Remove `.devcontainer/docker-compose.yml` (no longer needed with image-based setup)
- [ ] Remove `.devcontainer/.env.example` (OAUTH token for local build)
- [ ] Rewrite `.devcontainer/devcontainer.json` to use `image: ghcr.io/gatezh/devcontainer-images/claude-code:latest`
  - Keep VS Code extensions (remove agent-browser since it's only in Dockerfile now)
  - Keep editor settings (OXC formatter, formatOnSave, etc.)
  - Keep containerEnv (TZ, NODE_OPTIONS, CLAUDE_CONFIG_DIR)
  - Add mounts for command history and Claude config persistence
  - Set workspace mount and folder
  - Keep postCreateCommand for `bun install` and plugin init
  - Set remoteUser to `node` (matching upstream image)
- [ ] Update `.devcontainer/init-plugins.sh` — remove agent-browser install (not available in sandbox), keep Claude plugin installs
- [ ] Update `.devcontainer/README.md` to reflect pre-built image setup
- [ ] Verify devcontainer.json is valid JSONC

### Task 4: Migrate claude-code sandbox devcontainer to pre-built image
- [ ] Remove `.devcontainer/claude-code/Dockerfile` (using pre-built sandbox image)
- [ ] Rewrite `.devcontainer/claude-code/devcontainer.json` to use `image: ghcr.io/gatezh/devcontainer-images/claude-code-sandbox:latest`
  - Keep NET_ADMIN/NET_RAW capabilities for firewall
  - Keep VS Code extensions (minus OpenAI — already removed in Task 2)
  - Keep editor settings, containerEnv, mounts
  - Keep postCreateCommand for plugin init
  - Keep postStartCommand for firewall init (use bind-mounted script)
  - Set remoteUser to `node`
- [ ] Update `.devcontainer/claude-code/README.md` to reflect pre-built image
- [ ] Add `sandbox-fetch-docs` skill from upstream: create `.claude/skills/sandbox-fetch-docs/SKILL.md`
- [ ] Verify devcontainer.json is valid JSONC

### Task 5: Update GitHub Actions workflow
- [ ] Remove `.github/workflows/build-devcontainer.yml` (no longer building images locally — images built in devcontainer-images repo)
- [ ] Verify `.github/workflows/ci.yml` and `deploy.yml` don't reference the removed workflow or devcontainer Dockerfile

### Task 6: Modernize CLAUDE.md into .claude/ structure
- [ ] Create `.claude/CLAUDE.md` with minimal critical rules only:
  - Package manager (bun only, pin exact versions)
  - Tool version sync (.mise.toml as source of truth)
  - Pre-completion checks (tsc, oxlint, build, test)
  - Import references to rules files
- [ ] Create `.claude/rules/project-structure.md` — monorepo structure, configuration formats
- [ ] Create `.claude/rules/hugo-theme.md` — theme conventions, Tailwind CSS, layouts (path-scoped to `services/www/**`)
- [ ] Create `.claude/rules/seo.md` — SEO configuration, robots.txt, llms.txt (path-scoped to `services/www/**`)
- [ ] Create `.claude/rules/deployment.md` — build commands, deployment, GitHub secrets/variables
- [ ] Create `.claude/rules/contact-form.md` — contact form configuration, worker secrets (path-scoped to `services/email-worker/**`)
- [ ] Delete root `CLAUDE.md`
- [ ] Verify all content from original CLAUDE.md is preserved across the new files

### Task 7: Update .gitignore and final cleanup
- [ ] Update `.gitignore` — keep `progress*.txt` pattern for ralphex, remove any stale entries
- [ ] Verify no orphaned references to old Dockerfile, docker-compose.yml, or `.agents/` anywhere in the project
- [ ] Run `bunx oxlint` from root to check for lint errors (if applicable to config files)

### Task 8: Verify acceptance criteria
- [ ] All devcontainer JSON files are valid JSONC
- [ ] No references to old Dockerfiles, docker-compose.yml, `.agents/`, `.codex`, or OpenAI remain
- [ ] `.claude/CLAUDE.md` exists with critical rules
- [ ] `.claude/rules/` contains modular topic files
- [ ] Root `CLAUDE.md` is deleted
- [ ] Progress files moved to `.ralphex/progress/`
- [ ] `build-devcontainer.yml` workflow removed
- [ ] `sandbox-fetch-docs` skill exists in `.claude/skills/`

*Note: ralphex automatically moves completed plans to `docs/plans/completed/`*

## Technical Details

### Pre-built Image Architecture
The `gatezh/devcontainer-images` repo builds a multi-stage Dockerfile with two targets:
- **default**: Full dev environment with passwordless sudo, agent-browser, Fish shell, Starship prompt, mise
- **sandbox**: Network-restricted variant with iptables/ipset packages, no agent-browser

Both images include: Node.js 24, Claude Code CLI, RTK, Ralphex, Playwright, Git Delta, GitHub CLI, mise (reads `.mise.toml` for bun/hugo versions).

### CLAUDE.md Rules Structure
```
.claude/
├── CLAUDE.md              # Critical rules only (~30 lines)
├── settings.json          # Existing permissions
├── rules/
│   ├── project-structure.md   # Monorepo layout, config formats
│   ├── hugo-theme.md          # paths: services/www/**
│   ├── seo.md                 # paths: services/www/**
│   ├── deployment.md          # Build commands, CI/CD, secrets
│   └── contact-form.md        # paths: services/email-worker/**
└── skills/
    └── sandbox-fetch-docs/
        └── SKILL.md           # Sandbox documentation fetching strategy
```

## Post-Completion
**Manual verification**:
- Open project in VS Code with Dev Containers extension to verify both variants load correctly
- Test that firewall sandbox blocks non-whitelisted domains
- Verify Claude Code recognizes `.claude/CLAUDE.md` and rules files
- Confirm pre-built images pull successfully from GHCR
