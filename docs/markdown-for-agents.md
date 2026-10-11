# Markdown for Agents

How `gatezh.com` serves AI-agent-friendly content, and how to switch to
Cloudflare's native equivalent if the site moves to a paid plan.

## What this gives you

- **A Markdown mirror of every page.** The home page, every section listing and
  every regular page has an `index.md` beside its `index.html`, advertised from
  the HTML with `<link rel="alternate" type="text/markdown" href="…/index.md">`.
  There is no `Accept: text/markdown` negotiation: agents fetch the `.md` URL
  directly (see [ADR-005](adr-005-static-headers-no-worker-code.md) for why).
- **Generated `/llms.txt` and `/llms-full.txt`.** A site index in the
  [llmstxt.org](https://llmstxt.org) format plus a single-fetch full-text
  corpus, both rebuilt from content on every build. No manual maintenance.
- **Curated framing.** Each Markdown response leads with the title as H1, the
  description as a blockquote, and the publication date — context an HTML→
  Markdown converter cannot reconstruct from rendered output.

## How it works

Three cooperating layers, all static: nothing runs per request.

### 1. Hugo output formats

The mirrors use Hugo's built-in `markdown` format. `llms*.txt` use a custom
`LLMText` format in `services/www/hugo.yaml`, which sets `isPlainText` (so Hugo
uses `text/template` and stops HTML-escaping) and `notAlternative` (so pages do
not link to it). The `<link rel="alternate" type="text/markdown">` for the
mirror is emitted by `themes/terminal/layouts/_partials/head.html`, only on
pages that have one.

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

### 3. Response headers

`.md` and `llms*.txt` carry `X-Robots-Tag: noindex`: they stay crawlable for
agents without publishing a full-text duplicate of every page at a second URL.
The header comes from rules in the generated `public/_headers`
(`layouts/home._outputformat_headers_.txt`), which Workers static assets
applies with no Worker code
([docs](https://developers.cloudflare.com/workers/static-assets/headers/)):

```
/index.md
  X-Robots-Tag: noindex

/*/index.md
  X-Robots-Tag: noindex

/llms.txt
  X-Robots-Tag: noindex

/llms-full.txt
  X-Robots-Tag: noindex
```

Rules with different patterns merge with the site-wide `/*` rule, so these
responses also get the security headers.

## Verification

```bash
bun run build:www
ls services/www/public/posts/*/index.md          # per-page mirrors
cat services/www/public/llms.txt                 # generated index

cd services/www && bunx wrangler dev --port 8799 --local
# in another shell:
curl -sI localhost:8799/posts/<slug>/index.md
#   content-type: text/markdown; charset=utf-8
#   x-robots-tag: noindex
curl -s localhost:8799/posts/<slug>/ | grep -o '<link rel=alternate type=text/markdown[^>]*>'
```

The post-deploy `verify` job in `.github/workflows/release.yml` asserts the same
invariants against production.

## Future: Hugo native llms.txt

Hugo has an open issue to generate `llms.txt` natively
([gohugoio/hugo#14121](https://github.com/gohugoio/hugo/issues/14121)),
currently milestoned v0.167.0 after slipping from several earlier releases.
When it ships, the two `content/llms*.md` stubs and their templates can likely
be retired. The per-page Markdown mirrors are unaffected.

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

It is a zone toggle (Cloudflare → zone → **AI Crawl Control**) and needs no
code: HTML is served straight from the asset store, which is the response the
documented conversion path expects. Turning it on would bring back
`Accept: text/markdown` negotiation without a Worker. The pre-built mirrors can
stay either way: their framing (the H1/blockquote/date header) is authored, not
inferred, and the same source always produces the same file.

## References

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Static Assets headers (`_headers`)](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- [Hugo custom output formats](https://gohugo.io/configuration/output-formats/)
- [Hugo media types](https://gohugo.io/configuration/media-types/)
- [llms.txt spec](https://llmstxt.org)
