---
description: Hugo terminal theme conventions, Tailwind CSS, and layout structure
globs: services/www/**
---

# Hugo Theme

- Uses custom terminal theme in `services/www/themes/terminal/`
- Theme uses Tailwind CSS v4 via Hugo's `css.TailwindCSS` function
- Site-specific layouts in `services/www/layouts/` override theme (e.g., `contact.html`)

## Layout structure (Hugo v0.146+)

Any directory under `layouts/` that is **not** underscore-prefixed is a routable
page path. Non-routable templates live in the reserved underscore directories.
There is no `_default/` directory any more.

| Kind | Template |
|---|---|
| Home | `layouts/home.html` |
| Single page | `layouts/page.html` |
| List / section | `layouts/list.html`, or `layouts/<section>/section.html` |
| Base template | `layouts/baseof.html` |
| Partials | `layouts/_partials/` |
| Shortcodes | `layouts/_shortcodes/` |
| Render hooks | `layouts/_markup/` |

`{{ partial "head.html" . }}` resolves from `_partials/` — partial names do not
carry the directory.

## Theme features

- Three-position theme switcher (light/dark/system)
- Terminal-inspired aesthetic with monospace typography
- Remark42 comments integration with theme synchronization
- JSON-LD structured data via `layouts/_partials/seo.html` (site-level override:
  Person + WebSite on homepage, Article on posts, WebPage on other pages)
- SEO meta tags in `themes/terminal/layouts/_partials/head.html`: author,
  keywords, Open Graph article metadata, Twitter card

## Build notes

- `hugo.yaml` sets `security.node.permissions.allowRead: ["*"]`. Hugo v0.161+
  runs Tailwind under `node --permission`, and this monorepo hoists
  `node_modules` above the Hugo root. Removing it breaks the build.
- Hugo templates are formatted by `gotmplfmt` (`bun run format:hugo`), not
  oxfmt — oxfmt would mangle Go template syntax and is configured to skip them.
