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

| Directive                              | Why                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src 'self'`                   | Everything not listed below is first-party only — including the self-hosted fonts.                                                        |
| `script-src 'self' …`                  | Plus Remark42, Turnstile (when a site key is set) and `https://*.googletagmanager.com` (production builds, where Google Analytics loads). |
| `style-src 'self' 'unsafe-inline'`     | Inline style attributes from the theme and Turnstile.                                                                                     |
| `img-src 'self' data: …`               | Plus Google Analytics' pixel hosts, in production builds.                                                                                 |
| `connect-src 'self' <API> …`           | The contact-form API (per environment, from `HUGO_PARAMS_APIURL`), Remark42, Google Analytics.                                            |
| `frame-src`                            | Turnstile's challenge and the Remark42 comment thread.                                                                                    |
| `object-src 'none'`, `base-uri 'none'` | No plugins; no `<base>` hijacking.                                                                                                        |
| `form-action 'self'`                   | Native form posts only to this site. `fetch()` is governed by `connect-src`.                                                              |
| `frame-ancestors 'none'`               | Nothing may frame the site (clickjacking). `X-Frame-Options: DENY` for older browsers.                                                    |

Each third-party origin comes from the same param or condition the templates
use to load it (`params.apiUrl`, `params.remark42Host`,
`params.turnstileSiteKey`, the Google Analytics ID in production), so a build
never allows a service it does not include. There is no
`upgrade-insecure-requests`: every URL the site emits is relative or https, the
zone redirects http to https, and under `wrangler dev` it would break every
same-origin request.

The same `/*` rule sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` and
a `Permissions-Policy` that disables camera, geolocation, microphone, payment
and USB — on every response, HTML or not. Staging builds add
`X-Robots-Tag: noindex` to it.

### Cloudflare features that inject scripts

Rocket Loader and Bot Fight Mode's JavaScript Detections inject scripts at the
edge. With no nonce in the policy, an injected inline script can be blocked. Keep
them off for this zone, or check the console for violations after enabling one.

## Adding a third-party service

1. Load it from a file under `assets/js/` (built through the theme's `js.html`
   partial), never an inline `<script>`. Pass values with `data-*` attributes.
2. Add its script host to `script-src`, its iframe host to `frame-src`, its API
   host to `connect-src` and its image host to `img-src` — in
   `layouts/home._outputformat_headers_.txt`, under the same condition the
   template uses to load it.
3. Run `bun run test`. The `assets` project serves a real build with
   `wrangler dev` and fails on any `securitypolicyviolation` event.
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
deploy's verify job fails if the site stops serving the generated policy.

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
deploy workflow's verify job fails if the site does not serve it, or if its
`connect-src` does not allow the contact API.
