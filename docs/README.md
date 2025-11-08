# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for this project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Understand why decisions were made
- Onboard new team members faster
- Avoid revisiting settled decisions
- Track the evolution of the architecture

## Naming Convention

ADRs follow this naming pattern:

```
adr-NNN-title-with-dashes.md
```

Where:
- `NNN` is a sequential three-digit number (001, 002, 003, etc.)
- `title-with-dashes` is a short, lowercase, hyphen-separated title

**Examples:**
- `adr-001-remark42-theme-synchronization.md`
- `adr-002-deployment-platform-choice.md`
- `adr-003-comment-system-selection.md`

## Structure

All ADRs should follow the standard template provided in [`adr-template.md`](./adr-template.md).

### Required Sections

1. **Status** - Proposed, Accepted, Deprecated, or Superseded
2. **Context** - The issue motivating this decision
3. **Decision** - The change that was made
4. **Rationale** - Why this decision was chosen
5. **Alternatives Considered** - Other options that were evaluated
6. **Consequences** - Positive, negative, and neutral outcomes
7. **References** - Links to discussions, docs, and related resources
8. **Implementation** - Links to issues, PRs, and modified files

## Creating a New ADR

1. Copy `adr-template.md` to create a new file
2. Use the next sequential number in the filename
3. Fill in all required sections
4. Submit via pull request for review
5. Update the [Index](#index) below once accepted

## Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [001](./adr-001-remark42-theme-synchronization.md) | Remark42 Theme Synchronization with PaperMod | Accepted | 2025-11-08 |
| [002](./adr-002-csp-configuration.md) | Content Security Policy Configuration | Accepted | 2025-11-07 |

## Resources

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR Tools](https://github.com/npryce/adr-tools)
