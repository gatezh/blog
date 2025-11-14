# Contact Form Setup Guide

This guide explains how to set up and configure the contact form with Cloudflare Workers and Resend email service.

## Architecture

The contact form consists of three main components:

1. **Frontend Form** (`content/contact.md`): A Hugo page with an HTML form that collects user input
2. **Cloudflare Pages Function** (`functions/api/contact.ts`): A serverless function that processes form submissions
3. **Resend API**: Email delivery service that sends the contact form submissions to your inbox

## Prerequisites

- Cloudflare Pages project (already set up)
- Resend account (free tier available)
- Domain verified with Resend for sending emails

## Setup Instructions

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up for a free account
2. Verify your email address
3. Complete the onboarding process

### 2. Verify Your Domain with Resend

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

**Note:** For testing during development, you can use Resend's default test domain (`onboarding@resend.dev`), but it has sending limitations.

### 3. Get Your Resend API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Contact Form Production")
4. Select the appropriate permissions:
   - **Sending access**: Yes (required)
   - **Domain**: Select your verified domain or "All Domains"
5. Click **Add**
6. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
7. Store it securely (you'll need it in the next step)

### 4. Configure Environment Variables in Cloudflare

You need to set three environment variables in your Cloudflare Pages project:

1. Go to the Cloudflare Dashboard
2. Navigate to **Pages** → Select your project (`gatezh-com`)
3. Go to **Settings** → **Environment variables**
4. Add the following variables for the **Production** environment:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxx` | Your Resend API key from step 3 |
| `CONTACT_EMAIL_FROM` | `noreply@gatezh.com` | The email address that will appear as the sender (must be from your verified domain) |
| `CONTACT_EMAIL_TO` | `your-email@example.com` | Your email address where you want to receive contact form submissions |

5. Click **Save** for each variable

**Important Notes:**
- The `CONTACT_EMAIL_FROM` must use your verified domain
- The `CONTACT_EMAIL_TO` can be any valid email address (Gmail, Outlook, etc.)
- You can also set these variables for **Preview** environment if you want to test with preview deployments

### 5. Deploy the Changes

The contact form is already included in your repository. To deploy:

```bash
# Build the site locally (optional, for testing)
hugo

# Commit and push the changes
git add .
git commit -m "Add contact form with Cloudflare Workers and Resend integration"
git push
```

Cloudflare Pages will automatically build and deploy your site with the new contact form.

### 6. Test the Contact Form

1. Visit your site at `https://gatezh.com/contact`
2. Fill out the form with test data
3. Click "Send Message"
4. Check your email (the address you set in `CONTACT_EMAIL_TO`)
5. You should receive an email with the contact form submission

**Testing Checklist:**
- [ ] Form appears correctly on the page
- [ ] All fields are required and validated
- [ ] Email format is validated
- [ ] Form shows loading state while submitting
- [ ] Success message appears after submission
- [ ] Email is received in your inbox
- [ ] Reply-to address is set to the form submitter's email
- [ ] Form is reset after successful submission
- [ ] Error message appears if something goes wrong

## Troubleshooting

### Form submission fails with "Server configuration error"

- **Cause**: `RESEND_API_KEY` is not set or is incorrect
- **Solution**: Check that the environment variable is set correctly in Cloudflare Pages settings

### Email is not received

1. **Check Resend Dashboard**:
   - Go to Resend → **Emails** to see if the email was sent
   - Check for any errors or bounces

2. **Verify Domain**:
   - Ensure your domain is verified in Resend
   - Check that DNS records are properly configured

3. **Check Email Address**:
   - Verify `CONTACT_EMAIL_TO` is set to the correct email
   - Check your spam/junk folder

4. **API Key Permissions**:
   - Ensure the API key has sending permissions
   - Verify it's associated with the correct domain

### Form shows CORS errors

- **Cause**: CORS headers are not properly set
- **Solution**: The worker already includes CORS headers, but if you're testing locally, you may need to deploy to Cloudflare Pages to test properly

### "Invalid form data" error

- **Cause**: Form validation is failing
- **Solution**: Ensure all fields are filled out correctly:
  - Name: Cannot be empty
  - Email: Must be a valid email format
  - Subject: Cannot be empty
  - Message: Cannot be empty

## Security Considerations

1. **API Key Security**:
   - Never commit the Resend API key to version control
   - Only store it in Cloudflare environment variables
   - Rotate the key if it's ever exposed

2. **Input Validation**:
   - The worker validates all form inputs
   - Email addresses are validated with a regex
   - HTML content is escaped to prevent XSS

3. **Rate Limiting**:
   - Consider adding rate limiting to prevent spam (can be done with Cloudflare Rate Limiting rules)
   - Resend free tier has sending limits (100 emails/day)

4. **Spam Protection**:
   - Consider adding a honeypot field or CAPTCHA for additional spam protection
   - Monitor your Resend dashboard for suspicious activity

## Cost Considerations

- **Resend Free Tier**: 100 emails/day, 3,000 emails/month
- **Cloudflare Pages Functions**: 100,000 requests/day on free plan
- **Resend Paid Plan**: Starts at $20/month for 50,000 emails

For a personal blog, the free tier should be more than sufficient.

## Monitoring

1. **Resend Dashboard**: Monitor email delivery, bounces, and complaints
2. **Cloudflare Analytics**: Track function invocations and errors
3. **Cloudflare Logs**: View detailed logs for debugging (requires Logpush)

## File Structure

```
blog/
├── content/
│   └── contact.md              # Contact form page
├── functions/
│   └── api/
│       └── contact.ts          # Cloudflare Pages Function
├── docs/
│   └── contact-form-setup.md   # This documentation
└── hugo.yaml                   # Hugo config (includes contact button)
```

## API Endpoint

- **URL**: `https://gatezh.com/api/contact`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Test Subject",
    "message": "Test message content"
  }
  ```
- **Success Response** (200):
  ```json
  {
    "success": true,
    "message": "Your message has been sent successfully!",
    "id": "email-id-from-resend"
  }
  ```
- **Error Response** (400/500):
  ```json
  {
    "error": "Error message"
  }
  ```

## Customization

### Changing Email Template

The email template is defined in the `generateEmailHTML()` function in `functions/api/contact.ts`. You can customize:
- HTML structure
- Styling
- Fields displayed
- Formatting

### Changing Form Fields

To add or modify form fields:
1. Update the HTML form in `content/contact.md`
2. Update the TypeScript interfaces in `functions/api/contact.ts`
3. Update validation logic in `validateFormData()`
4. Update email template in `generateEmailHTML()`

### Adding CAPTCHA

To add Google reCAPTCHA or similar:
1. Add the CAPTCHA widget to the form
2. Verify the CAPTCHA token in the worker before sending email
3. Add CAPTCHA site key to environment variables

## Support

For issues with:
- **Resend**: Check [Resend Documentation](https://resend.com/docs) or contact their support
- **Cloudflare Workers**: Check [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- **This Implementation**: Check the code comments or create an issue in the repository

## References

- [Resend Documentation](https://resend.com/docs)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Cloudflare Tutorial: Send emails with Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/)
