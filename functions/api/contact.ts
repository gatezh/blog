/**
 * Cloudflare Pages Function to handle contact form submissions
 * Sends emails using Resend API
 */

interface Env {
  RESEND_API_KEY: string;
  CONTACT_EMAIL_TO: string;
  CONTACT_EMAIL_FROM: string;
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
}

// CORS headers for the response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate contact form data
 */
function validateFormData(data: any): data is ContactFormData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const { name, email, subject, message } = data;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return false;
  }

  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return false;
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    return false;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return false;
  }

  return true;
}

/**
 * Send email using Resend API
 */
async function sendEmail(
  apiKey: string,
  emailData: ResendEmailPayload
): Promise<Response> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(emailData),
  });

  return response;
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(formData: ContactFormData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .header h2 {
      margin: 0;
      color: #2c3e50;
    }
    .field {
      margin-bottom: 15px;
    }
    .label {
      font-weight: bold;
      color: #555;
      display: block;
      margin-bottom: 5px;
    }
    .value {
      color: #333;
    }
    .message-box {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #007bff;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>New Contact Form Submission</h2>
  </div>

  <div class="field">
    <span class="label">From:</span>
    <span class="value">${escapeHtml(formData.name)} &lt;${escapeHtml(formData.email)}&gt;</span>
  </div>

  <div class="field">
    <span class="label">Subject:</span>
    <span class="value">${escapeHtml(formData.subject)}</span>
  </div>

  <div class="field">
    <span class="label">Message:</span>
    <div class="message-box">${escapeHtml(formData.message)}</div>
  </div>

  <div class="footer">
    This message was sent via the contact form on gatezh.com
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Handle OPTIONS request for CORS
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle POST request - process contact form
 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    // Parse request body
    const formData = await context.request.json();

    // Validate form data
    if (!validateFormData(formData)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid form data. Please check all fields and try again.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    // Check for required environment variables
    if (!context.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return new Response(
        JSON.stringify({
          error: 'Server configuration error. Please contact the administrator.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const emailFrom = context.env.CONTACT_EMAIL_FROM || 'noreply@gatezh.com';
    const emailTo = context.env.CONTACT_EMAIL_TO || 'contact@gatezh.com';

    // Prepare email payload
    const emailPayload: ResendEmailPayload = {
      from: emailFrom,
      to: emailTo,
      subject: `Contact Form: ${formData.subject}`,
      html: generateEmailHTML(formData),
      reply_to: formData.email,
    };

    // Send email via Resend
    const emailResponse = await sendEmail(
      context.env.RESEND_API_KEY,
      emailPayload
    );

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);

      return new Response(
        JSON.stringify({
          error: 'Failed to send email. Please try again later.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const result = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your message has been sent successfully!',
        id: result.id,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Error processing contact form:', error);

    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * Handle OPTIONS request for CORS preflight
 */
export async function onRequestOptions(): Promise<Response> {
  return handleOptions();
}
