# Claude Code Sandbox Container

Pre-built devcontainer image from [gatezh/devcontainer-images](https://github.com/gatezh/devcontainer-images) with sandboxed network access for secure Claude Code development.

## Image

Uses `ghcr.io/gatezh/devcontainer-images/claude-code-sandbox:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI
- **Testing**: Playwright
- **Shell**: Zsh with Starship prompt, Fish shell, Git Delta
- **Firewall**: iptables/ipset packages for network sandboxing

## Network Sandbox

This container runs with a **default-deny firewall** (`init-firewall.sh`). Only whitelisted domains are accessible:

- npm registry
- GitHub
- Claude API
- VS Code Marketplace
- DNS and SSH connections

The firewall script runs via `postStartCommand` from the bind-mounted workspace. The container requires `NET_ADMIN` and `NET_RAW` capabilities.

See `init-firewall.sh` for the full allowlist.

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Usage

Open this project in VS Code with the Dev Containers extension, selecting the "Claude Code Sandbox" configuration. The container will pull the pre-built image and initialize the firewall automatically.

```bash
bun run dev          # Start Hugo dev server
bun run dev:worker   # Start email worker locally
bun run build        # Build all services
```

## Persistence

Named Docker volumes persist across container rebuilds:
- **Command history** - shell history retained between sessions
- **Claude config** - auth tokens and settings preserved

## Important Notes

- **Non-root user**: Runs as `node` (not root). Firewall setup uses passwordless sudo.
- **Docker not available**: `docker` and `docker compose` are not accessible from inside this sandbox.

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-plugins.sh` to add Claude Code plugin installations
- Edit `init-firewall.sh` to modify the network allowlist
