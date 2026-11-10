# Content Security Policy (CSP)

The main site's CSP is part of `public/_headers`, which Hugo generates from
[`services/www/layouts/home._outputformat_headers_.txt`](../services/www/layouts/home._outputformat_headers_.txt)
and Workers static assets applies to every response, with no Worker code. It is
versioned with the templates it has to match, built per environment, and tested
before it ships. History: [ADR-004](adr-004-csp-in-worker.md) moved it from a
Transform Rule into a Worker; [ADR-005](adr-005-static-headers-no-worker-code.md)
replaced the Worker with the generated file.

## The policy

A host allowlist. No template has an inline `<script>` — every script is a file
under `assets/js/`, built by `js.Build` and loaded with SRI — so `script-src`
needs neither `'unsafe-inline'` nor a nonce.

| Directive                              | Why                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src 'self'`                   | Everything not listed below is first-party only — including the self-hosted fonts.                                                                                                                                                                                                                                                  |
| `script-src 'self' …`                  | Plus Remark42, Turnstile (when a site key is set), `https://*.googletagmanager.com` (production builds, where Google Analytics loads), PostHog (when its key is set: its reverse proxy, or `https://*.posthog.com` without one) and Cloudflare Web Analytics (`https://static.cloudflareinsights.com`).                             |
| `style-src 'self' 'unsafe-inline'`     | Posts only: Chroma's inline highlighting colours (`markup.highlight.noClasses`, default true) and the `cfimage` shortcode's `<style>` block. The theme and Turnstile need none of it.                                                                                                                                               |
| `img-src 'self' data: …`               | Plus Google Analytics' pixel hosts (`https://*.google-analytics.com https://*.googletagmanager.com`), in production builds.                                                                                                                                                                                                         |
| `connect-src 'self' <API> …`           | The contact-form API (per environment, from `HUGO_PARAMS_APIURL`), Remark42, PostHog (the same host as in `script-src`) and Google Analytics (`https://*.google-analytics.com https://*.google.com https://*.googletagmanager.com`). Cloudflare Web Analytics needs only `'self'`: its beacon posts to `/cdn-cgi/rum` on this site. |
| `frame-src`                            | Turnstile's challenge and the Remark42 comment thread.                                                                                                                                                                                                                                                                              |
| `worker-src 'self' blob: data:`        | PostHog session replay compresses in a Worker created from a blob — PostHog's documented directive. Only when its key is set.                                                                                                                                                                                                       |
| `object-src 'none'`, `base-uri 'none'` | No plugins; no `<base>` hijacking.                                                                                                                                                                                                                                                                                                  |
| `form-action 'self'`                   | Native form posts only to this site. `fetch()` is governed by `connect-src`.                                                                                                                                                                                                                                                        |
| `frame-ancestors 'none'`               | Nothing may frame the site (clickjacking). `X-Frame-Options: DENY` for older browsers.                                                                                                                                                                                                                                              |
| `report-uri`, `report-to posthog`      | Violations are reported to PostHog, with a matching `Reporting-Endpoints` header. Only when its key is set. See [Violation reports](#violation-reports).                                                                                                                                                                            |

Google Analytics follows
[Google's policy](https://developers.google.com/tag-platform/security/guides/csp)
for "Google Analytics without any Ads features":

- `script-src-elem https://www.googletagmanager.com`
- `img-src https://www.googletagmanager.com https://*.google-analytics.com`
- `connect-src https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com`

The site puts the script host in `script-src` (which `script-src-elem` falls
back to) and uses `https://*.googletagmanager.com`, a superset of the `www`
host. `*.google.com` is not optional: when the hit to `*.google-analytics.com`
fails, gtag retries at `https://www.google.com/g/collect`.

Each third-party origin comes from the same param or condition the templates
use to load it (`params.apiUrl`, `params.remark42Host`,
`params.turnstileSiteKey`, the Google Analytics ID in production), so a build
never allows a service it does not include. Cloudflare Web Analytics is the
exception: the zone injects it, not a template, so `params.cloudflareWebAnalytics`
only gates the policy (see
[Cloudflare features that inject scripts](#cloudflare-features-that-inject-scripts)).
There is no
`upgrade-insecure-requests`: every URL the site emits is relative or https, the
zone redirects http to https, and under `wrangler dev` it would break every
same-origin request.

The same `/*` rule sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and
a `Permissions-Policy` that disables camera, geolocation, microphone, payment
and USB — on every response, HTML or not. Staging builds add
`X-Robots-Tag: noindex` to it.

### Violation reports

With a host allowlist, the usual way the policy breaks is a vendor starting to
reach a host it does not list. Production builds (the ones with a PostHog key)
report every violation to the same PostHog project, as
[PostHog documents](https://posthog.com/docs/csp-tracking):
`report-uri <posthogApiHost>/report/?token=<key>` for browsers without
the Reporting API, and `report-to posthog` with a
`Reporting-Endpoints: posthog="…"` header for those with it. The host is the
SDK's `api_host` (the reverse proxy in production); the token is public by
design. Reports are not
sampled — the site's traffic is small and a violation should be rare.

### Cloudflare features that inject scripts

Rocket Loader and Bot Management's JavaScript Detections inject inline scripts
at the edge. With no nonce or `'unsafe-inline'` in the policy, the browser
blocks them and logs a violation on every page, which Lighthouse counts against
Best Practices. Keep both off for this zone. JavaScript Detections was found on
and turned off on 2026-11-08 (`cf bot-management update --enable-js false`);
Bot Fight Mode, which requires it, is off.

Web Analytics' automatic setup injects a beacon too, but as an external file
with SRI, so the policy can allow its host. `params.cloudflareWebAnalytics` in
`hugo.yaml` adds `https://static.cloudflareinsights.com` to `script-src`: the
host, not the exact file in
[Cloudflare's FAQ](https://developers.cloudflare.com/web-analytics/faq/),
because the injected URL is `beacon.min.js/<version>` and a CSP path without a
trailing slash matches only itself. The automatic setup reports to the site's
own `/cdn-cgi/rum`, which `'self'` already allows; `cloudflareinsights.com` in
`connect-src` is only for the manually embedded snippet. Until
2026-11-08 the policy blocked it, so Web Analytics recorded nothing before then.

## Adding a third-party service

1. Load it from a file under `assets/js/` (built through the theme's `js.html`
   partial), never an inline `<script>`. Pass values with `data-*` attributes.
2. Add its script host to `script-src`, its iframe host to `frame-src`, its API
   host to `connect-src` and its image host to `img-src` — in
   `layouts/home._outputformat_headers_.txt`, under the same condition the
   template uses to load it.
3. Run `bun run test`. The `assets` project serves a real build with
   `wrangler dev` and fails on any `securitypolicyviolation` event. It proves
   the first hop only: the tags in the HTML and what the vendor snippets
   request directly, with third parties stubbed. Requests a real vendor script
   makes later — beacons, fallbacks, lazy-loaded modules — are not exercised,
   except Google Analytics' fallback beacon, which has its own test. If the new
   service has such a path, add a test that drives it.
4. Deploy to staging and check the browser console before releasing.

## Cloudflare Transform Rules

A **Modify Response Header** rule that sets `Content-Security-Policy` replaces
the generated header wholesale on every request it matches.

| Rule                       | Filter                               | Status                                                                  |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| CSP for comments subdomain | `http.host eq "comments.gatezh.com"` | Keep. Remark42 is self-hosted behind a tunnel, not served by this repo. |
| Allow Picture-in-Picture   | `http.host eq "comments.gatezh.com"` | Keep. `Permissions-Policy: picture-in-picture=(self)` for Remark42.     |

The main site's old **CSP** rule was deleted on 2026-10-03, after the first
release served the (then Worker-set) policy cleanly. Never add a rule that sets
`Content-Security-Policy` on `gatezh.com` or the staging hosts — every
deploy's verify step fails if the site stops serving the generated policy.

The comments subdomain's policy, for reference:

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors https://gatezh.com; base-uri 'self'; upgrade-insecure-requests
```

`frame-ancestors https://gatezh.com` is what lets the main site embed the
comment thread. Add `https://staging-www.gatezh.com` to it if comments should
render on staging.

## Verifying

```console
$ curl -sI https://gatezh.com/ | grep -i content-security-policy
```

The policy should match `public/_headers` from that release's build. Every
deploy workflow's verify step fails if the site does not serve it, or if its
`connect-src` does not allow the contact API. Violations in production show up
in PostHog (its "CSP Violation Reports" dashboard template is a starting point).
