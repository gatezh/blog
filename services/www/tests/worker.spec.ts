import { expect, test } from "@playwright/test";

/**
 * Cloudflare Worker behaviour, exercised against `wrangler dev --local` serving
 * a real build. None of this is reachable from `hugo server`: content
 * negotiation, the 404 status override and the X-Robots-Tag headers only exist
 * in src/index.ts.
 */

const MD = { Accept: "text/markdown" };

test.describe("Accept negotiation", () => {
  for (const path of ["/", "/posts/", "/ever-learning/", "/about/"]) {
    test(`${path} serves Markdown to an agent`, async ({ request }) => {
      const res = await request.get(path, { headers: MD });
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/markdown");
      expect(res.headers()["x-robots-tag"]).toBe("noindex");
    });
  }

  test("a post serves Markdown to an agent", async ({ request }) => {
    const res = await request.get("/posts/docker-desktop-disk-full-macos/", { headers: MD });
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });

  test("serves HTML to a browser", async ({ request }) => {
    const res = await request.get("/", {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    expect(res.headers()["content-type"]).toContain("text/html");
  });

  test("serves HTML when the client accepts anything", async ({ request }) => {
    const res = await request.get("/", { headers: { Accept: "*/*" } });
    expect(res.headers()["content-type"]).toContain("text/html");
  });

  test("honours q=0 as 'not acceptable'", async ({ request }) => {
    // RFC 9110: a zero quality value means the media type is NOT acceptable.
    const res = await request.get("/", { headers: { Accept: "text/html, text/markdown;q=0" } });
    expect(res.headers()["content-type"]).toContain("text/html");
  });

  test("does not match a media type that merely contains the string", async ({ request }) => {
    const res = await request.get("/", { headers: { Accept: "application/x-text/markdown-ish" } });
    expect(res.headers()["content-type"]).toContain("text/html");
  });

  test("Vary: Accept is set on negotiable pages", async ({ request }) => {
    const res = await request.get("/about/");
    expect(res.headers()["vary"] ?? "").toContain("Accept");
  });

  test("Vary is absent on hashed static assets", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const href = /\/css\/[A-Za-z0-9._-]+\.css/.exec(html)?.[0];
    expect(href, "no hashed stylesheet found in the homepage").toBeTruthy();

    const res = await request.get(href as string);
    expect(res.status()).toBe(200);
    expect(res.headers()["vary"] ?? "").not.toContain("Accept");
  });
});

test.describe("error pages", () => {
  for (const path of ["/404", "/404.html", "/no-such-page/"]) {
    test(`${path} returns a real 404`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }
});

test.describe("agent text is crawlable but not indexable", () => {
  for (const path of ["/llms.txt", "/llms-full.txt", "/about/index.md"]) {
    test(`${path} carries X-Robots-Tag: noindex`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["x-robots-tag"]).toBe("noindex");
    });
  }

  test("HTML pages are not marked noindex by the Worker", async ({ request }) => {
    const res = await request.get("/about/");
    expect(res.headers()["x-robots-tag"]).toBeUndefined();
  });
});

test.describe("request path handling", () => {
  test("a scheme-relative path does not resolve to another origin", async ({ request }, info) => {
    // `new URL("//evil.example/about/index.md", origin)` is a scheme-relative
    // reference and replaces the host. The Worker must not build its Markdown
    // sibling that way, and must not answer 200 at an arbitrary `//host/` URL.
    //
    // The URL is spelled out in full: a relative "//evil.example/..." would be
    // resolved against baseURL by the request context and actually leave the
    // origin, testing nothing about the Worker.
    const base = info.project.use.baseURL as string;
    const res = await request.get(`${base}//evil.example/about/`, {
      headers: MD,
      maxRedirects: 0,
    });
    expect(res.status(), "//host/ paths must not serve page content").not.toBe(200);
  });

  test("dot segments do not escape the site", async ({ request }) => {
    for (const path of ["/../../etc/passwd", "/about/..%2f..%2fetc%2fpasswd"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([301, 307, 308, 404]).toContain(res.status());
    }
  });

  test("non-GET methods are rejected", async ({ request }) => {
    for (const method of ["post", "put", "delete"] as const) {
      const res = await request[method]("/about/");
      expect(res.status()).toBe(405);
    }
  });
});
