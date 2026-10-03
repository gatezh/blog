# Content Security Policy (CSP)

The main site's CSP is set by the www Worker in
[`services/www/src/security.ts`](../services/www/src/security.ts), on every HTML
response. It is versioned with the templates it has to match, differs per
environment where it must, and is tested before it ships. Why it moved there
from a Cloudflare Transform Rule: [ADR-004](adr-004-csp-in-worker.md).

## The policy

A strict, nonce-based policy ([web.dev: strict CSP](https://web.dev/articles/strict-csp)):

| Directive                                                      | Why                                                                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script-src 'nonce-…' 'strict-dynamic' https: 'unsafe-inline'` | Only scripts carrying this response's nonce run, plus what they load. `https:` and `'unsafe-inline'` are pre-CSP3 fallbacks; nonce-aware browsers ignore both. |
| `default-src 'self'`                                           | Everything not listed below is first-party only — including the self-hosted fonts.                                                                             |
| `style-src 'self' 'unsafe-inline'`                             | Inline style attributes from the theme and Turnstile.                                                                                                          |
| `img-src 'self' data: …`                                       | Plus Google Analytics' pixel hosts.                                                                                                                            |
| `connect-src 'self' <API> …`                                   | The contact-form API (per environment, from `HUGO_PARAMS_APIURL`), Remark42, Google Analytics.                                                                 |
| `frame-src`                                                    | Turnstile's challenge and the Remark42 comment thread.                                                                                                         |
| `object-src 'none'`, `base-uri 'none'`                         | No plugins; no `<base>` hijacking.                                                                                                                             |
| `form-action 'self'`                                           | Native form posts only to this site. `fetch()` is governed by `connect-src`.                                                                                   |
| `frame-ancestors 'none'`                                       | Nothing may frame the site (clickjacking). `X-Frame-Options: DENY` for older browsers.                                                                         |
| `upgrade-insecure-requests`                                    | Only over https — under `wrangler dev` it would break every same-origin request.                                                                               |

Every response from the Worker also carries `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`
that disables camera, geolocation, microphone, payment and USB.

### How the nonce works

The Worker generates a 128-bit nonce per response, adds it to the policy, and
stamps it on every `<script>` with `HTMLRewriter`. Two consequences:

- **HTML is never revalidated.** The Worker strips `ETag`/`Last-Modified` from
  HTML and the conditional headers from page requests. A `304` would pair the
  browser's cached body — old nonce — with the new policy and block every
  script on the page.
- **Cloudflare's injected scripts keep working.** Bot Fight Mode's JavaScript
  Detections script is injected at the edge, after the Worker. Cloudflare
  [reads the nonce from the CSP header](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
  and adds it to what it injects. This only works with a header — never move the
  policy into a `<meta>` tag.

## Adding a third-party service

1. Load it from a script the templates already render; `'strict-dynamic'` trusts
   whatever a nonced script loads, so `script-src` needs no host.
2. Add its iframe host to `frame-src`, its API host to `connect-src` and its
   image host to `img-src` — the constants at the top of `security.ts`.
3. Run `bun run test`. The worker project loads real pages and fails on any
   `securitypolicyviolation` event.
4. Deploy to staging and check the browser console before releasing.

## Cloudflare Transform Rules

A **Modify Response Header** rule that sets `Content-Security-Policy` replaces
the Worker's header wholesale on every request it matches.

| Rule                       | Filter                                                                                                                                                                                                                                                          | Status                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| CSP                        | `http.host eq "gatezh.com"` **Disabled** 2026-10-03, so production serves the Worker's policy. Delete it once a release has run cleanly. Re-enabling it would replace the Worker's policy with a `connect-src`-only one, and the deploy verify jobs would fail. |
| CSP for comments subdomain | `http.host eq "comments.gatezh.com"`                                                                                                                                                                                                                            | Keep. Remark42 is self-hosted behind a tunnel, not served by this repo. |
| Allow Picture-in-Picture   | `http.host eq "comments.gatezh.com"`                                                                                                                                                                                                                            | Keep. `Permissions-Policy: picture-in-picture=(self)` for Remark42.     |

The "CSP" rule originally matched every request, which would also have
overridden the Worker on staging; it was scoped to the production host when the
policy moved into the Worker.

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

The policy should contain `'strict-dynamic'` and a fresh `'nonce-…'` on every
request. Every deploy workflow's verify job fails if the site does not serve it.
