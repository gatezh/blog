#!/bin/bash
# Initialize Claude Code skills for the devcontainer
# This script is idempotent - safe to run multiple times

set -euo pipefail

echo "=== Claude Code Skill Initialization ==="

# Install agent-browser skill via Vercel skills CLI
echo "Installing agent-browser skill..."
npx -y skills add vercel-labs/agent-browser --skill agent-browser -a claude-code -y || {
    echo "Note: agent-browser install failed or unavailable - continuing"
}

echo "=== Skill initialization complete ==="
