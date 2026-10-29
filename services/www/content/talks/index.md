---
title: "Talks"
layout: showcase
comments: false
description: "Talks by Serge Gatezh, product engineer in Calgary, on shipping real apps on zero-cost edge infrastructure and security-first AI workflows."
keywords: [talks, speaking, cloudflare, dev-containers, claude-code, frontend-and-beyond, calgary]
# Each talk renders three ways from this one list: the HTML cards and the
# Markdown/llms-full text (layouts/_shortcodes/talks.*) and the Event JSON-LD
# (layouts/_partials/seo.html). Link only public material: the decks below are
# the PDFs the meetup itself publishes.
talks:
  - title: "Zero Servers, Zero Dollars: Shipping Real Apps on Cloudflare"
    id: zero-servers-zero-dollars
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

I speak about the two things I do every day: shipping real products on
zero-cost edge infrastructure, and AI-assisted engineering with a fence around
it. Both talks so far were at Frontend & Beyond.

{{< talks >}}

## Frontend & Beyond

[Frontend & Beyond](https://frontend-yyc.github.io/) is a meetup for web
developers in Calgary. I've spoken there twice in 2026, and I help maintain the
meetup's website ([source](https://github.com/frontend-yyc/frontend-yyc.github.io)).

Want me to give one of these talks at your event, or something new on the same
themes? [Send me a message](/contact/).
