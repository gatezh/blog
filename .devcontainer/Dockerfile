FROM debian:trixie-slim

# Install system dependencies:
# - ca-certificates: SSL/TLS for HTTPS connections
# - curl: downloading mise
# - git: version control, cloning powerlevel10k
# - gnupg: package signing verification
# - unzip: extracting archives
# - zsh: shell
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gnupg \
        unzip \
        zsh \
    && rm -rf /var/lib/apt/lists/*

# Install mise (version manager for dev tools)
RUN curl https://mise.run | sh
ENV PATH="/root/.local/bin:$PATH"

# Install tools from .mise.toml (single source of truth)
# Also set as global config so mise shims resolve in any directory during build
# Node is required to run Playwright (bunx hangs on arm64)
# See: https://github.com/oven-sh/bun/issues/16708
COPY .mise.toml /tmp/.mise.toml
RUN cd /tmp && mise trust . && mise install \
    && mkdir -p ~/.config/mise && cp .mise.toml ~/.config/mise/config.toml \
    && rm .mise.toml
ENV PATH="/root/.local/share/mise/shims:$PATH"

# Trust workspace so mise doesn't prompt when the repo is bind-mounted at runtime
ENV MISE_TRUSTED_CONFIG_PATHS="/workspace"

# Ensure bun global installs work correctly
ENV BUN_INSTALL_BIN=/usr/local/bin

# Install Playwright browser dependencies and headless shell
# Version extracted from root package.json — no hardcoded version
# Using --only-shell for headless-only testing (smaller download, all we need for CI/testing)
# agent-browser below installs its own full chromium separately
COPY package.json /tmp/package.json
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/package.json').devDependencies['@playwright/test']") \
    && npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/package.json').devDependencies['@playwright/test']") \
    && npx -y playwright@${PLAYWRIGHT_VERSION} install --only-shell \
    && rm /tmp/package.json

# Install Powerlevel10k (zsh theme) — after Playwright for better layer caching
RUN git clone --depth=1 https://github.com/romkatv/powerlevel10k.git /usr/share/powerlevel10k

# Configure zsh with Powerlevel10k (wizard disabled)
RUN echo 'POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD=true' >> /etc/zsh/zshrc \
    && echo 'source /usr/share/powerlevel10k/powerlevel10k.zsh-theme' >> /etc/zsh/zshrc

ENV SHELL=/bin/zsh

# Install Claude Code CLI
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Install agent-browser (headless browser automation for AI agents)
# After installing, run playwright-core install from agent-browser's own bundled
# playwright-core so its browser is pre-installed at image build time.
# Uses $(npm root -g) to avoid hardcoding the Node version path.
ARG AGENT_BROWSER_VERSION=0.14.0
RUN npm install -g agent-browser@${AGENT_BROWSER_VERSION} \
    && $(npm root -g)/agent-browser/node_modules/.bin/playwright-core install --with-deps chromium

WORKDIR /workspace
