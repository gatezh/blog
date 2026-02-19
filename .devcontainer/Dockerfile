FROM debian:trixie-slim

# Install system dependencies:
# - ca-certificates: SSL/TLS for HTTPS connections
# - curl: downloading mise
# - git: version control
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install mise (polyglot version manager — reads .mise.toml)
RUN curl https://mise.run | sh
ENV PATH="/root/.local/bin:$PATH"

# Install tools from .mise.toml (bun, hugo — single source of truth)
# Also set as global config so mise shims resolve in any directory during build
COPY .mise.toml /tmp/.mise.toml
RUN cd /tmp && mise trust . && mise install \
    && mkdir -p ~/.config/mise && cp .mise.toml ~/.config/mise/config.toml \
    && rm .mise.toml
ENV PATH="/root/.local/share/mise/shims:$PATH"

# Trust workspace so mise doesn't prompt when the repo is bind-mounted at runtime
ENV MISE_TRUSTED_CONFIG_PATHS="/workspace"

WORKDIR /workspace
