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
 * the verify job in .github/workflows/deploy.yml.
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
      expect(robots, `${path} is in the sitemap but not indexable`).toContain("index");
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
        // Same-origin page links only: skip anchors, other schemes, and files
        // (a path whose last segment contains a dot, e.g. /llms.txt).
        if (!href.startsWith("/")) continue;
        const target = href.split(/[?#]/)[0];
        if (target === "" || target.endsWith("/")) continue;
        if (target.split("/").pop()?.includes(".")) continue;
        offenders.push(`${path} -> ${href}`);
      }
    }

    // A no-slash page link costs every crawler a 307 hop before the real page.
    expect(offenders).toEqual([]);
  });
});
