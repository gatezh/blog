# Remark42 Permissions-Policy Configuration

## Implementation

**Cloudflare Transform Rule Added:**
- **Name:** Allow Picture-in-Picture
- **Condition:** Hostname equals `comments.gatezh.com`
- **Action:** Set static header `Permissions-Policy` → `picture-in-picture=(self)`

## Purpose

Resolves browser console warning: "Permissions policy violation: picture-in-picture is not allowed in this document."

Remark42 (or embedded content it displays) requires picture-in-picture permission for video preview features. This rule grants the permission using the principle of least privilege by allowing only the comments origin itself.

## Security Rationale

Using `(self)` instead of `*`:
- Limits picture-in-picture permission to the Remark42 domain only
- Prevents arbitrary third-party embedded content from using the feature
- Maintains security while resolving the console error

## Future Expansion

If Remark42 embeds videos from external platforms that need picture-in-picture, expand the policy:

```
Permissions-Policy: picture-in-picture=(self "https://www.youtube.com" "https://player.vimeo.com")
```

Add trusted domains as space-separated quoted strings within the parentheses.
