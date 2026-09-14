# Claude Code Sandbox Container

Pre-built devcontainer image from [gatezh/devcontainers](https://github.com/gatezh/devcontainers) with sandboxed network access for secure Claude Code development.

## Image

Uses `ghcr.io/gatezh/devcontainers/claude-code-sandbox:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI, rtk, ralphex (no agent-browser — default variant only)
- **Testing**: system Chromium at `/usr/bin/chromium`
- **Shell**: Fish with Starship prompt, Git Delta
- **Firewall**: iptables/ipset packages for network sandboxing

## Image Freshness

`devcontainer.json` runs a host-side `initializeCommand`:

```jsonc
"initializeCommand": "docker pull ghcr.io/gatezh/devcontainers/claude-code-sandbox:latest || exit 0"
```

> **Do not add `pull_policy: always` to `docker-compose.yml`.** On Linux/WSL2,
> `updateRemoteUserUID` builds a local-only derived image; Compose would then try
> to pull that non-existent tag and fail with `pull access denied`
> ([gatezh/devcontainers#109](https://github.com/gatezh/devcontainers/issues/109)).

## Network Sandbox

This container runs with a **default-deny firewall** (`init-firewall.sh`). Only whitelisted domains are accessible:

- npm registry
- GitHub
- Claude API
- OpenAI API
- VS Code Marketplace
- DNS and SSH connections

The firewall script is bind-mounted from the project and runs via `postStartCommand`. The container requires `NET_ADMIN` and `NET_RAW` capabilities.

See `init-firewall.sh` for the full allowlist.

Setup runs in `postCreateCommand`, **before** the firewall comes up in
`postStartCommand` — so `mise install`, `bun install`, and plugin installation
still have unrestricted network access. Chromium is baked into the image for the
same reason: the firewall would block a runtime download.

## Authentication

The sandbox firewall blocks OAuth login. Generate a token on the host and inject it:

1. Run `claude setup-token` on your host machine
2. Set `CLAUDE_CODE_OAUTH_TOKEN` in your shell profile (`~/.zshrc` or `~/.bashrc`)
3. Restart VS Code

The sandbox `devcontainer.json` injects this via `${localEnv:CLAUDE_CODE_OAUTH_TOKEN}`.

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Usage

Open this project in VS Code with the Dev Containers extension, selecting the "Claude Code Sandbox" configuration. The container will pull the pre-built image and initialize the firewall automatically.

```bash
bun run dev          # Start Hugo dev server
bun run dev:api   # Start the API Worker locally
bun run build        # Build all services
```

## Persistence

Named Docker volumes (prefixed `gatezh-com-`) persist across container rebuilds
and are shared with the default variant:

- **node_modules** - isolated per workspace directory (root, services/www, services/api)
- **Claude config** - auth tokens and settings preserved
- **Fish data** - shell history and completions retained

## Important Notes

- **Non-root user**: Runs as `node` (not root). Firewall setup uses passwordless sudo.
- **Docker not available**: `docker` and `docker compose` are not accessible from inside this sandbox.

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-firewall.sh` to modify the network allowlist
- Edit `../init-plugins.sh` to change the marketplace/plugin list (shared with the default variant)
