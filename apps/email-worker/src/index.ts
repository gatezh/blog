import { Resend } from "resend";

interface Env {
  // Secrets (set via wrangler secret put)
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGIN: string;

  // Environment variables
  TO_EMAIL: string;
  FROM_EMAIL: string;
}

interface ContactFormData {
  name: string;
  email: string;
  subject?: string;
  message: string;
  turnstileToken: string;
}

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

// Validate Turnstile token
async function verifyTurnstile(
  token: string,
  secretKey: string,
  ip: string | null
): Promise<{ success: boolean; error?: string }> {
  const formData = new URLSearchParams();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (ip) {
    formData.append("remoteip", ip);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    }
  );

  const result: TurnstileVerifyResponse = await response.json();

  if (!result.success) {
    return {
      success: false,
      error: `Turnstile verification failed: ${result["error-codes"]?.join(", ") || "Unknown error"}`,
    };
  }

  return { success: true };
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize input to prevent injection
function sanitize(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Create CORS headers
function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // Allow the specific origin or localhost for development
  const isAllowed =
    origin === allowedOrigin ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    try {
      const data: ContactFormData = await request.json();

      // Validate required fields
      if (!data.name || !data.email || !data.message || !data.turnstileToken) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          }
        );
      }

      // Validate email format
      if (!isValidEmail(data.email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email address" }),
          {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          }
        );
      }

      // Verify Turnstile token
      const clientIP = request.headers.get("CF-Connecting-IP");
      const turnstileResult = await verifyTurnstile(
        data.turnstileToken,
        env.TURNSTILE_SECRET_KEY,
        clientIP
      );

      if (!turnstileResult.success) {
        return new Response(
          JSON.stringify({
            error: "Captcha verification failed. Please try again.",
          }),
          {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          }
        );
      }

      // Sanitize inputs
      const safeName = sanitize(data.name);
      const safeEmail = sanitize(data.email);
      const safeSubject = data.subject ? sanitize(data.subject) : null;
      const safeMessage = sanitize(data.message);

      // Build email content
      const subjectLine = safeSubject
        ? `<p><strong>Subject:</strong> ${safeSubject}</p>`
        : "";

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
    .field { margin-bottom: 20px; }
    .field strong { color: #3b82f6; }
    .message { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New Contact Form Submission</h1>
    </div>
    <div class="content">
      <div class="field">
        <p><strong>Name:</strong> ${safeName}</p>
      </div>
      <div class="field">
        <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
      </div>
      ${subjectLine ? `<div class="field">${subjectLine}</div>` : ""}
      <div class="field">
        <p><strong>Message:</strong></p>
        <div class="message">${safeMessage}</div>
      </div>
      <div class="footer">
        <p>This message was sent via the contact form on gatezh.com</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const textContent = `New Contact Form Submission

Name: ${data.name}
Email: ${data.email}
${safeSubject ? `Subject: ${data.subject}\n` : ""}
Message:
${data.message}

---
This message was sent via the contact form on gatezh.com`;

      // Send email via Resend
      const resend = new Resend(env.RESEND_API_KEY);

      const emailSubject = safeSubject
        ? `Contact: ${safeSubject}`
        : `Contact from ${safeName}`;

      const { data: emailData, error } = await resend.emails.send({
        from: `Serge Gatezh Blog <${env.FROM_EMAIL}>`,
        to: env.TO_EMAIL,
        replyTo: data.email,
        subject: emailSubject,
        html: htmlContent,
        text: textContent,
      });

      if (error) {
        console.error("Resend error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to send message. Please try again later.",
          }),
          {
            status: 500,
            headers: { ...headers, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Thank you! Your message has been sent successfully.",
          id: emailData?.id,
        }),
        {
          status: 200,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "An unexpected error occurred. Please try again.",
        }),
        {
          status: 500,
          headers: { ...headers, "Content-Type": "application/json" },
        }
      );
    }
  },
};
