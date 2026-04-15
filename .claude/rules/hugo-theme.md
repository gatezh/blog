---
description: Hugo terminal theme conventions, Tailwind CSS, and layout structure
globs: services/www/**
---

# Hugo Theme

- Uses custom terminal theme in `services/www/themes/terminal/`
- Theme uses Tailwind CSS v4 via Hugo's `css.TailwindCSS` function
- Site-specific layouts in `services/www/layouts/` override theme (e.g., contact.html)
- Theme features:
  - Three-position theme switcher (light/dark/system)
  - Terminal-inspired aesthetic with monospace typography
  - Remark42 comments integration with theme synchronization
  - JSON-LD structured data via `layouts/partials/seo.html` (site-level override: Person + WebSite on homepage, Article on posts, WebPage on other pages)
  - SEO meta tags in `themes/terminal/layouts/partials/head.html`: author, keywords, Open Graph article metadata, Twitter card
