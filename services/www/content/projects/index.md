---
title: "Projects"
layout: showcase
comments: false
description: "What Serge Gatezh, product engineer in Calgary, has shipped in public: the products, the edge platforms they run on, and where they are built."
keywords: [projects, portfolio, cloudflare, dev-containers, ux, product-engineering, calgary]
# Three layers, top to bottom: the products people use, the platforms they run
# on, and the workbench they are built in. The stack diagram at the top of the
# page is drawn from `runsOn` and `builtIn`; each must be true today. Each
# entry also renders as a diff, `before` the mess and `after` what shipped,
# in the HTML and the Markdown/llms-full text (layouts/_shortcodes/projects.*),
# and as JSON-LD (layouts/_partials/seo.html) when it has a schema.org `type`.
#
# Public work only. A project whose code is private appears by its public
# website and never by its repository; client work needs the client's written
# permission first. `talks` lists ids on /talks/ that explain the entry.
layers:
  - name: "Products"
    id: products
    blurb: "Sites and apps people use."
    projects:
      - id: utilify
        name: "Utilify"
        url: "https://utilify.ca/"
        type: WebApplication
        category: FinanceApplication
        status: "Waitlist"
        before: "An Alberta utility bill that never says which charges you can shop for"
        after: "Regulated delivery and shoppable energy, split out in plain words"
        runsOn: surgegate
        builtIn: devcontainers
        talks: [zero-servers-zero-dollars]
      - id: ux-cringe
        name: "UX Cringe"
        url: "https://uxcringe.com/"
        type: WebSite
        status: "Live"
        before: "Interfaces that fail the people using them, then get shrugged off"
        after: "Teardowns, filed, tagged and reproduced step by step"
        runsOn: hugo-workers
        builtIn: devcontainers
      - id: bank-and-me
        name: "bank and me"
        url: "https://bankand.me/"
        type: WebSite
        status: "Live"
        before: "Choosing a Canadian bank from its marketing pages"
        after: "First-hand reviews of banks, fintechs and credit unions"
        runsOn: hugo-workers
        builtIn: devcontainers
      - id: gatezh-com
        name: "gatezh.com"
        url: "https://github.com/gatezh/blog"
        type: SoftwareSourceCode
        status: "Open source"
        before: "$180 a year for a hosted contact form"
        after: "About 20 lines on Workers, with Turnstile instead of a CAPTCHA"
        runsOn: hugo-workers
        builtIn: devcontainers
        talks: [zero-servers-zero-dollars]
  - name: "Platforms"
    id: platforms
    blurb: "The stacks they run on, for nothing a month."
    projects:
      - id: surgegate
        name: "SurgeGate"
        url: "https://surgegate.dev/"
        type: SoftwareSourceCode
        status: "Coming soon"
        detail: "Apps: Workers, D1, passkeys"
        before: "Nginx configs, certificate renewals, firewall rules, OS updates"
        after: "Hono on Workers, D1, passkeys and React 19, on the free tier"
        builtIn: devcontainers
        talks: [zero-servers-zero-dollars]
      # A shared pattern rather than a product, so no link and no JSON-LD.
      - id: hugo-workers
        name: "Hugo on Cloudflare Workers"
        status: "In use"
        detail: "Sites: static assets, no servers"
        before: "A server to patch for a site that is mostly text"
        after: "Static files served free from Cloudflare's edge, with security headers generated at build"
        builtIn: devcontainers
        talks: [zero-servers-zero-dollars]
  - name: "Workbench"
    id: workbench
    blurb: "Where all of it is built, with AI agents fenced in."
    projects:
      - id: devcontainers
        name: "devcontainers"
        url: "https://github.com/gatezh/devcontainers"
        type: SoftwareSourceCode
        status: "Open source"
        detail: "Sandboxed images for AI agents"
        before: "An AI coding agent running with access to your whole machine"
        after: "Prebuilt images it works inside, with a sandbox variant behind a firewall"
        talks: [dev-containers-with-claude]
---

Everything here is public. The products sit on two platforms, and all of it
is built in one workbench. Each entry is a diff: the mess it started from, and
what shipped instead.

{{< projects >}}

Client work goes through [Just Right Systems](https://justright.systems/), my
consultancy in Calgary: custom software, automation and security for small
businesses, from one engineer who owns it end to end. Clients stay off this
page unless they agree to be named. If you'd like to talk about a project of
your own, [send me a message](/contact/).
