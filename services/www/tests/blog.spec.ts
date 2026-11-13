import { test, expect, type Page } from "@playwright/test";

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
    const date = page.locator(".article-meta time[itemprop=datePublished]");
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

  test("terminal chrome names the post, not its bundle's index.md", async ({ request }) => {
    // Post URLs are /posts/:contentbasename/, so the slug is the content base
    // name whether the post is a single file or a page bundle.
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text()).filter((p) =>
      /^\/posts\/[^/]+\/$/.test(p),
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const slug = path.split("/")[2];
      const html = await (await request.get(path)).text();
      expect(html, path).toContain(`cat ${slug}.md`);
    }
  });
});

test.describe("Mobile menu", () => {
  test("the menu button opens and closes the navigation", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the menu button exists below md only");
    await page.goto("/");

    const button = page.locator("#mobile-menu-btn");
    const menu = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: /Posts/ })).toBeVisible();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeHidden();
  });
});

test.describe("Contact form", () => {
  // hugo server builds with no Turnstile site key, so no widget is rendered and
  // the form submits straight to params.apiUrl, stubbed here.
  async function fillAndSend(page: Page, response: { status: number; body: object }) {
    await page.route("http://localhost:8787/**", (route) =>
      route.fulfill({ status: response.status, json: response.body }),
    );
    await page.goto("/contact/");
    await page.locator("#contact-name").fill("Ada");
    await page.locator("#contact-email").fill("ada@example.com");
    await page.locator("#contact-message").fill("Hello");
    await page.locator("#contact-submit").click();
  }

  test("a sent message replaces the form with the confirmation", async ({ page }) => {
    const success = page.locator("#contact-success");
    await page.goto("/contact/");
    await expect(success).toBeHidden();
    await expect(page.locator("#contact-error")).toBeHidden();

    await fillAndSend(page, { status: 200, body: { success: true } });
    await expect(success).toBeVisible();
    await expect(page.locator("#contact-form")).toBeHidden();
  });

  test("a rejected message shows the error and re-enables the button", async ({ page }) => {
    await fillAndSend(page, { status: 400, body: { error: "Invalid email address" } });
    await expect(page.locator("#contact-error")).toBeVisible();
    await expect(page.locator("#contact-error-text")).toHaveText("Invalid email address");
    await expect(page.locator("#contact-submit")).toBeEnabled();
    await expect(page.locator("#submit-spinner")).toBeHidden();
    await expect(page.locator("#submit-icon")).toBeVisible();
    await expect(page.locator("#contact-success")).toBeHidden();
  });
});

test.describe("Comments", () => {
  // Comments start over two viewports down; the embed loads one ahead.
  const LONG_POST = "/posts/docker-desktop-disk-full-macos/";

  // Stub embed: records changeTheme calls in window.__remarkThemes and fires
  // REMARK42::ready, like the real one.
  async function stubComments(page: Page): Promise<string[]> {
    const requested: string[] = [];
    await page.route("https://comments.gatezh.com/**", (route) => {
      requested.push(new URL(route.request().url()).pathname);
      return route.fulfill({
        contentType: "text/javascript",
        body: `window.REMARK42 = { changeTheme: (t) => (window.__remarkThemes ||= []).push(t) };
window.dispatchEvent(new Event("REMARK42::ready"));`,
      });
    });
    return requested;
  }

  const lastTheme = (page: Page) =>
    page.evaluate(() => ((window as any).__remarkThemes ?? []).at(-1) as string | undefined);

  const EMBED = 'script[src="https://comments.gatezh.com/web/embed.mjs"]';

  // Two frames: any pending IntersectionObserver callback has run.
  const afterFrames = (page: Page) =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );

  // Comments still out of the observer's reach.
  async function afterObserverRan(page: Page): Promise<void> {
    await afterFrames(page);
    const offset = await page.evaluate(
      () => document.getElementById("remark42")!.getBoundingClientRect().top / innerHeight,
    );
    expect(offset, "comments must start over two viewports down").toBeGreaterThan(2);
  }

  test("loads the Remark42 embed as an ES module only near the comments", async ({ page }) => {
    const requested = await stubComments(page);
    await page.goto(LONG_POST);
    await afterObserverRan(page);

    await expect(page.locator(EMBED)).toHaveCount(0);
    expect(requested).not.toContain("/web/embed.mjs");
    expect(await page.evaluate(() => (window as any).remark_config?.host)).toBe(
      "https://comments.gatezh.com",
    );

    await page.locator("#remark42").scrollIntoViewIfNeeded();
    await expect(page.locator(EMBED)).toHaveAttribute("type", "module");
    await expect.poll(() => requested).toContain("/web/embed.mjs");
  });

  test("a comment permalink loads the embed without scrolling", async ({ page }) => {
    const requested = await stubComments(page);
    await page.goto(`${LONG_POST}#remark42__comment-test`);
    await expect.poll(() => requested).toContain("/web/embed.mjs");
  });

  test("a permalink reached by a hash change loads the embed once", async ({ page }) => {
    const requested = await stubComments(page);
    await page.goto(LONG_POST);
    await afterObserverRan(page);
    await expect(page.locator(EMBED)).toHaveCount(0);

    // No reload, nothing to scroll to.
    await page.evaluate(() => (location.hash = "#remark42__comment-test"));
    await expect.poll(() => requested).toContain("/web/embed.mjs");

    // Scrolling must not load it again.
    await page.locator("#remark42").scrollIntoViewIfNeeded();
    await afterFrames(page);
    await expect(page.locator(EMBED)).toHaveCount(1);
  });

  test("Remark42 follows the page theme", async ({ page }) => {
    await stubComments(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(LONG_POST);
    await page.locator("#remark42").scrollIntoViewIfNeeded();

    await expect.poll(() => lastTheme(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => lastTheme(page)).toBe("dark");

    // An explicit choice beats the OS; "system" defers to it again.
    await page.locator(".theme-toggle-option", { hasText: "light" }).click();
    await expect.poll(() => lastTheme(page)).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.locator(".theme-toggle-option", { hasText: "system" }).click();
    await expect.poll(() => lastTheme(page)).toBe("dark");
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

  test("shares one fingerprinted portrait file with the About page", async ({ page }) => {
    // The same srcset on both pages means About is drawn from the browser
    // cache the home page already filled, instead of a second download.
    const attributes = async (testId: string) => {
      const portrait = page.getByTestId(testId);
      return {
        src: await portrait.getAttribute("src"),
        srcset: await portrait.getAttribute("srcset"),
      };
    };
    await page.goto("/");
    const home = await attributes("homepage-portrait");
    await page.goto("/about/");
    expect(await attributes("about-portrait")).toEqual(home);

    // Built by Hugo at 1x, 2x and 3x of the 17rem slot, each a hashed file.
    const candidates = (home.srcset ?? "").split(",").map((candidate) => candidate.trim());
    expect(candidates).toHaveLength(3);
    for (const [index, candidate] of candidates.entries()) {
      expect(candidate).toMatch(
        new RegExp(`^/brand/portrait-\\d+\\.[a-f0-9]{64}\\.webp ${index + 1}x$`),
      );
    }
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
      "Every decision the software can make is one the user doesn't have to.",
    );

    const portrait = page.getByTestId("about-portrait");
    await expect(portrait).toBeVisible();
    await expect(portrait).toHaveAttribute("alt", "Portrait of Serge Gatezh");
    await expect
      .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("keeps punctuation attached to Markdown links", async ({ page }) => {
    for (const linkName of ["learning log", "Just Right Systems"]) {
      const link = page.locator("#main-content").getByRole("link", { name: linkName, exact: true });
      await expect(link).toBeVisible();
      await expect
        .poll(() => link.evaluate((element) => element.nextSibling?.textContent))
        .toMatch(/^\./);
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

  test("image alt text is escaped once, not twice", async ({ request }) => {
    // html/template already escapes attribute values. Escaping again in the
    // template turns an apostrophe into a literal "&#39;" that screen readers
    // read out.
    const paths = sitemapPaths(await (await request.get("/sitemap.xml")).text());
    for (const path of paths) {
      const html = await (await request.get(path)).text();
      expect(html, `${path} has double-escaped alt text`).not.toMatch(
        /alt="[^"]*&amp;(#\d+|[a-z]+);/,
      );
    }
  });
});

test.describe("Footer", () => {
  test("links Just Right Systems as a business, not as a profile", async ({ page }) => {
    await page.goto("/");
    const link = page
      .locator("footer")
      .getByRole("navigation", { name: "Site map" })
      .getByRole("link", { name: "Just Right Systems" });
    await expect(link).toHaveAttribute("href", "https://justright.systems/");
    await expect(link).not.toHaveAttribute("rel", /\bme\b/);
  });

  test("maps the site: every page the header leaves out, each link resolving", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const map = page.locator("footer").getByRole("navigation", { name: "Site map" });
    const hrefs = await map
      .locator("a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    for (const href of [
      "/ever-learning/",
      "/upstream/",
      "/early-projects/",
      "/llms.txt",
      "/index.xml",
    ]) {
      expect(hrefs, href).toContain(href);
      expect((await request.get(href)).status(), href).toBe(200);
    }
    // The Talks column lists the talks themselves; every anchor is a section on the page.
    const talks = hrefs.filter((h): h is string => !!h && h.startsWith("/talks/#"));
    expect(talks.length).toBeGreaterThan(0);
    const talksHtml = await (await request.get("/talks/")).text();
    for (const href of talks) {
      expect(talksHtml, href).toContain(`id="${href.slice("/talks/#".length)}"`);
    }
    await expect(page.locator("header nav").locator('a[href="/upstream/"]')).toHaveCount(0);
    await expect(
      page.locator("footer").getByRole("link", { name: "Send me a message" }),
    ).toHaveAttribute("href", "/contact/");
  });
});

test.describe("Theme switcher", () => {
  test("lives in the footer, defaulting to the system theme", async ({ page, request }) => {
    // The default is in the markup, not only set by the script.
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<input[^>]*value="?system"?[^>]*\bchecked\b/);
    expect(html.match(/<input[^>]*name="?theme"?[^>]*\bchecked\b/g)).toHaveLength(1);

    await page.goto("/");
    await expect(page.locator("header input[name=theme]")).toHaveCount(0);
    const group = page.locator("footer").getByRole("group", { name: "theme" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group.getByRole("radio", { name: "system" })).toBeChecked();
  });

  // color-scheme on <html> picks every colour (light-dark() tokens), so the
  // tests assert it, not class names. The dark projects run these on a dark OS.
  test("applies a choice and keeps it across page loads", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    const html = page.locator("html");
    await expect(html).toHaveCSS("color-scheme", "light dark");

    // The inputs are visually hidden; their labels take the click.
    await footer.getByText("dark", { exact: true }).click();
    await expect(html).toHaveCSS("color-scheme", "dark");

    await footer.getByText("light", { exact: true }).click();
    await expect(html).toHaveCSS("color-scheme", "light");

    await page.reload();
    await expect(footer.getByRole("radio", { name: "light" })).toBeChecked();
    await expect(html).toHaveCSS("color-scheme", "light");

    await footer.getByText("system", { exact: true }).click();
    await expect(html).toHaveCSS("color-scheme", "light dark");
  });

  test("arrow keys move the selection, as in any radio group", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.getByRole("radio", { name: "system" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(footer.getByRole("radio", { name: "dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  });
});
