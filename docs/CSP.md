# Content Security Policy (CSP) Setup

CSP is configured via **Cloudflare Dashboard → Transform Rules → Modify Response Header**. It is not set from project code — note that `services/www/src/index.ts` does set other response headers (`X-Robots-Tag`, `Vary`), so "no headers in code" is no longer true in general, only for CSP. This approach is universal across all projects (Hugo, React, Hono) hosted on Cloudflare Workers with custom domains.

> **⚠️ The deployed policy does not match this document.** Verified on
> 2026-09-14, `https://gatezh.com/` returns a `content-security-policy` header
> containing **`connect-src` only** — the Rule 1 value below appears to have been
> saved truncated. The site therefore has no `frame-ancestors` and no
> `X-Frame-Options` (also absent), so any origin can frame it, and there is no
> `script-src`/`default-src`/`base-uri`/`form-action` in force. Rule 2
> (`comments.gatezh.com`) returns its full policy, so the mechanism itself
> works. Re-paste the Rule 1 value and confirm with:
>
> ```console
> $ curl -sI https://gatezh.com/ | grep -i content-security-policy
> ```
>
> The `verify` job in `.github/workflows/deploy.yml` reports missing directives
> as warnings on every deploy; promote them to errors once this is fixed.

> **Note:** Transform Rules only apply to traffic routed through proxied custom domains. They do **not** apply on `*.workers.dev` URLs.

## Rules for gatezh.com

### Rule 1 — CSP (main site)

- **Filter:** Hostname equals `gatezh.com`
- **Header:** `Content-Security-Policy` → Set static
- **Value:**

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://comments.gatezh.com https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com https://*.posthog.com; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://analytics.google.com https://*.posthog.com https://gatezh-com-email-worker.gatezh.workers.dev; worker-src 'self' blob: data:; frame-src 'self' https://challenges.cloudflare.com https://comments.gatezh.com; img-src 'self' https://www.google-analytics.com data:; style-src 'self' 'unsafe-inline'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
```

> **Fonts are first-party.** JetBrains Mono is self-hosted under `/fonts/`, so
> it is covered by `default-src 'self'` and needs no `font-src` entry. This is
> also why it must stay self-hosted: the policy above allows neither
> `fonts.googleapis.com` in `style-src` nor `fonts.gstatic.com` for font
> fetches, so a Google-hosted webfont would be blocked under the policy as
> documented. It is not blocked by the policy currently deployed — see the
> warning at the top — but self-hosting is the correct fix either way and does
> not depend on the CSP being right.

### Rule 2 — CSP (comments subdomain)

- **Filter:** Hostname equals `comments.gatezh.com`
- **Header:** `Content-Security-Policy` → Set static
- **Value:**

```
default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors https://gatezh.com; base-uri 'self'; upgrade-insecure-requests
```

### Rule 3 — Permissions Policy

- **Filter:** Hostname equals `comments.gatezh.com`
- **Header:** `Permissions-Policy` → Set static
- **Value:** `picture-in-picture=(self)`

## Directive Reference

| Directive                          | Purpose                                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `default-src 'self'`               | Fallback for all fetch directives — blocks anything not explicitly allowed                                  |
| `script-src`                       | Allowed JavaScript sources                                                                                  |
| `connect-src`                      | Allowed targets for fetch/XHR/WebSocket calls                                                               |
| `worker-src 'self' blob: data:`    | Required by PostHog Session Replay                                                                          |
| `frame-src`                        | Allowed iframe sources (Turnstile widget, Remark42 comments)                                                |
| `img-src`                          | Allowed image sources; `data:` covers inline SVGs/images                                                    |
| `style-src 'self' 'unsafe-inline'` | Allows inline styles (needed by most themes/widgets)                                                        |
| `base-uri 'self'`                  | Prevents `<base>` tag hijacking                                                                             |
| `form-action 'self'`               | Restricts native HTML form submission targets — does **not** affect `fetch()`/XHR (those are `connect-src`) |
| `frame-ancestors 'self'`           | Prevents clickjacking (replaces `X-Frame-Options`)                                                          |
| `upgrade-insecure-requests`        | Forces all resource loads over HTTPS                                                                        |

## Third-Party Domain Allowlist

| Service                  | Domains                                                                                                | Directives                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Cloudflare Web Analytics | `https://static.cloudflareinsights.com`, `https://cloudflareinsights.com`                              | `script-src`, `connect-src`            |
| Google Analytics / GTM   | `https://www.googletagmanager.com`, `https://www.google-analytics.com`, `https://analytics.google.com` | `script-src`, `connect-src`, `img-src` |
| Cloudflare Turnstile     | `https://challenges.cloudflare.com`                                                                    | `script-src`, `frame-src`              |
| API Worker               | `https://gatezh-com-email-worker.gatezh.workers.dev`                                                   | `connect-src`                          |
| PostHog                  | `https://*.posthog.com`                                                                                | `script-src`, `connect-src`            |
| Remark42 (self-hosted)   | `https://comments.gatezh.com`                                                                          | `script-src`, `frame-src`              |

> PostHog recommends using the wildcard `*.posthog.com` rather than specific subdomains, as they may change routing subdomains over time. If using PostHog heatmaps, also add `https://*.posthog.com` to `frame-ancestors`.

## Managing via API

Rules can be created/updated via the Cloudflare Rulesets API using the `http_response_headers_transform` phase:

```bash
# Check existing rules
curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/phases/http_response_headers_transform/entrypoint" \
  -H "Authorization: Bearer $CF_API_TOKEN" | jq .
```

API token requires **Transform Rules Write** permission.

## Tips

- **No CSP = no restrictions.** Browsers allow everything by default. Adding CSP opts into a deny-by-default model.
- **Later Transform Rules overwrite earlier ones** for the same header on the same request. Use hostname filters to avoid conflicts.
- **Test before enforcing.** Use `Content-Security-Policy-Report-Only` header name to log violations without blocking, then switch to `Content-Security-Policy` once verified.
- **Check violations** in browser DevTools → Console for `Refused to load` errors.
