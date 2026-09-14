import { Hono } from "hono";
import { cors } from "hono/cors";
import { Resend } from "resend";

// Environment bindings type
type Env = {
  Bindings: {
    // Secrets (set via wrangler secret put)
    RESEND_API_KEY: string;
    TURNSTILE_SECRET_KEY: string;
    ALLOWED_ORIGIN: string;
    // Environment variables
    TO_EMAIL: string;
    FROM_EMAIL: string;
  };
};

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

  const result = (await response.json()) as TurnstileVerifyResponse;

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

// Build HTML email content
function buildHtmlContent(
  safeName: string,
  safeEmail: string,
  safeSubject: string | null,
  safeMessage: string
): string {
  const subjectLine = safeSubject
    ? `<p><strong>Subject:</strong> ${safeSubject}</p>`
    : "";

  return `
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
}

// Build plain text email content
function buildTextContent(
  name: string,
  email: string,
  subject: string | undefined,
  message: string
): string {
  return `New Contact Form Submission

Name: ${name}
Email: ${email}
${subject ? `Subject: ${subject}\n` : ""}
Message:
${message}

---
This message was sent via the contact form on gatezh.com`;
}

const app = new Hono<Env>();

// CORS middleware with dynamic origin checking
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.ALLOWED_ORIGIN;
      // Allow the specific origin or localhost for development
      const isAllowed =
        origin === allowedOrigin ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:");
      return isAllowed ? origin : allowedOrigin;
    },
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  })
);

// Contact form submission endpoint
app.post("/", async (c) => {
  try {
    const data = await c.req.json<ContactFormData>();

    // Validate required fields
    if (!data.name || !data.email || !data.message || !data.turnstileToken) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Validate email format
    if (!isValidEmail(data.email)) {
      return c.json({ error: "Invalid email address" }, 400);
    }

    // Verify Turnstile token
    const clientIP = c.req.header("CF-Connecting-IP") || null;
    const turnstileResult = await verifyTurnstile(
      data.turnstileToken,
      c.env.TURNSTILE_SECRET_KEY,
      clientIP
    );

    if (!turnstileResult.success) {
      return c.json(
        { error: "Captcha verification failed. Please try again." },
        400
      );
    }

    // Sanitize inputs
    const safeName = sanitize(data.name);
    const safeEmail = sanitize(data.email);
    const safeSubject = data.subject ? sanitize(data.subject) : null;
    const safeMessage = sanitize(data.message);

    // Build email content
    const htmlContent = buildHtmlContent(
      safeName,
      safeEmail,
      safeSubject,
      safeMessage
    );
    const textContent = buildTextContent(
      data.name,
      data.email,
      data.subject,
      data.message
    );

    // Send email via Resend
    const resend = new Resend(c.env.RESEND_API_KEY);

    const emailSubject = safeSubject
      ? `Contact: ${safeSubject}`
      : `Contact from ${safeName}`;

    const { data: emailData, error } = await resend.emails.send({
      from: `Serge Gatezh Blog <${c.env.FROM_EMAIL}>`,
      to: c.env.TO_EMAIL,
      replyTo: data.email,
      subject: emailSubject,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return c.json(
        { error: "Failed to send message. Please try again later." },
        500
      );
    }

    return c.json({
      success: true,
      message: "Thank you! Your message has been sent successfully.",
      id: emailData?.id,
    });
  } catch (error) {
    console.error("Worker error:", error);
    return c.json(
      { error: "An unexpected error occurred. Please try again." },
      500
    );
  }
});

// Return 405 for any other methods on root
app.all("/", (c) => {
  return c.json({ error: "Method not allowed" }, 405);
});

export default app;
