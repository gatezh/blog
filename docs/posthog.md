# PostHog

Product analytics for `gatezh.com`, alongside Google Analytics. Production only.

## How it is wired

| Piece    | Where                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snippet  | `services/www/themes/terminal/assets/js/posthog.ts`, loaded by `_partials/posthog.html` from `_partials/head.html`                                  |
| Key      | `HUGO_PARAMS_POSTHOGKEY`, a variable on the **production** GitHub Environment                                                                       |
| Plumbing | `release.yml` passes it to the Hugo build. `deploy-staging.yml` has no equivalent line.                                                             |
| CSP      | `services/www/layouts/home._outputformat_headers_.txt` — `https://*.posthog.com` in `script-src` and `connect-src`, `worker-src 'self' blob: data:` |

The snippet is PostHog's [Option 1, "Recommended"](https://posthog.com/docs/libraries/js):
the loader copied verbatim from the docs, with
`api_host: 'https://us.i.posthog.com'` and a `defaults` date. It runs from a
bundled file rather than an inline `<script>`, because the site's CSP allows no
inline script; the project token reaches it as `data-posthog-key`. Nothing in
the loader is specific to this site's CSP.

**Production only, structurally.** It is not enough to leave the variable unset
on staging: the staging workflow has no line that could pass it, so a key set
there by mistake still never reaches a build. Local builds have no key either,
so your own browsing never lands in the data.

**A variable, not a secret.** The project token is public by design — it is
written into every page's HTML. Everything genuinely private stays a secret
(see `docs/deployment.md`).

## Under the CSP

The policy is a host allowlist generated into `_headers` (see `docs/CSP.md`), so
PostHog's documented directives are what it gets, and only in builds that
include the snippet:

- **`script-src https://*.posthog.com`** for `array.js` and the session-replay
  recorder, which the loader injects from PostHog's assets host.
- **`connect-src https://*.posthog.com`** for event capture.
- **`worker-src 'self' blob: data:`** for session replay's compression Worker.
- **The wildcard stays.** PostHog warns that "the exact subdomains may change
  over time" and that narrowing the list is not recommended.

`tests/assets.spec.ts` proves this rather than asserting it: a real browser loads
the page through the enforced policy and the snippet must get as far as
requesting `array.js`, with no violation raised.

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

- **A reverse proxy.** PostHog offers one to keep requests first-party and
  sidestep ad blockers. It is optional in their docs, and it would put this site
  in the business of proxying a third party.
- **The toolbar's extra directives** (`img-src`, `style-src`, `font-src`,
  `media-src` and `frame-ancestors` for heatmaps). They serve the site owner's
  in-app tooling, not visitors, and `frame-ancestors` would loosen the site's
  `'none'`.
