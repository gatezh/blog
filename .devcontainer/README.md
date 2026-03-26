# Default Development Container

Pre-built devcontainer image from [gatezh/devcontainer-images](https://github.com/gatezh/devcontainer-images) for local development.

## Image

Uses `ghcr.io/gatezh/devcontainer-images/claude-code:latest` which includes:

- **OS**: Debian with Node.js 24
- **Tools**: Bun, Hugo (via mise from `.mise.toml`), Git, GitHub CLI
- **AI**: Claude Code CLI
- **Testing**: Playwright
- **Shell**: Zsh with Starship prompt, Fish shell, Git Delta

## Version Management

Tool versions are centrally managed in [/.mise.toml](../../.mise.toml). The pre-built image includes mise, which reads `.mise.toml` at runtime to activate the correct versions of bun, hugo, and other tools.

## Usage

Open this project in VS Code with the Dev Containers extension. The container will pull the pre-built image and run `bun install` automatically.

```bash
bun run dev          # Start Hugo dev server
bun run dev:worker   # Start email worker locally
bun run build        # Build all services
```

## Persistence

Named Docker volumes persist across container rebuilds:
- **Command history** - shell history retained between sessions
- **Claude config** - auth tokens and settings preserved

## Customization

- Edit `.mise.toml` to update tool versions (bun, hugo)
- Edit `devcontainer.json` to modify VS Code extensions or settings
- Edit `init-plugins.sh` to add Claude Code plugin installations
