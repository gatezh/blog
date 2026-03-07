# Claude Code Development Container

Node-based devcontainer optimized for Claude Code with sandboxed network access and comprehensive development tooling.

## Stack

- **OS**: Debian Trixie (via Node 20 base image)
- **Base Image**: `node:20-trixie`
- **Tools**:
  - **Bun**: JavaScript runtime and package manager (version from `.mise.toml`)
  - **Hugo**: Static site generator (version from `.mise.toml`)
  - **Ralphex**: Claude Code plugin and CLI tool
  - **RTK**: CLI proxy that reduces token consumption by filtering command output ([rtk-ai/rtk](https://github.com/rtk-ai/rtk))
- **Claude Code Integrations**:
  - Claude Code CLI
  - RTK auto-rewrite hook (reduces token usage 60-90% on common commands)
  - VS Code firewall configuration (`init-firewall.sh`)
  - Custom plugin support via `init-plugins.sh`
- **Development Tools**:
  - Git & Git Delta
  - Zsh with Powerlevel10k
  - FZF (fuzzy finder)
  - GitHub CLI (`gh`)
  - Playwright (headless shell for browser testing)

## Version Management

Bun, Hugo, Ralphex, and RTK are managed by [mise](https://mise.jdx.dev/) from [/.mise.toml](../../.mise.toml):

```toml
[tools]
bun = "1.3.10"
hugo-extended = "0.157.0"
"github:umputun/ralphex" = "0.20.0"
"github:rtk-ai/rtk" = "0.25.0"
```

Node is provided by the base image (`node:20-trixie`) and is intentionally **not** installed via mise — mise's shims would shadow the base image's `npx`, breaking Playwright installation.

Dockerfile-specific versions (configured as ARGs):

| ARG | Default | Purpose |
|-----|---------|---------|
| `CLAUDE_CODE_VERSION` | `latest` | Claude Code CLI version |
| `GIT_DELTA_VERSION` | `0.18.2` | Git Delta version |
| `ZSH_IN_DOCKER_VERSION` | `1.2.0` | zsh-in-docker version |

## Network Sandbox

This container runs with a **default-deny firewall** (`init-firewall.sh`). Only whitelisted domains are accessible:

- npm registry
- GitHub
- Claude API
- OpenAI/Codex API
- VS Code Marketplace
- DNS and SSH connections

See `init-firewall.sh` for the full allowlist.

## Usage

### Claude Code

Claude Code is pre-installed and ready to use:

```bash
claude --help
```

### Local Development

```bash
bun dev          # Start all services
bun dev:www      # Start Hugo dev server only
bun dev:worker   # Start email worker only
```

## Important Notes

- **Non-root user**: Runs as `node` (not root). Firewall setup uses passwordless sudo.
- **npm global directory**: Pre-configured at `/usr/local/share/npm-global/lib` to prevent npm install errors.
- **Playwright**: Installed with headless shell only (`--only-shell`) for smaller image size.
- **Shared `.mise.toml`**: This container shares `.mise.toml` with the default devcontainer for Bun version consistency.
- **Docker not available**: `docker` and `docker compose` are not accessible from inside this sandbox.

## Image Publishing

The image can be built and pushed to GHCR for use as a pre-built devcontainer. Triggers for rebuild:
- `.devcontainer/claude-code/Dockerfile`
- `.mise.toml`
- `package.json` (Playwright version)

To use the pre-built image, update `devcontainer.json`:
```jsonc
"image": "ghcr.io/gatezh/blog/devcontainer-claude:latest",
// "build": { ... }  // comment out build section
```

## Customization

Edit `.mise.toml` to update Bun, Hugo, Ralphex, or RTK versions. For other tool versions (Git Delta, zsh-in-docker), update the corresponding `ARG` in the Dockerfile.
