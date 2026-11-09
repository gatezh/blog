---
title: "Talks"
layout: showcase
comments: false
description: "Talks by Serge Gatezh: shipping real apps on zero-cost edge infrastructure, and running AI coding agents in sandboxed dev containers. Slides for each."
keywords: [talks, speaking, cloudflare, dev-containers, claude-code]
# Each talk renders three ways from this one list: the HTML slides and the
# Markdown/llms-full text (layouts/_shortcodes/talks.*) and the Event JSON-LD
# (layouts/_partials/seo.html). Link only public material: a deck as the
# event published it. `short` names the talk where the footer and /projects/
# link to it. `admission` (where to register, and the price) and `images`
# (the event's own artwork, 16x9, 4x3 and 1x1, as Google asks) feed the
# Event's `offers` and `image`, copied from the organizer's own event page;
# a talk without either fails the build.
talks:
  - title: "Zero Servers, Zero Dollars: Shipping Real Apps on Cloudflare"
    id: zero-servers-zero-dollars
    short: "Zero Servers talk"
    event: "Frontend & Beyond"
    organizerUrl: "https://frontend-yyc.github.io/"
    eventUrl: "https://frontend-yyc.github.io/events/zero-servers-zero-dollars-shipping-real-apps-on-cloudflare/"
    start: 2026-10-20T18:00:00-06:00
    end: 2026-10-20T19:00:00-06:00
    venue: "Calgary Public Library, Memorial Park"
    address:
      street: "1221 2 Street SW"
      locality: "Calgary"
      region: "AB"
      postalCode: "T2R 0W5"
      country: "CA"
    admission:
      url: "https://www.eventbrite.ca/e/zero-servers-zero-dollars-shipping-real-apps-on-cloudflare-tickets-2003265290410"
      price: 0
      currency: "CAD"
    images:
      - "https://frontend-yyc.github.io/og/events/zero-servers-zero-dollars-shipping-real-apps-on-cloudflare-16x9.png"
      - "https://frontend-yyc.github.io/og/events/zero-servers-zero-dollars-shipping-real-apps-on-cloudflare-4x3.png"
      - "https://frontend-yyc.github.io/og/events/zero-servers-zero-dollars-shipping-real-apps-on-cloudflare-1x1.png"
    slides: "https://frontend-yyc.github.io/presentations/Zero%20Servers,%20Zero%20Dollars_%20Shipping%20Real%20Apps%20on%20Cloudflare%20-%20Slidev.pdf"
    abstract: >-
      How a personal website went from GitHub Pages to Netlify to Cloudflare,
      and then grew into product-sized web apps that still run on the free
      tier. The talk walks the stack one service at a time: a Hugo site served
      from the edge, a contact form on Workers with Turnstile instead of a
      CAPTCHA, a self-hosted comments engine behind Tunnel with no open ports,
      a React app and its API deployed together, D1 and Better Auth inside the
      10 ms CPU limit, R2 uploads with no egress fees, a bill-processing
      pipeline on Workflows, and AI Gateway in front of LLM calls. Two points
      carry it: if you can ship a React app, you can ship a whole backend with
      no infrastructure to run, and the free tier is production-ready. Every
      price and limit in the deck is sourced and was checked in October 2026.
  - title: "Dev Containers with Claude: Security First"
    id: dev-containers-with-claude
    short: "Dev Containers talk"
    event: "Frontend & Beyond"
    organizerUrl: "https://frontend-yyc.github.io/"
    eventUrl: "https://frontend-yyc.github.io/events/dev-containers-with-claude-security-first/"
    start: 2026-03-30T17:30:00-06:00
    end: 2026-03-30T18:30:00-06:00
    venue: "Calgary Public Library, Memorial Park"
    address:
      street: "1221 2 Street SW"
      locality: "Calgary"
      region: "AB"
      postalCode: "T2R 0W5"
      country: "CA"
    admission:
      url: "https://www.eventbrite.ca/e/dev-containers-with-claude-security-first-tickets-1985233302248"
      price: 0
      currency: "CAD"
    images:
      - "https://frontend-yyc.github.io/og/events/dev-containers-with-claude-security-first-16x9.png"
      - "https://frontend-yyc.github.io/og/events/dev-containers-with-claude-security-first-4x3.png"
      - "https://frontend-yyc.github.io/og/events/dev-containers-with-claude-security-first-1x1.png"
    slides: "https://frontend-yyc.github.io/presentations/Dev%20Containers%20with%20Claude_%20Security%20First%20-%20Slidev.pdf"
    code: "https://github.com/gatezh/devcontainers"
    abstract: >-
      A security wake-up call, and the development environment that came out
      of it. The talk follows one dev container setup from first attempt to
      daily use: sandboxing an AI coding agent so it can work in a repository
      without reaching everything else on the machine, prebuilt images for
      Hugo, Bun and Claude Code, tool versions kept in sync with mise, and the
      practical hurdles along the way, from package management inside
      containers to lessons from running the setup on real projects. The
      images are open source.
---

{{< talks >}}
