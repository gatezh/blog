---
name: sandbox-fetch-docs
description: Fetch documentation in the sandbox devcontainer where network access is restricted to whitelisted domains only
---

# Sandbox Documentation Fetching

This project's Claude Code sandbox container runs a default-deny firewall. Only specific domains are whitelisted (GitHub, npm registry, Claude API, VS Code Marketplace).

## When fetching documentation

1. **Prefer local sources first**: Check if documentation exists in `node_modules/`, project files, or `docs/`
2. **Use GitHub raw content**: Most library docs are on GitHub, which is whitelisted. Use raw.githubusercontent.com URLs
3. **Use npm registry**: Package metadata is available via `npm view <package> --json`
4. **Avoid blocked domains**: General websites (MDN, Stack Overflow, official doc sites) are not accessible from the sandbox

## Fetching strategies

### For npm packages
```bash
# Package info and README
npm view <package> readme
npm view <package> --json
```

### For GitHub-hosted docs
```bash
# Fetch raw file content from GitHub
curl https://raw.githubusercontent.com/<owner>/<repo>/<branch>/README.md
```

### For local documentation
```bash
# Check installed package docs
cat node_modules/<package>/README.md
```

## If a domain is blocked

If you need to fetch from a blocked domain, inform the user. They can either:
- Add the domain to `.devcontainer/claude-code/init-firewall.sh` and restart the container
- Provide the documentation content directly
