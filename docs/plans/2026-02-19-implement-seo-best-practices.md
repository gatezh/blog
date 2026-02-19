# Implement SEO Best Practices for gatezh.com

## Overview

Implement proven SEO improvements to make the blog more searchable and Serge Gatezh's name more discoverable. Focuses on structured data, missing meta configuration, content front matter hygiene, an enriched About page, a robots.txt file, and an llms.txt file for AI discoverability.

## Context

- Files involved:
  - `services/www/hugo.yaml` (site config - missing description, author, ogImage)
  - `services/www/themes/terminal/layouts/partials/head.html` (meta tags, needs JSON-LD)
  - `services/www/themes/terminal/layouts/_default/single.html` (article schema, needs author markup)
  - `services/www/themes/terminal/layouts/index.html` (homepage, needs Person schema)
  - `services/www/content/about.md` (thin content, needs enrichment with professional bio)
  - `services/www/content/posts/**/*.md` (front matter: missing descriptions on most posts)
  - `services/www/layouts/robots.txt` (does not exist yet)
  - `services/www/static/llms.txt` (does not exist yet - for AI/LLM discoverability)
- Related patterns: Hugo template partials, front matter conventions, Tailwind CSS theme
- Dependencies: None (all changes are Hugo templates, config, and static files)

## Development Approach

- Complete each task fully before moving to the next
- No test suite exists for Hugo templates; verification is done via `bun run build` and inspecting output HTML
- Every task ends with a build verification step

## Implementation Steps

### Task 1: Add site-level SEO configuration to hugo.yaml

**Files:**
- Modify: `services/www/hugo.yaml`

- [x] Add `params.description` with a site-wide default meta description (e.g., "Personal blog of Serge Gatezh, Front-end Engineer based in Calgary, Alberta. Posts about web development, React, TypeScript, DevOps, and software engineering.")
- [x] Add `params.author` with value "Serge Gatezh"
- [x] Add `params.ogImage` pointing to a default social sharing image path (placeholder path; actual image to be provided by user later)
- [x] Add `params.keywords` with relevant default keywords (e.g., "Serge Gatezh, front-end engineer, web development, React, TypeScript, Calgary")
- [x] Run `bun run build` to verify no errors

### Task 2: Add JSON-LD structured data for Person and WebSite schemas

**Files:**
- Create: `services/www/themes/terminal/layouts/partials/seo.html`
- Modify: `services/www/themes/terminal/layouts/partials/head.html`

- [x] Create a new `seo.html` partial containing JSON-LD structured data
- [x] On the homepage: output a Person schema (name: "Serge Gatezh", url, jobTitle: "Front-end Engineer", address.addressLocality: "Calgary", address.addressRegion: "Alberta", address.addressCountry: "Canada", sameAs with GitHub https://github.com/gatezh and LinkedIn https://linkedin.com/in/gatezh) and a WebSite schema (name, url, description)
- [x] On article pages: output an Article schema with headline, datePublished, dateModified, author (Person reference), description, url, and publisher
- [x] On other pages: output a WebPage schema with name, url, and description
- [x] Include the `seo.html` partial from `head.html`
- [x] Run `bun run build` and inspect the generated HTML to verify JSON-LD output is valid

### Task 3: Enhance head.html meta tags

**Files:**
- Modify: `services/www/themes/terminal/layouts/partials/head.html`

- [x] Add `<meta name="author" content="...">` using `site.Params.author`
- [x] Add `<meta name="keywords" content="...">` using page-level keywords with fallback to site-level `params.keywords`
- [x] Add `og:locale` meta tag (en_US)
- [x] For article pages, add `article:published_time` and `article:modified_time` Open Graph tags
- [x] For article pages, add `article:author` Open Graph tag
- [x] Change Twitter card from "summary" to "summary_large_image" when an og:image is available
- [x] Run `bun run build` to verify

### Task 4: Add author markup to single post template

**Files:**
- Modify: `services/www/themes/terminal/layouts/_default/single.html`

- [ ] Add an author byline in the article metadata section (below the date) displaying the author name with `itemprop="author"` and `itemscope itemtype="https://schema.org/Person"` markup
- [ ] Add `itemprop="dateModified"` using `.Lastmod` when available
- [ ] Run `bun run build` to verify

### Task 5: Add meta descriptions to existing posts

**Files:**
- Modify: `services/www/content/posts/2026/02/macos-secure-enclave-ssh-keys/index.md`
- Modify: `services/www/content/posts/2025/12/publishing-multi-platform-docker-images-to-github-container-registry/index.md`
- Modify: `services/www/content/posts/2024/06/15/how-to-redirect-www-to-root-domain-on-cloudflare-pages/index.md`
- Modify: `services/www/content/posts/2020/06/22/graphql-schema-use-it-in-a-sentence.md`

- [ ] Add a concise, keyword-rich `description` field (under 160 characters) to each post's front matter that is missing one
- [ ] Ensure descriptions naturally include "Serge Gatezh" or relevant technical terms for discoverability
- [ ] Run `bun run build` to verify

### Task 6: Enrich the About page with professional bio

**Files:**
- Modify: `services/www/content/about.md`

- [ ] Add a `description` field to front matter: "About Serge Gatezh - Front-end Engineer based in Calgary, Alberta, specializing in React, TypeScript, and modern web development."
- [ ] Rewrite the page content with a professional bio that includes:
  - Full name: Serge Gatezh
  - Job title: Front-end Engineer
  - Location: Calgary, Alberta, Canada
  - Core technologies: React, TypeScript, JavaScript
  - Areas of interest drawn from blog topics: web development, DevOps, Docker, Cloudflare, GraphQL, security (SSH keys, Secure Enclave)
  - Open source involvement: mention active GitHub presence (hugo-tailwindcss-starter, devcontainer-bun-template, and other projects)
  - Professional links: LinkedIn (linkedin.com/in/gatezh), GitHub (github.com/gatezh)
  - TN visa eligibility and openness to US roles (as noted on LinkedIn)
- [ ] Keep the wishlist section at the bottom as-is
- [ ] Run `bun run build` to verify

### Task 7: Create a robots.txt template with sitemap reference

**Files:**
- Create: `services/www/layouts/robots.txt`
- Modify: `services/www/hugo.yaml`

- [ ] Create a Hugo robots.txt template that allows all crawlers and includes a Sitemap directive pointing to `{{ site.BaseURL }}sitemap.xml`
- [ ] Add `enableRobotsTXT: true` to hugo.yaml so Hugo generates robots.txt from the template
- [ ] Run `bun run build` and verify `public/robots.txt` exists with correct content

### Task 8: Create llms.txt for AI/LLM discoverability

**Files:**
- Create: `services/www/static/llms.txt`

- [ ] Create `services/www/static/llms.txt` following the llmstxt.org specification format:
  - H1 header: "gatezh.com"
  - Blockquote summary: concise description of the site and author (e.g., "Personal blog of Serge Gatezh, a Front-end Engineer based in Calgary, Alberta, Canada. Covers web development, React, TypeScript, DevOps, Docker, Cloudflare, and software engineering.")
  - H2 "About" section with a link to the about page and a short description
  - H2 "Blog Posts" section listing each published post as a markdown link with a colon-separated description (e.g., `- [How to Redirect www to Root Domain on Cloudflare Pages](https://gatezh.com/posts/...): Step-by-step guide...`)
  - H2 "Links" section with GitHub and LinkedIn profile URLs
- [ ] Keep the file under 10KB and serve as plain text (Hugo static files are served as-is with correct MIME type based on extension)
- [ ] Run `bun run build` and verify `public/llms.txt` exists at the root

### Task 9: Verify all changes and build

- [ ] Run `bun run build` to ensure production build succeeds
- [ ] Run `bunx oxlint` from root to check for lint errors
- [ ] Spot-check generated HTML in `public/` to confirm: JSON-LD is present on homepage, article pages have Article schema, meta descriptions are populated, robots.txt exists with sitemap reference, author meta tags are present, llms.txt exists at root with correct format
