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

/**
 * Legacy URLs are served a single 301 from the generated /_redirects table,
 * rather than the meta-refresh stub Hugo writes for an `aliases:` entry.
 *
 * The pairs are spelled out rather than parsed out of public/_redirects on
 * purpose. Deriving the fixture from the generated artefact is precisely how
 * four published posts disappeared unnoticed in f683a0f: tests/seo.spec.ts swept
 * whatever the sitemap advertised, so when the sitemap shrank the sweep shrank
 * with it and stayed green. A list that cannot shrink by itself is the point.
 */
const CANONICAL = {
  angular: "/posts/how-to-host-angular-application-on-github-pages/",
  jekyll: "/posts/getting-started-with-jekyll/",
  blog: "/posts/host-your-personal-blog-on-github-pages/",
  anki: "/posts/using-anki-to-study-programming/",
  graphql: "/posts/graphql-schema-use-it-in-a-sentence/",
  www: "/posts/how-to-redirect-www-to-root-domain-on-cloudflare-pages/",
  remark42: "/posts/add-remark42-comments-to-hugo-website/",
} as const;

/** Dated Hugo-era paths. Both spellings, because auto-trailing-slash would
 *  otherwise answer the slash-less one with a 307 of its own first. */
const DATED: Array<[string, string]> = [
  ["/posts/2017/03/31/how-to-host-angular-application-on-github-pages", CANONICAL.angular],
  ["/posts/2017/04/04/getting-started-with-jekyll", CANONICAL.jekyll],
  ["/posts/2017/04/04/host-your-personal-blog-on-github-pages", CANONICAL.blog],
  ["/posts/2017/07/16/using-anki-to-study-programming", CANONICAL.anki],
  ["/posts/2020/06/22/graphql-schema-use-it-in-a-sentence", CANONICAL.graphql],
  ["/posts/2024/06/15/posts/fixing-www-issue-for-cloudflare-pages-website", CANONICAL.www],
  ["/posts/2024/06/22/add-remark42-comments-to-hugo-website", CANONICAL.remark42],
];

/** Jekyll-era URLs. Archived 200 in the Wayback CDX index for 2017-2019, so
 *  these were real published URLs and not a guess from the dead `permalink:`
 *  front matter they were recovered from. */
const DOT_HTML: Array<[string, string]> = [
  ["/how-to-host-angular-application-on-github-pages.html", CANONICAL.angular],
  ["/getting-started-with-jekyll.html", CANONICAL.jekyll],
  ["/host-your-personal-blog-on-github-pages.html", CANONICAL.blog],
  ["/using-anki-to-study-programming.html", CANONICAL.anki],
];

test.describe("legacy URLs redirect in one hop", () => {
  const cases: Array<[string, string]> = [
    ...DATED,
    ...DATED.map(([from, to]): [string, string] => [`${from}/`, to]),
    ...DOT_HTML,
  ];

  for (const [from, to] of cases) {
    test(`${from} -> ${to}`, async ({ request }, info) => {
      const res = await request.get(from, { maxRedirects: 0 });

      expect(
        res.status(),
        "a 307 here means the rule was missed and only the slash form is covered",
      ).toBe(301);
      // Cloudflare echoes the target as written in _redirects, which is a
      // site-relative path — resolve before comparing rather than assuming a
      // shape, so the assertion holds whichever form the edge returns.
      const location = new URL(res.headers().location, info.project.use.baseURL as string);
      expect(location.pathname).toBe(to);
    });
  }

  test("destinations are pages, not further redirects", async ({ request }) => {
    for (const to of Object.values(CANONICAL)) {
      const res = await request.get(to, { maxRedirects: 0 });
      expect(res.status(), `${to} must terminate the redirect chain`).toBe(200);
    }
  });

  test("no meta-refresh alias stub survives", async ({ request }) => {
    // disableAliases stops Hugo writing these. If it is ever removed, the stub
    // is served 200 at the same URL and silently wins over the redirect rule —
    // the failure this whole feature exists to prevent, and one that a status
    // check alone would not catch.
    for (const [from] of DATED) {
      const res = await request.get(`${from}/`, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(await res.text()).not.toContain("http-equiv");
    }
  });

  test("the redirect table itself is not served", async ({ request }) => {
    expect((await request.get("/_redirects")).status()).toBe(404);
  });
});
