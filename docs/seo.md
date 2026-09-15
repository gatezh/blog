# SEO & Index Coverage

Search-engine indexability for `gatezh.com`: the settings that live outside this
repo, the Search Console actions only a human can take, and a record of what is
already enforced in code so nobody re-fixes it.

Not required for a working deploy — see [deployment.md](./DEPLOYMENT.md) for
that. Everything here is about being _found_, not about the site functioning.

---

## 1. Cloudflare zone settings

Neither of these is visible from the repo, and neither can be set in code.

There are two independent URL-canonicalisation axes, and they use different
mechanisms — easy to conflate:

| Axis                                | Mechanism                                                    |
| ----------------------------------- | ------------------------------------------------------------ |
| `http://` → `https://` (**scheme**) | **Always Use HTTPS** toggle, SSL/TLS → Edge Certificates     |
| `www.` → apex (**hostname**)        | **Single Redirect rule**, Rules → Redirect Rules — no toggle |

> **The two axes are independent.** Always Use HTTPS rewrites the scheme only
> and leaves the hostname alone; collapsing `www` needs its own Redirect Rule.
>
> As of now `www.gatezh.com` has **no DNS record**, so there is no `www`
> duplicate to canonicalise — but anyone typing that hostname gets a DNS error
> rather than the site. Tracked in
> [#39](https://github.com/gatezh/blog/issues/39).

Without the scheme redirect, a Workers custom domain answers on `http://` as
well as `https://`, so every page has a duplicate URL and Search Console files
them under "Alternate page with proper canonical tag".

- [x] **Always Use HTTPS** — already on (verified below). Set under SSL/TLS →
      Overview (the toggle is hidden if the encryption mode is `Off`) → Edge
      Certificates.

  ```console
  $ curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://gatezh.com/
  301 https://gatezh.com/
  ```

- [ ] **HSTS** — not set. Tracked in
      [#101](https://github.com/gatezh/blog/issues/101). Same Edge Certificates page. Not an indexing signal on its own;
      it is the documented companion to the redirect above and stops browsers
      making the plain-http request at all on repeat visits.

  > Read the warning first. Once HSTS is live, browsers refuse plain http for
  > the whole max-age window. Do not enable it if you might move DNS off
  > Cloudflare, pause Cloudflare, or drop HTTPS on any subdomain within that
  > window. `Include subdomains` extends that to `comments.gatezh.com`. Leave
  > **Preload** off — the browser preload list is effectively a one-way door.

  Verified not set — the check below currently prints nothing. Once enabled it
  should print:

  ```console
  $ curl -sI https://gatezh.com/ | grep -i strict-transport
  strict-transport-security: max-age=31536000; includeSubDomains
  ```

These are dashboard state, so they can drift silently. Re-check them whenever
index coverage looks wrong.

---

## 2. Google Search Console

Only a human with property access can do these.

- [ ] **Submit the sitemap.** Search Console → Sitemaps → `https://gatezh.com/sitemap.xml`.
- [ ] **Request indexing for pages that matter.** URL Inspection → paste → Request
      Indexing. There is a small daily quota, so spend it on pages you would
      actually want ranking.
- [ ] **Confirm the property type.** A domain property crawls and reports every
      subdomain, `comments.gatezh.com` included. Any subdomain that resolves but
      should not be indexed needs an explicit signal.
- [ ] **Re-check coverage after a few weeks.** "Discovered — currently not
      indexed" drains gradually on a low-authority domain and is not a bug;
      `Last crawled: N/A` means Googlebot never fetched the URL at all, which no
      code change speeds up.

---

## 3. Already enforced — do not re-fix

Recorded so a future reader does not "discover" and undo any of it.

| Rule                                                      | Where                                                                        | Guarded by             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| Taxonomy/term listings are `noindex, follow`              | `themes/terminal/layouts/_partials/head.html`                                | `tests/seo.spec.ts`    |
| The 404 page is `noindex`                                 | same                                                                         | `tests/seo.spec.ts`    |
| Every page has a self-referencing canonical               | same                                                                         | `tests/seo.spec.ts`    |
| Taxonomy/term listings are excluded from the sitemap      | `layouts/sitemap.xml`                                                        | `tests/seo.spec.ts`    |
| Every sitemap URL is reachable and indexable              | —                                                                            | `tests/seo.spec.ts`    |
| No `/page/1/` pagination alias stubs are emitted          | `hugo.yaml` → `pagination.disableAliases`                                    | `tests/seo.spec.ts`    |
| Internal page links all carry a trailing slash            | —                                                                            | `tests/seo.spec.ts`    |
| Legacy URLs 301 in one hop, with no meta-refresh stub     | `hugo.yaml` → `disableAliases` + `layouts/home._outputformat_redirects_.txt` | `tests/worker.spec.ts` |
| Every post links out to related posts                     | `hugo.yaml` → `related`                                                      | `tests/seo.spec.ts`    |
| `<lastmod>` tracks the last commit, not the authored date | `hugo.yaml` → `enableGitInfo`                                                | needs `fetch-depth: 0` |
| The deployed artifact is the build CI expects             | `<meta name="build-commit">`                                                 | `verify` job           |
| Stale build output is never deployed                      | `--cleanDestinationDir`                                                      | —                      |

Five things that look redundant but are not:

- **`fetch-depth: 0` on the deploy-www checkout.** `enableGitInfo` reads git
  history for each page's `<lastmod>`. On a shallow clone Hugo does not warn or
  error — it silently falls back to the `date` front matter, reproducing exactly
  the stale-date problem `enableGitInfo` was added to fix.
- **`--renderToMemory` on the Playwright web server.** `hugo server` otherwise
  writes into `./public`, and Hugo never prunes files the current build no longer
  produces, so tests asserting a URL is _gone_ would pass or fail on leftovers
  rather than on the config under test. This is not hypothetical: the `/page/1/`
  stubs appeared to survive `disableAliases` purely because six of them were
  leftovers from earlier builds.
- **Self-hosted fonts.** See [CSP.md](./CSP.md) — the policy allows neither
  `fonts.googleapis.com` nor `fonts.gstatic.com`, so a Google-hosted webfont is
  blocked in production and the site silently falls back to the local monospace
  stack. Keep JetBrains Mono under `/fonts/`.
- **Two lines per alias in `/_redirects`.** `html_handling: auto-trailing-slash`
  answers the slash-less spelling of a path with its own 307 _before_ any
  redirect rule is consulted, so emitting only the canonical slash form turns
  every legacy URL into a 307 → 301 chain. Verified against
  `wrangler dev --local`; `tests/worker.spec.ts` asserts both spellings.
- **`disableAliases` and `pagination.disableAliases` are different settings.**
  Both are set and both are load-bearing. The top-level one stops Hugo writing a
  meta-refresh stub per `aliases:` entry — without it the stub is served `200` at
  the same URL and wins over the redirect rule, silently reinstating the meta
  refresh. The `pagination.` one stops the `/page/1/` stubs. A merge that
  collapses them breaks one or the other.

---

## 4. Reading a Search Console coverage export

The CSV export gives **counts and reasons, not URLs** — the URL list is only in
the web UI. Two things to establish before treating any of it as a bug:

1. **Which build was live during the reporting window.** The 2026-09-14 export
   covered 2026-06-16 → 2026-09-03, when production was still running the
   pre-phase-1 build: no canonical tags, no robots meta, taxonomy listings in the
   sitemap and `/404` answering `200`. Most of what it reported was already fixed
   in code and merely undeployed. `<meta name="build-commit">` on any page says
   which commit is actually live.
2. **Which bucket the reason falls into.** They are not equally actionable:

| Reason                               | Who decided       | Actionable in code?                                      |
| ------------------------------------ | ----------------- | -------------------------------------------------------- |
| `Page with redirect`                 | Googlebot fetched | Yes — it is reporting a redirect, which is often correct |
| `Crawled - currently not indexed`    | Googlebot fetched | Sometimes — thin or near-duplicate pages                 |
| `Discovered - currently not indexed` | Never fetched     | **No** — crawl budget and authority, not markup          |

`Discovered` is the one that looks alarming and responds to nothing. It drains
slowly on a low-authority domain; `Last crawled: N/A` in URL Inspection confirms
Googlebot never fetched the URL at all.

Known-good entries that will keep appearing under `Page with redirect`, because
they are the redirects this repo deliberately serves: the seven dated
`/posts/YYYY/MM/DD/<slug>` paths and the four Jekyll-era `/<slug>.html` paths,
all 301 to their canonical post.
