import { expect, test } from "@playwright/test";

import { sitemapPaths } from "./sitemap";

/**
 * Search-engine indexability tests.
 *
 * Locks in the rules that are easy to undo by accident: thin taxonomy listings
 * and the 404 page stay out of the index, the sitemap advertises only
 * indexable URLs, and no unlinked canonical-stub URLs get emitted.
 *
 * Scope: these cover what Hugo *builds*. Edge-level rules (404 statuses,
 * X-Robots-Tag headers, http -> https) cannot be exercised here — the suite
 * runs against `hugo server`. The first two are in assets.spec.ts, against
 * `wrangler dev`; all are checked post-deploy by the verify jobs in
 * .github/workflows/release.yml and deploy-staging.yml.
 */

// Structural pages only. Individual posts come and go, and the sitemap sweep
// below already asserts robots + canonical on every URL the site publishes.
const INDEXABLE_PAGES = ["/", "/posts/", "/ever-learning/", "/about/", "/talks/", "/contact/"];

// Taxonomy listings: near-duplicates of /posts/ while the post count is small.
// Term pages exist only as long as a post carries the term.
const NOINDEX_PAGES = ["/tags/", "/categories/"];

test.describe("robots meta", () => {
  for (const path of INDEXABLE_PAGES) {
    test(`${path} is indexable`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    });
  }

  for (const path of NOINDEX_PAGES) {
    test(`${path} is noindex`, async ({ page }) => {
      await page.goto(path);
      // `follow` is deliberate: taxonomy pages still pass equity to the posts.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, follow",
      );
    });
  }

  test("404 page is noindex", async ({ page }) => {
    await page.goto("/404.html");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  });
});

test.describe("canonical URLs", () => {
  for (const path of INDEXABLE_PAGES) {
    test(`${path} canonical points at itself`, async ({ page }) => {
      await page.goto(path);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).not.toBeNull();
      expect(new URL(canonical as string).pathname).toBe(path);
    });
  }
});

test.describe("sitemap", () => {
  test("lists the indexable pages", async ({ request }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    for (const path of INDEXABLE_PAGES) {
      expect(paths).toContain(path);
    }
  });

  test("excludes taxonomy and term listings", async ({ request }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    expect(paths.filter((p) => p.startsWith("/tags") || p.startsWith("/categories"))).toEqual([]);
  });

  test("every listed URL is reachable and indexable", async ({ page, request }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    expect(paths.length).toBeGreaterThan(0);

    for (const path of paths) {
      expect((await request.get(path)).status(), `${path} should be 200`).toBe(200);

      // A sitemap is a request to index — nothing in it may say otherwise.
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      // Not `toContain("index")` — "noindex" contains "index", so that can
      // never fail. Match the directive as a whole word instead.
      expect(robots, `${path} is in the sitemap but not indexable`).toMatch(/(^|[\s,])index\b/);
      expect(robots, `${path} is in the sitemap but noindex`).not.toContain("noindex");

      // A sitemap URL that canonicalises elsewhere is a contradiction, and is
      // what Search Console files as "Alternate page with proper canonical tag".
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical, `${path} has no canonical`).not.toBeNull();
      expect(new URL(canonical as string).pathname, `${path} canonicalises elsewhere`).toBe(path);

      // Every JSON-LD block must parse, and the site-level entities belong to
      // the home page alone: a Person or WebSite on every page tells search
      // engines each page is about the site owner rather than its own topic.
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      const types = blocks.map((b) => JSON.parse(b)["@type"]);
      if (path !== "/") {
        expect(types, `${path} repeats the home page's entities`).not.toContain("Person");
        expect(types, `${path} repeats the home page's entities`).not.toContain("WebSite");
      }
    }
  });
});

test.describe("titles and descriptions", () => {
  // Search results truncate longer titles and descriptions mid-word.

  // Titles: the structural pages only. A post's title is its headline: the
  // <h1>, the Article's `headline` and the words people search for. Cutting it
  // to fit a results page would trade the post's own wording for a snippet
  // length, so posts are exempt.
  for (const path of INDEXABLE_PAGES) {
    test(`${path} title fits a results page`, async ({ page }) => {
      await page.goto(path);
      expect(
        (await page.title()).length,
        `${path} title is over 60 characters`,
      ).toBeLessThanOrEqual(60);
    });
  }

  // Descriptions: every page the sitemap lists, under 160 characters
  // (.claude/rules/seo.md). Posts are included: they write their own, so they
  // are where the limit gets broken.
  test("every listed page has a meta description under 160 characters", async ({
    page,
    request,
  }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    expect(paths.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      if (!description) {
        offenders.push(`${path} has no meta description`);
      } else if (description.length >= 160) {
        offenders.push(`${path} description is ${description.length} characters`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("the home page title names the role, not just the person", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/^Serge Gatezh · Product Engineer/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Product Engineer/,
    );
  });
});

/** Width and height from a PNG's IHDR chunk, which always starts at byte 16. */
function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(1, 4).toString("latin1"), "not a PNG").toBe("PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test.describe("link previews", () => {
  // Every platform that unfurls links (LinkedIn, Slack, X, iMessage) reads these.
  for (const path of INDEXABLE_PAGES) {
    test(`${path} has a large share image with dimensions and alt text`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const og = (property: string) =>
        page.locator(`meta[property="og:${property}"]`).getAttribute("content");

      const image = await og("image");
      // Open Graph requires an absolute URL; a relative one shows no preview.
      expect(image).toMatch(/^https?:\/\/[^/]+\/brand\/share\.[a-f0-9]+\.png$/);
      expect(await og("image:width")).toBe("1200");
      expect(await og("image:height")).toBe("630");
      expect(await og("image:alt")).toMatch(/^Serge Gatezh, Product Engineer/);

      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        "content",
        "summary_large_image",
      );
      await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
        "content",
        image as string,
      );

      // The declared size is the file's real size.
      const res = await request.get(new URL(image as string).pathname);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
      expect(pngSize(await res.body())).toEqual({ width: 1200, height: 630 });
    });
  }

  test("a post's Article image is the share image", async ({ page }) => {
    await page.goto("/posts/docker-desktop-disk-full-macos/");
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = blocks.map((b) => JSON.parse(b)).find((b) => b["@type"] === "Article");
    expect(article.image).toEqual({ "@type": "ImageObject", url: og, width: 1200, height: 630 });
  });
});

test.describe("favicons", () => {
  test("the head links an SVG, a 32 px PNG and a 180 px touch icon", async ({ page, request }) => {
    await page.goto("/");
    const href = (selector: string) => page.locator(selector).getAttribute("href");

    const svg = await href('link[rel="icon"][type="image/svg+xml"]');
    expect(svg).toMatch(/^\/brand\/favicon\.[a-f0-9]+\.svg$/);
    const svgRes = await request.get(svg as string);
    expect(svgRes.status()).toBe(200);
    expect(svgRes.headers()["content-type"]).toContain("image/svg+xml");

    for (const [selector, size] of [
      ['link[rel="icon"][type="image/png"][sizes="32x32"]', 32],
      ['link[rel="apple-touch-icon"][sizes="180x180"]', 180],
    ] as const) {
      const png = await href(selector);
      expect(png, selector).toMatch(/^\/brand\/[a-z0-9-]+\.[a-f0-9]+\.png$/);
      const res = await request.get(png as string);
      expect(res.status(), selector).toBe(200);
      expect(pngSize(await res.body())).toEqual({ width: size, height: size });
    }
  });

  test("/favicon.ico exists and is a real ICO", async ({ request }) => {
    const res = await request.get("/favicon.ico");
    expect(res.status()).toBe(200);
    // ICONDIR header: reserved 0, type 1 (icon), then the image count.
    const body = await res.body();
    expect(body.readUInt16LE(0)).toBe(0);
    expect(body.readUInt16LE(2)).toBe(1);
    expect(body.readUInt16LE(4)).toBeGreaterThan(0);
  });
});

test.describe("crawlable URL hygiene", () => {
  // Hugo emits /page/1/ meta-refresh stubs for paginated lists unless
  // pagination.disableAliases is set. Nothing links them; they exist only to be
  // crawled and filed as "Alternate page with proper canonical tag".
  for (const path of ["/posts/page/1/", "/tags/page/1/", "/ever-learning/page/1/"]) {
    test(`${path} pagination alias is not emitted`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }

  test("internal page links all carry a trailing slash", async ({ page, request }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    const offenders: string[] = [];

    for (const path of paths) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));

      for (const href of hrefs) {
        // Same-origin page links only. `.Permalink` emits absolute URLs, so
        // matching on a leading "/" alone would skip every post link — which
        // is most of them. Resolve against the page instead and compare origin.
        let target: string;
        try {
          const url = new URL(href, page.url());
          if (url.origin !== new URL(page.url()).origin) continue;
          target = url.pathname;
        } catch {
          continue; // mailto:, tel:, and other non-navigational schemes
        }

        if (target === "" || target.endsWith("/")) continue;
        // Files, not pages: a last segment containing a dot, e.g. /llms.txt.
        if (target.split("/").pop()?.includes(".")) continue;
        offenders.push(`${path} -> ${href}`);
      }
    }

    // A no-slash page link costs every crawler a 307 hop before the real page.
    expect(offenders).toEqual([]);
  });
});

test.describe("internal linking", () => {
  /**
   * The "ls --related" block in page.html calls .Site.RegularPages.Related.
   * That call sat in the template rendering on ZERO posts, because Hugo's
   * default related config indexes `keywords` and no post had any — a silent
   * no-op, since a template that outputs nothing still builds green.
   *
   * Two posts are expected to have no related content and are named here
   * rather than papered over: GraphQL schema naming and Anki study habits
   * share a topic with nothing else on the site. Inventing links between
   * unrelated posts is the thin-content signal this work is trying to avoid.
   */
  const NO_RELATED_CONTENT = [
    "/posts/graphql-schema-use-it-in-a-sentence/",
    "/posts/using-anki-to-study-programming/",
  ];

  test("posts link out to related posts", async ({ page, request }) => {
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text())
      .filter((p) => p.startsWith("/posts/") && p !== "/posts/")
      .filter((p) => !NO_RELATED_CONTENT.includes(p));

    // Guards against the sweep quietly emptying out, the way the sitemap-derived
    // sweeps did when four posts stopped being recognised as content.
    expect(paths.length, "expected the site's posts to be in the sitemap").toBeGreaterThan(5);

    const bare: string[] = [];

    for (const path of paths) {
      await page.goto(path);
      const links = page.locator("nav a.post-list-link");
      if ((await links.count()) === 0) bare.push(path);
    }

    expect(bare, "posts with no related-post links are crawl leaves").toEqual([]);
  });

  test("every post still offers prev/next navigation", async ({ page }) => {
    // The fallback for the two posts above: they must not be dead ends.
    for (const path of NO_RELATED_CONTENT) {
      await page.goto(path);
      const nav = page.locator('nav[aria-label="Post navigation"] a');
      expect(await nav.count(), `${path} has no sibling navigation`).toBeGreaterThan(0);
    }
  });
});

test.describe("identity structured data", () => {
  // Other sites (uxcringe.com) reference this exact @id as their Article author.
  const PERSON_ID = /^https?:\/\/[^/]+\/#person$/;

  async function jsonLd(page: import("@playwright/test").Page, path: string) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    return blocks.map((b) => JSON.parse(b));
  }

  test("the home page Person carries the shared @id", async ({ page }) => {
    const person = (await jsonLd(page, "/")).find((b) => b["@type"] === "Person");
    expect(person["@id"]).toMatch(PERSON_ID);
    expect(person.image).toMatch(/^https?:\/\//);
    expect(person.jobTitle).toBe("Product Engineer");
    expect(person.description).toMatch(/^Serge Gatezh is a product engineer/);
    // The same spelling as the canonical link: the home URL with its slash.
    expect(person.url).toMatch(/^https?:\/\/[^/]+\/$/);
  });

  test("a post is an Article about its own page, under a breadcrumb trail", async ({ page }) => {
    const path = "/posts/docker-desktop-disk-full-macos/";
    const blocks = await jsonLd(page, path);

    const article = blocks.find((b) => b["@type"] === "Article");
    expect(new URL(article.mainEntityOfPage).pathname).toBe(path);

    const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
    const items = crumbs.itemListElement;
    expect(items.map((i: { position: number }) => i.position)).toEqual([1, 2, 3]);
    expect(new URL(items[0].item).pathname).toBe("/");
    expect(new URL(items[1].item).pathname).toBe("/posts/");
    expect(new URL(items[2].item).pathname).toBe(path);
  });

  test("a post's keywords reach its Article and its article:tag metas", async ({ page }) => {
    // Both read `keywords` front matter through .Keywords. They used to read the
    // `tags` taxonomy, which no post uses, so both rendered nothing and the
    // build stayed green.
    const article = (await jsonLd(page, "/posts/docker-desktop-disk-full-macos/")).find(
      (b) => b["@type"] === "Article",
    );
    expect(article.keywords).toEqual(expect.arrayContaining(["docker"]));
    await expect(page.locator('meta[property="article:tag"]').first()).toHaveAttribute(
      "content",
      "docker",
    );
  });

  test("/about/ is a ProfilePage about that same Person", async ({ page }) => {
    const [profile] = await jsonLd(page, "/about/");
    expect(profile["@type"]).toBe("ProfilePage");
    expect(profile.mainEntity.name).toBe("Serge Gatezh");
    expect(profile.mainEntity["@id"]).toMatch(PERSON_ID);
    // Recommended by Google for ProfilePage; ISO 8601 with an offset. A UTC
    // date prints as `Z` (Go's Z07:00), as in CI, where the shallow checkout
    // makes every page's Lastmod GitHub's test-merge commit, often in UTC.
    expect(profile.dateModified).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/,
    );
  });

  test("/talks/ is a CollectionPage of Events Serge performed", async ({ page }) => {
    const blocks = await jsonLd(page, "/talks/");
    const collection = blocks.find((b) => b["@type"] === "CollectionPage");
    expect(new URL(collection.url).pathname).toBe("/talks/");
    expect(collection.author["@id"]).toMatch(PERSON_ID);

    const events = collection.mainEntity.itemListElement.map((i: { item: unknown }) => i.item);
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.performer["@id"], event.name).toMatch(PERSON_ID);
      // ISO 8601 with the venue's own offset, not a bare date.
      expect(event.startDate, event.name).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      );
      expect(event.location.address.addressLocality, event.name).toBe("Calgary");
      expect(event.organizer.name, event.name).toBe("Frontend & Beyond");
      expect(event.workPerformed["@type"], event.name).toBe("PresentationDigitalDocument");
      expect(event.workPerformed.url, event.name).toMatch(/^https:\/\/.+\.pdf$/);
      // Each Event @id is an anchor that exists on the page.
      const anchor = new URL(event["@id"]).hash;
      await expect(page.locator(anchor), event.name).toHaveCount(1);
    }
    expect(events.map((e: { name: string }) => e.name)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Zero Servers, Zero Dollars/),
        "Dev Containers with Claude: Security First",
      ]),
    );
  });

  test("footer profile links declare rel=me", async ({ page }) => {
    await page.goto("/");
    for (const host of ["github.com", "linkedin.com"]) {
      await expect(page.locator(`footer a[href*="${host}"]`)).toHaveAttribute("rel", /\bme\b/);
    }
  });
});

test.describe("robots.txt", () => {
  test("welcomes every crawler and grants every content signal", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^User-agent: \*$/m);
    expect(body).toMatch(/^Allow: \/$/m);
    // A Disallow anywhere would take something back from some crawler.
    expect(body).not.toMatch(/^Disallow:/im);
    expect(body).toMatch(/^Content-Signal: search=yes, ai-input=yes, ai-train=yes$/m);
    expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });
});

test.describe("RSS", () => {
  test("the home feed lists articles, not site pages", async ({ request }) => {
    const xml = await (await request.get("/index.xml")).text();
    const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map(
      (m) => new URL(m[1]).pathname,
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link, `${link} is not an article`).toMatch(/^\/(posts|ever-learning)\//);
    }
  });
});
