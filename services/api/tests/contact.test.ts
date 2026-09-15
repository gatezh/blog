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

function submit(body: Record<string, unknown>) {
  return app.request(
    "/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://gatezh.com" },
      body: JSON.stringify(body),
    },
    ENV,
  );
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

  test("accepts a token when the hostname is absent", async () => {
    // Cloudflare's test keys omit hostname; absence must not fail closed.
    turnstileResponse = { success: true };
    expect((await submit(VALID)).status).toBe(200);
  });

  test("rejects an unsuccessful verification", async () => {
    turnstileResponse = { success: false, "error-codes": ["invalid-input-response"] };
    const res = await submit(VALID);
    expect(res.status).toBe(400);
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
