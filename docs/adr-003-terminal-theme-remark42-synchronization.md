# ADR-003: Remark42 Theme Synchronization with Terminal Theme

## Status

Accepted

## Context

The blog moved from PaperMod theme to a custom terminal theme. The previous approach (ADR-001) used PaperMod's extension points (`extend_head.html` and `extend_footer.html`) to synchronize Remark42 comments widget theme. The new terminal theme has its own three-position theme switcher (light/dark/system) that dispatches a custom `themechange` event.

The challenges were:
- Detect initial theme correctly from localStorage or system preference
- Synchronize Remark42 widget when user toggles theme
- Handle the "system" theme position that follows OS preference changes

## Decision

Implemented theme synchronization in a single `comments.html` partial that:

1. **Initial theme detection** - Reads from localStorage (`theme` key) or falls back to system preference via `matchMedia`
2. **Theme toggle synchronization** - Listens for `themechange` custom event dispatched by `theme-toggle.html`
3. **System preference tracking** - Listens for system preference changes when theme is set to "system"
4. **Remark42 API call** - Calls `REMARK42.changeTheme()` API with appropriate theme value

### Key Implementation Details

The `remark_config` object is initialized with the correct theme using an IIFE that:
- Checks localStorage for explicit `theme` value (`light` or `dark`)
- If value is `system` or missing, checks `window.matchMedia('(prefers-color-scheme: dark)')`

The synchronization script:
- Uses `syncRemark42Theme(isDark)` helper that safely calls `REMARK42.changeTheme()`
- Listens for `themechange` event which includes `{ theme, isDark }` in detail
- Listens for system preference changes only when theme is set to "system"

## Rationale

**Why a single file instead of two extension partials?**

The terminal theme is fully custom and doesn't use PaperMod's extension points. A single `comments.html` partial is cleaner and self-contained.

**Why listen for custom event instead of detecting class changes?**

The `themechange` event provides both the theme value and `isDark` boolean, eliminating the need to re-detect state. This creates clean decoupling between the theme toggle and comment widget.

**Why duplicate system preference detection?**

The initial theme must be known before Remark42 loads (in `remark_config`), so we can't rely solely on the `themechange` event. The duplication is unavoidable for correct initialization.

## Alternatives Considered

1. **Use MutationObserver on document.documentElement**
   - Pros: No custom event needed
   - Cons: More overhead, less explicit about intent
   - Why rejected: Custom event pattern is cleaner and more explicit

2. **Move all theme logic to a shared JavaScript module**
   - Pros: DRY code
   - Cons: Adds build complexity, requires bundler
   - Why rejected: Hugo templates with inline scripts are simpler for this use case

## Consequences

### Positive
- Single file implementation (vs two files in PaperMod approach)
- Custom event pattern provides clean decoupling
- Three-position theme (including "system") handled properly
- Remark42 comments correctly sync with site theme

### Negative
- Theme detection logic exists in multiple places (head.html, theme-toggle.html, comments.html)
- Requires understanding of custom event pattern

### Neutral
- ADR-001 is now superseded
- Implementation is self-contained in the terminal theme

## References

- [ADR-001](./adr-001-remark42-theme-synchronization.md) - Superseded PaperMod approach
- [Remark42 Frontend Configuration](https://remark42.com/docs/configuration/frontend/)
- [CustomEvent API](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)

## Implementation

- **Files Modified:**
  - `services/www/themes/terminal/layouts/partials/comments.html` (created)
  - `services/www/themes/terminal/layouts/partials/theme-toggle.html` (created)
  - `services/www/themes/terminal/layouts/partials/head.html` (created)

---

**Date:** 2026-02-02
