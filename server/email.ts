/**
 * FAULTLINE Email Helper
 * Sends transactional emails via SendGrid.
 * Falls back gracefully if SENDGRID_API_KEY is not configured.
 */

import sgMail from "@sendgrid/mail";

const DEFAULT_FROM_EMAIL = "jt@getfaultline.live";
const DEFAULT_FROM_NAME = "FAULTLINE";

let _initializedKey = "";

/** Read env vars lazily so tests can override process.env after module load. */
function initSendGrid(apiKey: string) {
  if (_initializedKey !== apiKey) {
    sgMail.setApiKey(apiKey);
    _initializedKey = apiKey;
  }
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY ?? "";
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME ?? DEFAULT_FROM_NAME;

  if (!apiKey) {
    console.warn("[Email] SENDGRID_API_KEY not configured — email not sent to:", payload.to);
    return { success: false, error: "Email service not configured. Add SENDGRID_API_KEY in Settings → Secrets." };
  }

  initSendGrid(apiKey);

  try {
    await sgMail.send({
      to: payload.to,
      from: { email: fromEmail, name: fromName },
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

// ── Contact Form Email Template ────────────────────────────────────────────────
export function buildContactEmail(opts: {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: string;
}): EmailPayload {
  const { name, email, subject, message, category } = opts;
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:24px;}
.badge{display:inline-block;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#F59E0B;text-transform:uppercase;margin-bottom:20px;}
.fl{font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#00D4FF;text-transform:uppercase;margin-bottom:4px;}
.fv{font-size:14px;color:#E2E8F0;margin-bottom:20px;line-height:1.6;}
.msg{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:16px;font-size:14px;color:#CBD5E1;line-height:1.7;white-space:pre-wrap;}
.btn{display:inline-block;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);border-radius:8px;padding:12px 24px;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">⬡ New Contact Inquiry</div>
<div class="fl">From</div><div class="fv">${name} &lt;${email}&gt;</div>
<div class="fl">Category</div><div class="fv">${category}</div>
<div class="fl">Subject</div><div class="fv">${subject}</div>
<div class="fl">Message</div>
<div class="msg">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<br/><a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="btn">Reply to ${name} →</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<div class="fl">Received</div>
<div class="fv" style="margin-bottom:0;font-size:13px;color:#64748B;">${now} ET</div>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE — Macroeconomic Risk Intelligence<br/>Submitted via Contact Us form at getfaultline.live</div>
</div></body></html>`;
  return {
    to: "jt@getfaultline.live",
    subject: `[FAULTLINE Contact] ${category}: ${subject}`,
    html,
  };
}

// ── Contact Auto-Reply Template ────────────────────────────────────────────────
export function buildContactAutoReply(opts: {
  name: string;
  email: string;
  subject: string;
}): EmailPayload {
  const { name, email, subject } = opts;
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:24px;}
.badge{display:inline-block;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#00D4FF;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:20px;font-weight:700;color:#E2E8F0;margin:0 0 12px;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">⬡ Message Received</div>
<h1>We got your message, ${name}.</h1>
<p>Your inquiry regarding <strong style="color:#E2E8F0;">"${subject}"</strong> has been received. We typically respond within 24–48 hours.</p>
<p>In the meantime, explore the platform at <a href="https://getfaultline.live" style="color:#00D4FF;">getfaultline.live</a>.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE — Macroeconomic Risk Intelligence<br/><a href="https://getfaultline.live" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a></div>
</div></body></html>`;
  return {
    to: email,
    subject: `We received your message — FAULTLINE`,
    html,
  };
}

// ── Welcome Email Template (first login) ──────────────────────────────────────
export function buildWelcomeEmail(opts: {
  name: string;
  email: string;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name?.trim() || "there";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:24px;}
.badge{display:inline-block;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#00D4FF;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:22px;font-weight:700;color:#E2E8F0;margin:0 0 12px;line-height:1.3;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.feature-row{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;}
.feature-icon{font-size:16px;margin-top:2px;flex-shrink:0;}
.feature-text{font-size:13px;color:#CBD5E1;line-height:1.5;}
.feature-label{font-weight:700;color:#E2E8F0;}
.cta{display:inline-block;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);border-radius:8px;padding:14px 28px;font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">&#x2B21; Access Granted</div>
<h1>Welcome to FAULTLINE, ${displayName}.</h1>
<p>You're now inside the intelligence terminal. Here's what you have access to:</p>
<div class="feature-row"><div class="feature-icon">&#x2B21;</div><div class="feature-text"><span class="feature-label">Pressure Index</span> — Real-time systemic market pressure across 8 risk vectors.</div></div>
<div class="feature-row"><div class="feature-icon">&#x2B21;</div><div class="feature-text"><span class="feature-label">Diagnostic AI</span> — Today, week, month, and year-level market regime interpretation.</div></div>
<div class="feature-row"><div class="feature-icon">&#x2B21;</div><div class="feature-text"><span class="feature-label">Signals Screener</span> — AI-scored stock signals with RSI, MACD, and regime weighting.</div></div>
<div class="feature-row"><div class="feature-icon">&#x2B21;</div><div class="feature-text"><span class="feature-label">Crypto Intelligence</span> — Systemic risk, alt rotation, and on-chain signal analysis.</div></div>
<br/>
<a href="${siteUrl}/app" class="cta">Enter the Terminal &#x2192;</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<p style="margin:0;font-size:13px;color:#64748B;">Questions? Reply to this email or visit <a href="${siteUrl}/contact" style="color:#00D4FF;">getfaultline.live/contact</a>.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &#x2014; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a></div>
</div></body></html>`;
  return {
    to: email,
    subject: `Welcome to FAULTLINE — Your access is ready`,
    html,
  };
}

// ── Subscription Confirmation Email Template ───────────────────────────────────
export function buildSubscriptionConfirmationEmail(opts: {
  name: string;
  email: string;
  planName: string;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, planName, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name?.trim() || "there";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:24px;}
.badge{display:inline-block;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#22C55E;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:22px;font-weight:700;color:#E2E8F0;margin:0 0 12px;line-height:1.3;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.plan-box{background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:16px 20px;margin-bottom:20px;}
.plan-label{font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#00D4FF;text-transform:uppercase;margin-bottom:4px;}
.plan-name{font-size:18px;font-weight:700;color:#E2E8F0;}
.cta{display:inline-block;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);border-radius:8px;padding:14px 28px;font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">&#x2713; Subscription Active</div>
<h1>You're in, ${displayName}.</h1>
<p>Your subscription has been activated. Full intelligence access is now unlocked.</p>
<div class="plan-box">
<div class="plan-label">Active Plan</div>
<div class="plan-name">${planName}</div>
</div>
<p>Head back to the terminal to explore everything that's now available to you.</p>
<a href="${siteUrl}/app" class="cta">Open FAULTLINE &#x2192;</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<p style="margin:0;font-size:13px;color:#64748B;">Manage your subscription at <a href="${siteUrl}/app/account" style="color:#00D4FF;">Account Settings</a>. Questions? Reply to this email.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &#x2014; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a></div>
</div></body></html>`;
  return {
    to: email,
    subject: `Your FAULTLINE ${planName} subscription is active`,
    html,
  };
}

// ── Founding Request Owner Notification Email Template ─────────────────────────
export function buildFoundingRequestNotification(opts: {
  name: string | null;
  email: string;
  message: string | null;
  requestId: number | null;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, message, requestId, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name?.trim() || "Anonymous";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:24px;}
.badge{display:inline-block;background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#FFA500;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:22px;font-weight:700;color:#E2E8F0;margin:0 0 12px;line-height:1.3;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.field-row{margin-bottom:16px;}
.field-label{font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:.2em;color:#00D4FF;text-transform:uppercase;margin-bottom:4px;}
.field-value{font-size:14px;color:#E2E8F0;background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.1);border-radius:6px;padding:10px 14px;font-family:'IBM Plex Mono',monospace;}
.message-box{font-size:13px;color:#94A3B8;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;padding:14px;line-height:1.7;white-space:pre-wrap;}
.cta{display:inline-block;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);border-radius:8px;padding:12px 24px;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">New Founding Request</div>
<h1>New founding access request received.</h1>
<div class="field-row"><div class="field-label">Name</div><div class="field-value">${displayName}</div></div>
<div class="field-row"><div class="field-label">Email</div><div class="field-value">${email}</div></div>
${message ? `<div class="field-row"><div class="field-label">Message</div><div class="message-box">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div>` : ''}
${requestId ? `<div class="field-row"><div class="field-label">Request ID</div><div class="field-value">#${requestId}</div></div>` : ''}
<a href="${siteUrl}/app/admin" class="cta">Review in Admin Dashboard</a>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &mdash; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a></div>
</div></body></html>`;
  return {
    to: "jt@getfaultline.live",
    subject: `[FAULTLINE] New Founding Access Request — ${displayName} (${email})`,
    html,
  };
}

// ── Day 1 Drip: Pressure Index Explainer (sent ~24h after signup) ──────────────
export function buildDay1PressureEmail(opts: {
  name: string;
  email: string;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name?.trim() || "there";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:16px;}
.badge{display:inline-block;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#00D4FF;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:22px;font-weight:700;color:#E2E8F0;margin:0 0 12px;line-height:1.3;}
h2{font-size:15px;font-weight:700;color:#00D4FF;margin:24px 0 8px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.vrow{display:flex;gap:14px;margin-bottom:10px;align-items:flex-start;padding:10px;background:rgba(0,212,255,.03);border:1px solid rgba(0,212,255,.08);border-radius:8px;}
.vnum{font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:#00D4FF;min-width:22px;line-height:1.2;}
.vtitle{font-size:13px;font-weight:700;color:#E2E8F0;margin-bottom:2px;}
.vdesc{font-size:12px;color:#64748B;line-height:1.5;}
.gauge{height:8px;border-radius:4px;background:linear-gradient(90deg,#00D4FF 0%,#FFA500 50%,#FF4444 100%);margin:16px 0 6px;}
.glabel{display:flex;justify-content:space-between;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#475569;letter-spacing:.1em;}
.cta{display:inline-block;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);border-radius:8px;padding:14px 28px;font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
.hl{color:#00D4FF;font-weight:700;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">&#x2B21; Day 1 &mdash; Intelligence Brief</div>
<h1>The one number that tells you everything.</h1>
<p>Hey ${displayName} &mdash; welcome back. Yesterday you got access. Today, let's make sure you know how to use the most important tool in FAULTLINE.</p>
<p>It's called the <span class="hl">Pressure Index</span>. Here's what it is and why it matters.</p>
<h2>What is the Pressure Index?</h2>
<p>Most market tools show you price. FAULTLINE shows you <em>pressure</em> &mdash; the systemic forces building beneath the surface before they become price moves.</p>
<p>The Pressure Index is a composite score from <span class="hl">0 to 100</span> that aggregates 8 independent risk vectors in real time. Think of it as a seismograph for the financial system.</p>
<div class="gauge"></div>
<div class="glabel"><span>0 &mdash; CALM</span><span>50 &mdash; BUILDING</span><span>100 &mdash; CRITICAL</span></div>
<h2>The 8 Vectors</h2>
<div class="vrow"><div class="vnum">1</div><div><div class="vtitle">Credit Stress</div><div class="vdesc">Corporate bond spreads, HY/IG ratio, credit default swap activity.</div></div></div>
<div class="vrow"><div class="vnum">2</div><div><div class="vtitle">Liquidity Pressure</div><div class="vdesc">Fed balance sheet, bank reserves, repo market stress.</div></div></div>
<div class="vrow"><div class="vnum">3</div><div><div class="vtitle">Volatility Regime</div><div class="vdesc">VIX level and trend, vol-of-vol, term structure.</div></div></div>
<div class="vrow"><div class="vnum">4</div><div><div class="vtitle">Dollar Pressure</div><div class="vdesc">DXY trend, EM currency stress, dollar funding.</div></div></div>
<div class="vrow"><div class="vnum">5</div><div><div class="vtitle">Yield Curve Stress</div><div class="vdesc">2s10s spread, inversion depth, real yield level.</div></div></div>
<div class="vrow"><div class="vnum">6</div><div><div class="vtitle">Equity Breadth</div><div class="vdesc">% of stocks above 200-day MA, advance/decline, new highs vs lows.</div></div></div>
<div class="vrow"><div class="vnum">7</div><div><div class="vtitle">Macro Momentum</div><div class="vdesc">ISM, PMI, jobs data, consumer confidence.</div></div></div>
<div class="vrow"><div class="vnum">8</div><div><div class="vtitle">Systemic Risk</div><div class="vdesc">Bank CDS, financial sector stress, cross-asset correlation spikes.</div></div></div>
<h2>How to read it</h2>
<p><span class="hl">0&ndash;30:</span> Low pressure. Risk assets can trend. Momentum strategies work.<br/>
<span class="hl">30&ndash;55:</span> Building pressure. Watch for regime shifts. Reduce leverage.<br/>
<span class="hl">55&ndash;75:</span> Elevated. Defensive positioning. Hedge exposure.<br/>
<span class="hl">75&ndash;100:</span> Critical. Capital preservation mode. Cash is a position.</p>
<p>Open the Pressure Index now and check today's reading.</p>
<a href="${siteUrl}/app/pressure" class="cta">View Today's Pressure Index &#x2192;</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<p style="margin:0;font-size:13px;color:#64748B;">Tomorrow: why the Trader tier unlocks the signals that matter most &mdash; and what you're missing as an Observer.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &mdash; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a><br/><br/>You received this because you signed up for FAULTLINE. <a href="${siteUrl}/app/account" style="color:rgba(0,212,255,.3);text-decoration:none;">Manage preferences</a></div>
</div></body></html>`;
  return { to: email, subject: `FAULTLINE: The one number that tells you everything`, html };
}

// ── Day 2 Drip: Trader Tier Value Proposition (sent ~48h after signup) ─────────
export function buildDay2UpgradeEmail(opts: {
  name: string;
  email: string;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name?.trim() || "there";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><style>
body{margin:0;padding:0;background:#050A0F;font-family:'IBM Plex Sans',Arial,sans-serif;color:#CBD5E1;}
.container{max-width:560px;margin:0 auto;padding:40px 24px;}
.logo{font-family:'Rajdhani',Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:.12em;color:#00D4FF;margin-bottom:32px;}
.logo span{color:#E2E8F0;}
.card{background:#0A1520;border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:32px;margin-bottom:16px;}
.badge{display:inline-block;background:rgba(255,165,0,.1);border:1px solid rgba(255,165,0,.4);border-radius:6px;padding:4px 12px;font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.14em;color:#FFA500;text-transform:uppercase;margin-bottom:20px;}
h1{font-size:22px;font-weight:700;color:#E2E8F0;margin:0 0 12px;line-height:1.3;}
h2{font-size:15px;font-weight:700;color:#FFA500;margin:24px 0 8px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;}
p{font-size:14px;line-height:1.7;color:#94A3B8;margin:0 0 16px;}
.urow{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;padding:10px;background:rgba(255,165,0,.04);border:1px solid rgba(255,165,0,.1);border-radius:8px;}
.uicon{font-size:16px;min-width:22px;}
.utitle{font-size:13px;font-weight:700;color:#FFA500;margin-bottom:2px;}
.udesc{font-size:12px;color:#64748B;line-height:1.5;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th{font-size:11px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);}
th.obs{color:#475569;}th.trd{color:#FFA500;}
td{font-size:13px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);color:#94A3B8;vertical-align:top;}
td.feat{color:#E2E8F0;font-weight:600;}
td.no{color:#374151;font-family:'IBM Plex Mono',monospace;}
td.yes{color:#FFA500;font-family:'IBM Plex Mono',monospace;}
.price{text-align:center;padding:20px;background:rgba(255,165,0,.04);border:1px solid rgba(255,165,0,.15);border-radius:10px;margin:20px 0;}
.pamount{font-size:36px;font-weight:700;color:#FFA500;font-family:'IBM Plex Mono',monospace;line-height:1;}
.pperiod{font-size:13px;color:#64748B;margin-top:4px;}
.pnote{font-size:11px;color:#475569;margin-top:8px;}
.cta1{display:inline-block;background:linear-gradient(135deg,rgba(255,165,0,.2),rgba(255,165,0,.08));border:1px solid rgba(255,165,0,.6);border-radius:8px;padding:14px 28px;font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;color:#FFA500;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:8px;}
.cta2{display:inline-block;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:10px 20px;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:600;margin-top:8px;margin-left:12px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">&#x25B2; Day 2 &mdash; Upgrade Brief</div>
<h1>You're using 20% of FAULTLINE.</h1>
<p>Hey ${displayName} &mdash; you've had two days with the Observer tier. You can see the Pressure Index, the market regime, and the daily briefing.</p>
<p>Here's what you can't see yet &mdash; and why it matters for every trade you make.</p>
<h2>What the Trader tier unlocks</h2>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Opportunity Radar</div><div class="udesc">AI-ranked opportunities across equities, crypto, and macro &mdash; scored by regime fit, momentum, and risk/reward.</div></div></div>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Signal Outlook Center</div><div class="udesc">Forward-looking signal analysis: what the current regime historically produces over the next 5, 10, and 30 days.</div></div></div>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Social Intelligence</div><div class="udesc">Institutional sentiment from options flow, dark pool prints, and social signal aggregation.</div></div></div>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Insider Intelligence</div><div class="udesc">SEC Form 4 insider transactions, cluster buying signals, and executive conviction scoring.</div></div></div>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Unlimited Watchlist</div><div class="udesc">Observer tier is capped at 3 symbols. Trader gives you unlimited watchlist tracking with regime-aware alerts.</div></div></div>
<div class="urow"><div class="uicon">&#x2B21;</div><div><div class="utitle">Trade Journal</div><div class="udesc">Log trades, track P&amp;L, and get AI-powered post-trade analysis &mdash; what the regime said vs what happened.</div></div></div>
<h2>Observer vs Trader</h2>
<table>
<tr><th></th><th class="obs">Observer</th><th class="trd">Trader</th></tr>
<tr><td class="feat">Pressure Index</td><td class="yes">&#x2714;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Market Regime</td><td class="yes">&#x2714;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Daily Briefing</td><td class="yes">&#x2714;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Opportunity Radar</td><td class="no">&mdash;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Signal Outlook</td><td class="no">&mdash;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Social Intelligence</td><td class="no">&mdash;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Insider Intelligence</td><td class="no">&mdash;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Trade Journal</td><td class="no">&mdash;</td><td class="yes">&#x2714;</td></tr>
<tr><td class="feat">Watchlist symbols</td><td class="no">3</td><td class="yes">Unlimited</td></tr>
<tr><td class="feat">Ask FAULTLINE (daily)</td><td class="no">10 questions</td><td class="yes">Unlimited</td></tr>
</table>
<div class="price">
<div class="pamount">$29</div>
<div class="pperiod">per month &mdash; cancel anytime</div>
<div class="pnote">No contracts. No annual commitment required. Upgrade in 30 seconds.</div>
</div>
<a href="${siteUrl}/app/account" class="cta1">Upgrade to Trader &#x2192;</a>
<a href="${siteUrl}/app/pressure" class="cta2">Stay on Free</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<p style="margin:0;font-size:13px;color:#64748B;"><span style="color:#FFA500;font-weight:700;">Not ready yet?</span> No pressure. The Observer tier stays free forever. When the market gets volatile and you need the full picture, you'll know where to find it.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &mdash; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a><br/><br/>You received this because you signed up for FAULTLINE. <a href="${siteUrl}/app/account" style="color:rgba(0,212,255,.3);text-decoration:none;">Manage preferences</a><br/><br/><span style="color:rgba(100,116,139,.4);">This is not financial advice. FAULTLINE provides market intelligence tools for informational purposes only.</span></div>
</div></body></html>`;
  return { to: email, subject: `You're using 20% of FAULTLINE`, html };
}

// ── Day 3 Drip: Founding Member Urgency (sent ~72h after signup) ─────────────
export function buildDay3FoundingEmail(opts: {
  name: string;
  email: string;
  siteUrl?: string;
}): EmailPayload {
  const { name, email, siteUrl = "https://getfaultline.live" } = opts;
  const displayName = name ? name.split(" ")[0] : "Trader";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
body{margin:0;padding:0;background:#050608;font-family:'IBM Plex Sans',Arial,sans-serif;color:#E2E8F0;}
.container{max-width:600px;margin:0 auto;padding:32px 16px;}
.logo{font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;letter-spacing:.3em;color:#F0F4FF;margin-bottom:28px;}
.logo span{color:#00D4FF;}
.card{background:rgba(10,12,18,.98);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:28px 24px;margin-bottom:16px;}
.badge{display:inline-block;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);border-radius:4px;padding:4px 10px;font-size:9px;font-family:'IBM Plex Mono',monospace;letter-spacing:.12em;color:#FFD700;text-transform:uppercase;margin-bottom:16px;}
h1{font-size:22px;font-weight:700;color:#F0F4FF;margin:0 0 14px;line-height:1.3;}
h2{font-size:14px;font-weight:700;color:#00D4FF;margin:20px 0 10px;letter-spacing:.08em;text-transform:uppercase;}
p{font-size:14px;color:#94A3B8;line-height:1.65;margin:0 0 14px;}
.scarcity{background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.15);border-radius:8px;padding:16px 18px;margin:20px 0;}
.scarcity-label{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.15em;color:#FFD700;text-transform:uppercase;margin-bottom:6px;}
.scarcity-count{font-family:'IBM Plex Mono',monospace;font-size:28px;font-weight:700;color:#FFD700;line-height:1;}
.scarcity-sub{font-size:12px;color:rgba(255,215,0,.5);margin-top:4px;}
.compare{display:flex;gap:12px;margin:16px 0;}
.cbox{flex:1;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:14px 16px;}
.cbox.gold{background:rgba(255,215,0,.04);border-color:rgba(255,215,0,.2);}
.ctier{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px;}
.cprice{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;line-height:1;}
.csub{font-size:11px;color:#64748B;margin-top:4px;}
.cfeature{font-size:12px;color:#94A3B8;margin-top:10px;line-height:1.6;}
.cta1{display:inline-block;background:#FFD700;border-radius:8px;padding:14px 28px;font-size:13px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;color:#050608;text-decoration:none;text-transform:uppercase;font-weight:700;margin-top:20px;}
.cta2{display:inline-block;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:10px 20px;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;color:#00D4FF;text-decoration:none;text-transform:uppercase;font-weight:600;margin-top:8px;margin-left:12px;}
.divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:24px 0;}
.footer{font-size:11px;color:rgba(100,116,139,.5);font-family:'IBM Plex Mono',monospace;line-height:1.6;}
</style></head><body>
<div class="container">
<div class="logo">FAULT<span>LINE</span></div>
<div class="card">
<div class="badge">&#x25C6; Day 3 &mdash; Founding Brief</div>
<h1>47 founding spots. Then the rate goes up.</h1>
<p>Hey ${displayName} &mdash; three days in. You've seen the Pressure Index, the regime engine, and the daily briefing.</p>
<p>Here's the thing: the Founding Member rate locks your price forever. When we raise prices (and we will), you pay $49/mo regardless. That's the deal.</p>
<div class="scarcity">
<div class="scarcity-label">Founding spots remaining</div>
<div class="scarcity-count">47</div>
<div class="scarcity-sub">Rate locks at $49/mo forever &mdash; never increases</div>
</div>
<h2>Founding vs Trader vs Power</h2>
<div class="compare">
<div class="cbox">
<div class="ctier" style="color:#94A3B8;">Trader</div>
<div class="cprice" style="color:#22D3EE;">$9.99</div>
<div class="csub">/month</div>
<div class="cfeature">Core signals &amp; watchlist. Good entry point.</div>
</div>
<div class="cbox">
<div class="ctier" style="color:#00D4FF;">Power</div>
<div class="cprice" style="color:#00D4FF;">$59</div>
<div class="csub">/month</div>
<div class="cfeature">Full platform. Every engine unlocked.</div>
</div>
<div class="cbox gold">
<div class="ctier" style="color:#FFD700;">Founding</div>
<div class="cprice" style="color:#FFD700;">$49</div>
<div class="csub">/month &mdash; locked forever</div>
<div class="cfeature">Everything in Power. Rate never increases. Limited spots.</div>
</div>
</div>
<p>The Founding rate is $10/mo cheaper than Power &mdash; and it never changes. If you're going to use FAULTLINE long-term, this is the only time you can lock in at this price.</p>
<a href="${siteUrl}/#access" class="cta1">Lock In Founding &mdash; $49/mo &#x2192;</a>
<a href="${siteUrl}/app/pressure" class="cta2">Stay on Observer</a>
</div>
<div class="card" style="background:rgba(0,0,0,.2);">
<p style="margin:0;font-size:13px;color:#64748B;"><span style="color:#FFA500;font-weight:700;">No pressure.</span> The Observer tier is free forever. If you upgrade later, the Founding rate will be gone &mdash; but Trader and Power will still be available at their standard prices.</p>
</div>
<hr class="divider"/>
<div class="footer">FAULTLINE &mdash; Macroeconomic Risk Intelligence<br/><a href="${siteUrl}" style="color:rgba(0,212,255,.5);text-decoration:none;">getfaultline.live</a><br/><br/>You received this because you signed up for FAULTLINE. <a href="${siteUrl}/app/account" style="color:rgba(0,212,255,.3);text-decoration:none;">Manage preferences</a><br/><br/><span style="color:rgba(100,116,139,.4);">This is not financial advice. FAULTLINE provides market intelligence tools for informational purposes only.</span></div>
</div></body></html>`;
  return { to: email, subject: `47 founding spots left — then the rate goes up`, html };
}
