# ADR-002: Content Security Policy Configuration

## Status

Accepted

## Context

The Hugo blog uses Remark42 for comments (via Cloudflare Zero Trust Tunnel) along with Cloudflare Web Analytics and Google Analytics. Browser console was showing Content Security Policy (CSP) violation errors blocking scripts from loading:

1. Cloudflare Insights beacon script (`static.cloudflareinsights.com`) was blocked
2. Google Analytics script (`www.googletagmanager.com`) was blocked
3. Remark42 comments iframe had its own restrictive CSP blocking Cloudflare scripts

These errors prevented proper functionality and analytics tracking on the website.

### What is Content Security Policy?

Content Security Policy (CSP) is a security mechanism that acts like a **security guard for your website**. It defines rules that tell the browser: "Only allow scripts, images, and other resources from these specific trusted sources."

**Why it exists:** Without CSP, attackers could inject malicious JavaScript code (Cross-Site Scripting/XSS attacks). CSP prevents this by only allowing content from explicitly approved sources.

**How it works:** When a browser loads a webpage, it checks the CSP header. If a script tries to load from a domain not listed in the CSP, the browser blocks it and logs an error.

### Why This Problem Occurred

1. The website had an existing restrictive CSP with rules like `script-src 'self' 'unsafe-inline'`
   - `'self'` = only allow scripts from your own domain
   - `'unsafe-inline'` = allow inline scripts (written directly in HTML)

2. Cloudflare automatically injects analytics scripts from `static.cloudflareinsights.com` (not in allowed list)

3. Google Analytics loads from `www.googletagmanager.com` (not in allowed list)

4. Remark42 runs in an iframe at `comments.gatezh.com` with its own separate CSP, creating a nested security policy requiring separate configuration

## Decision

Implement two separate Content Security Policy Transform Rules in Cloudflare to allow necessary third-party scripts while maintaining security:

### Rule 1: CSP for Main Domain

**Configuration:**
- **Rule Name:** CSP
- **Applies to:** All incoming requests
- **Action:** Set static header
- **Header:** `Content-Security-Policy`
- **Value:**
```
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://comments.gatezh.com https://www.googletagmanager.com https://www.google-analytics.com; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://analytics.google.com;
```

**Directives explained:**

| Directive | Purpose | Allowed Sources |
|-----------|---------|-----------------|
| `script-src` | Controls where JavaScript can load from | Own domain, inline scripts, Cloudflare analytics, Remark42, Google Analytics/Tag Manager |
| `connect-src` | Controls where JavaScript can make network requests (AJAX, fetch) | Own domain, Cloudflare analytics endpoints, Google Analytics endpoints |

### Rule 2: CSP for Comments Subdomain

**Configuration:**
- **Rule Name:** CSP for comments subdomain
- **Condition:** `Hostname equals comments.gatezh.com`
- **Action:** Set static header
- **Header:** `Content-Security-Policy`
- **Value:**
```
script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com;
```

**Why separate rule?** Remark42 loads in an iframe (essentially a separate webpage). Iframes have their own security context and need their own CSP.

## Rationale

**Why two rules are needed:**

Think of the website like an apartment building:
- **Rule 1** sets security rules for the main building (blog)
- **Rule 2** sets security rules for a separate unit (comments iframe)

Each "space" needs its own security configuration with its own approved resource list.

**Why configure at Cloudflare level:**
- Cloudflare-injected scripts load before Hugo's CSP would be evaluated
- Changes take effect immediately without site redeployment
- Centralized security policy management

## Alternatives Considered

### 1. Disable Cloudflare Web Analytics
- **Pros:** Eliminates CSP conflict entirely
- **Cons:** Lose valuable analytics data
- **Rejected:** Analytics data is valuable for site insights

### 2. Use 'unsafe-inline' and 'unsafe-eval' everywhere
- **Pros:** No script blocking
- **Cons:** Significantly weakens security, exposes site to XSS attacks
- **Rejected:** Unacceptable security risk

### 3. Configure CSP in Hugo config
- **Pros:** Version-controlled with site code
- **Cons:** Cloudflare-injected scripts blocked before Hugo CSP evaluation
- **Rejected:** Doesn't solve Cloudflare script injection issue

## Consequences

### Positive
- ✅ Scripts load without console errors
- ✅ Cloudflare analytics tracking works properly
- ✅ Google Analytics collects data successfully
- ✅ Remark42 comments display and function correctly
- ✅ Website maintains security by explicitly whitelisting trusted sources

### Negative
- ⚠️ Must update CSP rules manually when adding new third-party services
- ⚠️ `'unsafe-inline'` slightly reduces security (but necessary for modern web apps)
- ⚠️ Must maintain two separate CSP rules (main domain + comments subdomain)

### Neutral
- CSP rules configured at Cloudflare level (not in Hugo source code)
- Changes take effect immediately without redeploying the site

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Cloudflare: Content Security Policies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/)
- [CSP Quick Reference](https://content-security-policy.com/)

## Implementation

- **Date:** 2025-11-07
- **Location:** Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header
- **Files Modified:** None (Cloudflare configuration only)

### Verification

After implementation, the following work without console errors:
- ✅ Cloudflare Web Analytics beacon loads
- ✅ Google Analytics tracking functions
- ✅ Remark42 comments display in iframe
- ✅ No CSP violation errors in browser console

## Notes

- Rule order matters: The more specific rule (comments subdomain) is evaluated alongside the general rule
- Hard browser refresh (Ctrl+Shift+R) may be required to see changes take effect
- Verify by checking Console in DevTools

### Future Considerations

- When adding new third-party services (analytics, fonts, CDNs), update CSP rules
- Monitor browser console periodically to catch blocked resources
- Consider using CSP reporting to log violations without blocking (add `report-uri` directive)
- Review CSP annually to remove unused domains and tighten security

---

**Date:** 2025-11-07
**Author:** Site Administrator
