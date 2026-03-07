# Default Development Container

Debian-based devcontainer for local development with mise as the version manager for core tools.

## Stack

- **OS**: Debian Trixie (slim)
- **Package Manager**: Mise (polyglot version manager)
- **Tools**:
  - **Bun**: JavaScript runtime and package manager
  - **Node**: Required by VS Code extensions (OXC, Playwright)
  - **Hugo**: Static site generator (extended)
- **Additional**:
  - Playwright (for browser testing)
  - Claude Code CLI
  - agent-browser (headless browser automation for AI agents)
  - Powerlevel10k (zsh theme)

## Version Management

All tool versions are centrally managed in [/.mise.toml](../../.mise.toml):

```toml
[tools]
bun = "1.3.10"
node = "20"
hugo-extended = "0.157.0"
"github:umputun/ralphex" = "0.20.0"  # Claude Code devcontainer only
"github:rtk-ai/rtk" = "0.25.0"      # Claude Code devcontainer only
```

Ralphex and RTK are only installed in the Claude Code devcontainer (via mise), not in this one.

Playwright version is extracted from root `package.json` (`@playwright/test` devDependency) at build time.

## Usage

### Local Development

```bash
# From project root
bun dev          # Start all services in parallel
bun dev:www      # Start Hugo dev server only
bun dev:worker   # Start email worker only
bun build        # Build all services
```

## Docker Compose Services

| Service | Image | Purpose |
|---------|-------|---------|
| `app` | Built from this Dockerfile | Main dev container |

## Image Publishing

The image can be built and pushed to GHCR for use as a pre-built devcontainer. Triggers for rebuild:
- `.devcontainer/Dockerfile`
- `.mise.toml`
- `package.json` (Playwright version)

To use the pre-built image, update `docker-compose.yml`:
```yaml
image: ghcr.io/gatezh/blog/devcontainer:latest
```

## Customization

Edit `.mise.toml` to update Bun, Node, or Hugo versions. All environments (this devcontainer, Claude Code devcontainer, CI) pick up the change automatically.
