import { expect, test } from "@playwright/test";

/**
 * Agent-facing output: the generated llms.txt index, the llms-full.txt corpus,
 * and the per-page Markdown mirrors.
 *
 * Scope: these cover what Hugo *builds*. Content negotiation, the real 404
 * status and the X-Robots-Tag headers are Worker behaviour and live in
 * worker.spec.ts, which runs against `wrangler dev`.
 */

// Posts authored with a `.markdown` extension. Hugo's built-in text/markdown
// media type covers md, markdown and mdown; narrowing it in hugo.yaml drops
// these four silently, with a green build and a correspondingly smaller
// sitemap, so nothing else notices.
const LEGACY_MARKDOWN_POSTS = [
  "/posts/getting-started-with-jekyll/",
  "/posts/host-your-personal-blog-on-github-pages/",
  "/posts/how-to-host-angular-application-on-github-pages/",
  "/posts/using-anki-to-study-programming/",
];

async function text(
  request: { get: (u: string) => Promise<{ text: () => Promise<string> }> },
  url: string,
) {
  return (await request.get(url)).text();
}

test.describe("content coverage", () => {
  for (const path of LEGACY_MARKDOWN_POSTS) {
    test(`${path} is published`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(200);
    });
  }

  test("llms.txt lists every post the sitemap advertises", async ({ request }) => {
    const sitemap = await text(request, "/sitemap.xml");
    const llms = await text(request, "/llms.txt");

    const postUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => new URL(m[1]).pathname)
      .filter((p) => p.startsWith("/posts/") && p !== "/posts/");

    expect(postUrls.length).toBeGreaterThan(0);
    for (const path of postUrls) {
      expect(llms, `${path} is missing from llms.txt`).toContain(path);
    }
  });
});

test.describe("llms.txt structure", () => {
  test("is a Markdown list, not an indented code block", async ({ request }) => {
    const body = await text(request, "/llms.txt");
    // A leading tab or four spaces makes the line an indented code block in
    // CommonMark, so the llmstxt.org link list stops being a link list.
    const indented = body.split("\n").filter((line) => /^(\t| {4})/.test(line));
    expect(indented, "indented lines in llms.txt").toEqual([]);
  });

  test("follows the llmstxt.org shape", async ({ request }) => {
    const lines = (await text(request, "/llms.txt")).split("\n");
    expect(lines[0]).toMatch(/^# \S/); // H1 title
    expect(lines.some((l) => l.startsWith("> "))).toBe(true); // blockquote summary
    expect(lines.some((l) => /^## \S/.test(l))).toBe(true); // H2 sections
    expect(lines.some((l) => /^- \[.+\]\(https?:\/\/\S+\)/.test(l))).toBe(true);
  });
});

test.describe("llms-full.txt structure", () => {
  test("section headings are real headings", async ({ request }) => {
    const body = await text(request, "/llms-full.txt");
    // Body text legitimately contains indented lines (fenced and indented code
    // blocks inside posts), so "no indentation anywhere" is the wrong rule.
    // What must hold is that every line the *template* emits is flush-left —
    // an indented "## Title" is a code block, not a heading.
    const structural = body.split("\n").filter((line) => /^\s+(## |Source: |---\s*$)/.test(line));
    expect(structural, "indented structural lines in llms-full.txt").toEqual([]);

    // And the delimiters must actually be there. Permalinks are http://localhost
    // under `hugo server`, so match the scheme loosely.
    expect(body.split("\n").filter((l) => /^## \S/.test(l)).length).toBeGreaterThan(0);
    expect(body).toMatch(/\nSource: https?:\/\/\S+/);
  });

  test("does not rewrite headings inside fenced code blocks", async ({ request }) => {
    const lines = (await text(request, "/llms-full.txt")).split("\n");
    const offenders: string[] = [];
    let fenced = false;

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        continue;
      }
      // A shell comment inside a fence must keep its original `#`. A rewritten
      // one shows up as `###`/`####` where the source had `#`.
      if (fenced && /^#{2,}\s/.test(line)) offenders.push(line);
    }

    expect(offenders, "headings rewritten inside code fences").toEqual([]);
  });
});

test.describe("markdown mirrors", () => {
  for (const path of ["/", "/posts/", "/ever-learning/", "/about/"]) {
    test(`${path} has a Markdown mirror`, async ({ request }) => {
      const res = await request.get(`${path}index.md`);
      expect(res.status(), `${path}index.md should exist`).toBe(200);
      expect((await res.text()).trim().length).toBeGreaterThan(0);
    });
  }

  test("preserves link targets supplied by shortcodes", async ({ request }) => {
    const body = await text(
      request,
      "/ever-learning/mcp-what-it-is-and-why-it-matters-by-addy-osmani/index.md",
    );
    // `[text]({{< param "..." >}})` must resolve, not be stripped to `[text]()`.
    expect(body).not.toMatch(/\]\(\s*\)/);
    expect(body).toContain("](https://");
  });

  test("emits usable image destinations", async ({ request }) => {
    const body = await text(request, "/posts/docker-desktop-disk-full-macos/index.md");
    const images = [...body.matchAll(/!\[[^\]]*\]\(([^)]*)\)/g)].map((m) => m[1]);

    expect(images.length).toBeGreaterThan(0);
    for (const src of images) {
      // An unescaped space breaks the link destination in CommonMark, and a
      // page-relative src does not resolve from a corpus served at another URL.
      expect(src, `image destination "${src}"`).not.toMatch(/\s/);
      expect(src, `image destination "${src}"`).toMatch(/^(https?:)?\//);
    }
  });
});
