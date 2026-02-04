# ADR 001: Remark42 Theme Synchronization with PaperMod

## Status

Superseded - Replaced by custom terminal theme implementation in `apps/web/themes/terminal/layouts/partials/comments.html`

## Context

The blog uses Remark42 as the commenting engine and Hugo PaperMod theme with dark/light mode toggle. Issue #30 reported that Remark42 comments remained in light mode regardless of the blog's theme setting, creating a jarring user experience when switching to dark mode.

The challenge was to synchronize Remark42's theme with PaperMod's theme toggle without modifying the theme files directly, ensuring future theme updates wouldn't break the implementation.

## Decision

We implemented theme synchronization using PaperMod's **extension point pattern** via two partial templates:

### 1. `layouts/partials/extend_head.html`
**Purpose:** Define Remark42 configuration with initial theme detection

- Must be in `<head>` section because `comments.html` partial (which loads Remark42 scripts) requires `remark_config` to be defined before it executes
- Cannot use `document.body.className` (body doesn't exist yet in head)
- Reads theme from `localStorage.getItem("pref-theme")` - the same source PaperMod uses
- Falls back to system preference via `window.matchMedia('(prefers-color-scheme: dark)')`

### 2. `layouts/partials/extend_footer.html`
**Purpose:** Listen for theme toggle events and synchronize Remark42

- Placed in footer where `document.body` is guaranteed to exist
- Attaches event listener to `#theme-toggle` button
- Calls `window.REMARK42.changeTheme()` API when theme switches
- Checks `document.body.className.includes("dark")` to determine new theme

## Rationale

**Why extension partials instead of overriding theme files?**

PaperMod theme includes these extension hooks:
- `themes/PaperMod/layouts/partials/head.html:162` → `{{- partial "extend_head.html" . }}`
- `themes/PaperMod/layouts/partials/footer.html:24` → `{{- partial "extend_footer.html" . }}`

Hugo's lookup order checks `layouts/partials/` before `themes/PaperMod/layouts/partials/`, allowing clean customization without theme file modification.

**Benefits:**
- ✅ Theme updates won't overwrite customizations
- ✅ Clean separation of concerns
- ✅ Follows PaperMod's documented extension pattern
- ✅ Minimal code footprint (43 lines total vs 188+ lines from theme override)

## Alternatives Considered

1. **Override `head.html` entirely** - Initially implemented but fragile; theme updates would require manual merging
2. **Single file solution** - Attempted to place all code in footer, but `remark_config` must be defined before comments load
3. **Complex theme detection function** - Initially implemented 25+ line detection function; simplified to localStorage check per community solution

## Consequences

### Positive
- Remark42 comments correctly initialize with current theme on page load
- Theme toggles synchronize in real-time via `REMARK42.changeTheme()` API
- Future PaperMod theme updates won't break the implementation
- Simple, maintainable solution following community best practices

### Negative
- Requires understanding of Hugo partial lookup order
- Two files instead of one (unavoidable due to page load timing requirements)

## References

- [PaperMod Discussion #566 - Sync Papermod with Remark42](https://github.com/adityatelange/hugo-PaperMod/discussions/566)
- [Remark42 Frontend Configuration](https://remark42.com/docs/configuration/frontend/)
- [PaperMod FAQs - Extending the theme](https://github.com/adityatelange/hugo-PaperMod/wiki/FAQs)

## Implementation

- **Issue:** #30
- **Pull Request:** [Link to PR]
- **Files Modified:**
  - `layouts/partials/extend_head.html` (created)
  - `layouts/partials/extend_footer.html` (created)
