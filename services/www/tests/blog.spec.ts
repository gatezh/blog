import { test, expect } from "@playwright/test";

import { sitemapPaths } from "./sitemap";

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

test.describe("Code blocks", () => {
  // Fences with a language are highlighted; fences without one render as a
  // plain <pre><code> with no .highlight wrapper. Both get the same chrome.
  const KINDS = [
    {
      name: "highlighted",
      marker: 'class="highlight"',
      selector: ".article-content .highlight > pre",
    },
    {
      name: "plain",
      marker: '<pre tabindex="0"><code>',
      selector: ".article-content pre:not(.highlight > pre)",
    },
  ];

  for (const { name, marker, selector } of KINDS) {
    test(`${name} blocks sit inside the content column and scroll from the keyboard`, async ({
      page,
      request,
    }) => {
      // Content changes, so find a post with this kind of block via the sitemap.
      const posts = sitemapPaths(await (await request.get("/sitemap.xml")).text()).filter((path) =>
        /^\/posts\/.+/.test(path),
      );
      let found = false;
      for (const path of posts) {
        if ((await (await request.get(path)).text()).includes(marker)) {
          await page.goto(path);
          await page.waitForLoadState("load");
          found = true;
          break;
        }
      }
      expect(found, `no post with a ${name} code block`).toBe(true);

      const blocks = await page.locator(selector).evaluateAll((pres) =>
        pres.map((pre) => {
          const article = pre.closest(".article-content")!.getBoundingClientRect();
          const box = pre.getBoundingClientRect();
          const code = pre.querySelector("code")!;
          const codeBox = code.getBoundingClientRect();
          const codeStyle = getComputedStyle(code);
          const style = getComputedStyle(pre);
          const barBottom =
            box.top +
            parseFloat(style.borderTopWidth) +
            parseFloat(getComputedStyle(pre, "::before").height);
          // The <code>'s content box is exactly its line boxes. Text rects
          // follow glyph metrics instead, which are not centred in the line.
          const textTop = codeBox.top + parseFloat(codeStyle.paddingTop);
          const textBottom = codeBox.bottom - parseFloat(codeStyle.paddingBottom);
          // A Range covers highlighted lines (spans) and plain text alike.
          const range = document.createRange();
          range.selectNodeContents(code);
          const textRight = Math.max(...[...range.getClientRects()].map((r) => r.right));
          return {
            left: box.left - article.left,
            right: article.right - box.right,
            // The <code> spans the frame, or its longest line when wider, and
            // the <pre> scrolls exactly that far, so the end padding shows.
            spans: codeBox.width - pre.clientWidth,
            reach: pre.scrollWidth - codeBox.width,
            endPadding: codeBox.right - textRight - parseFloat(codeStyle.paddingRight),
            // Equal only because headless Chromium hides scrollbars; a classic
            // scrollbar adds its own strip below an overflowing block.
            gapAbove: textTop - barBottom,
            gapBelow: box.bottom - parseFloat(style.borderBottomWidth) - textBottom,
            overflows: pre.scrollWidth > pre.clientWidth,
            scrolls: ["auto", "scroll"].includes(style.overflowX),
          };
        }),
      );
      expect(blocks.length).toBeGreaterThan(0);

      for (const block of blocks) {
        expect(block.left).toBeGreaterThanOrEqual(-0.5);
        expect(block.right).toBeGreaterThanOrEqual(-0.5);
        expect(block.spans).toBeGreaterThanOrEqual(-0.5);
        expect(Math.abs(block.reach)).toBeLessThan(1);
        expect(block.endPadding).toBeGreaterThanOrEqual(-0.5);
        expect(block.gapAbove).toBeGreaterThan(0);
        expect(Math.abs(block.gapAbove - block.gapBelow)).toBeLessThan(1);
        if (block.overflows) expect(block.scrolls).toBe(true);
      }

      // Long lines scroll inside their block, never the page.
      const pageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(pageOverflow).toBe(0);

      // Hugo makes each <pre> focusable so the keyboard can scroll it, which
      // works only while the <pre> is the scroller.
      const index = blocks.findIndex((block) => block.overflows);
      if (index >= 0) {
        const pre = page.locator(selector).nth(index);
        await pre.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => pre.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      }
    });
  }
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

test.describe("Theme switcher", () => {
  test("lives in the footer, defaulting to the system theme", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header input[name=theme]")).toHaveCount(0);
    const group = page.locator("footer").getByRole("group", { name: "theme" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group.getByRole("radio", { name: "system" })).toBeChecked();
  });

  test("applies a choice and keeps it across page loads", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    const html = page.locator("html");

    // The inputs are visually hidden; their labels take the click.
    await footer.getByText("dark", { exact: true }).click();
    await expect(html).toHaveClass(/\bdark\b/);

    await footer.getByText("light", { exact: true }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(footer.getByRole("radio", { name: "light" })).toBeChecked();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("arrow keys move the selection, as in any radio group", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.getByRole("radio", { name: "system" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(footer.getByRole("radio", { name: "dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
});
