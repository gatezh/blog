# Share image, Talks, Projects and footer theme switcher — review (PRs #133–#136)

A stack of four PRs, each based on the one before it:

| PR                                                      | Branch                                              | Commit(s)            |
| ------------------------------------------------------- | --------------------------------------------------- | -------------------- |
| #133 feat(seo): add a share image and favicons          | `feat/brand-assets` → `master`                      | `ee3a853`            |
| #134 feat(www): add a Talks page                        | `feat/talks-page` → `feat/brand-assets`             | `8dbb6f2`, `bef2287` |
| #135 feat(www): add a Projects page                     | `feat/projects-page` → `feat/talks-page`            | `81c0a8e`            |
| #136 feat(theme): move the theme switcher to the footer | `feat/footer-theme-switcher` → `feat/projects-page` | `242f15f`            |

No plan or spec document exists for this work, so it was reviewed against the PR
descriptions, the commit messages and the project rules (`.claude/rules/seo.md`,
`hugo-theme.md`, `docs/seo.md`). Each PR's diff was read against its base branch.
Probes ran on a build of the stack's tip (`242f15f`) in a scratch worktree.

Installed versions every finding was checked against: Hugo extended 0.164.0
(`.mise.toml`), its embedded templates at tag `v0.164.0`, Tailwind CSS v4 (via
`css.TailwindCSS`), `@playwright/test` from `bun.lock`, Bun 1.4.4. CI (Lint,
Test (Browser)) is green on all four PRs.

## Review Round 1

### Summary

The stack is well built. All the data lives in one place: talks and projects
come from front matter and render to the HTML, the Markdown mirror,
`llms-full.txt` and the JSON-LD. The theme switcher now uses native radios
instead of ARIA buttons, which follows the native-first rule. Two pieces of
custom code were checked and should stay: the share-image partial and the ICO
packer.

The issues that matter are mostly content and data, not code:

- The Projects page makes a claim that the repo shows to be false (#1).
- The Projects page links to a domain that doesn't resolve (#2).
- The `llms.txt` list of standalone pages is maintained by hand, and it already
  misses a page. A one-line built-in replaces it (#3).
- Every post's Article `image` is a generic brand card, which Google's
  guidelines rule out (#4).

### Important

#### 1. "About 20 lines on Workers" is false: the contact Worker is 307 lines

`services/www/content/projects/index.md:102` (#135)

The gatezh.com entry says the hosted contact form was replaced by "About 20
lines on Workers, with Turnstile instead of a CAPTCHA". The repo it links to
says otherwise: `services/api/src/index.ts` is 307 lines, 231 of them code. It
holds Turnstile verification, email validation, input sanitising, HTML and
plain-text email builders, CORS middleware and the POST handler. The page links
straight to that repository, so any reader who checks finds the claim wrong. On
a page whose job is credibility, that hurts.

**Fix:** state something the code supports, for example "One Worker on the free
tier, with Turnstile instead of a CAPTCHA". The `before:` line ("$180 a year for
a hosted contact form") could not be verified from the repo. Confirm its source
before shipping it.

#### 2. `surgegate.dev` does not resolve, but the page links to it and its JSON-LD names it as the URL

`services/www/content/projects/index.md:112` (#135)

A DNS-over-HTTPS query to Cloudflare for `surgegate.dev` returns no answer:
only the zone's SOA (`alex.ns.cloudflare.com`), with no A or AAAA record. `curl`
fails with "Could not resolve host". The other three product URLs return 200.
Three things use the dead URL:

- the SurgeGate heading link
- the Markdown mirror and `llms-full.txt` (`### [SurgeGate](https://surgegate.dev/)`)
- the JSON-LD item's `url`

"Coming soon" explains why the site isn't there yet. It doesn't make a dead link
acceptable, and the JSON-LD presents that URL as the entity's address.

**Fix:** remove `url:` from the SurgeGate entry until the site is live. The
shortcode, the Markdown template and the diagram already handle an entry with no
URL (Hugo on Cloudflare Workers has none). The JSON-LD item then needs no `url`.
See #7 for its `@type`.

#### 3. The standalone-page list in both llms templates is maintained by hand, already misses `/early-projects/`, and `site.Home.RegularPages` replaces it

`services/www/layouts/llms._outputformat_llmtext_.txt:28`,
`services/www/layouts/llms-full._outputformat_llmtext_.txt:27` (#134, extended in #135)

#134 replaced `site.GetPage "/about"` with `range slice "/about" "/talks"`, and
#135 added `"/projects"`. A rule went into `.claude/rules/seo.md` and a comment
into the template: "a new one needs adding there". But one top-level page is
already missing. `/early-projects/` has been on `master` since #111. It is
indexable and in the sitemap, and it is in neither `llms.txt` nor
`llms-full.txt`. The test only checks the paths it is given, so it cannot catch
this.

Hugo already provides this list. Probe, on a build of the stack tip, using a
throwaway layout:

```
site.Home.RegularPages:  /about/ /early-projects/ /projects/ /talks/
agent-listable of that:  /about/ /early-projects/ /projects/ /talks/
```

`llms.md` and `llms-full.md` are excluded already by their `build: list: never`.

**Fix:** in both templates, replace the `slice` with the collection, filtered the
way every other list there is:

```go-html-template
{{ range partial "agent-listable.html" site.Home.RegularPages }}{{ template "entry" . }}{{ end }}
```

Use `template "page"` in llms-full. This needs no lookup by path and no rule to
remember. Give About `weight: 1` in its front matter if it should stay first.
Then delete:

- the sentence in `.claude/rules/seo.md` that says new pages need adding by hand
- the matching paragraph in the llms template comment
- the `docs/seo.md` table row about it

Turn the agents test into a coverage check: every top-level page in the sitemap
appears in both files. If `/early-projects/` is meant to stay out of the agent
indexes, `robots: noindex` is the lever these templates already honour. Being
missing from a hand-kept list is not a decision anyone can see.

#### 4. Every post's Article JSON-LD `image` is the site-wide brand card, which Google's Article guidelines rule out

`services/www/layouts/_partials/seo.html:93-95` (#133)

Google's Article structured-data docs say: "Images must represent the marked up
content." (https://developers.google.com/search/docs/appearance/structured-data/article).
The new merge gives every post the same "Serge Gatezh, Product Engineer" card as
its `image`. For social previews, a site-wide fallback is normal and useful. For
Article markup, it states something the guidelines forbid, on every post. A test
pins that behaviour: "a post's Article image is the share image".

**Fix:** keep the fallback for `og:image` and `twitter:image`. Emit the Article
`image` only when the post sets its own `image:`:

```go-html-template
{{- if .Params.image }}{{ with partial "share-image.html" . }} … {{ end }}{{ end }}
```

Change the test to assert that a post without `image:` has no Article `image`,
and that one with `image:` matches `og:image`.

### Minor

#### 5. Google Search can't use the SVG favicon, and the only raster `rel=icon` is 32 px

`services/www/themes/terminal/layouts/_partials/head.html:106-120`, `services/www/brand/render.ts:76` (#133)

Google's favicon docs list the supported formats as "BMP, GIF, ICO, PNG, JPEG,
PPM, and TIFF". SVG is not among them. The same docs recommend "a favicon that's
larger than 48x48px" (https://developers.google.com/search/docs/appearance/favicon-in-search).
So the only `rel=icon` that Search can use is `favicon-32.png`, which is below
that size. Google also accepts `apple-touch-icon`, so the 180 px icon may still
be picked, but nothing guarantees it. This matters because the roadmap item this
closes was justified by "Google shows the favicon beside every result".

**Fix:** also render a 192 px PNG (`renderIcon(page, 192)`, which costs one more
line) and link it as `<link rel="icon" type="image/png" sizes="192x192">`. Add it
to the size loop in the favicons test.

#### 6. A product that doesn't run on a second-layer platform silently drops out of the stack diagram

`services/www/layouts/_partials/project-graph.html:53-56`, `services/www/tests/seo.spec.ts` (#135)

The diagram's groups come from
`where (index $layers 0).projects "runsOn" .id` for each second-layer entry. Two
kinds of product never appear in any group:

- a product with no `runsOn`
- a product whose `runsOn` names a node outside the second layer (the edge check
  only confirms that the node exists)

The build doesn't fail. The diagram test hard-codes `toBe(7)`, so an eighth
product with a bad `runsOn` still yields seven boxes, and the test passes.

**Fix:** in `project-graph.html`, call `errorf` for any first-layer entry whose
`runsOn` is not the `id` of a second-layer entry. In the test, compare the box
count with `article.project-diff` instead of 7.

#### 7. The JSON-LD types SurgeGate as `SoftwareSourceCode`, and doesn't read the shared graph as the PR says

`services/www/content/projects/index.md:113`, `services/www/layouts/_partials/seo.html:172-200` (#135)

SurgeGate's source is private, and it is listed by its website. The page's own
rule is "a project with private code appears by its public website, never its
repository". Yet its `type` is `SoftwareSourceCode`, which tells search engines
the URL is source code. Use `SoftwareApplication` (or `WebSite` once the site is
live), as Utilify uses `WebApplication`.

Separately, the PR description says the JSON-LD reads `project-graph.html` "so
they can't disagree". It doesn't. `seo.html` walks `.Params.layers` itself.
That is fine, because the JSON-LD needs no edges, but correct the description.

#### 8. `render.ts` waits for `document.fonts.ready`, which also resolves when the font fails to load

`services/www/brand/render.ts:33-34` (#133)

The comment says the wait stops a screenshot "silently" using the fallback font.
`FontFaceSet.ready` doesn't do that. It resolves once loading has _finished_,
whether it succeeded or failed (MDN, `FontFaceSet.ready`). If someone moves
`static/fonts/jetbrains-mono-latin.woff2`, `bun run brand` commits a
`share.png` set in the fallback monospace font, with no error. `load()` is the
API that rejects on failure (MDN, `FontFaceSet.load()`: "rejected if one of the
fonts failed to load").

**Fix:**

```ts
const loaded = await page.evaluate(() =>
  document.fonts.load('800 108px "JetBrains Mono"').then((f) => f.length),
);
if (!loaded) throw new Error("JetBrains Mono did not load; share.png would use the fallback font");
```

#### 9. No theme radio is checked until the script runs

`services/www/themes/terminal/layouts/_partials/theme-toggle.html:17-23` (#136)

The built HTML has three radios and none of them has `checked`. The default,
system, exists only after `theme-toggle.ts` runs. If the script fails (blocked,
SRI mismatch) or before it runs, the group shows no selection. The test
"defaulting to the system theme" passes only because of the script.

**Fix:** server-render the default, `{{ if eq . "system" }} checked{{ end }}`.
The script already overwrites `checked` with the stored choice.

### Nits

- **`data-status="done"` is dead CSS, and the status class is guessed from the
  display string.** `main.css` styles `[data-status="done"]`, but the shortcode
  only emits `live` or `soon` (built output: 5 × `live`, 2 × `soon`). `soon` comes
  from matching `hasPrefix "Coming"` or `"Waitlist"`, so rewording a status
  changes its colour. Either add an explicit `state:` key, or delete the `done`
  rule.
- **Hand-written visually-hidden CSS for `.theme-toggle-input`** (#136): Tailwind's
  `sr-only` utility does this job, and `projects.html` already uses it. Use
  `class="theme-toggle-input sr-only"` and drop the five declarations.
- **`render.ts` turns `file:` URLs into paths with `.pathname`**, which is still
  percent-encoded, so a checkout path containing a space fails.
  `fileURLToPath(path(...))` from `node:url` is the correct conversion.
- **Front-matter key names:** `image:` and `params.ogImage` differ from Hugo's
  own convention. The embedded `opengraph.html`, `twitter_cards.html` and
  `schema.html` templates, through `_partials/_funcs/get-page-images.html`
  (v0.164.0), read `images:` and `params.images`. The custom partial is still
  the right call (see the audit table). Using Hugo's names costs nothing and
  keeps any embedded or third-party partial in agreement.

### Native-first audit

| Custom piece                                                    | Built-in checked (where)                                                           | Verdict                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `share-image.html` partial (image lookup, alt, absolute URL)    | Hugo's embedded `opengraph.html` + `_funcs/get-page-images.html` (v0.164.0 source) | **Keep**: the built-in emits no width, height or alt, doesn't fingerprint, and falls back to `absURL` for a missing file instead of failing. Key names: nit                                                                                                                                                                            |
| Playwright renderer for the share image                         | Hugo `images.Text` filter                                                          | **Keep**: `images.Text` draws text only. The card's rule, accent bar, cursor block and footer row would mean several hand-positioned filters, and the result would not match the HTML template the site's CSS tokens feed                                                                                                              |
| SVG → PNG via Chromium screenshot                               | Hugo image processing                                                              | **Keep**: Hugo can't rasterise SVG                                                                                                                                                                                                                                                                                                     |
| `ico()` packer (20 lines)                                       | Hugo image formats; ImageMagick or `png-to-ico`                                    | **Keep**: Hugo has no ICO encoder, and a new dependency for a one-off render isn't worth it                                                                                                                                                                                                                                            |
| `slice "/about" "/projects" "/talks"` in both llms templates    | `site.Home.RegularPages` (probe above)                                             | **Replace** (#3)                                                                                                                                                                                                                                                                                                                       |
| Identical `talks.*` / `projects.*` md + txt shortcode templates | Shortcode lookup fallback                                                          | **Keep**: a probe showed that either file alone renders byte-identical Markdown mirrors and `llms-full.txt`. But Hugo's shortcode docs (https://gohugo.io/templates/shortcode/) document lookup only by output format and suffix, not this cross-format fallback, so don't build on it. Same convention as `about-focus` and `cfimage` |
| `project-graph.html`                                            | —                                                                                  | **Keep**: one source for the diagram, the relation lines and the mirror. The JSON-LD doesn't use it (#7)                                                                                                                                                                                                                               |
| `showcase.html` layout                                          | Theme `page.html`                                                                  | **Keep**: avoids the Article microdata on list pages, as documented                                                                                                                                                                                                                                                                    |
| Theme switcher as native radios in a `<fieldset>`               | —                                                                                  | Already native: it replaces ARIA radio buttons. The arrow-key test confirms the browser's behaviour                                                                                                                                                                                                                                    |
| `.theme-toggle-input` hiding CSS                                | Tailwind `sr-only`                                                                 | **Replace** (nit)                                                                                                                                                                                                                                                                                                                      |
| Credential badge crop and WebP                                  | Hugo `Crop` / `Process`                                                            | Already native                                                                                                                                                                                                                                                                                                                         |

### Checked and correct

- **Event JSON-LD:** `startDate` and `endDate` render with the venue's offset
  (`2026-10-20T18:00:00-06:00`, `2026-03-30T17:30:00-06:00`, both correct MDT).
  Each `@id` anchor exists. A BreadcrumbList is still emitted on `/talks/` and
  `/projects/`.
- **`/brand/*` immutable caching** is safe: the build publishes only fingerprinted
  files under `/brand/`. `/favicon.ico` keeps revalidating.
- **ICO container:** header, entry offsets and PNG-encoded entries are correct.
  The test checks the ICONDIR.
- **External links:** both slide PDFs, both event pages, utilify.ca, bankand.me
  and uxcringe.com return 200. `gatezh/devcontainers` and the meetup repo are
  public.
- **Public-repo rule:** no private repository is named or linked. SurgeGate
  appears by product name and site only.
- **Security:** `safeHTML` and `safeCSS` apply only to strings built from
  author-controlled front matter, with names passed through `htmlEscape`. The
  CSS values are integers. No secrets, no new script, nothing inline.
- **Theme switcher:** `themechange` is still dispatched, so Remark42 sync
  (ADR-003) is unaffected. No stale references to `.theme-toggle-btn` remain.
- **Breakpoint change to `md`** (#134): the header markup and `mobile-menu.ts`
  have no other breakpoint coupling.

## Round 1 resolution

Every fix sits on the PR whose code it changes. The branches above each fix
were restacked with `gh stack rebase`. Every branch passes `bun run check` and
`bun run test` on its own.

| #                    | Outcome                                                                                                                                                                                                                                                                                                                                                   | Commit                                                   | Verified by                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1                    | **Not changed, by owner's decision.** The owner judges that a simple contact Worker fits in about 20 lines, and keeps the copy. For the record: the current Worker is 307 lines, and even its first version (`2f2e9b1`, January 2026, `apps/email-worker/src/index.ts`) was 276.                                                                          | —                                                        | `git show` line counts                                                                                                   |
| 2                    | **Not changed, by owner's decision.** `surgegate.dev` goes live later. The link and the JSON-LD `url` stay. Its `@type` was fixed under #7.                                                                                                                                                                                                               | —                                                        | —                                                                                                                        |
| 3                    | **Fixed.** Both llms templates range over `partial "agent-listable.html" site.Home.RegularPages`. The hand-kept path list and the rule to extend it are gone. `/early-projects/` is now listed. The llms.txt heading is "Pages". The test takes every top-level sitemap path that isn't one of the three section listings, and requires it in both files. | `d369029` (#134). The #135 conflict was resolved onto it | The test fails on `/early-projects/` with the old list restored, and passes with the new one                             |
| 4                    | **Fixed.** `share-image.html` returns `own: true` only for a page's own image. `seo.html` sets the Article `image` only in that case. `og:image` and `twitter:image` keep the site-wide card.                                                                                                                                                             | `9a0911c` (#133)                                         | The rewritten test asserts no Article `image` on a post without its own image, and that `og:image` is still the card     |
| 5                    | **Fixed.** `bun run brand` also renders `favicon-192.png`, linked as `rel=icon sizes=192x192`. The other outputs re-rendered byte-identical.                                                                                                                                                                                                              | `be7692c` (#133)                                         | The favicons test checks the 192 px link and the PNG's real IHDR size                                                    |
| 6                    | **Fixed.** `project-graph.html` fails the build for a first-layer entry whose `runsOn` is not a second-layer id. The diagram test compares the box count with the `article.project-diff` count instead of 7.                                                                                                                                              | `6c2b553` (#135)                                         | With Utilify pointed at `devcontainers`, Hugo exits 1: `projects: "utilify" must run on one of [surgegate hugo-workers]` |
| 7                    | **Fixed.** SurgeGate is a `SoftwareApplication`. The test requires every `SoftwareSourceCode` item to have a GitHub `codeRepository`. The #135 description now says that the JSON-LD reads `layers:` directly.                                                                                                                                            | `8515c7f` (#135)                                         | Built page: 1 SoftwareApplication, 2 SoftwareSourceCode (both on GitHub)                                                 |
| 8                    | **Fixed.** `render.ts` awaits `document.fonts.load('800 108px "JetBrains Mono"')` and throws when it loads nothing.                                                                                                                                                                                                                                       | `3c5ce13` (#133)                                         | With the woff2 renamed, the run fails (`evaluate: NetworkError`) and writes nothing                                      |
| 9                    | **Fixed.** The `system` radio carries `checked` in the markup. The script still overwrites it with the stored choice.                                                                                                                                                                                                                                     | `61d2ce0` (#136)                                         | The test reads the raw HTML: exactly one `checked`, on `system`                                                          |
| Nit: status class    | **Fixed.** An explicit `state: soon`, with live as the default, replaces the guess from the label prefix. The dead `done` rule is removed.                                                                                                                                                                                                                | `a4d882a` (#135)                                         | Built page unchanged: 5 live, 2 soon                                                                                     |
| Nit: `sr-only`       | **Fixed.** `.theme-toggle-input` uses Tailwind's `sr-only`. The hand-written rule is removed.                                                                                                                                                                                                                                                             | `61d2ce0` (#136)                                         | Theme switcher tests: label click, reload, arrow keys                                                                    |
| Nit: `fileURLToPath` | **Fixed.** Output paths go through `fileURLToPath`.                                                                                                                                                                                                                                                                                                       | `3c5ce13` (#133)                                         | `bun run brand` output is unchanged                                                                                      |
| Nit: key names       | **Fixed.** The keys are now `images:` and `params.images` (Hugo's own; first entry used), with `imageAlt` / `params.imageAlt`.                                                                                                                                                                                                                            | `9a0911c` (#133)                                         | Link-preview tests on every indexable page                                                                               |
