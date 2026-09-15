import { test, expect } from "@playwright/test";

/**
 * Blog functional and accessibility tests.
 * Verifies blog structure works regardless of content.
 *
 * Run with: bun run test
 */

test.describe("Posts list page", () => {
  test("renders with correct structure", async ({ page }) => {
    await page.goto("/posts/");
    await page.waitForLoadState("load");

    // Should have an h1
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("Posts");

    // Should show item count
    const total = page.locator("text=/total \\d+ item/");
    await expect(total).toBeVisible();
  });

  test("displays post cards", async ({ page }) => {
    await page.goto("/posts/");
    await page.waitForLoadState("load");

    // Should have at least one post link
    const posts = page.locator(".post-list .post-list-item a");
    await expect(posts.first()).toBeVisible();

    // Each card should have a title
    const firstTitle = posts.first().locator(".post-list-title");
    await expect(firstTitle).toBeVisible();
    await expect(firstTitle).not.toBeEmpty();

    // Each card should have a date (desktop and mobile responsive variants)
    const dates = posts.first().locator("time");
    expect(await dates.count()).toBeGreaterThan(0);
    expect(await dates.first().getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("post cards link to articles", async ({ page }) => {
    await page.goto("/posts/");
    await page.waitForLoadState("load");

    const firstLink = page.locator(".post-list .post-list-item a").first();
    const href = await firstLink.getAttribute("href");
    expect(href).toContain("/posts/");

    // Click and verify navigation
    await firstLink.click();
    await page.waitForLoadState("load");
    expect(page.url()).toContain("/posts/");
    // Should land on a single post page with an article element
    await expect(page.locator("article")).toBeVisible();
  });
});

test.describe("Single post", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the first available post
    await page.goto("/posts/");
    await page.waitForLoadState("load");
    await page.locator(".post-list .post-list-item a").first().click();
    await page.waitForLoadState("load");
  });

  test("renders article with required elements", async ({ page }) => {
    // Title
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    // Date
    const date = page.locator(".article-meta time");
    await expect(date).toBeVisible();

    // Reading time
    await expect(page.locator(".article-reading-time")).toBeVisible();
  });

  test("article content renders", async ({ page }) => {
    const content = page.locator(".article-content");
    await expect(content).toBeVisible();

    // Should have paragraph content
    const paragraphs = content.locator("p");
    expect(await paragraphs.count()).toBeGreaterThan(0);
  });
});

test.describe("Homepage", () => {
  test("renders with correct structure", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    // Should have an h1
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText("Serge Gatezh.");

    // Should have recent posts section
    const recentPosts = page.locator(".post-list .post-list-item");
    expect(await recentPosts.count()).toBeGreaterThan(0);
  });

  test("recent posts link to articles", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const firstPost = page.locator(".post-list .post-list-item a").first();
    await expect(firstPost).toBeVisible();

    const href = await firstPost.getAttribute("href");
    expect(href).toContain("/posts/");
  });

  test("promotes the About page instead of duplicating posts navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const aboutCta = page.getByTestId("homepage-about-cta");
    await expect(aboutCta).toBeVisible();
    await expect(aboutCta).toHaveAttribute("href", "/about/");
    await expect(aboutCta).toContainText("more about me");
    await expect(page.getByRole("link", { name: /go to posts/i })).toHaveCount(0);

    const portrait = page.getByTestId("homepage-portrait");
    await expect(portrait).toBeVisible();
    await expect
      .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("uses the same portrait scale as the About page", async ({ page }) => {
    await page.goto("/");
    const homepagePortrait = page.getByTestId("homepage-portrait");
    await expect(homepagePortrait).toBeVisible();
    const homepageWidth = await homepagePortrait.evaluate(
      (image) => image.getBoundingClientRect().width,
    );

    await page.goto("/about/");
    const aboutPortrait = page.getByTestId("about-portrait");
    await expect(aboutPortrait).toBeVisible();
    const aboutWidth = await aboutPortrait.evaluate((image) => image.getBoundingClientRect().width);

    expect(homepageWidth).toBe(aboutWidth);
  });
});

test.describe("About page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/about/");
    await page.waitForLoadState("load");
  });

  test("is available from the main navigation", async ({ page }) => {
    const aboutLinks = page.locator('header nav a[href="/about/"]');

    await expect(aboutLinks).toHaveCount(2);
    await expect(aboutLinks.first()).toContainText("About");
  });

  test("renders the biography and portrait", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Serge Gatezh." })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Security is part of the product" }),
    ).toBeVisible();
    await expect(page.getByLabel("Core specialization")).toContainText(
      "I specialize in optimizing user workflows to reduce cognitive load.",
    );

    const portrait = page.getByTestId("about-portrait");
    await expect(portrait).toBeVisible();
    await expect(portrait).toHaveAttribute("alt", "Portrait of Serge Gatezh");
    await expect
      .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("keeps punctuation attached to Markdown links", async ({ page }) => {
    for (const linkName of ["LinkedIn", "send me a message"]) {
      const link = page.getByRole("link", { name: linkName, exact: true });
      await expect(link).toBeVisible();
      await expect
        .poll(() => link.evaluate((element) => element.nextSibling?.textContent))
        .toBe(".");
    }
  });
});

test.describe("Accessibility", () => {
  test("homepage has proper heading structure", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    // Exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("posts list has proper heading structure", async ({ page }) => {
    await page.goto("/posts/");
    await page.waitForLoadState("load");

    // Exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("links are accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const links = page.locator("main a");
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");
      const hasContent = (text && text.trim()) || ariaLabel;
      expect(hasContent).toBeTruthy();
    }
  });
});
