# Debian Trixie base (GLIBC 2.41) — required for RTK binary compatibility
FROM node:20-trixie

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure npm global directory structure exists with proper permissions
# CRITICAL: NPM_CONFIG_PREFIX below is set to /usr/local/share/npm-global, which means npm
# expects the /lib subdirectory to exist (npm installs to $PREFIX/lib/node_modules).
# Pre-creating /lib prevents "ENOENT: no such file or directory" errors when running npx
# commands during build (e.g., npx playwright install-deps). See: error.log history.
RUN mkdir -p /usr/local/share/npm-global/lib && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install mise (polyglot version manager — reads .mise.toml for bun, hugo, ralphex, rtk)
USER root
RUN curl https://mise.run | sh \
    && cp /root/.local/bin/mise /usr/local/bin/mise

# Install tools from .mise.toml as node user so shims land in /home/node/
# Explicit tool list — node is provided by the base image (node:20-trixie);
# if node is listed in .mise.toml, mise's shims would shadow the base
# image's npx and Playwright installation hangs (npm 11.x issue)
USER node
COPY --chown=node:node .mise.toml /tmp/.mise.toml
RUN cd /tmp \
    && mise trust . \
    && mise install bun hugo-extended "github:umputun/ralphex" "github:rtk-ai/rtk" \
    && mise reshim \
    && mkdir -p /home/node/.config/mise && cp .mise.toml /home/node/.config/mise/config.toml \
    && rm .mise.toml
ENV PATH="/home/node/.local/share/mise/shims:$PATH"

# Trust workspace so mise doesn't prompt when the repo is bind-mounted at runtime
ENV MISE_TRUSTED_CONFIG_PATHS="/workspace"

# Install Playwright browser dependencies (as root) and headless shell (as node)
# Version extracted from root package.json — no hardcoded version
# Using --only-shell for headless-only testing (smaller download, all we need for CI/testing)
COPY --chown=node:node package.json /tmp/package.json
USER root
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/package.json').devDependencies['@playwright/test']") \
    && npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium
USER node
RUN PLAYWRIGHT_VERSION=$(node -p "require('/tmp/package.json').devDependencies['@playwright/test']") \
    && npx -y playwright@${PLAYWRIGHT_VERSION} install --only-shell \
    && rm /tmp/package.json

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Copy and set up firewall script
COPY .devcontainer/claude-code/init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
