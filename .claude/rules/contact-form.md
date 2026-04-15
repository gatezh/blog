---
description: Contact form configuration and email worker secrets
globs: services/email-worker/**
---

# Contact Form Configuration

The contact form requires:
1. **Turnstile Site Key** - Set in `services/www/hugo.yaml` as `turnstileSiteKey`
2. **Worker URL** - Set in `services/www/hugo.yaml` as `contactWorkerUrl`
3. **Worker Secrets** - Set via `wrangler secret put`:
   - `RESEND_API_KEY` - Resend API key for sending emails
   - `TURNSTILE_SECRET_KEY` - Turnstile secret for verification
   - `TO_EMAIL` - Email recipient for contact form submissions
   - `FROM_EMAIL` - Email sender (must be from a verified domain in Resend)
