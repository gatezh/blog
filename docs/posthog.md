# PostHog

Product analytics for `gatezh.com`, alongside Google Analytics. Production only.

## How it is wired

| Piece    | Where                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snippet  | `services/www/themes/terminal/assets/js/posthog.ts`, loaded by `_partials/posthog.html` from `_partials/head.html`                                                                     |
| Key      | `HUGO_PARAMS_POSTHOGKEY`, a variable on the **production** GitHub Environment                                                                                                          |
| Proxy    | `HUGO_PARAMS_POSTHOGAPIHOST`, a **secret** on the production GitHub Environment; overrides `params.posthogApiHost` (`https://us.i.posthog.com`) in `hugo.yaml`                         |
| Plumbing | `release.yml` passes both to the Hugo build. `deploy-staging.yml` has no equivalent line.                                                                                              |
| CSP      | `services/www/layouts/home._outputformat_headers_.txt` — `https://*.posthog.com` in `script-src` and `connect-src`, `worker-src 'self' blob: data:`, and the violation report endpoint |

The snippet is PostHog's [Option 1, "Recommended"](https://posthog.com/docs/libraries/js):
the loader copied verbatim from the docs, with `api_host` from
`params.posthogApiHost`, `ui_host: 'https://us.posthog.com'` and a `defaults`
date. It runs from a
bundled file rather than an inline `<script>`, because the site's CSP allows no
inline script; the token and hosts reach it as `data-*` attributes. Nothing in
the loader is specific to this site's CSP.

**Production only, structurally.** It is not enough to leave the variable unset
on staging: the staging workflow has no line that could pass it, so a key set
there by mistake still never reaches a build. Local builds have no key either,
so your own browsing never lands in the data.

**A variable, not a secret.** The project token is public by design — it is
written into every page's HTML. Everything genuinely private stays a secret
(see `docs/deployment.md`).

## Reverse proxy

Production sends events through PostHog's
[managed reverse proxy](https://posthog.com/docs/advanced/proxy), a subdomain of
gatezh.com, so ad blockers that list PostHog's hosts do not drop them. It serves
`/static/array.js` too, so the page never contacts `*.posthog.com` directly.

- **The hostname is a secret.** It is in every page's HTML and CSP, so this
  hides it only from the repository and its Actions logs — the places a
  blocklist maintainer could grep. What keeps it off lists is a boring name: never
  `analytics`, `tracking`, `telemetry`, `posthog` or `ph`.
- **Setup:** PostHog → Organization settings → Managed reverse proxy, then a
  Cloudflare `CNAME` to the target PostHog shows, **DNS only** (an orange cloud
  breaks certificate issuance). Set the secret to `https://<subdomain>`.
- **Release gate:** `release.yml`'s preflight fetches `array.js` through the
  proxy and stops a release if it fails (a redeploy only warns).
- **Without the secret** the build falls back to `us.i.posthog.com`, with a
  warning in preflight.
- **Changing it:** create the new proxy and CNAME, wait for PostHog to show it
  valid, update the secret, release, then delete the old proxy and record.

## Under the CSP

The policy is a host allowlist generated into `_headers` (see `docs/CSP.md`), so
PostHog's documented directives are what it gets, and only in builds that
include the snippet:

- **`script-src https://*.posthog.com`** for `array.js` and the session-replay
  recorder, which the loader injects from PostHog's assets host.
- **`connect-src https://*.posthog.com`** for event capture.
- **The reverse proxy** in both, when `posthogApiHost` is not a `*.posthog.com`
  host.
- **`worker-src 'self' blob: data:`** for session replay's compression Worker.
- **`report-uri` and `report-to posthog`**, with a `Reporting-Endpoints`
  header, send the site's own CSP violations to this project
  ([CSP tracking](https://posthog.com/docs/csp-tracking)), at
  `<posthogApiHost>/report/?token=<key>`. See `docs/CSP.md`, "Violation
  reports".
- **The wildcard stays.** PostHog warns that "the exact subdomains may change
  over time" and that narrowing the list is not recommended.

`tests/assets.spec.ts` proves this rather than asserting it: a real browser loads
the page through the enforced policy and the snippet must request `array.js`
from a placeholder proxy, with no violation raised and no request to
`*.posthog.com`.

## Updating

- **The snippet:** replace the whole loader line in `js/posthog.ts` from the
  docs; never edit it in place.
- **`defaults`:** pinned at `2026-05-30`, the date PostHog's install snippet
  shows. It sets SDK option defaults only — autocapture, session replay and web
  vitals are separate options and project settings. The
  [config reference](https://posthog.com/docs/libraries/js/config) lists newer
  dates, and each adds behaviour: `2026-06-25` turns on
  `session_recording.streamNetworkBody`, which matters on a page with a contact
  form. Read what a date adds there before bumping to it.

## Not used, on purpose

- **The toolbar's extra directives** (`img-src`, `style-src`, `font-src`,
  `media-src` and `frame-ancestors` for heatmaps). They serve the site owner's
  in-app tooling, not visitors, and `frame-ancestors` would loosen the site's
  `'none'`.
