# Contact Form Worker

A Cloudflare Worker that handles contact form submissions with Airtable storage and optional email notifications via Resend.

## Features

- 🗄️ **Airtable Storage**: All submissions stored in a structured Airtable database
- 📧 **Optional Email Notifications**: Send email notifications via Resend (optional)
- 🔒 **Security**: Input validation, XSS prevention, CORS configuration
- ✅ **Type-Safe**: Written in TypeScript with strict typing
- 🧪 **Tested**: Unit tests with Vitest and Cloudflare Workers test environment
- 🎨 **Code Quality**: EditorConfig, Prettier, and TypeScript for consistent code

## Project Structure

```
worker/
├── src/
│   └── index.ts              # Main worker code
├── test/
│   └── index.test.ts         # Unit tests
├── .dev.vars.example         # Example environment variables
├── .editorconfig             # Editor configuration
├── .gitignore                # Git ignore rules
├── .prettierrc               # Prettier configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vitest.config.mts         # Vitest test configuration
├── worker-configuration.d.ts # Worker environment types
├── wrangler.yaml             # Wrangler configuration
└── README.md                 # This file
```

## Prerequisites

- [Bun](https://bun.sh) (JavaScript runtime and package manager)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Airtable Account](https://airtable.com/signup)
- [Resend Account](https://resend.com/signup) (optional, for email notifications)

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your credentials:

```env
# Required
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=Contact Submissions

# Optional: Email notifications
RESEND_API_KEY=re_xxxxxxxxxxxxx
CONTACT_EMAIL_FROM=noreply@gatezh.com
CONTACT_EMAIL_TO=your.email@example.com

# Optional: CORS
ALLOWED_ORIGINS=https://gatezh.com,http://localhost:1313
```

### 3. Set Up Airtable

1. Create a base in Airtable
2. Create a table named "Contact Submissions"
3. Add these fields:
   - `Name` (Single line text)
   - `Email` (Email)
   - `Subject` (Single line text)
   - `Message` (Long text)
   - `Submitted At` (Date with time)
4. Get your API credentials from [airtable.com/create/tokens](https://airtable.com/create/tokens)

## Development

### Run Local Development Server

```bash
bun run dev
```

The worker will be available at `http://localhost:8787`.

### Run Tests

```bash
# Run tests once
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage
```

### Type Checking

```bash
bun run type-check
```

### Format Code

```bash
# Format all files
bun run format

# Check formatting without making changes
bun run format:check
```

## Deployment

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

### 2. Deploy to Production

```bash
bun run deploy
```

### 3. Set Production Secrets

```bash
# Required
wrangler secret put AIRTABLE_API_KEY
wrangler secret put AIRTABLE_BASE_ID
wrangler secret put AIRTABLE_TABLE_NAME

# Optional
wrangler secret put RESEND_API_KEY
wrangler secret put CONTACT_EMAIL_FROM
wrangler secret put CONTACT_EMAIL_TO
```

## API

### POST /

Submit a contact form.

**Request:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Test Subject",
  "message": "Test message"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Your message has been received successfully!",
  "id": "recXXXXXXXXXXXXXX",
  "emailSent": true
}
```

**Error Response (400/500):**

```json
{
  "error": "Error message"
}
```

### OPTIONS /

CORS preflight request.

Returns appropriate CORS headers for cross-origin requests.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AIRTABLE_API_KEY` | Yes | Airtable Personal Access Token |
| `AIRTABLE_BASE_ID` | Yes | Airtable Base ID (starts with `app`) |
| `AIRTABLE_TABLE_NAME` | Yes | Name of the Airtable table |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `CONTACT_EMAIL_FROM` | No | Sender email address |
| `CONTACT_EMAIL_TO` | No | Recipient email address |
| `ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins |

### Validation Rules

- **Name**: 1-100 characters
- **Email**: Valid email format, max 254 characters
- **Subject**: 1-200 characters
- **Message**: 1-10,000 characters

## Scripts Reference

| Script | Description |
|--------|-------------|
| `bun run dev` | Start local development server |
| `bun run deploy` | Deploy to Cloudflare |
| `bun run test` | Run tests once |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Run tests with coverage report |
| `bun run type-check` | Run TypeScript type checking |
| `bun run format` | Format code with Prettier |
| `bun run format:check` | Check code formatting |
| `bun run lint` | Run linter (TypeScript check) |

## Troubleshooting

### Tests Failing

Make sure you have all dependencies installed:

```bash
bun install
```

### Type Errors

Run type checking to see detailed errors:

```bash
bun run type-check
```

### Worker Not Deploying

1. Check you're logged in: `wrangler whoami`
2. Verify `wrangler.yaml` configuration
3. Check all required secrets are set: `wrangler secret list`

## Contributing

1. Make changes
2. Run tests: `bun run test`
3. Format code: `bun run format`
4. Type check: `bun run type-check`
5. Deploy: `bun run deploy`

## License

Private - All rights reserved

## Support

For issues or questions, see the main repository documentation at `/docs/contact-form-setup.md`.
