# Contact Form Setup Guide

This guide explains how to set up and configure the contact form with a standalone Cloudflare Worker, Tailwind CSS, and Resend email service.

## Architecture

The contact form consists of three main components:

1. **Frontend Form** (`content/contact.md`): A Hugo page with a Tailwind CSS-styled form that collects user input
2. **Cloudflare Worker** (`worker/index.ts`): A standalone serverless worker that processes form submissions
3. **Resend API**: Email delivery service that sends the contact form submissions to your inbox

## Prerequisites

- Hugo static site generator
- Bun (JavaScript runtime and package manager)
- Cloudflare account with Workers enabled
- Resend account (free tier available)
- Domain verified with Resend for sending emails

## Initial Setup

### 1. Install Dependencies

This project uses Bun as the package manager and runtime:

```bash
# Install Bun if you haven't already (macOS/Linux)
curl -fsSL https://bun.sh/install | bash

# Install project dependencies
bun install
```

This will install:
- Tailwind CSS for styling
- Wrangler (Cloudflare Workers CLI)
- TypeScript and Workers types

### 2. Build Tailwind CSS

Generate the Tailwind CSS file:

```bash
# One-time build
bun run build:css

# Or watch for changes during development
bun run watch:css
```

This creates `/static/css/tailwind.css` which is loaded by the contact form.

### 3. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up for a free account
2. Verify your email address
3. Complete the onboarding process

### 4. Verify Your Domain with Resend

To send emails from your domain (e.g., `noreply@gatezh.com`), you need to verify it:

1. Log in to your Resend dashboard
2. Navigate to **Domains** in the sidebar
3. Click **Add Domain**
4. Enter your domain (e.g., `gatezh.com`)
5. Resend will provide DNS records that you need to add:
   - **SPF Record**: Allows Resend to send emails on behalf of your domain
   - **DKIM Record**: Helps verify email authenticity
   - **DMARC Record**: Defines how to handle unauthenticated emails

6. Add these DNS records in your Cloudflare DNS settings:
   - Go to Cloudflare Dashboard → Select your domain → DNS → Records
   - Add each TXT record provided by Resend
   - Wait for DNS propagation (can take a few minutes to 48 hours)

7. Return to Resend and click **Verify Domain**
8. Once verified, you'll see a green checkmark next to your domain

**Note:** For testing during development, you can use Resend's test domain (`onboarding@resend.dev`), but it has sending limitations.

### 5. Get Your Resend API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Contact Form Production")
4. Select the appropriate permissions:
   - **Sending access**: Yes (required)
   - **Domain**: Select your verified domain or "All Domains"
5. Click **Add**
6. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
7. Store it securely (you'll need it in the next step)

## Worker Setup and Deployment

### 1. Configure Development Environment

For local development, create a `.dev.vars` file in the `worker/` directory:

```bash
cd worker
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your values:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
CONTACT_EMAIL_FROM=noreply@gatezh.com
CONTACT_EMAIL_TO=your.email@example.com
ALLOWED_ORIGINS=https://gatezh.com,http://localhost:1313
```

**Important:** The `.dev.vars` file is gitignored and should never be committed!

### 2. Test Worker Locally

Start the worker development server:

```bash
cd worker
bun run dev
# or
wrangler dev
```

This will start a local server (typically at `http://localhost:8787`). You can test the worker by sending POST requests to it.

### 3. Deploy Worker to Cloudflare

#### First-time Setup

1. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

2. Deploy the worker:
   ```bash
   cd worker
   wrangler deploy
   ```

3. Wrangler will output the worker URL, something like:
   ```
   https://gatezh-contact-worker.your-subdomain.workers.dev
   ```

#### Configure Production Environment Variables

Set the production environment variables using Wrangler secrets:

```bash
cd worker

# Set RESEND_API_KEY (you'll be prompted to enter the value)
wrangler secret put RESEND_API_KEY

# Set CONTACT_EMAIL_FROM
wrangler secret put CONTACT_EMAIL_FROM

# Set CONTACT_EMAIL_TO
wrangler secret put CONTACT_EMAIL_TO

# Optionally set ALLOWED_ORIGINS (non-secret, can use vars)
# Edit wrangler.toml to add under [vars]:
# ALLOWED_ORIGINS = "https://gatezh.com,http://localhost:1313"
```

**Important:** Use `wrangler secret put` for sensitive values like API keys. They will be encrypted and stored securely.

### 4. Configure Custom Domain (Optional but Recommended)

To use a custom domain like `contact.gatezh.com` instead of `workers.dev`:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on your worker (`gatezh-contact-worker`)
3. Go to **Settings** → **Triggers**
4. Under **Custom Domains**, click **Add Custom Domain**
5. Enter your subdomain (e.g., `contact.gatezh.com`)
6. Cloudflare will automatically create the DNS record
7. Click **Add Custom Domain**

### 5. Update Frontend Worker URL

Edit `content/contact.md` and update the `WORKER_URL` constant:

```javascript
const WORKER_URL = 'https://contact.gatezh.com'; // or your workers.dev URL
```

If you're using a custom domain:
```javascript
const WORKER_URL = 'https://contact.gatezh.com';
```

If you're using workers.dev:
```javascript
const WORKER_URL = 'https://gatezh-contact-worker.your-subdomain.workers.dev';
```

### 6. Build and Deploy Hugo Site

```bash
# Build Tailwind CSS
bun run build:css

# Build Hugo site
hugo

# The site is now in ./public/ and ready to deploy to Cloudflare Pages
```

## Testing the Contact Form

1. Visit your site at `https://gatezh.com/contact`
2. Fill out the form with test data
3. Click "Send Message"
4. Check your email (the address you set in `CONTACT_EMAIL_TO`)
5. You should receive a beautifully formatted email with the contact form submission

**Testing Checklist:**
- [ ] Form appears correctly with Tailwind styling
- [ ] Form is responsive and works on mobile
- [ ] All fields are required and validated
- [ ] Email format is validated
- [ ] Form shows loading state while submitting
- [ ] Success message appears after submission in green
- [ ] Email is received in your inbox with HTML formatting
- [ ] Reply-to address is set to the form submitter's email
- [ ] Form is reset after successful submission
- [ ] Error message appears in red if something goes wrong
- [ ] CORS works correctly from your domain

## Development Workflow

### Working with Tailwind CSS

```bash
# Watch for CSS changes during development
bun run watch:css

# Build CSS for production
bun run build:css
```

The Tailwind config (`tailwind.config.js`) is set up to scan all Hugo content, layouts, and theme files for class usage.

### Working with the Worker

```bash
# Start local development server
cd worker
wrangler dev

# Deploy to production
wrangler deploy

# View logs
wrangler tail

# Check deployment status
wrangler deployments list
```

### Build Everything

```bash
# Build both CSS and Hugo site
bun run build
```

## Troubleshooting

### Worker deployment fails

**Issue**: `wrangler deploy` fails with authentication error

**Solution**:
```bash
wrangler login
```
Follow the browser authentication flow.

### Form submission fails with CORS error

**Issue**: Browser console shows CORS error

**Solutions**:
1. Check that your domain is in the `ALLOWED_ORIGINS` environment variable
2. Verify the worker is deployed and accessible
3. Check browser DevTools Network tab for the actual error

### Form submission fails with "Server configuration error"

**Cause**: `RESEND_API_KEY` is not set or is incorrect

**Solution**:
```bash
cd worker
wrangler secret put RESEND_API_KEY
```
Enter your Resend API key when prompted.

### Email is not received

1. **Check Resend Dashboard**:
   - Go to Resend → **Emails** to see if the email was sent
   - Check for any errors or bounces

2. **Verify Domain**:
   - Ensure your domain is verified in Resend
   - Check that DNS records are properly configured
   - Use `dig TXT _dmarc.gatezh.com` to verify DNS propagation

3. **Check Email Address**:
   - Verify `CONTACT_EMAIL_TO` is set correctly
   - Check your spam/junk folder

4. **API Key Permissions**:
   - Ensure the API key has sending permissions
   - Verify it's associated with the correct domain

### Tailwind styles not applying

**Issue**: Form looks unstyled

**Solutions**:
1. Ensure CSS is built: `bun run build:css`
2. Check that `/static/css/tailwind.css` exists
3. Verify the CSS file is being served by Hugo
4. Check browser DevTools to see if CSS file loads (200 status)
5. Hard refresh the page (Cmd/Ctrl + Shift + R)

### Worker returns 404

**Issue**: Worker returns "Not found" error

**Solution**:
- Worker only accepts POST requests to the root path `/`
- Verify you're making a POST request, not GET
- Check the `WORKER_URL` in your contact form JavaScript

## File Structure

```
blog/
├── assets/
│   └── css/
│       └── input.css                # Tailwind CSS input file
├── content/
│   └── contact.md                   # Contact form page with Tailwind
├── worker/
│   ├── index.ts                     # Cloudflare Worker code
│   ├── wrangler.toml                # Worker configuration
│   ├── .dev.vars.example            # Example dev environment variables
│   ├── .dev.vars                    # Local dev environment (gitignored)
│   └── .gitignore                   # Worker-specific gitignore
├── static/
│   └── css/
│       └── tailwind.css             # Generated Tailwind CSS (gitignored)
├── docs/
│   └── contact-form-setup.md        # This documentation
├── package.json                     # Bun dependencies and scripts
├── tailwind.config.js               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
├── hugo.yaml                        # Hugo config (includes contact button)
└── .gitignore                       # Project gitignore
```

## Scripts Reference

All scripts are in `package.json` and use Bun:

- `bun run dev` - Start Hugo development server
- `bun run build` - Build Tailwind CSS and Hugo site
- `bun run build:css` - Build Tailwind CSS (one-time)
- `bun run watch:css` - Watch and rebuild CSS on changes
- `bun run worker:dev` - Start worker development server
- `bun run worker:deploy` - Deploy worker to Cloudflare

## Security Considerations

### API Key Security

- ✅ **DO**: Use `wrangler secret put` for production API keys
- ✅ **DO**: Use `.dev.vars` for local development (gitignored)
- ❌ **DON'T**: Commit API keys to version control
- ❌ **DON'T**: Put API keys in `wrangler.toml` or environment files
- ✅ **DO**: Rotate the key immediately if it's ever exposed

### Input Validation

The worker includes comprehensive validation:
- Email format validation with regex
- Length limits on all fields (name: 100, email: 254, subject: 200, message: 10000)
- HTML escaping to prevent XSS
- Type checking for all inputs
- Trimming of whitespace

### CORS Configuration

- Worker validates request origin
- Only allows specified origins (default: `https://gatezh.com`, `http://localhost:1313`)
- Customize via `ALLOWED_ORIGINS` environment variable
- Preflight requests (OPTIONS) are handled correctly

### Rate Limiting

Consider adding rate limiting to prevent abuse:

1. **Cloudflare Rate Limiting** (recommended):
   - Go to Security → WAF → Rate limiting rules
   - Create a rule for your worker URL
   - Example: 5 requests per minute per IP

2. **Resend Limits**:
   - Free tier: 100 emails/day, 3,000 emails/month
   - Monitor usage in Resend dashboard

### Spam Protection

Consider adding:
- Honeypot field (hidden field that bots fill out)
- Google reCAPTCHA v3
- Cloudflare Turnstile (Cloudflare's CAPTCHA alternative)
- Time-based validation (reject submissions too fast)

## Cost Considerations

### Free Tier Limits

- **Cloudflare Workers**: 100,000 requests/day (free plan)
- **Resend**: 100 emails/day, 3,000 emails/month (free plan)
- **Cloudflare Pages**: Unlimited requests (free plan)

### Paid Plans

- **Resend**: Starts at $20/month for 50,000 emails
- **Cloudflare Workers**: $5/month for 10 million requests (Workers Paid plan)

For a personal blog, the free tiers should be more than sufficient.

## Monitoring and Analytics

### Cloudflare Dashboard

1. Go to Workers & Pages → Your Worker
2. View real-time analytics:
   - Request count
   - Success rate
   - Errors
   - Response time

### Resend Dashboard

Monitor:
- Email delivery status
- Bounce rate
- Complaint rate
- Sending volume

### Wrangler Tail (Live Logs)

View live logs from your worker:

```bash
cd worker
wrangler tail
```

This shows `console.log()` output and errors in real-time.

## Customization

### Changing Email Template

The email template is defined in the `generateEmailHTML()` function in `worker/index.ts`. The template includes:
- Gradient header with purple theme
- Clean, modern design
- Responsive layout
- Proper email client compatibility

To customize:
1. Edit the HTML/CSS in `generateEmailHTML()`
2. Test with different email clients
3. Deploy the updated worker

### Changing Form Fields

To add or modify form fields:

1. **Update TypeScript Interface** (`worker/index.ts`):
   ```typescript
   interface ContactFormData {
     name: string;
     email: string;
     subject: string;
     message: string;
     // Add new field:
     phone?: string;
   }
   ```

2. **Update Validation** (`validateFormData()` function):
   ```typescript
   if (phone && typeof phone !== 'string') {
     return false;
   }
   ```

3. **Update Email Template** (`generateEmailHTML()` function):
   ```html
   <div class="field">
     <span class="label">Phone</span>
     <div class="value">${escapeHtml(formData.phone || 'N/A')}</div>
   </div>
   ```

4. **Update Frontend Form** (`content/contact.md`):
   ```html
   <div>
     <label for="phone" class="form-label">Phone</label>
     <input type="tel" id="phone" name="phone" class="form-input">
   </div>
   ```

5. **Update JavaScript** (in `content/contact.md`):
   ```javascript
   const formData = {
     // ... existing fields
     phone: form.phone.value.trim()
   };
   ```

### Customizing Tailwind Theme

Edit `tailwind.config.js` to customize colors, spacing, etc:

```javascript
theme: {
  extend: {
    colors: {
      // Add custom colors
      brand: '#667eea',
    },
  },
},
```

Then rebuild CSS:
```bash
bun run build:css
```

### Adding CAPTCHA

To add Google reCAPTCHA v3:

1. Get reCAPTCHA site and secret keys from Google
2. Add reCAPTCHA script to the contact form
3. Get token before form submission
4. Send token with form data
5. Verify token in the worker using Google's API
6. Reject submission if score is too low

## CI/CD Integration

### Cloudflare Pages (Hugo Site)

Cloudflare Pages can auto-deploy from GitHub:

1. Connect repository to Cloudflare Pages
2. Set build command: `bun run build`
3. Set output directory: `public`
4. Add environment variable: `BUN_VERSION=latest`

### Worker Auto-Deployment

Option 1: **GitHub Actions**

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Worker

on:
  push:
    branches: [main]
    paths:
      - 'worker/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Deploy Worker
        run: |
          cd worker
          bun install
          wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Option 2: **Manual Deployment**

Deploy manually when worker code changes:
```bash
cd worker
wrangler deploy
```

## Support and Resources

### Documentation

- [Resend Docs](https://resend.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Bun Docs](https://bun.sh/docs)

### Useful Commands

```bash
# View Wrangler help
wrangler --help

# List all deployments
wrangler deployments list

# Rollback to previous deployment
wrangler rollback

# View environment variables
wrangler secret list

# Delete a secret
wrangler secret delete RESEND_API_KEY
```

### Getting Help

For issues with:
- **Resend**: Check [Resend Documentation](https://resend.com/docs) or contact support
- **Cloudflare Workers**: Check [Workers Documentation](https://developers.cloudflare.com/workers/)
- **Tailwind CSS**: Check [Tailwind Documentation](https://tailwindcss.com/docs)
- **This Implementation**: Check the code comments or create an issue in the repository

## Changelog

### Version 2.0 (Current)

- ✅ Standalone Cloudflare Worker (instead of Pages Function)
- ✅ Tailwind CSS for modern, responsive styling
- ✅ Bun for package management and build scripts
- ✅ TypeScript with strict type checking
- ✅ Enhanced email template with gradient design
- ✅ Comprehensive input validation and security
- ✅ CORS configuration with origin validation
- ✅ Development environment support with `.dev.vars`
- ✅ Custom domain support
- ✅ Detailed documentation and troubleshooting

### Version 1.0 (Previous)

- Cloudflare Pages Function
- Inline CSS styling
- Basic email template
