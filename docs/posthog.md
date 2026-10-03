# PostHog

Product analytics for `gatezh.com`, alongside Google Analytics. Production only.

## How it is wired

| Piece    | Where                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Snippet  | `services/www/themes/terminal/layouts/_partials/posthog.html`, included from `_partials/head.html`    |
| Key      | `HUGO_PARAMS_POSTHOGKEY`, a variable on the **production** GitHub Environment                         |
| Plumbing | `release.yml` passes it to the Hugo build. `deploy-staging.yml` has no equivalent line.               |
| CSP      | `services/www/src/security.ts` — `connect-src https://*.posthog.com`, `worker-src 'self' blob: data:` |

The snippet is PostHog's [Option 1, "Recommended"](https://posthog.com/docs/libraries/js):
the inline loader in `<head>`, copied verbatim from the docs, with
`api_host: 'https://us.i.posthog.com'` and a `defaults` date. Nothing in it is
specific to this site's CSP.

**Production only, structurally.** It is not enough to leave the variable unset
on staging: the staging workflow has no line that could pass it, so a key set
there by mistake still never reaches a build. Local builds have no key either,
so your own browsing never lands in the data.

**A variable, not a secret.** The project token is public by design — it is
written into every page's HTML. Everything genuinely private stays a secret
(see `docs/deployment.md`).

## Under the strict CSP

The Worker stamps a per-response nonce on every `<script>`, including this
inline snippet, and the policy's `'strict-dynamic'` then trusts whatever that
script loads — `array.js`, the session-replay recorder. That is why:

- **`script-src` has no PostHog host.** PostHog's documented policy lists one,
  but under `'strict-dynamic'` a host in `script-src` is ignored.
- **`prepare_external_dependency_script` is not used.** PostHog documents it for
  nonce policies _without_ `'strict-dynamic'`, where every injected script needs
  the nonce itself. Using it here would mean threading a per-response nonce into
  a statically built page for no effect.
- **The wildcard stays.** PostHog warns that "the exact subdomains may change
  over time" and that narrowing the list is not recommended.

`tests/worker.spec.ts` proves this rather than asserting it: a real browser loads
the page through the enforced policy and the snippet must get as far as
requesting `array.js`, with no violation raised.

## Updating

- **The snippet:** replace the whole loader line from the docs; never edit it in
  place.
- **`defaults`:** use the latest date the docs show. It is a dated configuration
  snapshot, so a newer date can change which features are on by default — read
  PostHog's changelog for it before bumping.

## Not used, on purpose

- **A reverse proxy.** PostHog offers one to keep requests first-party and
  sidestep ad blockers. It is optional in their docs, and it would put this site
  in the business of proxying a third party.
- **The toolbar's extra directives** (`img-src`, `style-src`, `font-src`,
  `media-src` and `frame-ancestors` for heatmaps). They serve the site owner's
  in-app tooling, not visitors, and `frame-ancestors` would loosen the site's
  `'none'`.
