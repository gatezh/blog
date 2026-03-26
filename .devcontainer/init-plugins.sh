#!/bin/bash
# Initialize Claude Code plugins for the devcontainer
# This script is idempotent - safe to run multiple times

set -euo pipefail

echo "=== Claude Code Plugin Initialization ==="

# Add official Anthropic marketplace (idempotent - will update if exists)
echo "Adding official Anthropic plugin marketplace..."
claude plugin marketplace add anthropics/claude-plugins-official || {
    echo "Note: Marketplace may already be added or claude not available yet"
}

# Add ralphex marketplace
echo "Adding ralphex plugin marketplace..."
claude plugin marketplace add umputun/ralphex || {
    echo "Note: ralphex marketplace may already be added or unavailable"
}

# List of plugins to install
PLUGINS=(
    "frontend-design@claude-plugins-official"
    "code-review@claude-plugins-official"
    "typescript-lsp@claude-plugins-official"
    "code-simplifier@claude-plugins-official"
    "playwright@claude-plugins-official"
    "superpowers@claude-plugins-official"
    "explanatory-output-style@claude-plugins-official"
    "claude-md-management@claude-plugins-official"
    "claude-code-setup@claude-plugins-official"
    "posthog@claude-plugins-official"
    "ralphex@ralphex"
)

# Install each plugin (idempotent - will skip if already installed)
echo "Installing Claude Code plugins..."
for plugin in "${PLUGINS[@]}"; do
    echo "  Installing: $plugin"
    claude plugin install "$plugin" 2>/dev/null || {
        echo "    Note: $plugin may already be installed or unavailable"
    }
done

# Initialize rtk global hook for Claude Code (auto-rewrite mode)
# Installs PreToolUse hook to ~/.claude/hooks/rtk-rewrite.sh and patches settings.json
# --auto-patch skips interactive prompt (required for non-interactive container setup)
# https://github.com/rtk-ai/rtk
echo "Initializing rtk (token optimizer)..."
rtk init -g --auto-patch || {
    echo "Note: rtk init may have already been configured or rtk not available"
}

echo "=== Plugin initialization complete ==="
