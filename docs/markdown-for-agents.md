# Markdown for Agents

How `gatezh.com` serves AI-agent-friendly content, and how to switch to
Cloudflare's native equivalent if the site moves to a paid plan.

## What this gives you

- **`Accept: text/markdown` content negotiation.** Any client — an agent, or
  `curl -H 'Accept: text/markdown' ...` — gets clean Markdown for any page.
  Browsers continue to get HTML.
- **Generated `/llms.txt` and `/llms-full.txt`.** A site index in the
  [llmstxt.org](https://llmstxt.org) format plus a single-fetch full-text
  corpus, both rebuilt from content on every build. No manual maintenance.
- **Curated framing.** Each Markdown response leads with the title as H1, the
  description as a blockquote, and the publication date — context an HTML→
  Markdown converter cannot reconstruct from rendered output.

## How it works

Three cooperating layers.

### 1. Hugo output formats

`services/www/hugo.yaml` declares two custom formats. Both set `isPlainText`
(so Hugo uses `text/template` and stops HTML-escaping) and `notAlternative`
(so no `<link rel="alternate">` tags are emitted — agents arrive by URL or by
negotiation, not from `<head>`).

| Output                       | Driven by                                                  | Rendered by                                                 |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `/<section>/<slug>/index.md` | `outputs.page` includes `Markdown` (`baseName: index`)     | `services/www/layouts/page._outputformat_markdown_.md`      |
| `/llms.txt`                  | `content/llms.md` → `outputs: [LLMText]`, `url: /llms.txt` | `services/www/layouts/llms._outputformat_llmtext_.txt`      |
| `/llms-full.txt`             | `content/llms-full.md` → `outputs: [LLMText]`              | `services/www/layouts/llms-full._outputformat_llmtext_.txt` |

The two `content/llms*.md` files are front matter only. Their `url:` key is what
places the output at the site root, and `build.list: never` keeps the stubs out
of page collections and the sitemap.

The `<basename>._outputformat_<format-lowercased>_.<suffix>` filename convention
is Hugo's flexible template identifier, available from v0.161.

### 2. Shortcode handling

`.RawContent` is unprocessed source, so shortcodes would otherwise leak into
agent output as literal `{{< cfimage ... >}}`. Their `alt` and `caption` text is
real descriptive content, so it is converted rather than discarded:

- per-page Markdown → proper image syntax, `![alt](src)`, with the caption as
  italic text beneath
- `llms-full.txt` → caption (or alt) kept as italic text, image link dropped;
  it is a text corpus
- any other shortcode → removed

The regexes use `(?s)` because these shortcodes span multiple lines.

### 3. Cloudflare Worker

`services/www/src/index.ts` runs in front of the asset bundle. It requires all
three of `main`, `assets.binding: "ASSETS"` and `assets.run_worker_first: true`
in `wrangler.jsonc` — without the binding, `env.ASSETS` is `undefined` at
runtime; without `run_worker_first`, the asset router serves `/<slug>/index.md`
directly and the negotiation never runs.

```
GET /posts/foo/                    ┌──────────────────────────────┐
Accept: text/markdown          ──▶ │ run_worker_first: true       │
                                   │   └─ src/index.ts            │
                                   │        ├ /404? → real 404    │
                                   │        ├ Accept matches?     │
                                   │        │   → ASSETS          │
                                   │        │     /posts/foo/     │
                                   │        │        index.md     │
                                   │        └ else → ASSETS (HTML)│
                                   └──────────────────────────────┘
```

It also carries two SEO fixes that cannot live anywhere else:

- **`/404` and `/404.html` return a real 404.** Cloudflare's asset router
  rewrites `/404.html` to `/404` and serves it `200`, making the error page an
  indexable URL that Google files as a soft 404. Neither a zone setting nor
  `_headers` can change a response status, and `_redirects` only issues 3xx.
- **`.md` and `llms*.txt` carry `X-Robots-Tag: noindex`.** They stay crawlable
  for agents without publishing a full-text duplicate of every page at a second
  URL. An `_headers` file cannot do this either: Cloudflare
  [documents](https://developers.cloudflare.com/workers/static-assets/headers/)
  that `_headers` does not apply to Worker-generated responses when
  `run_worker_first` is set.

`Vary: Accept` is added on content pages only. Putting it on hashed assets like
`/css/main.<hash>.css` would fragment the CDN cache by request header for no
benefit.

## Verification

```bash
bun run build:www
ls services/www/public/posts/*/index.md          # per-page mirrors
cat services/www/public/llms.txt                 # generated index

cd services/www && bunx wrangler dev --port 8799 --local
# in another shell:
curl -sI -H 'Accept: text/markdown' localhost:8799/posts/<slug>/
#   content-type: text/markdown; charset=utf-8
#   vary: Accept
#   x-robots-tag: noindex
curl -sI localhost:8799/posts/<slug>/            # content-type: text/html
curl -s -o /dev/null -w '%{http_code}\n' localhost:8799/404      # 404, not 200
```

The post-deploy `verify` job in `.github/workflows/deploy.yml` asserts the same
invariants against production.

## Future: Hugo native llms.txt

Hugo has an open issue to generate `llms.txt` natively
([gohugoio/hugo#14121](https://github.com/gohugoio/hugo/issues/14121)),
currently milestoned v0.167.0 after slipping from several earlier releases.
When it ships, the two `content/llms*.md` stubs and their templates can likely
be retired. The per-page Markdown mirrors and the Worker are unaffected.

## Future: Cloudflare's native Markdown for Agents

Cloudflare's **Markdown for Agents** converts HTML to Markdown at the edge when
a request carries `Accept: text/markdown`
([docs](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)).

> It is available to **Pro, Business and Enterprise** plans, and SSL for SaaS
> customers. This site runs on the **free plan**, which is why the custom
> implementation above exists.

The native conversion adds `Content-Type: text/markdown`, an
`x-markdown-tokens` estimate, and a `Content-Signal` header. It handles HTML
only, origin responses up to 2 MB, and is in beta.

### Operating modes

The two are not mutually exclusive — together they give three valid modes:

| Mode              | `run_worker_first` | Zone toggle | Behaviour on `Accept: text/markdown`  |
| ----------------- | ------------------ | ----------- | ------------------------------------- |
| Today (free plan) | `true`             | n/a         | Worker serves the pre-built `.md`     |
| Paid, native only | `false`            | on          | Edge converts HTML on the fly         |
| Paid, keep custom | `true`             | off         | Worker serves curated pre-built `.md` |

Keeping the custom path after upgrading is reasonable for **curated framing**
(the H1/blockquote/date header is authored, not inferred) and **determinism**
(the same source deterministically produces the same response, in version
control; edge conversion is implementation-defined and may change).

### Migration sequence

1. Enable **Markdown for Agents**: Cloudflare → zone → **AI Crawl Control**.
2. Smoke test: `curl -sI -H 'Accept: text/markdown' https://gatezh.com/`. This
   is safe alongside the Worker, which still intercepts first.
3. Decide whether to keep the custom path. Keeping it needs no further change.
4. To go fully native, set `assets.run_worker_first: false`. The Worker becomes
   a no-op.
5. Optionally remove the unused code: delete `services/www/src/`,
   `services/www/tsconfig.json`, `"main"` from `wrangler.jsonc`, the `Markdown`
   output format and its `outputs.page` entry, and
   `layouts/page._outputformat_markdown_.md`. **Keep the `llms*` templates and
   stubs** — the generated indexes remain valuable.
6. Rollback: set `run_worker_first` back to `true`.

> **Caveat.** The native feature is documented as converting "the original HTML
> version from the origin". With `run_worker_first: true` the Worker generates
> the response, and the docs are not explicit about whether the edge converter
> runs on Worker output. When committing to native, also set
> `run_worker_first: false` so HTML is served straight from the asset bundle,
> which is what the documented conversion path expects.

Note that step 5 would also remove the soft-404 fix and the `X-Robots-Tag`
headers, which are unrelated to negotiation. Keep the Worker unless those are
re-homed.

## References

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Static Assets binding (`run_worker_first`)](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Hugo custom output formats](https://gohugo.io/configuration/output-formats/)
- [Hugo media types](https://gohugo.io/configuration/media-types/)
- [llms.txt spec](https://llmstxt.org)
