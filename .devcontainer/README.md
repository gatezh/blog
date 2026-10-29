# Default Development Container

Pre-built devcontainer image from [gatezh/devcontainers](https://github.com/gatezh/devcontainers) for local development.

## Image

Uses `ghcr.io/gatezh/devcontainers/claude-code:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI, agent-browser, ralphex
- **Testing**: system Chromium at `/usr/bin/chromium` (see [Playwright](#playwright))
- **Shell**: zsh with Starship prompt, Git Delta

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

The Playwright **MCP** plugin needs the same redirect. The image handles it by
setting `PLAYWRIGHT_MCP_BROWSER`, `PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium`
and `PLAYWRIGHT_MCP_HEADLESS`, which `@playwright/mcp` reads in place of its
command-line flags, so the plugin's `.mcp.json` stays as shipped and nothing in
this project touches it.

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Lifecycle Commands

| Hook                   | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `initializeCommand`    | Pulls the latest image on the **host**                       |
| `updateContentCommand` | `chown-volumes` (image-baked), `mise install`, `bun install` |

There is deliberately no `postCreateCommand`: `claude` CLI calls there race the
extension's OAuth sign-in ([gatezh/devcontainers#58](https://github.com/gatezh/devcontainers/issues/58)).
After signing in to Claude Code for the first time, run:

```bash
bash .devcontainer/init-plugins.sh
```

It registers the marketplaces, installs the plugins, seeds session retention,
and updates everything to the latest version. Run it again whenever you want to
update the plugins.

Two plugins aren't in it. The image's managed settings declare the `gatezh`
marketplace and force-enable `dev@gatezh`. `.claude/settings.json` declares
`typescript-native-lsp` (with auto-update on) and disables `typescript-lsp`,
which fails on TypeScript 7. Claude Code loads typescript-native-lsp once you
trust the folder.

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

Named Docker volumes (prefixed `gatezh-com-`) persist across container rebuilds.
The sandbox variant has its own set; it shares none of these
([why](https://github.com/gatezh/devcontainers#why-the-variants-dont-share-volumes)).

- **node_modules** - isolated per workspace directory (root, services/www, services/api)
- **Claude config** (`~/.claude`) - auth tokens, settings, session history
- **gh CLI** (`~/.config/gh`) - `gh auth login` survives a rebuild. Git uses it
  for github.com too (`GIT_CONFIG_*` in `containerEnv`), so HTTPS pushes need no
  other credential helper.
- **cf CLI** (`~/.config/cloudflare`) - `cf auth login` survives a rebuild.
  Wrangler's own login (`~/.config/.wrangler`) is not on a volume, so
  `wrangler login` is lost on rebuild; deploys run in CI, so this rarely matters
- **zsh history** (`/commandhistory`)
- **Bun package cache** (`bun-global-store`) - shared by every project on this
  image, declared in `docker-compose.yml`

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-plugins.sh` to change the marketplace/plugin list (it is a template, not image-baked — each project owns its own list)
