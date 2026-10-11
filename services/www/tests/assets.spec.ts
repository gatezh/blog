import { type APIRequestContext, expect, test } from "@playwright/test";

/**
 * What Cloudflare's asset server does with a real build, exercised against
 * `wrangler dev --local` serving ./public with no Worker code: the generated
 * _headers (security headers, CSP, X-Robots-Tag) and _redirects, and the 404
 * status from `not_found_handling`. None of this is reachable from
 * `hugo server`.
 *
 * The build is a production one, so these also pin that production HTML is
 * NOT noindex. Staging's X-Robots-Tag is checked by its deploy's verify job.
 */

/** A post with comments, so the Remark42 embed is on the page. */
const POST = "/posts/docker-desktop-disk-full-macos/";

test.describe("error pages", () => {
  // /404 itself answers 200 (it is the asset 404.html). That page carries
  // robots noindex, which tests/seo.spec.ts pins.
  test("an unknown path returns a real 404", async ({ request }) => {
    expect((await request.get("/no-such-page/")).status()).toBe(404);
  });
});

test.describe("agent text is crawlable but not indexable", () => {
  for (const path of [
    "/llms.txt",
    "/llms-full.txt",
    "/index.md",
    "/about/index.md",
    `${POST}index.md`,
  ]) {
    test(`${path} carries X-Robots-Tag: noindex`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["x-robots-tag"]).toBe("noindex");
    });
  }

  test("HTML pages are not marked noindex in production", async ({ request }) => {
    for (const path of ["/", "/about/", POST]) {
      expect((await request.get(path)).headers()["x-robots-tag"]).toBeUndefined();
    }
  });
});

test.describe("security headers", () => {
  const cspOf = async (request: APIRequestContext, path: string) =>
    (await request.get(path)).headers()["content-security-policy"] ?? "";

  const directive = (csp: string, name: string) =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? "";

  test("HTML carries an allowlist CSP", async ({ request }) => {
    const csp = await cspOf(request, "/");
    for (const expected of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(expected);
    }

    // Every script is a file, so script-src must never need these back.
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).toContain("'self'");
    for (const banned of [
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'nonce-",
      "'strict-dynamic'",
      " https: ",
    ]) {
      expect(scriptSrc).not.toContain(banned);
    }
  });

  test("connect-src allows the API the contact form posts to", async ({ request }) => {
    // Both come from params.apiUrl, so they cannot disagree — this pins that.
    const html = await (await request.get("/contact/")).text();
    const apiUrl = /data-api-url="?([^"\s>]+)/.exec(html)?.[1];
    expect(apiUrl, "no data-api-url on the contact form script").toBeTruthy();

    const csp = await cspOf(request, "/contact/");
    expect(directive(csp, "connect-src")).toContain(new URL(apiUrl as string).origin);
  });

  test("HTML carries no inline executable script", async ({ request }) => {
    for (const path of ["/", "/contact/", POST]) {
      const tags = (await (await request.get(path)).text()).match(/<script\b[^>]*>/g) ?? [];
      // JSON-LD is data, not script, and is not governed by script-src.
      const inline = tags.filter((t) => !/\bsrc=/.test(t) && !/application\/ld\+json/.test(t));
      expect(inline, `${path} has inline scripts`).toEqual([]);
    }
  });

  test("baseline headers are on every response", async ({ request }) => {
    const html = await (await request.get("/")).text();
    const css = /\/css\/[A-Za-z0-9._-]+\.css/.exec(html)?.[0];
    expect(css, "no hashed stylesheet found in the homepage").toBeTruthy();

    for (const path of ["/", "/llms.txt", css as string, "/no-such-page/"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["content-security-policy"], path).toBeTruthy();
    }
  });

  // The policy is only useful if the site still works under it. A violation is
  // reported before any network fetch, so this holds offline too.
  for (const path of ["/", "/contact/", POST]) {
    test(`${path} raises no CSP violations`, async ({ page }) => {
      await page.addInitScript(() => {
        const seen: string[] = [];
        (window as unknown as { __csp: string[] }).__csp = seen;
        document.addEventListener("securitypolicyviolation", (e) => {
          seen.push(`${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      await page.goto(path);
      await page.waitForLoadState("load");

      const violations = await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      );
      expect(violations).toEqual([]);
    });
  }
});

test.describe("request path handling", () => {
  test("a scheme-relative path does not leave the origin", async ({ request }, info) => {
    // The URL is spelled out in full: a relative "//evil.example/..." would be
    // resolved against baseURL by the request context and actually leave the
    // origin, testing nothing about the asset router.
    const base = info.project.use.baseURL as string;
    const res = await request.get(`${base}//evil.example/about/`, { maxRedirects: 0 });
    expect(res.status(), "//host/ paths must not serve page content").not.toBe(200);

    // auto-trailing-slash answers with a redirect; it must stay on this site.
    const location = res.headers().location;
    if (location) expect(location).not.toMatch(/^(https?:)?\/\//);
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

/** The 2017 portfolio, restored at /early-projects/. Also archived 200 in the
 *  CDX index. It reaches the redirect table the same way every other entry
 *  does — an `aliases:` value on the page — with no special-casing anywhere. */
const PAGES: Array<[string, string]> = [["/portfolio", "/early-projects/"]];

test.describe("legacy URLs redirect in one hop", () => {
  const directoryStyle = [...DATED, ...PAGES];
  const cases: Array<[string, string]> = [
    ...directoryStyle,
    ...directoryStyle.map(([from, to]): [string, string] => [`${from}/`, to]),
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
    for (const to of [...Object.values(CANONICAL), ...PAGES.map(([, to]) => to)]) {
      const res = await request.get(to, { maxRedirects: 0 });
      expect(res.status(), `${to} must terminate the redirect chain`).toBe(200);
    }
  });

  test("no meta-refresh alias stub survives", async ({ request }) => {
    // disableAliases stops Hugo writing these. If it is ever removed, the stub
    // is served 200 at the same URL and silently wins over the redirect rule —
    // the failure this whole feature exists to prevent, and one that a status
    // check alone would not catch.
    for (const [from] of directoryStyle) {
      const res = await request.get(`${from}/`, { maxRedirects: 0 });
      expect(res.status()).toBe(301);
      expect(await res.text()).not.toContain("http-equiv");
    }
  });

  test("the redirect table itself is not served", async ({ request }) => {
    expect((await request.get("/_redirects")).status()).toBe(404);
  });
});
