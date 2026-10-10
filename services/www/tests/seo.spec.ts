import { expect, test } from "@playwright/test";

/**
 * Search-engine indexability tests.
 *
 * Locks in the rules that are easy to undo by accident: thin taxonomy listings
 * and the 404 page stay out of the index, the sitemap advertises only
 * indexable URLs, and no unlinked canonical-stub URLs get emitted.
 *
 * Scope: these cover what Hugo *builds*. Worker- and edge-level rules (a real
 * 404 status on /404, X-Robots-Tag headers, http -> https) cannot be exercised
 * here — the suite runs against `hugo server`. Those are checked post-deploy by
 * the verify jobs in .github/workflows/release.yml and deploy-staging.yml.
 */

// Structural pages only. Individual posts come and go, and the sitemap sweep
// below already asserts robots + canonical on every URL the site publishes.
const INDEXABLE_PAGES = ["/", "/posts/", "/ever-learning/", "/about/", "/contact/"];

// Taxonomy listings: near-duplicates of /posts/ while the post count is small.
// Term pages exist only as long as a post carries the term.
const NOINDEX_PAGES = ["/tags/", "/categories/"];

function sitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

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
    }
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
  });

  test("/about/ is a ProfilePage about that same Person", async ({ page }) => {
    const [profile] = await jsonLd(page, "/about/");
    expect(profile["@type"]).toBe("ProfilePage");
    expect(profile.mainEntity.name).toBe("Serge Gatezh");
    expect(profile.mainEntity["@id"]).toMatch(PERSON_ID);
  });

  test("footer profile links declare rel=me", async ({ page }) => {
    await page.goto("/");
    for (const host of ["github.com", "linkedin.com"]) {
      await expect(page.locator(`footer a[href*="${host}"]`)).toHaveAttribute("rel", /\bme\b/);
    }
  });
});
