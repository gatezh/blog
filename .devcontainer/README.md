# Default Development Container

Pre-built devcontainer image from [gatezh/devcontainers](https://github.com/gatezh/devcontainers) for local development.

## Image

Uses `ghcr.io/gatezh/devcontainers/claude-code:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI, agent-browser, rtk, ralphex
- **Testing**: system Chromium at `/usr/bin/chromium` (see [Playwright](#playwright))
- **Shell**: Fish with Starship prompt, Git Delta

The image is rebuilt upstream whenever one of its pinned tools ships a release
(Renovate opens the bump, CI builds amd64 + arm64 natively).

## Image Freshness

`devcontainer.json` runs a host-side `initializeCommand`:

```jsonc
"initializeCommand": "docker pull ghcr.io/gatezh/devcontainers/claude-code:latest || exit 0"
```

This pulls the newest image before the container is built, so "Rebuild Without
Cache" always layers on the freshest base, and `|| exit 0` keeps offline opens
working.

> **Do not add `pull_policy: always` to `docker-compose.yml`.** On Linux/WSL2,
> `updateRemoteUserUID` builds a local-only derived image; Compose would then try
> to pull that non-existent tag and fail with `pull access denied`
> ([gatezh/devcontainers#109](https://github.com/gatezh/devcontainers/issues/109)).
> Keep the image reference in `initializeCommand` in sync with the compose file.

## Playwright

Chromium is baked into the image via apt, and the image sets
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — so there is no `playwright install` step
in the lifecycle commands. `services/www/playwright.config.ts` reads
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and falls back to Playwright's own managed
browser on the host and in CI, where that variable is unset.

The Playwright **MCP** plugin needs the same redirect. `/usr/local/bin/patch-playwright-mcp`
(baked into the image) rewrites every cached `.mcp.json` to launch
`/usr/bin/chromium`. It runs from `init-plugins.sh`, from `postStartCommand`, and
from a Claude Code `SessionStart` hook — the last one catches plugin auto-updates
that land mid-session.

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Lifecycle Commands

| Hook                   | What it does                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `initializeCommand`    | Pulls the latest image on the **host**                            |
| `updateContentCommand` | Fixes volume ownership, `mise install`, `bun install`             |
| `postCreateCommand`    | `init-plugins.sh` — marketplaces, plugins, rtk, session retention |
| `postStartCommand`     | Re-patches Playwright MCP configs                                 |

## Usage

Open this project in VS Code with the Dev Containers extension and pick
**Local Development**. The container pulls the pre-built image and runs setup
automatically.

```bash
bun run dev          # Start Hugo dev server
bun run dev:api   # Start the API Worker locally
bun run build        # Build all services
```

## Persistence

Named Docker volumes (prefixed `gatezh-com-`) persist across container rebuilds
and are shared with the sandbox variant:

- **node_modules** - isolated per workspace directory (root, services/www, services/api)
- **Claude config** - auth tokens and settings preserved
- **Fish data** - shell history and completions retained

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-plugins.sh` to change the marketplace/plugin list (it is a template, not image-baked — each project owns its own list)
