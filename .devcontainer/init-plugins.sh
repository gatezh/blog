#!/bin/bash
# Claude Code plugin initialization — runs once at container creation.
# Idempotent — safe to run multiple times.
#
# Wire into postCreateCommand in your devcontainer.json:
#   "postCreateCommand": "bash .devcontainer/init-plugins.sh"

set -euo pipefail

# Mark onboarding complete so claude CLI doesn't hang on interactive prompts
if [ -f "$HOME/.claude/.claude.json" ]; then
    jq '.hasCompletedOnboarding = true' "$HOME/.claude/.claude.json" > /tmp/.claude.json \
        && mv /tmp/.claude.json "$HOME/.claude/.claude.json"
else
    mkdir -p "$HOME/.claude"
    echo '{"hasCompletedOnboarding":true}' > "$HOME/.claude/.claude.json"
fi

# ── Claude Code session retention ───────────────────────────────────────────
# Session transcripts live in ~/.claude/projects, which is a named volume — so a
# fresh volume starts on the 30-day default and silently drops older history.
# Seed a longer retention, but only when unset, so a deliberate local value wins.
SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
    current=$(jq -r '.cleanupPeriodDays // "unset"' "$SETTINGS" 2>/dev/null || echo unset)
    if [ "$current" = "unset" ]; then
        if jq '.cleanupPeriodDays = 365' "$SETTINGS" > /tmp/.claude-settings.json \
            && mv /tmp/.claude-settings.json "$SETTINGS"; then
            echo "✔ Session retention seeded: cleanupPeriodDays=365"
        else
            echo "⚠ Failed to seed cleanupPeriodDays" >&2
        fi
    fi
else
    mkdir -p "$HOME/.claude"
    echo '{"cleanupPeriodDays":365}' > "$SETTINGS"
    echo "✔ Session retention seeded: cleanupPeriodDays=365"
fi

# ── Claude Code marketplaces ────────────────────────────────────────────────
# The official marketplace is auto-configured on first interactive launch, but
# postCreateCommand runs before that — register explicitly so plugin install works.
MARKETPLACES=(
    "anthropics/claude-plugins-official"
    "umputun/ralphex"
    "GoogleChrome/modern-web-guidance"
    "AgriciDaniel/claude-seo"
    "cloudflare/skills"
)

for marketplace in "${MARKETPLACES[@]}"; do
    if claude plugin marketplace add "$marketplace" 2>&1; then
        echo "✔ Marketplace added: $marketplace"
    else
        echo "⚠ Failed to add marketplace: $marketplace" >&2
    fi
done

# ── Claude Code plugins ─────────────────────────────────────────────────────
# Customize this list — remove plugins you don't use.
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
    "modern-web-guidance@googlechrome"
    # SEO toolkit — technical SEO, schema, E-E-A-T, GEO/AEO. Relevant: this repo
    # ships JSON-LD, llms.txt, and per-post SEO front matter.
    "claude-seo@agricidaniel-claude-seo"
    # Cloudflare's own marketplace: current Workers/Wrangler skills + MCP server.
    # The claude-plugins-official copy is a stale snapshot.
    "cloudflare@cloudflare"
)

for plugin in "${PLUGINS[@]}"; do
    if claude plugin install "$plugin" 2>&1; then
        echo "✔ Installed: $plugin"
    else
        echo "⚠ Failed to install: $plugin" >&2
    fi
done

# ── Playwright MCP: route every cached .mcp.json to system chromium ─────────
# Universal across arches (no Chrome stable binary in either default or sandbox).
# The patch binary is baked into the image and also runs from postStartCommand
# and a Claude Code SessionStart hook — the hook is what closes the gap when the
# plugin auto-updates mid-container-run. It loops over every cache dir, unlike
# the old ARM64-only `find -print -quit` which left newer dirs unpatched.
# See gatezh/devcontainers#64, #85, #87, #98.
/usr/local/bin/patch-playwright-mcp

# ── rtk init (token-optimized CLI proxy) ────────────────────────────────────
# Global hook-first mode: installs only the PreToolUse rewrite hook to ~/.claude/,
# no workspace artifacts (CLAUDE.md, .rtk/). Safe to run multiple times.
# RTK_TELEMETRY_DISABLED=1 is the supported opt-out, not a workaround: since
# rtk-ai/rtk#2477 (v0.44.0+) it short-circuits the telemetry consent prompt that
# would otherwise block on stdin here. rtk's own TTY check is not enough — a
# devcontainer postCreateCommand gets a pseudo-TTY, so the prompt believes it is
# interactive. timeout stays as a backstop against a future init-time hang.
if command -v rtk &>/dev/null; then
    RTK_TELEMETRY_DISABLED=1 timeout 10 rtk init -g --hook-only --auto-patch 2>/dev/null || true
fi

# ── agent-browser skill ─────────────────────────────────────────────────────
# Installs the agent-browser Claude Code skill for headless browser automation.
# agent-browser CLI is pre-installed in the default devcontainer image (not sandbox).
if command -v agent-browser &>/dev/null; then
    agent-browser install-skill 2>/dev/null || true
fi
