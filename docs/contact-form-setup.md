# Contact Form Setup Guide

This guide explains how to set up and configure the contact form with a standalone Cloudflare Worker, Tailwind CSS, and Airtable for submission storage.

## Architecture

The contact form consists of three main components:

1. **Frontend Form** (`content/contact.md`): A Hugo page with a Tailwind CSS-styled form that collects user input
2. **Cloudflare Worker** (`worker/index.ts`): A standalone serverless worker that processes form submissions
3. **Airtable**: A database that stores all contact form submissions in a structured table

**Optional**: Email notifications via Resend API

## Prerequisites

- Hugo static site generator
- Bun (JavaScript runtime and package manager)
- Cloudflare account with Workers enabled
- Airtable account (free tier available)
- Resend account (optional, for email notifications)

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

## Airtable Setup

### 1. Create an Airtable Account

1. Go to [airtable.com](https://airtable.com) and sign up for a free account
2. Verify your email address

### 2. Create a Base and Table

1. Click **"Add a base"** or **"Start from scratch"**
2. Name your base (e.g., "Contact Form Submissions")
3. Create a table named **"Contact Submissions"** (or your preferred name)

### 3. Configure Table Fields

Your table needs these fields (Airtable will create the first field automatically):

| Field Name | Field Type | Description |
|------------|-----------|-------------|
| Name | Single line text | Submitter's name |
| Email | Email | Submitter's email address |
| Subject | Single line text | Message subject |
| Message | Long text | The message content |
| Submitted At | Date and time | When the form was submitted |

To add fields:
1. Click the **"+"** button next to the last column
2. Choose the field type
3. Name the field exactly as shown above (case-sensitive!)
4. For "Submitted At", enable "Include a time field"

**Important**: The field names must match exactly (including capitalization and spacing) as they're used in the worker code.

### 4. Get Your Airtable API Credentials

You need three pieces of information:

#### A. Personal Access Token (API Key)

1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Click **"Create new token"**
3. Give it a name (e.g., "Contact Form Worker")
4. Under **Scopes**, add these permissions:
   - `data.records:write` (to create new records)
   - `data.records:read` (optional, for debugging)
5. Under **Access**, select your base
6. Click **"Create token"**
7. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!
   - Token format: `patXXXXXXXXXXXXXX`

#### B. Base ID

1. Go to [airtable.com/api](https://airtable.com/api)
2. Click on your base
3. Look for "The ID of this base is **appXXXXXXXXXXXXXX**" in the introduction
4. Copy the base ID (starts with `app`)

#### C. Table Name

Simply use the name of your table (e.g., "Contact Submissions")
- Must match exactly, including spaces and capitalization

## Worker Setup and Deployment

### 1. Configure Development Environment

For local development, create a `.dev.vars` file in the `worker/` directory:

```bash
cd worker
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your values:

```env
# Required
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=Contact Submissions

# Optional: for email notifications
# RESEND_API_KEY=re_xxxxxxxxxxxxx
# CONTACT_EMAIL_FROM=noreply@gatezh.com
# CONTACT_EMAIL_TO=your.email@example.com

# Optional: CORS
ALLOWED_ORIGINS=https://gatezh.com,http://localhost:1313
```

**Important:** The `.dev.vars` file is gitignored and should never be committed!

### 2. Test Worker Locally

Start the worker development server:

```bash
cd worker
wrangler dev
```

This will start a local server (typically at `http://localhost:8787`). Test it by submitting the form from your local Hugo site.

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

# Required: Airtable credentials
wrangler secret put AIRTABLE_API_KEY
wrangler secret put AIRTABLE_BASE_ID
wrangler secret put AIRTABLE_TABLE_NAME

# Optional: Email notifications via Resend
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_EMAIL_FROM
wrangler secret put CONTACT_EMAIL_TO
```

When prompted, enter each value. The secrets are encrypted and stored securely.

**Important:** Use `wrangler secret put` for sensitive values like API keys.

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

Edit `content/contact.md` and update the `WORKER_URL` constant (around line 73):

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
4. Check your Airtable base - you should see a new record!
5. If configured, check your email for a notification

**Testing Checklist:**
- [ ] Form appears correctly with Tailwind styling
- [ ] Form is responsive and works on mobile
- [ ] All fields are required and validated
- [ ] Email format is validated
- [ ] Form shows loading state while submitting
- [ ] Success message appears after submission in green
- [ ] New record appears in Airtable with all fields populated
- [ ] Timestamp is correctly recorded
- [ ] Email notification is received (if configured)
- [ ] Form is reset after successful submission
- [ ] Error message appears in red if something goes wrong
- [ ] CORS works correctly from your domain

## Optional: Email Notifications with Resend

If you want to receive email notifications in addition to Airtable storage:

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address

### 2. Verify Your Domain (for production)

To send emails from your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `gatezh.com`)
4. Add the provided DNS records (SPF, DKIM, DMARC) to Cloudflare DNS
5. Wait for verification (can take a few minutes)

**Note**: For testing, you can use Resend's test domain (`onboarding@resend.dev`).

### 3. Get Your Resend API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name and set permissions (Sending access)
4. Copy the API key immediately

### 4. Configure Worker with Resend

Add the Resend credentials to your worker:

```bash
cd worker

# For development
# Add to .dev.vars:
# RESEND_API_KEY=re_xxxxxxxxxxxxx
# CONTACT_EMAIL_FROM=noreply@gatezh.com
# CONTACT_EMAIL_TO=your.email@example.com

# For production
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_EMAIL_FROM
wrangler secret put CONTACT_EMAIL_TO
```

Now submissions will be saved to Airtable AND you'll receive email notifications!

## Development Workflow

### Working with Tailwind CSS

This project uses **Tailwind CSS v4** with CSS-based configuration (no `tailwind.config.js`).

```bash
# Watch for CSS changes during development
bun run watch:css

# Build CSS for production
bun run build:css
```

Configuration is done in `assets/css/input.css` using the `@theme` directive. See the Customization section for details.

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

**Cause**: Airtable credentials are not set or incorrect

**Solution**:
```bash
cd worker
wrangler secret put AIRTABLE_API_KEY
wrangler secret put AIRTABLE_BASE_ID
wrangler secret put AIRTABLE_TABLE_NAME
```

### Submission not appearing in Airtable

1. **Check Airtable API Status**:
   - Go to worker logs: `wrangler tail`
   - Look for error messages

2. **Verify Credentials**:
   - Double-check your Base ID (starts with `app`)
   - Verify API token has correct permissions
   - Ensure table name matches exactly (case-sensitive)

3. **Check Field Names**:
   - Field names in Airtable must match exactly:
     - `Name`, `Email`, `Subject`, `Message`, `Submitted At`
   - Check for typos, extra spaces, or capitalization differences

4. **API Token Permissions**:
   - Token must have `data.records:write` scope
   - Token must have access to the specific base

### Email notifications not working

1. **Check if Resend is configured**:
   - Email is optional - worker works without it
   - Verify `RESEND_API_KEY`, `CONTACT_EMAIL_FROM`, `CONTACT_EMAIL_TO` are set

2. **Check Resend Dashboard**:
   - Go to Resend → **Emails**
   - Look for delivery status

3. **Check logs**:
   - `wrangler tail` will show email errors as warnings
   - Failed emails don't stop submission from being saved

### Tailwind styles not applying

**Solutions**:
1. Build CSS: `bun run build:css`
2. Check `/static/css/tailwind.css` exists
3. Verify CSS loads in browser (check Network tab)
4. Hard refresh: Cmd/Ctrl + Shift + R

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
│   ├── wrangler.yaml                # Worker configuration
│   ├── .dev.vars.example            # Example dev environment variables
│   ├── .dev.vars                    # Local dev environment (gitignored)
│   └── .gitignore                   # Worker-specific gitignore
├── static/
│   └── css/
│       └── tailwind.css             # Generated Tailwind CSS (gitignored)
├── docs/
│   └── contact-form-setup.md        # This documentation
├── package.json                     # Bun dependencies and scripts
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
- ❌ **DON'T**: Put API keys in `wrangler.yaml` or environment files
- ✅ **DO**: Rotate tokens immediately if exposed
- ✅ **DO**: Use minimal permissions for Airtable tokens

### Input Validation

The worker includes comprehensive validation:
- Email format validation with regex
- Length limits on all fields (name: 100, email: 254, subject: 200, message: 10000)
- HTML escaping to prevent XSS in email notifications
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

2. **Airtable Limits**:
   - Free tier: 5 API calls per second per base
   - 1,200 records per table on free tier
   - Monitor usage in Airtable dashboard

### Spam Protection

Consider adding:
- Honeypot field (hidden field that bots fill out)
- Google reCAPTCHA v3
- Cloudflare Turnstile (Cloudflare's CAPTCHA alternative)
- Time-based validation (reject submissions too fast)

## Cost Considerations

### Free Tier Limits

- **Cloudflare Workers**: 100,000 requests/day (free plan)
- **Airtable**: 1,200 records per base, 5 API calls/sec (free plan)
- **Resend** (optional): 100 emails/day, 3,000 emails/month (free plan)

### Paid Plans

- **Airtable**: Starts at $20/month for unlimited bases
- **Cloudflare Workers**: $5/month for 10 million requests
- **Resend** (optional): Starts at $20/month for 50,000 emails

For a personal blog, the free tiers should be more than sufficient.

## Managing Submissions in Airtable

### Viewing Submissions

1. Go to [airtable.com](https://airtable.com)
2. Open your base
3. View all submissions in table format
4. Sort by "Submitted At" to see newest first

### Organizing Submissions

Create additional fields to track status:
- **Status** (Single select): New, Read, Replied, Archived
- **Priority** (Single select): Low, Medium, High
- **Notes** (Long text): Internal notes about the submission

### Creating Views

Create different views to organize submissions:
1. Click **"Grid view"** dropdown
2. Click **"Create new view"**
3. Example views:
   - **Unread**: Filter where Status = "New"
   - **High Priority**: Filter where Priority = "High"
   - **This Week**: Filter where Submitted At is within last 7 days

### Exporting Data

Export submissions as CSV:
1. Click the **"..."** menu in the top right
2. Select **"Download CSV"**
3. Choose which fields to include

## Customization

### Changing Form Fields

To add or modify form fields:

1. **Add field to Airtable table** (e.g., "Phone")

2. **Update TypeScript interfaces** (`worker/index.ts`):
   ```typescript
   interface ContactFormData {
     name: string;
     email: string;
     subject: string;
     message: string;
     phone?: string; // Add new field
   }

   interface AirtableRecord {
     fields: {
       Name: string;
       Email: string;
       Subject: string;
       Message: string;
       'Submitted At': string;
       Phone?: string; // Add new field
     };
   }
   ```

3. **Update validation** (`validateFormData()` function)

4. **Update Airtable payload** (`saveToAirtable()` function):
   ```typescript
   const record: AirtableRecord = {
     fields: {
       Name: formData.name,
       Email: formData.email,
       Subject: formData.subject,
       Message: formData.message,
       Phone: formData.phone, // Add new field
       'Submitted At': new Date().toISOString(),
     },
   };
   ```

5. **Update frontend form** (`content/contact.md`)

6. **Update email template** (if using Resend)

### Customizing Email Template

If using email notifications, customize the HTML in `generateEmailHTML()` function in `worker/index.ts`.

### Customizing Tailwind Theme

Tailwind CSS v4 uses CSS-based configuration. Edit `assets/css/input.css` to customize the theme:

```css
@theme {
  /* Add custom colors */
  --color-brand: #667eea;

  /* Or extend with CSS variables */
  --color-custom: var(--your-css-var);
}
```

Then rebuild:

```bash
bun run build:css
```

**Note**: Tailwind v4 doesn't use `tailwind.config.js` - all configuration is done in CSS using the `@theme` directive.

## CI/CD Integration

### Cloudflare Pages (Hugo Site)

Set up auto-deployment from GitHub:

1. Connect repository to Cloudflare Pages
2. Build command: `bun run build`
3. Output directory: `public`
4. Environment variable: `BUN_VERSION=latest`

### Worker Auto-Deployment

**GitHub Actions** (`.github/workflows/deploy-worker.yml`):

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
          wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Support and Resources

### Documentation

- [Airtable API Docs](https://airtable.com/developers/web/api/introduction)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Bun Docs](https://bun.sh/docs)
- [Resend Docs](https://resend.com/docs) (optional)

### Useful Commands

```bash
# Wrangler
wrangler login
wrangler deploy
wrangler tail
wrangler deployments list
wrangler secret list
wrangler secret put <NAME>
wrangler secret delete <NAME>
wrangler rollback

# Bun
bun install
bun run build
bun run build:css
bun run watch:css

# Hugo
hugo server -D
hugo
```

## Changelog

### Version 3.0 (Current)

- ✅ Airtable integration for structured data storage
- ✅ Optional email notifications via Resend
- ✅ Standalone Cloudflare Worker
- ✅ Tailwind CSS v4 with CSS-based configuration (no config file!)
- ✅ Bun for package management
- ✅ TypeScript with strict type checking
- ✅ Pinned dependency versions in package.json
- ✅ Comprehensive input validation and security
- ✅ CORS configuration with origin validation
- ✅ Detailed Airtable setup documentation

### Version 2.0

- Standalone Cloudflare Worker (instead of Pages Function)
- Tailwind CSS styling
- Resend email integration
- Bun configuration

### Version 1.0

- Cloudflare Pages Function
- Inline CSS styling
- Basic email template
