/**
 * Cloudflare Worker for handling contact form submissions
 * Saves submissions to Airtable and optionally sends email notifications
 */

interface Env {
  AIRTABLE_API_KEY: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_TABLE_NAME: string;
  RESEND_API_KEY?: string; // Optional: for email notifications
  CONTACT_EMAIL_TO?: string; // Optional: for email notifications
  CONTACT_EMAIL_FROM?: string; // Optional: for email notifications
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
}

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface AirtableRecord {
  fields: {
    Name: string;
    Email: string;
    Subject: string;
    Message: string;
    'Submitted At': string;
  };
}

interface ResendEmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
}

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://gatezh.com', 'http://localhost:1313'];

  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

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

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return false;
  }

  if (!email || typeof email !== 'string' || !isValidEmail(email) || email.length > 254) {
    return false;
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0 || subject.trim().length > 200) {
    return false;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0 || message.trim().length > 10000) {
    return false;
  }

  return true;
}

/**
 * Save submission to Airtable
 */
async function saveToAirtable(
  apiKey: string,
  baseId: string,
  tableName: string,
  formData: ContactFormData
): Promise<Response> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

  const record: AirtableRecord = {
    fields: {
      Name: formData.name,
      Email: formData.email,
      Subject: formData.subject,
      Message: formData.message,
      'Submitted At': new Date().toISOString(),
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(record),
  });

  return response;
}

/**
 * Send email notification using Resend API (optional)
 */
async function sendEmailNotification(
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
 * Generate HTML email content for notifications
 */
function generateEmailHTML(formData: ContactFormData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9fafb;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .field {
      margin-bottom: 20px;
    }
    .label {
      font-weight: 600;
      color: #4b5563;
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      color: #1f2937;
      font-size: 16px;
    }
    .message-box {
      background-color: #f3f4f6;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #667eea;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #1f2937;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Contact Form Submission</h1>
    </div>

    <div class="content">
      <div class="field">
        <span class="label">From</span>
        <div class="value">${escapeHtml(formData.name)} &lt;${escapeHtml(formData.email)}&gt;</div>
      </div>

      <div class="field">
        <span class="label">Subject</span>
        <div class="value">${escapeHtml(formData.subject)}</div>
      </div>

      <div class="field">
        <span class="label">Message</span>
        <div class="message-box">${escapeHtml(formData.message)}</div>
      </div>

      <div class="footer">
        This message was sent via the contact form on <a href="https://gatezh.com">gatezh.com</a>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(
  data: any,
  status: number,
  corsHeaders: HeadersInit
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Handle OPTIONS request for CORS preflight
 */
function handleOptions(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, env),
  });
}

/**
 * Handle POST request - process contact form
 */
async function handlePost(request: Request, env: Env): Promise<Response> {
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // Parse request body
    let formData: any;
    try {
      formData = await request.json();
    } catch {
      return jsonResponse(
        { error: 'Invalid JSON in request body' },
        400,
        corsHeaders
      );
    }

    // Validate form data
    if (!validateFormData(formData)) {
      return jsonResponse(
        {
          error: 'Invalid form data. Please check all fields and try again.',
          details: 'All fields are required and must be within length limits.',
        },
        400,
        corsHeaders
      );
    }

    // Check for required Airtable configuration
    if (!env.AIRTABLE_API_KEY || !env.AIRTABLE_BASE_ID || !env.AIRTABLE_TABLE_NAME) {
      console.error('Airtable configuration is missing');
      return jsonResponse(
        { error: 'Server configuration error. Please contact the administrator.' },
        500,
        corsHeaders
      );
    }

    // Save to Airtable (primary action)
    const airtableResponse = await saveToAirtable(
      env.AIRTABLE_API_KEY,
      env.AIRTABLE_BASE_ID,
      env.AIRTABLE_TABLE_NAME,
      formData
    );

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      console.error('Airtable API error:', errorText);

      return jsonResponse(
        { error: 'Failed to save submission. Please try again later.' },
        500,
        corsHeaders
      );
    }

    const airtableResult = await airtableResponse.json();

    // Optional: Send email notification if Resend is configured
    let emailSent = false;
    if (env.RESEND_API_KEY && env.CONTACT_EMAIL_TO && env.CONTACT_EMAIL_FROM) {
      try {
        const emailPayload: ResendEmailPayload = {
          from: env.CONTACT_EMAIL_FROM,
          to: env.CONTACT_EMAIL_TO,
          subject: `Contact Form: ${formData.subject}`,
          html: generateEmailHTML(formData),
          reply_to: formData.email,
        };

        const emailResponse = await sendEmailNotification(
          env.RESEND_API_KEY,
          emailPayload
        );

        if (emailResponse.ok) {
          emailSent = true;
        } else {
          const emailError = await emailResponse.text();
          console.warn('Email notification failed:', emailError);
          // Don't fail the request if email fails - submission is already saved
        }
      } catch (emailError) {
        console.warn('Email notification error:', emailError);
        // Don't fail the request if email fails
      }
    }

    return jsonResponse(
      {
        success: true,
        message: 'Your message has been received successfully!',
        id: airtableResult.id,
        emailSent,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error('Error processing contact form:', error);

    return jsonResponse(
      { error: 'An unexpected error occurred. Please try again later.' },
      500,
      corsHeaders
    );
  }
}

/**
 * Main worker entry point
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // Only accept POST requests at root path
    if (request.method === 'POST' && url.pathname === '/') {
      return handlePost(request, env);
    }

    // Return 404 for other paths/methods
    const corsHeaders = getCorsHeaders(request, env);
    return jsonResponse(
      { error: 'Not found' },
      404,
      corsHeaders
    );
  },
};
