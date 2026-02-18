FROM debian:trixie-slim

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Install essential packages
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  sudo \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid $USER_GID $USERNAME \
  && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
  && echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
  && chmod 0440 /etc/sudoers.d/$USERNAME

USER $USERNAME

# Install mise (tool version manager)
RUN curl https://mise.run | sh
ENV PATH="/home/${USERNAME}/.local/bin:${PATH}"

# Copy .mise.toml and install tools
COPY --chown=${USERNAME}:${USERNAME} .mise.toml /home/${USERNAME}/.mise.toml
RUN cd /home/${USERNAME} && mise install

# Add mise shims to PATH
RUN mise reshim
ENV PATH="/home/${USERNAME}/.local/share/mise/shims:${PATH}"
