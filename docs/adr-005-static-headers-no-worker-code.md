# ADR-005: Static `_headers` and no Worker code for www

## Status

Accepted. Supersedes [ADR-004](adr-004-csp-in-worker.md).

## Context

ADR-004 put the CSP in the www Worker, which `run_worker_first` already ran on
every page view for Markdown content negotiation, the real 404 status on `/404`
and `X-Robots-Tag`. That made every page view a Worker request.

Cloudflare bills those, and the
[static assets docs](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
spell out the failure mode: requests to static assets are free and unlimited,
but a request matching `run_worker_first` always invokes the Worker, and once
the free plan's 100,000 daily requests are used up it gets a 429 instead of
falling back to the asset. The site is a static Hugo build; none of those page
views needed compute.

Every Worker feature but one has a static equivalent. Workers static assets
applies a `_headers` file to every response with no Worker code
([docs](https://developers.cloudflare.com/workers/static-assets/headers/)), and
it is a response header, so it can carry `frame-ancestors` and is not the
`<meta>` policy ADR-002 and ADR-004 rejected. The exception is `Accept:
text/markdown` negotiation, which branches on a request header — neither
`_headers` nor `_redirects` can do that.

## Decision

Serve `services/www` from Workers static assets alone. `wrangler.jsonc` has no
`main` and no `run_worker_first`, and `services/www/src/` is deleted.

- **Headers.** Hugo renders `public/_headers` from
  `layouts/home._outputformat_headers_.txt` (a `Headers` output format on the
  home page). It sets `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options` and the CSP on every response.
- **CSP.** An allowlist instead of a nonce: `script-src 'self'` plus the third
  parties the build actually includes (Google Analytics in production,
  Remark42, Turnstile when configured), each derived from the same param or
  condition the templates use. `connect-src` takes the contact API's origin from
  `params.apiUrl`, the URL the form posts to.
- **No inline scripts.** Every inline `<script>` moved to a TypeScript file
  under `assets/js/`, built by `js.Build`, fingerprinted and loaded with SRI.
  Templates pass values through `data-*` attributes. JSON-LD stays inline: it
  is data, not script.
- **Staging noindex.** Staging builds with `HUGO_ENVIRONMENT=staging`, and any
  non-production build adds `X-Robots-Tag: noindex` to the `/*` rule.
- **Agent text.** `/index.md`, `/*/index.md`, `/llms.txt` and `/llms-full.txt`
  get `X-Robots-Tag: noindex` from their own `_headers` rules.
- **Markdown negotiation is dropped.** The `index.md` mirrors and `llms*.txt`
  stay. Each HTML page advertises its mirror with
  `<link rel="alternate" type="text/markdown">`, and agents fetch the `.md` URL
  directly.
- **The `/404` special case is dropped.** Unknown paths already return 404
  through `not_found_handling: "404-page"`. `/404` itself answers 200, and that
  page carries `noindex, follow`, so it cannot be indexed.

## Rationale

Requests to static assets are free, unmetered and cannot hit the 429 cliff.
The policy is still versioned with the templates, still varies per environment
(it is built per environment), and is still tested before it ships. Removing
inline scripts is what makes an allowlist as strong as the nonce was: an
injected inline script is blocked either way.

## Alternatives Considered

1. **Keep the Worker for negotiation alone.**
   - Pros: `curl -H 'Accept: text/markdown'` on any page keeps working.
   - Cons: every page view stays a billed request with a 429 failure mode,
     for a feature agents can do without by fetching `index.md`.
   - Why rejected: the cost and the outage risk outweigh it.
2. **Keep the nonce, set by a Worker on HTML only.**
   - Why rejected: same per-page-view cost. Once no template has an inline
     script, the nonce protects nothing an allowlist does not.
3. **A `<meta http-equiv>` CSP.**
   - Why rejected: cannot express `frame-ancestors`. `_headers` is a real
     header with none of that limitation.

## Consequences

### Positive

- No page view invokes Worker code; there is no Worker request quota to run
  out of.
- HTML is cacheable and revalidates with `304` again — ADR-004 had to strip
  validators because of the nonce.
- `wrangler dev` serves exactly what production serves, `_headers` included,
  so `tests/assets.spec.ts` checks the real headers before deploy.

### Negative

- No `Accept: text/markdown` negotiation.
- Cloudflare features that inject inline scripts at the edge (Rocket Loader,
  Bot Fight Mode's JavaScript Detections) have no nonce to borrow, so
  `script-src` can block them. Keep them off for this zone, or check the
  browser console for violations after turning one on.
- Adding a third-party script means adding its host to the `_headers` template.
- A zone Transform Rule that sets `Content-Security-Policy` still overrides the
  generated header. The deploy verify jobs check for it.

### Neutral

- The CSP and security headers now apply to every response, not only HTML.
  Harmless on non-HTML.
- `X-Frame-Options` is now on every response, not only HTML.

## References

- [Workers static assets: headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Workers static assets: billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Hugo custom output formats](https://gohugo.io/configuration/output-formats/)
- [Google tag: CSP guide](https://developers.google.com/tag-platform/security/guides/csp)
- [docs/CSP.md](CSP.md), [docs/markdown-for-agents.md](markdown-for-agents.md)

## Implementation

- **Issue:** #118
- **Files Modified:**
  - `services/www/wrangler.jsonc`, `services/www/hugo.yaml`
  - `services/www/layouts/home._outputformat_headers_.txt`
  - `services/www/assets/js/`, `services/www/themes/terminal/assets/js/`
  - `services/www/themes/terminal/layouts/_partials/js.html`
  - `services/www/tests/assets.spec.ts` (was `worker.spec.ts`)
  - `.github/workflows/deploy-staging.yml`, `.github/workflows/release.yml`

---

**Date:** 2026-10-10
**Author(s):** Serge Gatezh
