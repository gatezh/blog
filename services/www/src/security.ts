// Security headers for every response this Worker serves, and the Content
// Security Policy for every HTML page.
//
// The policy lives here, not in a Cloudflare Transform Rule, so that it is
// versioned with the templates it has to match, differs per environment (the
// contact form POSTs to a different API origin on staging), and is exercised by
// tests/worker.spec.ts before it ships. The Transform Rule it replaces drifted
// to `connect-src` alone without any commit — see docs/adr-004-csp-in-worker.md.

// Third parties the templates load, and the directive each one needs. Anything
// not listed is blocked; adding a third-party script means adding it here.
//
// Google Analytics: Google's documented CSP for GA4. The wildcards are required
// — collection goes to regional hosts such as region1.google-analytics.com,
// which a www.-only allowlist silently blocks.
// https://developers.google.com/tag-platform/security/guides/csp
const GOOGLE_ANALYTICS_IMG = ["https://*.google-analytics.com", "https://*.googletagmanager.com"];
const GOOGLE_ANALYTICS_CONNECT = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
];
// Remark42, self-hosted behind a Cloudflare Tunnel: its embed script renders
// the comment thread in an iframe from this host.
const REMARK42 = "https://comments.gatezh.com";
// Cloudflare Turnstile renders its challenge in an iframe.
const TURNSTILE = "https://challenges.cloudflare.com";

/** Headers that are correct on any response, HTML or not. */
const COMMON_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
};

/**
 * A strict, nonce-based policy (https://web.dev/articles/strict-csp).
 *
 * script-src trusts only scripts carrying this response's nonce, and through
 * 'strict-dynamic' whatever those scripts load — which is how gtag.js, the
 * Remark42 embed and Turnstile's api.js run without a host allowlist. `https:`
 * and 'unsafe-inline' are fallbacks for browsers older than CSP3; a browser
 * that understands nonces ignores both.
 *
 * Scripts Cloudflare injects at the edge (JavaScript Detections) are covered
 * too: Cloudflare reads the nonce from this header and adds it to them. That
 * only works with a header — never move this policy into a <meta> tag.
 * https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/
 */
export function contentSecurityPolicy(nonce: string, apiUrl: string, secure: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Inline style attributes are used by the theme and by Turnstile.
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data:", ...GOOGLE_ANALYTICS_IMG].join(" "),
    ["connect-src 'self'", originOf(apiUrl), REMARK42, ...GOOGLE_ANALYTICS_CONNECT]
      .filter(Boolean)
      .join(" "),
    `frame-src ${TURNSTILE} ${REMARK42}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Over plain http (wrangler dev) this would rewrite same-origin requests to
  // an https:// port nothing is listening on.
  if (secure) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

/** A fresh 128-bit nonce. Never reuse one across responses. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Adds the security headers to a mutable response and, for HTML, stamps the
 * nonce on every <script> and sets the matching policy.
 */
export function secure(response: Response, request: Request, apiUrl: string): Response {
  for (const [name, value] of Object.entries(COMMON_HEADERS)) response.headers.set(name, value);

  if (!isHtml(response)) return response;

  const nonce = createNonce();
  const secureOrigin = new URL(request.url).protocol === "https:";

  response.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(nonce, apiUrl, secureOrigin),
  );
  // Superseded by frame-ancestors in every current browser; kept for the ones
  // that predate it.
  response.headers.set("X-Frame-Options", "DENY");

  // The body is rewritten per request, so the asset's validators no longer
  // describe it. Left in place, a revalidation would answer 304 and the browser
  // would pair its cached body — old nonce — with this response's policy, and
  // block every script on the page. See also stripValidators().
  response.headers.delete("ETag");
  response.headers.delete("Last-Modified");

  // HEAD: the headers above are the whole answer, and there is nothing to stamp.
  if (!response.body) return response;

  return new HTMLRewriter()
    .on("script", {
      element(script) {
        script.setAttribute("nonce", nonce);
      },
    })
    .transform(response);
}

/**
 * The request a page fetch should make to the asset store: without
 * conditional headers, so the store never answers 304 for HTML whose nonce is
 * about to be rewritten. A browser that cached a page before this Worker
 * stripped validators still sends If-None-Match.
 */
export function stripValidators(request: Request): Request {
  if (!request.headers.has("If-None-Match") && !request.headers.has("If-Modified-Since")) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  return new Request(request, { headers });
}

function isHtml(response: Response): boolean {
  return (response.headers.get("Content-Type") ?? "").includes("text/html");
}

function originOf(url: string): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}
