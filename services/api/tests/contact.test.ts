import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import app from "../src/index";

const ENV = {
  RESEND_API_KEY: "re_test",
  TURNSTILE_SECRET_KEY: "0x-test-secret",
  ALLOWED_ORIGIN: "https://gatezh.com",
  TO_EMAIL: "to@example.com",
  FROM_EMAIL: "from@example.com",
};

/** Captures the outbound Resend payload so tests can assert on what would be sent. */
let sentEmail: Record<string, unknown> | null = null;
/** Verification response the stubbed Turnstile endpoint returns. */
let turnstileResponse: Record<string, unknown> = { success: true, hostname: "gatezh.com" };
const realFetch = globalThis.fetch;

beforeEach(() => {
  sentEmail = null;
  turnstileResponse = { success: true, hostname: "gatezh.com" };

  // Only the network boundary is stubbed: Turnstile's siteverify and Resend's
  // send endpoint. Everything inside the Worker runs for real.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("challenges.cloudflare.com")) {
      return Response.json(turnstileResponse);
    }
    if (url.includes("api.resend.com")) {
      sentEmail = JSON.parse(String(init?.body ?? "{}"));
      return Response.json({ id: "email-id" });
    }
    throw new Error(`unexpected outbound request: ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Hands requests for `host` to `handle`; `next` passes one on to the current stub. */
function intercept(
  host: string,
  handle: (next: () => Promise<Response>, init?: RequestInit) => Response | Promise<Response>,
) {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return url.includes(host) ? handle(() => inner(input, init), init) : inner(input, init);
  }) as typeof fetch;
}

function request(body: Record<string, unknown>) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://gatezh.com" },
    body: JSON.stringify(body),
  };
}

function submit(body: Record<string, unknown>) {
  return app.request("/", request(body), ENV);
}

const VALID = {
  name: "Ada",
  email: "ada@example.com",
  subject: "Hello",
  message: "Hi there",
  turnstileToken: "token",
};

describe("input limits", () => {
  test("accepts a submission within the limits", async () => {
    const res = await submit(VALID);
    expect(res.status).toBe(200);
  });

  test("rejects a message beyond the length cap", async () => {
    const res = await submit({ ...VALID, message: "x".repeat(5001) });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("too long") });
  });

  test("rejects a name beyond the length cap", async () => {
    const res = await submit({ ...VALID, name: "x".repeat(101) });
    expect(res.status).toBe(400);
  });

  test("rejects a subject beyond the length cap", async () => {
    const res = await submit({ ...VALID, subject: "x".repeat(201) });
    expect(res.status).toBe(400);
  });

  test("rejects an oversized message before spending a Turnstile verification", async () => {
    let verified = false;
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("challenges.cloudflare.com")) verified = true;
      return inner(input, init);
    }) as typeof fetch;

    await submit({ ...VALID, message: "x".repeat(5001) });
    expect(verified).toBe(false);
  });
});

describe("request body", () => {
  function post(body: string, contentType: string) {
    return app.request(
      "/",
      {
        method: "POST",
        headers: { "Content-Type": contentType, Origin: "https://gatezh.com" },
        body,
      },
      ENV,
    );
  }

  test("malformed JSON is a 400, not a server error", async () => {
    const res = await post("{not json", "application/json");
    expect(res.status).toBe(400);
    // JSON like every other error, so the form can show it.
    expect(await res.json()).toEqual({ error: "Malformed JSON in request body" });
  });

  test("a field of the wrong type is a 400, not a server error", async () => {
    const res = await submit({ ...VALID, name: 123 });
    expect(res.status).toBe(400);
    expect(sentEmail).toBeNull();
  });

  test("a body that is not declared as JSON is refused", async () => {
    // text/plain is a CORS "simple" request, sent cross-origin without a
    // preflight. Requiring application/json keeps every submission preflighted.
    const res = await post(JSON.stringify(VALID), "text/plain");
    expect(res.status).toBe(400);
    expect(sentEmail).toBeNull();
  });
});

describe("upstream failures", () => {
  test("an unreachable siteverify is a 502, and nothing is sent", async () => {
    intercept("challenges.cloudflare.com", () => {
      throw new TypeError("network down");
    });

    const res = await submit(VALID);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: "Captcha verification is unavailable. Please try again later.",
    });
    expect(sentEmail).toBeNull();
  });

  test("a non-2xx siteverify is a 502, not a captcha failure", async () => {
    intercept("challenges.cloudflare.com", () => new Response("upstream error", { status: 503 }));

    const res = await submit(VALID);
    expect(res.status).toBe(502);
    expect(sentEmail).toBeNull();
  });



  test("a Resend failure is a JSON 500 that leaks nothing", async () => {
    intercept("api.resend.com", () => {
      throw new TypeError("network down");
    });

    const res = await submit(VALID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("network down");
  });
});

describe("turnstile", () => {
  test("rejects a token solved for a different hostname", async () => {
    turnstileResponse = { success: true, hostname: "attacker.example" };
    const res = await submit(VALID);
    expect(res.status).toBe(400);
    expect(sentEmail).toBeNull();
  });

  test("accepts a token solved for the site hostname", async () => {
    turnstileResponse = { success: true, hostname: "gatezh.com" };
    expect((await submit(VALID)).status).toBe(200);
  });

  test("rejects a token with no hostname", async () => {
    turnstileResponse = { success: true };
    expect((await submit(VALID)).status).toBe(400);
    expect(sentEmail).toBeNull();
  });

  test("Cloudflare's test secret passes despite its fixed example.com hostname", async () => {
    // What siteverify really answers for the always-pass test secret.
    turnstileResponse = { success: true, hostname: "example.com" };
    const env = { ...ENV, TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" };
    expect((await app.request("/", request(VALID), env)).status).toBe(200);
  });

  test("a real secret still rejects example.com", async () => {
    turnstileResponse = { success: true, hostname: "example.com" };
    expect((await submit(VALID)).status).toBe(400);
  });

  test("rejects an unsuccessful verification", async () => {
    turnstileResponse = { success: false, "error-codes": ["invalid-input-response"] };
    const res = await submit(VALID);
    expect(res.status).toBe(400);
    expect(sentEmail).toBeNull();
  });
});

// The browser keeps other sites out; see the cors comment in src/index.ts.
describe("origin", () => {
  for (const origin of ["https://attacker.example", "http://localhost:1313"]) {
    test(`a JSON preflight from ${origin} gets ALLOWED_ORIGIN back, so the POST never runs`, async () => {
      const res = await app.request(
        "/",
        {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
          },
        },
        ENV,
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://gatezh.com");
    });
  }

  test("a body sent without a preflight is never parsed, so nothing is verified or sent", async () => {
    let verified = false;
    intercept("challenges.cloudflare.com", (next) => {
      verified = true;
      return next();
    });

    // All another site can send without a preflight.
    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain", Origin: "https://attacker.example" },
        body: JSON.stringify(VALID),
      },
      ENV,
    );
    expect(res.status).toBe(400);
    expect(verified).toBe(false);
    expect(sentEmail).toBeNull();
  });
});

describe("header safety", () => {
  test("strips CR/LF from the subject before it reaches the mail API", async () => {
    await submit({ ...VALID, subject: "Hi\r\nBcc: victim@example.com" });
    expect(sentEmail).not.toBeNull();
    // The injected text may survive as literal subject text — harmless. What
    // must not survive is the CR/LF that would start a new header.
    expect(String(sentEmail?.subject)).not.toMatch(/[\r\n]/);
    expect(String(sentEmail?.subject)).toBe("Contact: Hi Bcc: victim@example.com");
  });

  test("strips CR/LF from the name before it reaches the mail API", async () => {
    await submit({ ...VALID, subject: undefined, name: "Ada\r\nBcc: victim@example.com" });
    expect(String(sentEmail?.subject)).not.toMatch(/[\r\n]/);
  });
});

describe("email body", () => {
  test("escapes markup in every field of the HTML body", async () => {
    await submit({ ...VALID, name: "<b>Ada</b>", message: `<script>alert("x")</script>` });
    const body = String(sentEmail?.html);
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("<b>");
    expect(body).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  test("escapes ampersands, so entities typed by the sender arrive as typed", async () => {
    await submit({ ...VALID, message: "Fish & chips; &lt;b&gt; is not bold" });
    expect(String(sentEmail?.html)).toContain("Fish &amp; chips; &amp;lt;b&amp;gt; is not bold");
  });

  test("keeps the subject header plain text, not HTML-escaped", async () => {
    await submit({ ...VALID, subject: `Q&A about <Hugo> "themes"` });
    expect(sentEmail?.subject).toBe(`Contact: Q&A about <Hugo> "themes"`);
  });

  test("sends the plain-text body unescaped", async () => {
    await submit({ ...VALID, message: "a < b & c" });
    expect(String(sentEmail?.text)).toContain("a < b & c");
  });
});

describe("optional feature credentials", () => {
  /** Same request shape as `submit`, but against a caller-supplied environment. */
  function submitWith(env: Record<string, string>, body: Record<string, unknown>) {
    return app.request("/", request(body), env);
  }

  const VALID = {
    name: "Ada",
    email: "ada@example.com",
    message: "Hello",
    turnstileToken: "token",
  };

  // A bare deploy — only ALLOWED_ORIGIN set — must come up and degrade one
  // feature, not fail the whole Worker.
  for (const missing of ["RESEND_API_KEY", "TO_EMAIL", "FROM_EMAIL"] as const) {
    test(`POST / returns 503 when ${missing} is unset`, async () => {
      const env: Record<string, string> = { ...ENV };
      delete env[missing];

      const res = await submitWith(env, VALID);

      expect(res.status).toBe(503);
      // Cast: Hono narrows .json() per typed route, and this 503 is emitted
      // before any route handler, so the inferred body type is `undefined`.
      expect((await res.json()) as { error: string }).toEqual({
        error: "Contact form is not configured on this deployment.",
      });
    });
  }

  test("submissions are accepted without a captcha when the bot gate is unconfigured", async () => {
    const env: Record<string, string> = { ...ENV };
    delete env.TURNSTILE_SECRET_KEY;

    // No turnstileToken at all: a client served no widget has nothing to send.
    const { turnstileToken: _omitted, ...noToken } = VALID;
    const res = await submitWith(env, noToken);

    expect(res.status).toBe(200);
  });

  test("the captcha token is still required when the bot gate IS configured", async () => {
    const { turnstileToken: _omitted, ...noToken } = VALID;
    const res = await submitWith(ENV, noToken);

    expect(res.status).toBe(400);
  });
});

describe("crawlability", () => {
  // Googlebot crawls this host with GET. A 405 landed the origin in Search
  // Console's "Blocked due to other 4xx issue" bucket.
  test("GET / is 200 and asks not to be indexed", async () => {
    const res = await app.request("/", { method: "GET" }, ENV);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  // The deploy checks a version staged at 0% through a version override; a
  // missed override silently reaches the live version, so it must be visible.
  test("GET / names the Worker version that answered", async () => {
    const CF_VERSION_METADATA = { id: "0b5c2e3a-version", tag: "v1.2.3", timestamp: "" };
    const res = await app.request("/", { method: "GET" }, { ...ENV, CF_VERSION_METADATA });

    expect(res.headers.get("Worker-Version")).toBe("0b5c2e3a-version");
  });

  test("GET / without version metadata sends no Worker-Version", async () => {
    const res = await app.request("/", { method: "GET" }, ENV);

    expect(res.headers.has("Worker-Version")).toBe(false);
  });

  test("other methods on / are still rejected", async () => {
    const res = await app.request("/", { method: "DELETE" }, ENV);

    expect(res.status).toBe(405);
    // RFC 9110 §15.5.6: a 405 must list the methods the resource supports.
    expect(res.headers.get("Allow")?.split(", ").sort()).toEqual(["GET", "HEAD", "POST"]);
    expect(await res.json()).toEqual({ error: "Method not allowed" });
  });

  test("a path that does not exist is 404, not 405", async () => {
    const res = await app.request("/nope", { method: "DELETE" }, ENV);

    expect(res.status).toBe(404);
  });
});
