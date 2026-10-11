# ADR-004: Content Security Policy in the www Worker

## Status

Superseded by [ADR-005](adr-005-static-headers-no-worker-code.md). The www
Worker is gone; the policy is now an allowlist in a Hugo-generated `_headers`
file. Superseded [ADR-002](adr-002-csp-configuration.md).

## Context

ADR-002 put the main site's CSP in a Cloudflare Transform Rule. Two things have
changed since.

**The rule drifted with nobody noticing.** The documented eleven-directive
policy was found deployed as `connect-src` alone — no `script-src`, no
`frame-ancestors`, no `base-uri`. Nothing in the repo could catch it, because
nothing in the repo defined it. It was also missing the wildcard Google
Analytics hosts GA4 needs, so collection to regional hosts such as
`region1.google-analytics.com` would have been blocked had the policy been
whole.

**A Worker now runs in front of every page.** `run_worker_first` routes every
HTML request through `services/www/src/index.ts` (for content negotiation, the
real 404 status and `X-Robots-Tag`). ADR-002 rejected a CSP "in Hugo config"
because Cloudflare-injected scripts would be blocked; it never considered a
response header set by a Worker, which did not exist then.

The project is also gaining a staging environment, whose contact-form API is a
different origin — a single zone-wide rule cannot express that.

## Decision

The www Worker sets a strict, nonce-based CSP on every HTML response:

- A fresh nonce per response, stamped on every `<script>` with `HTMLRewriter`,
  and `'strict-dynamic'` so scripts those load (gtag.js, the Remark42 embed,
  Turnstile) are trusted without a host allowlist.
- `connect-src` takes the contact-form origin from the same GitHub variable the
  form posts to (`HUGO_PARAMS_APIURL`, passed to the Worker as `API_URL`).
- `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`,
  `frame-ancestors 'none'`, plus `nosniff`, `Referrer-Policy` and
  `Permissions-Policy`.
- HTML loses its validators so it is never revalidated with a stale nonce.

The legacy "CSP" Transform Rule is scoped to `gatezh.com` and deleted after the
first release that carries the Worker's policy. The comments subdomain's rules
stay: Remark42 is not served by this repo.

## Consequences

### Positive

- The policy is versioned, reviewed and tested with the templates it must match.
  `tests/worker.spec.ts` loads real pages and fails on any CSP violation.
- Inline scripts run because they carry the nonce, so an injected inline script
  without it is blocked — the protection `'unsafe-inline'` gave away.
- Cloudflare's own injected script (JavaScript Detections) is covered —
  Cloudflare reads the nonce from the header and applies it.
- Per-environment differences come from the same variables as everything else.

### Negative

- A CSP change needs a deploy rather than a dashboard edit.
- HTML cannot be revalidated with `304`; every page view downloads the page.
  The pages are small and the static assets, which bypass the Worker, still
  cache normally.
- A zone Transform Rule that sets the same header silently overrides the Worker.
  The deploy verify jobs check for this.

## Alternatives considered

- **Keep the Transform Rule, fix its value.** Restores the policy but not the
  property that broke: it can still drift without a commit, and cannot vary per
  environment.
- **Host allowlist with `'unsafe-inline'`.** What ADR-002 documented. With
  `'unsafe-inline'` in `script-src`, an injected inline script runs, which is
  the case CSP exists for.
- **`<meta http-equiv>` policy from Hugo.** Cannot express `frame-ancestors`, and
  Cloudflare does not apply nonces from a meta tag to injected scripts.

## References

- [web.dev: Mitigate XSS with a strict CSP](https://web.dev/articles/strict-csp)
- [Cloudflare: JavaScript Detections and CSP](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
- [Google tag: CSP guide](https://developers.google.com/tag-platform/security/guides/csp)
- [docs/CSP.md](CSP.md)
