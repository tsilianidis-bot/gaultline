/* ============================================================
   FAULTLINE — Legal Page
   Privacy Policy + Terms of Use
   ============================================================ */
import { useState } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";

type Tab = "privacy" | "terms";

export default function Legal() {
  useSEO({
    title: "Legal — FAULTLINE",
    description: "Privacy Policy and Terms of Use for the FAULTLINE macroeconomic risk intelligence platform.",
    canonical: "/legal",
  });

  const [tab, setTab] = useState<Tab>("privacy");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#E2E8F0",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* Nav bar */}
      <header
        style={{
          borderBottom: "1px solid rgba(0,212,255,0.12)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/">
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "20px",
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            <span style={{ color: "#F0F4FF" }}>FAULT</span>
            <span style={{ color: "#00D4FF" }}>LINE</span>
          </span>
        </Link>
        <Link href="/">
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: "#64748B",
              letterSpacing: "0.1em",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            ← BACK TO SITE
          </span>
        </Link>
      </header>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Title */}
        <div style={{ marginBottom: "32px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: "#00D4FF",
              letterSpacing: "0.2em",
              marginBottom: "8px",
            }}
          >
            LEGAL
          </div>
          <h1
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 40px)",
              color: "#F0F4FF",
              margin: 0,
            }}
          >
            Legal Documents
          </h1>
          <p
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "14px",
              color: "#64748B",
              marginTop: "8px",
            }}
          >
            Last updated: May 24, 2026
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "36px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(0,212,255,0.12)",
            borderRadius: "8px",
            padding: "4px",
            width: "fit-content",
          }}
        >
          {(["privacy", "terms"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
                background: tab === t ? "rgba(0,212,255,0.12)" : "transparent",
                color: tab === t ? "#00D4FF" : "#64748B",
              }}
            >
              {t === "privacy" ? "PRIVACY POLICY" : "TERMS OF USE"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ lineHeight: 1.8 }}>
          {tab === "privacy" ? <PrivacyPolicy /> : <TermsOfUse />}
        </div>

        {/* Footer note */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "#374151",
          }}
        >
          Questions? Contact us at{" "}
          <a
            href="mailto:jt@getfaultline.live"
            style={{ color: "#00D4FF", textDecoration: "none" }}
          >
            jt@getfaultline.live
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Section heading helper ────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 700,
        fontSize: "18px",
        color: "#00D4FF",
        marginTop: "36px",
        marginBottom: "10px",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </h2>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: "14px",
        color: "#94A3B8",
        marginTop: 0,
        marginBottom: "14px",
      }}
    >
      {children}
    </p>
  );
}

// ── Privacy Policy ────────────────────────────────────────────
function PrivacyPolicy() {
  return (
    <>
      <Para>
        This Privacy Policy describes how FAULTLINE ("we", "us", or "our") collects, uses, and
        protects information you provide when using our platform at{" "}
        <a href="https://getfaultline.live" style={{ color: "#00D4FF" }}>
          getfaultline.live
        </a>
        .
      </Para>

      <SectionHeading>1. Information We Collect</SectionHeading>
      <Para>
        <strong style={{ color: "#E2E8F0" }}>Account information:</strong> When you sign in via
        Manus OAuth, we receive your name and email address from the OAuth provider. We store this
        to identify your account and manage your access tier.
      </Para>
      <Para>
        <strong style={{ color: "#E2E8F0" }}>Waitlist submissions:</strong> If you submit a
        founding access request, we collect your email address, name (optional), and any message
        you provide. This information is used solely to evaluate and respond to your request.
      </Para>
      <Para>
        <strong style={{ color: "#E2E8F0" }}>Usage data:</strong> We collect anonymized analytics
        (page views, session duration) via Manus Analytics. No personally identifiable information
        is included in analytics data.
      </Para>
      <Para>
        <strong style={{ color: "#E2E8F0" }}>Watchlist and portfolio data:</strong> Any tickers,
        notes, or portfolio entries you save are stored in our database and associated with your
        account. This data is private and not shared with third parties.
      </Para>

      <SectionHeading>2. How We Use Your Information</SectionHeading>
      <Para>We use the information we collect to:</Para>
      <ul style={{ color: "#94A3B8", fontSize: "14px", paddingLeft: "20px", marginBottom: "14px" }}>
        <li>Provide, maintain, and improve the FAULTLINE platform</li>
        <li>Manage your account and access tier</li>
        <li>Respond to founding access requests and waitlist inquiries</li>
        <li>Send transactional communications (access approvals, account notices)</li>
        <li>Monitor platform health and prevent abuse</li>
      </ul>
      <Para>
        We do not sell, rent, or share your personal information with third parties for marketing
        purposes.
      </Para>

      <SectionHeading>3. Data Storage and Security</SectionHeading>
      <Para>
        Your data is stored in a secured database hosted on Manus infrastructure. We use
        industry-standard encryption in transit (TLS) and at rest. Access to production data is
        restricted to authorized personnel only.
      </Para>
      <Para>
        Session authentication is handled via signed JWT cookies. We do not store passwords — all
        authentication is delegated to Manus OAuth.
      </Para>

      <SectionHeading>4. Third-Party Services</SectionHeading>
      <Para>
        FAULTLINE integrates with the following third-party data providers to deliver market
        intelligence:
      </Para>
      <ul style={{ color: "#94A3B8", fontSize: "14px", paddingLeft: "20px", marginBottom: "14px" }}>
        <li>
          <strong style={{ color: "#E2E8F0" }}>FRED (Federal Reserve Bank of St. Louis)</strong> —
          macroeconomic data
        </li>
        <li>
          <strong style={{ color: "#E2E8F0" }}>Polygon.io</strong> — stock market data
        </li>
        <li>
          <strong style={{ color: "#E2E8F0" }}>CoinGecko</strong> — cryptocurrency data
        </li>
        <li>
          <strong style={{ color: "#E2E8F0" }}>Google Fonts</strong> — typography
        </li>
      </ul>
      <Para>
        These services receive only the data necessary to fulfill their function (e.g., ticker
        symbols for price lookups). No personal user data is transmitted to these providers.
      </Para>

      <SectionHeading>5. Cookies</SectionHeading>
      <Para>
        We use a single session cookie to maintain your authenticated state. This cookie is
        HttpOnly, Secure, and SameSite=Lax. We do not use advertising or tracking cookies.
      </Para>

      <SectionHeading>6. Your Rights</SectionHeading>
      <Para>
        You may request deletion of your account and associated data at any time by emailing{" "}
        <a href="mailto:jt@getfaultline.live" style={{ color: "#00D4FF" }}>
          jt@getfaultline.live
        </a>
        . We will process deletion requests within 30 days.
      </Para>

      <SectionHeading>7. Changes to This Policy</SectionHeading>
      <Para>
        We may update this Privacy Policy from time to time. Material changes will be communicated
        via the platform. Continued use of FAULTLINE after changes constitutes acceptance of the
        updated policy.
      </Para>

      <SectionHeading>8. Contact</SectionHeading>
      <Para>
        For privacy-related inquiries, contact us at{" "}
        <a href="mailto:jt@getfaultline.live" style={{ color: "#00D4FF" }}>
          jt@getfaultline.live
        </a>
        .
      </Para>
    </>
  );
}

// ── Terms of Use ──────────────────────────────────────────────
function TermsOfUse() {
  return (
    <>
      <Para>
        By accessing or using FAULTLINE at{" "}
        <a href="https://getfaultline.live" style={{ color: "#00D4FF" }}>
          getfaultline.live
        </a>
        , you agree to be bound by these Terms of Use. If you do not agree, do not use the
        platform.
      </Para>

      <SectionHeading>1. Description of Service</SectionHeading>
      <Para>
        FAULTLINE is a macroeconomic risk intelligence platform that aggregates and analyzes
        publicly available financial and economic data to provide market risk signals, scenario
        analysis, and portfolio monitoring tools. The platform is intended for informational
        purposes only.
      </Para>

      <SectionHeading>2. Not Financial Advice</SectionHeading>
      <Para>
        <strong style={{ color: "#FF4444" }}>
          FAULTLINE does not provide financial, investment, legal, or tax advice.
        </strong>{" "}
        All content, signals, scores, and analysis provided by the platform are for informational
        and educational purposes only. Nothing on FAULTLINE constitutes a recommendation to buy,
        sell, or hold any security, cryptocurrency, or other financial instrument.
      </Para>
      <Para>
        You are solely responsible for your own investment decisions. Always consult a qualified
        financial advisor before making investment decisions.
      </Para>

      <SectionHeading>3. Eligibility</SectionHeading>
      <Para>
        You must be at least 18 years of age to use FAULTLINE. By using the platform, you
        represent that you meet this requirement.
      </Para>

      <SectionHeading>4. Account Responsibilities</SectionHeading>
      <Para>
        You are responsible for maintaining the confidentiality of your account credentials and
        for all activity that occurs under your account. You agree to notify us immediately of any
        unauthorized use of your account at{" "}
        <a href="mailto:jt@getfaultline.live" style={{ color: "#00D4FF" }}>
          jt@getfaultline.live
        </a>
        .
      </Para>

      <SectionHeading>5. Acceptable Use</SectionHeading>
      <Para>You agree not to:</Para>
      <ul style={{ color: "#94A3B8", fontSize: "14px", paddingLeft: "20px", marginBottom: "14px" }}>
        <li>Use the platform for any unlawful purpose</li>
        <li>Attempt to gain unauthorized access to any part of the platform or its infrastructure</li>
        <li>Scrape, crawl, or systematically extract data from the platform without written permission</li>
        <li>Reverse engineer, decompile, or disassemble any part of the platform</li>
        <li>Use the platform to transmit spam, malware, or harmful content</li>
        <li>Impersonate any person or entity</li>
        <li>Interfere with or disrupt the integrity or performance of the platform</li>
      </ul>

      <SectionHeading>6. Data Accuracy</SectionHeading>
      <Para>
        FAULTLINE sources data from third-party providers (FRED, Polygon.io, CoinGecko, and
        others). While we strive for accuracy, we make no warranties regarding the completeness,
        accuracy, timeliness, or reliability of any data displayed on the platform. Market data
        may be delayed, incomplete, or contain errors.
      </Para>

      <SectionHeading>7. Intellectual Property</SectionHeading>
      <Para>
        All content, design, code, algorithms, and branding on FAULTLINE — including the
        Aftershock Engine™, Pressure Score methodology, and visual design — are the exclusive
        property of FAULTLINE and are protected by applicable intellectual property laws. You may
        not reproduce, distribute, or create derivative works without express written permission.
      </Para>

      <SectionHeading>8. Access Tiers and Payments</SectionHeading>
      <Para>
        Access to certain features requires a paid subscription or founding member status. Pricing
        and access terms are subject to change with reasonable notice. Founding member pricing is
        locked for the duration of the founding member program as described at the time of
        purchase.
      </Para>

      <SectionHeading>9. Limitation of Liability</SectionHeading>
      <Para>
        To the maximum extent permitted by law, FAULTLINE and its operators shall not be liable
        for any indirect, incidental, special, consequential, or punitive damages, including but
        not limited to loss of profits, data, or goodwill, arising from your use of or inability
        to use the platform, even if advised of the possibility of such damages.
      </Para>
      <Para>
        Our total liability to you for any claims arising from use of the platform shall not
        exceed the amount you paid to FAULTLINE in the 12 months preceding the claim.
      </Para>

      <SectionHeading>10. Disclaimer of Warranties</SectionHeading>
      <Para>
        The platform is provided "as is" and "as available" without warranties of any kind, either
        express or implied, including but not limited to implied warranties of merchantability,
        fitness for a particular purpose, and non-infringement.
      </Para>

      <SectionHeading>11. Termination</SectionHeading>
      <Para>
        We reserve the right to suspend or terminate your access to FAULTLINE at any time, with or
        without notice, for conduct that we believe violates these Terms or is harmful to other
        users, us, or third parties.
      </Para>

      <SectionHeading>12. Governing Law</SectionHeading>
      <Para>
        These Terms shall be governed by and construed in accordance with the laws of the United
        States, without regard to conflict of law principles.
      </Para>

      <SectionHeading>13. Changes to These Terms</SectionHeading>
      <Para>
        We may update these Terms from time to time. Continued use of the platform after changes
        constitutes your acceptance of the revised Terms.
      </Para>

      <SectionHeading>14. Contact</SectionHeading>
      <Para>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:jt@getfaultline.live" style={{ color: "#00D4FF" }}>
          jt@getfaultline.live
        </a>
        .
      </Para>
    </>
  );
}
