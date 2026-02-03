# Full Custom Terminal-Inspired Theme for gatezh.com

Replace the PaperMod Hugo theme with a completely custom theme in a separate directory, featuring:
- Light terminal aesthetic (dark text on light background)
- Monospace typography throughout
- Terminal-inspired UI elements (command prompts, cursor blinks)
- Three-position theme switcher (light/dark/system) with system as default
- TailwindCSS v4 for styling via Hugo's built-in css.TailwindCSS function
- Preserved Remark42 comments integration with theme synchronization

## Design Direction

- Light mode: warm off-white background (#f5f5f0), dark text (#1a1a1a)
- Dark mode: dark background (#0d1117), light text (#e6edf3)
- Accent: terminal green (#22c55e) for links/highlights
- Monospace font: JetBrains Mono (Google Fonts or self-hosted)

---

## Context

- Files involved:
  - apps/web/hugo.yaml (remove PaperMod module, add build config for Tailwind)
  - apps/web/go.mod (remove PaperMod dependency)
  - apps/web/package.json (add tailwindcss dependency)
  - apps/web/themes/terminal/ (new custom theme directory)
  - apps/web/themes/terminal/layouts/_default/baseof.html
  - apps/web/themes/terminal/layouts/_default/list.html
  - apps/web/themes/terminal/layouts/_default/single.html
  - apps/web/themes/terminal/layouts/index.html
  - apps/web/themes/terminal/layouts/partials/head.html
  - apps/web/themes/terminal/layouts/partials/header.html
  - apps/web/themes/terminal/layouts/partials/footer.html
  - apps/web/themes/terminal/layouts/partials/comments.html (Remark42)
  - apps/web/themes/terminal/layouts/partials/theme-toggle.html
  - apps/web/themes/terminal/assets/css/main.css (Tailwind entry)
  - apps/web/layouts/_default/contact.html (keep in site layouts, updated)

- Related patterns:
  - Hugo css.TailwindCSS function for Tailwind v4 processing
  - Hugo template inheritance via baseof.html and blocks
  - Three-state theme with localStorage and system preference detection
  - Remark42 changeTheme() API for comment widget sync

- Dependencies:
  - tailwindcss v4.x (npm package for CLI)
  - JetBrains Mono font (Google Fonts or self-hosted)

---

## Implementation Approach

- Theme lives in apps/web/themes/terminal/ directory
- Use Hugo's css.TailwindCSS function (v4 compatible)
- Three-position theme switcher: light, dark, system (default)
- Preserve Remark42 integration with updated theme sync logic
- Keep contact form functionality intact (Turnstile integration)

---

## Tasks

### Task 1: Set up Tailwind CSS v4 and theme directory structure

**Files:**
- Modify: `apps/web/hugo.yaml` (remove PaperMod, add Tailwind build config, set theme)
- Modify: `apps/web/go.mod` (remove PaperMod dependency)
- Modify: `apps/web/package.json` (add tailwindcss)
- Create: `apps/web/themes/terminal/theme.toml`
- Create: `apps/web/themes/terminal/assets/css/main.css`
- Create: `apps/web/themes/terminal/layouts/partials/css.html`

**Steps:**
- [x] Remove PaperMod module import from hugo.yaml
- [x] Add build.buildStats and module mounts for Tailwind to hugo.yaml
- [x] Set theme to "terminal" in hugo.yaml
- [x] Run hugo mod tidy to clean go.mod
- [x] Add tailwindcss to apps/web/package.json: `bun add -D tailwindcss`
- [x] Create apps/web/themes/terminal/theme.toml with theme metadata
- [x] Create apps/web/themes/terminal/assets/css/main.css with Tailwind imports
- [x] Create css.html partial to process Tailwind CSS
- [x] Verify dependencies install: `bun install`

### Task 2: Create base layout structure with three-position theme switcher

**Files:**
- Create: `apps/web/themes/terminal/layouts/_default/baseof.html`
- Create: `apps/web/themes/terminal/layouts/partials/head.html`
- Create: `apps/web/themes/terminal/layouts/partials/header.html`
- Create: `apps/web/themes/terminal/layouts/partials/footer.html`
- Create: `apps/web/themes/terminal/layouts/partials/theme-toggle.html`

**Steps:**
- [x] Create baseof.html with HTML structure, head/header/main/footer blocks
- [x] Create head.html with meta tags, font loading, CSS via css.TailwindCSS
- [x] Create theme-toggle.html with three-position toggle (light/dark/system)
- [x] Implement theme JS: detect system preference, store in localStorage, apply class
- [x] Create header.html with site title and navigation (terminal prompt style)
- [x] Create footer.html with copyright and social links
- [x] Verify site builds without errors: `bun run build`

### Task 3: Create main Tailwind styles with terminal aesthetic

**Files:**
- Modify: `apps/web/themes/terminal/assets/css/main.css`

**Steps:**
- [x] Add Tailwind base/components/utilities layers
- [x] Define custom colors via CSS variables (light and dark themes)
- [x] Set up monospace typography with JetBrains Mono
- [x] Style base elements (body, headings, links, paragraphs)
- [x] Create terminal-inspired components (prompt prefix, blinking cursor)
- [x] Style navigation with terminal look
- [x] Style theme toggle button/component
- [x] Add responsive utilities
- [x] Verify styles apply correctly: `bun run dev`

### Task 4: Create homepage layout

**Files:**
- Create: `apps/web/themes/terminal/layouts/index.html`

**Steps:**
- [ ] Create profile section with name, subtitle, terminal styling
- [ ] Add social links with terminal-style presentation
- [ ] Create "recent posts" section with terminal list styling
- [ ] Add navigation styled as terminal commands
- [ ] Verify homepage renders correctly: `bun run dev`

### Task 5: Create list and single page layouts

**Files:**
- Create: `apps/web/themes/terminal/layouts/_default/list.html`
- Create: `apps/web/themes/terminal/layouts/_default/single.html`

**Steps:**
- [ ] Create list.html for posts/ever-learning index pages
- [ ] Style list items as terminal output or file listing
- [ ] Create single.html for individual posts/pages
- [ ] Style article header, content, and metadata
- [ ] Add code block styling with terminal window chrome
- [ ] Verify posts and pages render correctly: `bun run dev`

### Task 6: Integrate Remark42 comments with theme sync

**Files:**
- Create: `apps/web/themes/terminal/layouts/partials/comments.html`
- Modify: `apps/web/themes/terminal/layouts/_default/single.html`

**Steps:**
- [ ] Create comments.html partial with Remark42 configuration
- [ ] Implement initial theme detection (system/localStorage/light/dark)
- [ ] Add event listener to sync Remark42 theme when toggle changes
- [ ] Handle system theme: listen for prefers-color-scheme media query changes
- [ ] Include comments partial in single.html for posts
- [ ] Verify comments load with correct theme: `bun run dev`
- [ ] Test theme switching syncs Remark42 widget

### Task 7: Update contact page with new theme

**Files:**
- Modify: `apps/web/layouts/_default/contact.html`

**Steps:**
- [ ] Update contact.html to extend new base layout
- [ ] Restyle form with terminal aesthetic using Tailwind classes
- [ ] Keep all existing functionality (Turnstile, form submission)
- [ ] Style success/error states to match theme
- [ ] Verify contact form works: `bun run dev` and test submission

### Task 8: Polish and responsive design

**Files:**
- Modify: `apps/web/themes/terminal/assets/css/main.css`
- Possibly modify: various layout files

**Steps:**
- [ ] Test and fix mobile responsiveness
- [ ] Add subtle animations (cursor blink, hover states)
- [ ] Ensure proper contrast and accessibility (WCAG AA)
- [ ] Test theme persistence across page loads
- [ ] Test system theme changes are detected
- [ ] Run final build: `bun run build`

---

## Final Verification

- [ ] Run `bun run build` - must complete without errors
- [ ] Manual test: homepage displays correctly with terminal aesthetic
- [ ] Manual test: theme toggle works (light/dark/system positions)
- [ ] Manual test: system theme is respected when set to "system"
- [ ] Manual test: Remark42 comments sync with theme changes
- [ ] Manual test: posts list and individual posts render properly
- [ ] Manual test: contact form submits successfully
- [ ] Manual test: site is responsive on mobile
