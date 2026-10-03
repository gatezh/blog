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

test.describe("security headers", () => {
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

  test("HTML carries a strict, nonce-based CSP", async ({ request }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
    expect(nonceOf(csp), "no nonce in script-src").toBeTruthy();
    for (const directive of [
      "'strict-dynamic'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(csp).toContain(directive);
    }
  });

  test("every script carries this response's nonce", async ({ request }) => {
    const res = await request.get("/posts/docker-desktop-disk-full-macos/");
    const nonce = nonceOf(res.headers()["content-security-policy"] ?? "");
    const scripts = (await res.text()).match(/<script\b[^>]*>/g) ?? [];

    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
  });

  test("the nonce is fresh on every response", async ({ request }) => {
    const first = (await request.get("/about/")).headers()["content-security-policy"] ?? "";
    const second = (await request.get("/about/")).headers()["content-security-policy"] ?? "";
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  test("connect-src allows the contact-form API", async ({ request }) => {
    // API_URL is passed to `wrangler dev` in playwright.config.ts, mirroring
    // what the deploy workflows pass from HUGO_PARAMS_APIURL.
    const csp = (await request.get("/contact/")).headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/connect-src [^;]*http:\/\/localhost:8787/);
  });

  test("HTML is never revalidated into a stale nonce", async ({ request }) => {
    // A 304 would make the browser pair its cached body (old nonce) with the
    // new policy and block every script on the page.
    const res = await request.get("/about/");
    expect(res.headers()["etag"]).toBeUndefined();

    const conditional = await request.get("/about/", {
      headers: { "If-None-Match": '"anything"', "If-Modified-Since": new Date().toUTCString() },
    });
    expect(conditional.status()).toBe(200);
  });

  test("HEAD reports the policy too", async ({ request }) => {
    const res = await request.head("/");
    expect(res.headers()["content-security-policy"]).toContain("'strict-dynamic'");
  });

  test("baseline headers are on non-HTML responses", async ({ request }) => {
    const res = await request.get("/llms.txt");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers()["content-security-policy"]).toBeUndefined();
  });

  // The policy is only useful if the site still works under it. A violation is
  // reported before any network fetch, so this holds offline too.
  for (const path of ["/", "/contact/", "/posts/docker-desktop-disk-full-macos/"]) {
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
