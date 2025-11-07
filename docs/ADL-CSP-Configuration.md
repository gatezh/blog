# Architecture Decision Log: Content Security Policy Configuration

**Date:** 2025-11-07  
**Status:** Implemented  
**Decision Maker:** Site Administrator  
**Context:** Hugo blog with Remark42 comments via Cloudflare Zero Trust Tunnel

---

## Problem Statement

Browser console was showing Content Security Policy (CSP) violation errors blocking scripts from loading:
1. Cloudflare Insights beacon script (`static.cloudflareinsights.com`) was blocked
2. Google Analytics script (`www.googletagmanager.com`) was blocked
3. Remark42 comments iframe had its own restrictive CSP blocking Cloudflare scripts

These errors prevented proper functionality and analytics tracking on the website.

---

## What is Content Security Policy (CSP)?

**Simple Explanation:**  
Content Security Policy (CSP) is like a **security guard for your website**. It's a list of rules that tells the browser: "Only allow scripts, images, and other resources from these specific trusted sources."

**Why it exists:**  
Without CSP, malicious attackers could inject harmful JavaScript code into your website (called Cross-Site Scripting or XSS attacks). CSP prevents this by only allowing content from sources you explicitly approve.

**How it works:**  
When a browser loads your webpage, it checks the CSP header. If a script tries to load from a domain not listed in your CSP, the browser blocks it and shows an error in the console.

---

## Why This Problem Occurred

1. **Your website had an existing CSP** (either from Hugo, Cloudflare, or Remark42) with restrictive rules like `script-src 'self' 'unsafe-inline'`
   - `'self'` = only allow scripts from your own domain
   - `'unsafe-inline'` = allow inline scripts (scripts written directly in HTML)

2. **Cloudflare automatically injects analytics scripts** from `static.cloudflareinsights.com`, which was not in the allowed list

3. **You added Google Analytics**, which loads from `www.googletagmanager.com`, also not in the allowed list

4. **Remark42 runs in an iframe** at `comments.gatezh.com`, which has its own separate CSP, creating a nested security policy that needed separate configuration

---

## Decision

Implement two separate Content Security Policy Transform Rules in Cloudflare to allow necessary third-party scripts while maintaining security.

---

## Solution Implemented

### Rule 1: CSP for Main Domain

**Configuration:**
- **Rule Name:** CSP
- **Applies to:** All incoming requests
- **Action:** Set static
- **Header Name:** Content-Security-Policy
- **Value:**
```
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://comments.gatezh.com https://www.googletagmanager.com https://www.google-analytics.com; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://analytics.google.com;
```

**What each parameter means:**

| Parameter | What It Does |
|-----------|--------------|
| `script-src` | Controls where JavaScript can load from |
| `'self'` | Allow scripts from your own domain (gatezh.com) |
| `'unsafe-inline'` | Allow inline JavaScript (scripts in `<script>` tags) |
| `https://static.cloudflareinsights.com` | Allow Cloudflare analytics beacon script |
| `https://comments.gatezh.com` | Allow Remark42 comment system scripts |
| `https://www.googletagmanager.com` | Allow Google Tag Manager scripts |
| `https://www.google-analytics.com` | Allow Google Analytics scripts |
| `connect-src` | Controls where JavaScript can make network requests to (AJAX, fetch, WebSocket) |
| `https://cloudflareinsights.com` | Allow sending analytics data to Cloudflare |
| `https://www.google-analytics.com` | Allow sending data to Google Analytics |
| `https://analytics.google.com` | Allow Google Analytics data collection endpoint |

---

### Rule 2: CSP for Comments Subdomain

**Configuration:**
- **Rule Name:** CSP for comments subdomain
- **Condition:** If incoming requests match...
- **Custom Filter Expression:**
  - **Field:** Hostname
  - **Operator:** Equals
  - **Value:** comments.gatezh.com
- **Action:** Set static
- **Header Name:** Content-Security-Policy
- **Value:**
```
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com;
```

**Why a separate rule?**  
Remark42 loads in an iframe, which is essentially a separate webpage embedded in your blog. Iframes have their own security context and need their own CSP. This rule specifically targets the `comments.gatezh.com` subdomain where Remark42 runs.

**What this allows:**
- Scripts from the comments subdomain itself (`'self'`)
- Inline scripts needed by Remark42 (`'unsafe-inline'`)
- Cloudflare analytics beacon (`https://static.cloudflareinsights.com`)
- Network requests to Cloudflare analytics (`https://cloudflareinsights.com`)

---

## Why Two Rules Are Needed

Think of your website like an apartment building:
- **Rule 1** sets security rules for the main building (your blog)
- **Rule 2** sets security rules for a separate unit (the comments iframe)

Each "space" needs its own security guard with its own approved visitor list.

---

## Consequences

### Positive
✅ Scripts load without console errors  
✅ Cloudflare analytics tracking works properly  
✅ Google Analytics collects data successfully  
✅ Remark42 comments display and function correctly  
✅ Website maintains security by explicitly whitelisting trusted sources  

### Negative
⚠️ Need to update CSP rules manually when adding new third-party services  
⚠️ `'unsafe-inline'` slightly reduces security (but is often necessary for modern web apps)  
⚠️ Must maintain two separate CSP rules (main domain + comments subdomain)  

### Neutral
ℹ️ CSP rules are configured at Cloudflare level (not in Hugo source code)  
ℹ️ Changes take effect immediately without redeploying the site  

---

## Alternatives Considered

### Option 1: Disable Cloudflare Web Analytics
- **Pros:** Eliminates CSP conflict entirely
- **Cons:** Lose valuable analytics data
- **Rejected:** Analytics data is valuable for site insights

### Option 2: Use 'unsafe-inline' and 'unsafe-eval' for everything
- **Pros:** No script blocking
- **Cons:** Significantly weakens security, exposes site to XSS attacks
- **Rejected:** Unacceptable security risk

### Option 3: Configure CSP in Hugo config
- **Pros:** Version-controlled with site code
- **Cons:** Cloudflare-injected scripts would still be blocked before Hugo CSP is evaluated
- **Rejected:** Doesn't solve the Cloudflare script injection issue

---

## Implementation Notes

1. Rules are configured in **Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header**
2. Rule order matters: The more specific rule (comments subdomain) is evaluated alongside the general rule
3. Hard browser refresh (Ctrl+Shift+R) required to see changes take effect
4. Verify by checking Console in DevTools - no CSP errors should appear

---

## Future Considerations

- **When adding new third-party services** (like more analytics, fonts, CDNs), remember to update the CSP rules
- **Monitor browser console** periodically to catch any blocked resources
- **Consider using CSP reporting** to log violations without blocking (add `report-uri` directive)
- **Review CSP annually** to remove unused domains and tighten security

---

## Verification

After implementation, the following should work without console errors:
- ✅ Cloudflare Web Analytics beacon loads
- ✅ Google Analytics tracking functions
- ✅ Remark42 comments display in iframe
- ✅ No CSP violation errors in browser console

---

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cloudflare: Content Security Policies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/)
- [CSP Quick Reference](https://content-security-policy.com/)

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-07
