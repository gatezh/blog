# Default Development Container

Pre-built devcontainer image from [gatezh/devcontainers](https://github.com/gatezh/devcontainers) for local development.

## Image

Uses `ghcr.io/gatezh/devcontainers/claude-code:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI, agent-browser
- **Testing**: Playwright
- **Shell**: Fish with Starship prompt, Git Delta

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Usage

Open this project in VS Code with the Dev Containers extension. The container will pull the pre-built image and run setup automatically.

```bash
bun run dev          # Start Hugo dev server
bun run dev:worker   # Start email worker locally
bun run build        # Build all services
```

## Persistence

Named Docker volumes persist across container rebuilds:
- **node_modules** - isolated per workspace directory (root, services/www, services/email-worker)
- **Claude config** - auth tokens and settings preserved
- **Fish data** - shell history and completions retained

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-plugins.sh` to add Claude Code plugin installations
