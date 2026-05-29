/**
 * FAULTLINE Email Helper
 * Sends transactional emails via SendGrid.
 * Falls back gracefully if SENDGRID_API_KEY is not configured.
 */

import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@getfaultline.live";
const FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "FAULTLINE";

let sgInitialized = false;

function initSendGrid() {
  if (!sgInitialized && SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    sgInitialized = true;
  }
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.warn("[Email] SENDGRID_API_KEY not configured — email not sent to:", payload.to);
    return { success: false, error: "Email service not configured. Add SENDGRID_API_KEY in Settings → Secrets." };
  }

  initSendGrid();

  try {
    await sgMail.send({
      to: payload.to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, ""),
    });
    console.log(`[Email] Sent "${payload.subject}" to ${payload.to}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Email] SendGrid error:", msg);
    return { success: false, error: msg };
  }
}

// ── Email Templates ────────────────────────────────────────────────────────────

export function buildApprovalEmail(opts: {
  name: string;
  email: string;
  siteUrl: string;
}): EmailPayload {
  const { name, siteUrl } = opts;
  const displayName = name || "there";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your FAULTLINE Access is Ready</title>
  <style>
    body { margin: 0; padding: 0; background: #050A0F; font-family: 'IBM Plex Sans', Arial, sans-serif; color: #CBD5E1; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 24px; }
    .logo { font-family: 'Rajdhani', Arial, sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 0.12em; color: #00D4FF; margin-bottom: 32px; }
    .logo span { color: #E2E8F0; }
    .card { background: #0A1520; border: 1px solid rgba(0,212,255,0.15); border-radius: 12px; padding: 32px; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3); border-radius: 6px; padding: 4px 12px; font-size: 11px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.14em; color: #00D4FF; text-transform: uppercase; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; color: #E2E8F0; margin: 0 0 12px; line-height: 1.3; }
    p { font-size: 14px; line-height: 1.7; color: #94A3B8; margin: 0 0 16px; }
    .cta { display: inline-block; background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.4); border-radius: 8px; padding: 14px 28px; font-size: 13px; font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.1em; color: #00D4FF; text-decoration: none; text-transform: uppercase; font-weight: 700; margin-top: 8px; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
    .footer { font-size: 11px; color: rgba(100,116,139,0.5); font-family: 'IBM Plex Mono', monospace; line-height: 1.6; }
    .highlight { color: #00D4FF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">FAULT<span>LINE</span></div>

    <div class="card">
      <div class="badge">⬡ Founding Access Approved</div>
      <h1>Your access is ready, ${displayName}.</h1>
      <p>
        You've been granted <span class="highlight">Founding Member</span> access to FAULTLINE — 
        full, unrestricted access to the macroeconomic risk intelligence platform.
      </p>
      <p>
        Sign in using this email address and your founding tier will be activated automatically on first login. No codes, no forms.
      </p>
      <a href="${siteUrl}" class="cta">Access FAULTLINE →</a>
    </div>

    <div class="card" style="background: rgba(0,212,255,0.03);">
      <p style="margin: 0; font-size: 13px; color: #64748B;">
        <strong style="color: #94A3B8;">What you have access to:</strong><br />
        Pressure Index · Macro Regime Engine · Signal Systems · Crypto Intelligence · 
        Aftershock Engine™ · Portfolio Monitor · Diagnostic AI · Track Record
      </p>
    </div>

    <hr class="divider" />
    <div class="footer">
      FAULTLINE — Macroeconomic Risk Intelligence<br />
      <a href="${siteUrl}" style="color: rgba(0,212,255,0.5); text-decoration: none;">getfaultline.live</a><br /><br />
      You received this because your email was approved for founding access.
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    to: opts.email,
    subject: "Your FAULTLINE Founding Access is Ready",
    html,
  };
}
