---
description: Stage changes, generate commit message, and commit
allowed-tools: Bash, Read
---

Generate a commit message and commit the changes.

## Instructions

1. Check if there are staged files (`git diff --cached --name-only`)
2. If nothing is staged → stage all changes (`git add -A`)
3. If files are already staged → leave unstaged files alone
4. Analyze the staged changes (`git diff --cached`)
5. Generate a conventional commit message
6. Display the commit message in chat
7. Commit with the generated message (`git commit -m "..."`)

## Output format
```
<type>(<scope>): <concise summary>

- [bullet points if needed]
```

Use conventional commit types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`

Keep the summary under 72 characters.
