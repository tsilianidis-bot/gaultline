import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { useState } from "react";

// ── Press kit assets ─────────────────────────────────────────────
const PRESS_KIT_ASSETS = [
  {
    id: "company-overview",
    label: "Company Overview",
    desc: "One-page summary of Phoenix Systems and FAULTLINE.",
    type: "TXT",
    icon: "📄",
  },
  {
    id: "product-overview",
    label: "Product Overview",
    desc: "FAULTLINE platform capabilities, feature summary, and use cases.",
    type: "TXT",
    icon: "📋",
  },
  {
    id: "fact-sheet",
    label: "Fact Sheet",
    desc: "Key data points, platform metrics, and product facts.",
    type: "TXT",
    icon: "📊",
  },
  {
    id: "press-release",
    label: "Press Release",
    desc: "Official launch announcement for FAULTLINE.",
    type: "TXT",
    icon: "📰",
  },
  {
    id: "boilerplate-50",
    label: "Company Boilerplate — 50 Words",
    desc: "Approved short-form boilerplate for editorial use.",
    type: "TXT",
    icon: "📝",
  },
  {
    id: "boilerplate-150",
    label: "Company Boilerplate — 150 Words",
    desc: "Standard boilerplate for articles and publications.",
    type: "TXT",
    icon: "📝",
  },
  {
    id: "boilerplate-500",
    label: "Company Boilerplate — 500 Words",
    desc: "Long-form boilerplate for feature articles and profiles.",
    type: "TXT",
    icon: "📝",
  },
  {
    id: "outreach-email",
    label: "Media Outreach Email",
    desc: "Approved template for journalist outreach. Customise the recipient name before sending.",
    type: "TXT",
    icon: "✉️",
  },
  {
    id: "followup-email",
    label: "Follow-Up Email",
    desc: "Approved follow-up template for unanswered media inquiries.",
    type: "TXT",
    icon: "✉️",
  },
];

const BOILERPLATE_50 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. Its flagship product, FAULTLINE, is a macroeconomic risk intelligence platform that monitors systemic financial pressure in real time — helping investors understand the risk environment before markets reprice it. Available at getfaultline.live.`;

const BOILERPLATE_150 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. The company develops decision-intelligence systems designed to reduce the information asymmetry between institutional and individual decision-makers.

Its flagship product, FAULTLINE, is a macroeconomic risk intelligence platform that continuously monitors systemic stress across economic, financial, and market systems — detecting regime shifts before they become obvious. FAULTLINE provides a continuous Pressure Index™, regime classification, institutional-grade signal intelligence, and scenario analysis tools.

FAULTLINE is designed for investors, traders, and analysts who want to understand the risk environment before it reprices. The platform provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

FAULTLINE is available at getfaultline.live with tiered access for individual investors, active traders, and institutional users.

Press contact: press@getfaultline.live`;

const BOILERPLATE_500 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company focused on building intelligent platforms that transform complex information into actionable understanding. The company was founded on a straightforward observation: most individual investors are making decisions with fundamentally incomplete situational awareness. They can see price action. They can access earnings data. What they cannot easily access is a continuous, integrated view of the underlying structural conditions that drive markets — the systemic pressures, regime shifts, and macroeconomic fault lines that institutional investors monitor as a matter of course.

Phoenix Systems was created to close that gap.

The company's approach to artificial intelligence is deliberately calibrated. Phoenix Systems does not use AI to generate predictions or recommendations. It uses AI to synthesise, classify, and contextualise — to surface what is happening and what has historically happened in similar conditions, and to present that information in a form that supports human judgment rather than replacing it. Every product Phoenix Systems builds is designed to reduce information asymmetry, not to manufacture false certainty.

FAULTLINE is Phoenix Systems' flagship product and the first in a growing portfolio of decision-intelligence platforms. FAULTLINE is a macroeconomic risk intelligence platform that takes a risk-first approach to market analysis. Rather than beginning with stock selection or trading signals, FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system?

The platform continuously monitors systemic financial pressure across seven risk vectors — credit stress, liquidity conditions, volatility, yield curve dynamics, systemic risk indicators, inflation, and geopolitical exposure — and synthesises them into a single, continuously updated composite score: the Pressure Index™. The Pressure Index™ drives the platform's market regime classification engine, which categorises current conditions into one of five regimes and tracks how those regimes have historically resolved.

The Historical Analog Engine identifies historical market periods that most closely resemble current conditions and surfaces their outcome distributions — not as a single prediction, but as a range of historically plausible scenarios. Signal Intelligence provides directional signals across equities, crypto, and macro, always contextualised against the current regime. Symbol Intelligence provides deep-dive analysis for individual stocks and digital assets. The Decision Engine offers a structured framework for evaluating ideas against the current risk environment.

All FAULTLINE outputs are probabilistic rather than deterministic. The platform does not generate buy or sell signals. It generates probability-weighted assessments of current conditions, historical analog distributions, and scenario likelihoods — designed to support informed judgment, not to replace it.

FAULTLINE is available at getfaultline.live via web browser and as a Progressive Web App (PWA) on iOS and Android. The platform offers four access tiers: Free, Core, Pro, and Founding Member.

Press contact: press@getfaultline.live
Website: getfaultline.live`;

const OUTREACH_EMAIL = `Subject: FAULTLINE — Risk-First Market Intelligence Platform | Press Inquiry

Dear [Editor/Reporter Name],

I am writing on behalf of Phoenix Systems to introduce FAULTLINE, a macroeconomic risk intelligence platform that takes a fundamentally different approach to market analysis.

Most investing platforms begin with stock selection or trading signals. FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system? The platform continuously monitors systemic financial pressure across seven risk vectors and synthesises them into a single, continuously updated Pressure Index™ — giving individual investors the same quality of situational awareness that institutional participants take for granted.

FAULTLINE is available at getfaultline.live and is designed for investors, traders, and analysts who want to understand the risk environment before making investment decisions.

I would welcome the opportunity to provide a briefing, product demonstration, or embargo access ahead of any planned coverage. Full press materials — including a press release, fact sheet, product overview, and company boilerplate — are available at getfaultline.live/press.

Please let me know if you have any questions or would like to arrange a call.

Best regards,
Phoenix Systems Press Team
press@getfaultline.live
getfaultline.live/press`;

const FOLLOWUP_EMAIL = `Subject: Following Up — FAULTLINE Press Materials

Dear [Editor/Reporter Name],

I wanted to follow up on my previous note regarding FAULTLINE, Phoenix Systems' macroeconomic risk intelligence platform.

I understand your schedule is demanding. I am writing briefly to confirm that full press materials remain available at getfaultline.live/press, including a press release, company fact sheet, product overview, and company boilerplate in multiple formats.

If FAULTLINE is relevant to any upcoming coverage of financial technology, macroeconomic risk, retail investor tools, or AI applications in financial services, I would be glad to arrange a briefing or product demonstration at your convenience.

I am also available to answer any specific questions you may have about the platform, its methodology, or Phoenix Systems' broader product vision.

Thank you for your time.

Best regards,
Phoenix Systems Press Team
press@getfaultline.live
getfaultline.live/press`;

const FACT_SHEET = `FAULTLINE — Fact Sheet
Platform: Macroeconomic risk intelligence
Developer: Phoenix Systems
Website: getfaultline.live
Category: Financial intelligence / Market awareness
Primary metric: Pressure Index (0–100 composite score)
Data sources: FRED (Federal Reserve), live market feeds, institutional flow data
Key features: Pressure Index, Regime Detection, Signal Intelligence, Market Scenarios, Symbol Intelligence, Decision Engine
Availability: Web (getfaultline.live) + Progressive Web App (iOS/Android)
Pricing tiers: Free (free), Core ($9.99/mo), Pro ($59/mo), Founding ($49/mo)
Press contact: press@getfaultline.live`;

const PRESS_RELEASE = `FOR IMMEDIATE RELEASE

PHOENIX SYSTEMS LAUNCHES FAULTLINE — A MACROECONOMIC RISK INTELLIGENCE PLATFORM THAT DETECTS REGIME SHIFTS BEFORE THEY BECOME OBVIOUS

FAULTLINE gives investors, traders, and analysts a continuous Pressure Index and institutional-grade intelligence tools to understand systemic risk before markets reprice it.

[City, Date] — Phoenix Systems today announced the public launch of FAULTLINE, a macroeconomic risk intelligence platform designed to detect economic and financial regime shifts before they become obvious in price action.

Unlike traditional signals applications that focus on identifying the next winning trade, FAULTLINE takes a risk-first approach. The platform continuously monitors the economic, financial, and market fault lines where stress builds beneath the surface — providing users with a composite Pressure Index, regime classification, institutional flow data, and scenario analysis tools.

"The most valuable intelligence is not a recommendation — it is context," said a spokesperson for Phoenix Systems. "FAULTLINE is built around the principle that informed investors make better decisions when they understand the risk environment they are operating in, not just the next move to make."

FAULTLINE is available at getfaultline.live with tiered access for individual investors, active traders, and institutional users.

About Phoenix Systems
Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. FAULTLINE is its flagship product.

Press Contact
press@getfaultline.live
getfaultline.live/press

###`;

const COMPANY_OVERVIEW = `PHOENIX SYSTEMS — COMPANY OVERVIEW

Company: Phoenix Systems
Product: FAULTLINE (flagship)
Website: getfaultline.live
Category: AI-first financial intelligence

WHAT WE BUILD
Phoenix Systems develops AI-assisted intelligence systems that help people make better decisions by transforming complex data into actionable understanding. Every product we build is designed to reduce the information asymmetry between institutional and individual decision-makers.

FAULTLINE — FLAGSHIP PLATFORM
FAULTLINE is a macroeconomic risk intelligence platform that continuously monitors the economic, financial, and market fault lines where stress builds beneath the surface. It detects regime shifts before they become obvious — giving users a continuous Pressure Index, regime classification, institutional flow data, signal intelligence, and scenario analysis tools.

PHILOSOPHY
We believe the most valuable intelligence is not a recommendation — it is context. Phoenix Systems products emphasise probabilistic reasoning over binary predictions. We surface likelihoods, regimes, and stress indicators — not buy or sell signals.

DISCLAIMER
FAULTLINE is a macroeconomic risk intelligence platform. It provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

CONTACT
press@getfaultline.live
getfaultline.live/press`;

const PRODUCT_OVERVIEW = `FAULTLINE — PRODUCT OVERVIEW

Platform: Macroeconomic Risk Intelligence
Developer: Phoenix Systems
Website: getfaultline.live

WHAT FAULTLINE DOES
FAULTLINE monitors the economic, financial, and market fault lines where stress builds beneath the surface. It provides a continuous Pressure Index, regime detection, and institutional-grade intelligence tools — helping investors and traders understand the risk environment before it reprices.

CORE FEATURES

1. Pressure Index
   A composite 0–100 score synthesising macroeconomic, financial, and market stress indicators. Updated continuously. Provides regime classification (Low Risk / Moderate Risk / Elevated Risk / High Risk / Critical).

2. Signal Intelligence
   Institutional-grade signals across equities, crypto, and macro. Includes directional bias, conviction scores, and regime context.

3. Market Intelligence Scenarios
   Probabilistic scenario analysis for key macro events. Assigns likelihood scores and potential market impact to multiple outcomes.

4. Symbol Intelligence
   Deep-dive analysis for individual stocks and crypto assets. Includes pressure context, institutional flow, and signal overlay.

5. Decision Engine
   A structured decision-support tool that helps users evaluate trade ideas against the current macro regime.

6. Daily Intelligence Brief
   A daily AI-generated briefing synthesising macro conditions, key signals, and regime status.

AVAILABILITY
Web: getfaultline.live
PWA: Available on iOS and Android
Tiers: Free (free), Core ($9.99/mo), Pro ($59/mo), Founding ($49/mo)

DISCLAIMER
FAULTLINE provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

PRESS CONTACT
press@getfaultline.live`;

const ASSET_CONTENT: Record<string, string> = {
  "company-overview": COMPANY_OVERVIEW,
  "product-overview": PRODUCT_OVERVIEW,
  "fact-sheet": FACT_SHEET,
  "press-release": PRESS_RELEASE,
  "boilerplate-50": BOILERPLATE_50,
  "boilerplate-150": BOILERPLATE_150,
  "boilerplate-500": BOILERPLATE_500,
  "outreach-email": OUTREACH_EMAIL,
  "followup-email": FOLLOWUP_EMAIL,
};

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

function AssetCard({
  asset,
}: {
  asset: (typeof PRESS_KIT_ASSETS)[0];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const content = ASSET_CONTENT[asset.id] ?? "";

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        background: "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(0,212,255,0.25)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor =
          "rgba(255,255,255,0.08)")
      }
    >
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "20px" }}>{asset.icon}</span>
          <div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                fontWeight: 700,
                color: "#F0F4FF",
                marginBottom: "3px",
              }}
            >
              {asset.label}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#64748B",
              }}
            >
              {asset.desc}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "#64748B",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "3px 8px",
              borderRadius: "3px",
            }}
          >
            {asset.type}
          </span>
          <span
            style={{
              color: "#64748B",
              fontSize: "12px",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              display: "inline-block",
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {open && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "20px 24px",
          }}
        >
          <pre
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              color: "#94A3B8",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginBottom: "16px",
              background: "rgba(0,0,0,0.3)",
              padding: "16px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.05)",
              maxHeight: "320px",
              overflowY: "auto",
            }}
          >
            {content}
          </pre>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(content, setCopied);
            }}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: copied ? "#00D4FF" : "#F0F4FF",
              background: copied
                ? "rgba(0,212,255,0.1)"
                : "rgba(255,255,255,0.06)",
              border: `1px solid ${copied ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.15)"}`,
              padding: "8px 18px",
              borderRadius: "5px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? "✓ COPIED" : "COPY TEXT"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Press() {
  const [contactCopied, setContactCopied] = useState(false);

  useSEO({
    title: "Press — FAULTLINE by Phoenix Systems",
    description:
      "Press resources for FAULTLINE and Phoenix Systems. Company overview, product overview, press release, fact sheet, boilerplate, and media contact.",
    canonical: "/press",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050608",
        color: "#F0F4FF",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          borderBottom: "1px solid rgba(0,212,255,0.12)",
          background: "rgba(5,6,8,0.98)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "0 24px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8 L6 4 L10 9 L14 3"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "#F0F4FF",
              }}
            >
              FAULTLINE
            </span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.3em",
                color: "#64748B",
                paddingLeft: "8px",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              PRESS
            </span>
          </div>
          <Link
            href="/"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: "#00D4FF",
              textDecoration: "none",
            }}
          >
            ← HOME
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "80px 24px 56px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "#00D4FF",
            marginBottom: "20px",
          }}
        >
          MEDIA &amp; PRESS
        </div>
        <h1
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(24px, 4vw, 42px)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#F0F4FF",
            lineHeight: 1.15,
            marginBottom: "20px",
          }}
        >
          Press Resources
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "#94A3B8",
            lineHeight: 1.8,
            maxWidth: "600px",
          }}
        >
          All approved press materials for FAULTLINE and Phoenix Systems.
          Expand any asset to view and copy the full text. For interview
          requests, embargoed briefings, or additional assets, contact the
          press team directly.
        </p>
      </section>

      {/* ── Divider ── */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)",
          }}
        />
      </div>

      {/* ── Press Kit Assets ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "56px 24px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "#64748B",
            marginBottom: "24px",
          }}
        >
          PRESS KIT — CLICK TO EXPAND
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {PRESS_KIT_ASSETS.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      {/* ── Quick Facts ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 56px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "#64748B",
            marginBottom: "24px",
          }}
        >
          QUICK FACTS
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1px",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.07)",
          }}
        >
          {[
            { label: "PLATFORM", value: "FAULTLINE" },
            { label: "DEVELOPER", value: "Phoenix Systems" },
            { label: "CATEGORY", value: "Macroeconomic Risk Intelligence" },
            { label: "WEBSITE", value: "getfaultline.live" },
            { label: "AVAILABILITY", value: "Web + PWA (iOS / Android)" },
            { label: "TIERS", value: "Free · Core · Pro · Founding" },
          ].map((fact) => (
            <div
              key={fact.label}
              style={{
                padding: "20px 24px",
                background: "#050608",
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.3em",
                  color: "#64748B",
                  marginBottom: "8px",
                }}
              >
                {fact.label}
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  color: "#F0F4FF",
                  fontWeight: 600,
                }}
              >
                {fact.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── About Phoenix Systems ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 72px",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ About the Company
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            About Phoenix Systems
          </h2>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px",
            padding: "32px",
          }}
        >
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            Phoenix Systems is an AI-first technology company focused on building intelligent platforms that transform complex information into actionable understanding. The company develops decision-intelligence systems designed to reduce the information asymmetry between institutional and individual decision-makers.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            Phoenix Systems was founded on a straightforward observation: most individual investors are making decisions with fundamentally incomplete situational awareness. They can see price action. They can access earnings data. What they cannot easily access is a continuous, integrated view of the underlying structural conditions that drive markets — the systemic pressures, regime shifts, and macroeconomic fault lines that institutional investors monitor as a matter of course. Phoenix Systems was created to close that gap.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            The company’s approach to artificial intelligence is deliberately calibrated. Phoenix Systems does not use AI to generate predictions or recommendations. It uses AI to synthesise, classify, and contextualise — to surface what is happening and what has historically happened in similar conditions, and to present that information in a form that supports human judgment rather than replacing it.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, margin: 0 }}>
            FAULTLINE is Phoenix Systems’ flagship product and the first in a growing portfolio of decision-intelligence platforms. Each product in the portfolio applies the same core philosophy — probabilistic reasoning, regime awareness, and contextual intelligence — to domains where information asymmetry creates risk and where better awareness leads to better decisions.
          </p>
        </div>
      </section>

      {/* ── About FAULTLINE ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 72px",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ About the Platform
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            About FAULTLINE
          </h2>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px",
            padding: "32px",
          }}
        >
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            FAULTLINE is a macroeconomic risk intelligence platform that takes a risk-first approach to market analysis. Rather than beginning with stock selection or trading signals, FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system?
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            The platform continuously monitors systemic financial pressure across seven risk vectors — credit stress, liquidity conditions, volatility, yield curve dynamics, systemic risk indicators, inflation, and geopolitical exposure — and synthesises them into a single, continuously updated composite score: the Pressure Index™. The Pressure Index™ drives the platform’s market regime classification engine, which categorises current conditions into one of five regimes and tracks how those regimes have historically resolved.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            The Historical Analog Engine identifies historical market periods that most closely resemble current conditions and surfaces their outcome distributions — not as a single prediction, but as a range of historically plausible scenarios. Signal Intelligence provides directional signals across equities, crypto, and macro, always contextualised against the current regime. Symbol Intelligence provides deep-dive analysis for individual stocks and digital assets. The Decision Engine offers a structured framework for evaluating ideas against the current risk environment.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            All FAULTLINE outputs are probabilistic rather than deterministic. The platform does not generate buy or sell signals. It generates probability-weighted assessments of current conditions, historical analog distributions, and scenario likelihoods — designed to support informed judgment, not to replace it.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.7, margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            FAULTLINE is a macroeconomic risk intelligence platform. It provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice. Past performance of any indicator or signal does not guarantee future results.
          </p>
        </div>
      </section>

      {/* ── Press Release ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 72px",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ For Immediate Release
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            Press Release
          </h2>
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "10px",
            padding: "32px",
          }}
        >
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#64748B", marginBottom: "20px" }}>FOR IMMEDIATE RELEASE · PHOENIX SYSTEMS PRESS TEAM · press@getfaultline.live</p>
          <h3
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "20px",
              fontWeight: 700,
              color: "#F0F4FF",
              lineHeight: 1.3,
              marginBottom: "8px",
              letterSpacing: "0.03em",
            }}
          >
            Phoenix Systems Introduces FAULTLINE, a Risk-First Market Intelligence Platform
          </h3>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(0,212,255,0.7)", fontStyle: "italic", marginBottom: "24px", lineHeight: 1.6 }}>
            New platform gives investors a continuous view of systemic market pressure, macroeconomic regime shifts, and cross-market stress — before conditions reprice
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            Phoenix Systems, an AI-first technology company focused on decision intelligence, today announced the public availability of FAULTLINE, a macroeconomic risk intelligence platform designed to help investors understand the risk environment before making investment decisions.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            Unlike traditional investing platforms that begin with stock selection or trading signals, FAULTLINE takes a risk-first approach. The platform continuously monitors systemic financial pressure across seven distinct risk vectors — credit stress, liquidity conditions, volatility, yield curve dynamics, systemic risk indicators, inflation, and geopolitical exposure — and synthesises them into a single, continuously updated Pressure Index™.
          </p>
          <blockquote
            style={{
              borderLeft: "2px solid rgba(0,212,255,0.4)",
              paddingLeft: "20px",
              margin: "24px 0",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "15px",
              color: "#CBD5E1",
              fontStyle: "italic",
              lineHeight: 1.7,
            }}
          >
            “Better decisions begin with better awareness. Most retail investors are operating with incomplete situational awareness. They see price action, but they don’t see the underlying structural conditions that drive it. FAULTLINE is designed to close that gap.”
            <div style={{ fontStyle: "normal", fontSize: "11px", color: "#64748B", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}>PHOENIX SYSTEMS SPOKESPERSON</div>
          </blockquote>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.8, marginBottom: "16px" }}>
            FAULTLINE is available at getfaultline.live via web browser and as a Progressive Web App (PWA) on iOS and Android. The platform offers four access tiers: Free, Core, Pro, and Founding Member. Free access provides the live Pressure Index and limited signal previews at no cost.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.7, margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            FAULTLINE is a macroeconomic risk intelligence platform. It provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice. Past performance of any indicator or signal does not guarantee future results. All content is for informational purposes only.
          </p>
        </div>
      </section>

      {/* ── Download Center ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ Download Center
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0F4FF",
              margin: 0,
              letterSpacing: "0.04em",
            }}
          >
            Brand Assets
          </h2>
          <p
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "13px",
              color: "#64748B",
              margin: "8px 0 0",
              lineHeight: 1.6,
            }}
          >
            Visual assets for editorial use. All assets are cleared for editorial use with attribution. Commercial use requires written permission. Contact{" "}
            <a href="mailto:press@getfaultline.live" style={{ color: "rgba(0,212,255,0.6)", textDecoration: "none" }}>press@getfaultline.live</a>{" "}
            to request assets.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          {([
            { label: "Phoenix Systems Logo", format: "PNG", status: "pending" },
            { label: "Phoenix Systems Logo", format: "SVG", status: "pending" },
            { label: "FAULTLINE Wordmark", format: "PNG", status: "pending" },
            { label: "FAULTLINE Wordmark", format: "SVG", status: "pending" },
            { label: "FAULTLINE Icon", format: "PNG", status: "pending" },
            { label: "Dashboard Screenshot", format: "PNG", status: "pending" },
            { label: "Pressure Index Screenshot", format: "PNG", status: "pending" },
            { label: "Signal Intelligence Screenshot", format: "PNG", status: "pending" },
            { label: "Mobile PWA Screenshot", format: "PNG", status: "pending" },
            { label: "Brand Guidelines", format: "PDF", status: "pending" },
          ] as Array<{ label: string; format: string; status: string }>).map((asset, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.3)",
                    textTransform: "uppercase",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                  }}
                >
                  {asset.format}
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.1em",
                    color: "rgba(251,191,36,0.7)",
                    textTransform: "uppercase",
                  }}
                >
                  ⏳ Pending
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "12px",
                  color: "#94A3B8",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {asset.label}
              </p>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: "11px",
            color: "#4B5563",
            marginTop: "16px",
            lineHeight: 1.6,
          }}
        >
          Visual assets are in preparation. To request assets in advance of publication, contact{" "}
          <a href="mailto:press@getfaultline.live" style={{ color: "rgba(0,212,255,0.5)", textDecoration: "none" }}>press@getfaultline.live</a>.
        </p>
      </section>
      {/* ── Media Contact ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 96px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: "10px",
            padding: "40px",
            background: "rgba(0,212,255,0.03)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
            }}
          />
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "#00D4FF",
              marginBottom: "16px",
            }}
          >
            MEDIA CONTACT
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#F0F4FF",
                  marginBottom: "10px",
                }}
              >
                Phoenix Systems Press Team
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#94A3B8",
                  lineHeight: 1.7,
                  maxWidth: "460px",
                  marginBottom: "16px",
                }}
              >
                For interview requests, embargoed briefings, product
                demonstrations, or additional press materials, contact the
                Phoenix Systems press team.
              </p>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  color: "#00D4FF",
                  marginBottom: "6px",
                }}
              >
                press@getfaultline.live
              </div>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  color: "#64748B",
                }}
              >
                Response within 1 business day
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href="mailto:press@getfaultline.live"
                style={{
                  display: "inline-block",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: "#050608",
                  background: "#00D4FF",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                EMAIL PRESS TEAM →
              </a>
              <button
                onClick={() =>
                  copyToClipboard("press@getfaultline.live", setContactCopied)
                }
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: contactCopied ? "#00D4FF" : "#94A3B8",
                  background: "transparent",
                  border: `1px solid ${contactCopied ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.12)"}`,
                  padding: "10px 24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {contactCopied ? "✓ COPIED" : "COPY EMAIL"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ Press FAQ
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.04em",
              margin: 0,
            }}
          >
            Frequently Asked Questions
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {([
            {
              q: "What is FAULTLINE?",
              a: "FAULTLINE is a macroeconomic risk intelligence platform that monitors systemic financial pressure in real time. The platform aggregates data across seven risk vectors — credit stress, liquidity conditions, volatility, yield curve dynamics, systemic risk indicators, inflation, and geopolitical exposure — and synthesises them into a unified Pressure Index™ score and market regime classification. FAULTLINE is designed to help investors understand the risk environment before making investment decisions.",
            },
            {
              q: "What makes FAULTLINE different?",
              a: "Most investing platforms begin with stock selection or trading signals. FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system? Rather than providing buy or sell recommendations, FAULTLINE provides continuous situational awareness — the systemic pressure level, the current market regime, historical analogs to current conditions, and a range of probability-weighted scenarios. This risk-first approach gives investors the structural context that is typically available only to institutional participants.",
            },
            {
              q: "What is a risk-first market intelligence platform?",
              a: "A risk-first platform begins with the state of the system, not with a stock pick or a trade idea. FAULTLINE asks: what is the current level of systemic financial pressure? What regime are markets in? What has historically happened in similar conditions? Those answers form the context within which any investment decision should be evaluated. The platform does not tell users what to buy or sell. It tells them what kind of environment they are operating in.",
            },
            {
              q: "Does FAULTLINE tell users what to buy or sell?",
              a: "No. FAULTLINE does not generate buy or sell signals. The platform generates probability-weighted assessments of current conditions, historical analog distributions, and scenario likelihoods. Users are expected to apply their own judgment to these assessments in the context of their own investment objectives and risk tolerance. FAULTLINE is designed to support informed decision-making, not to replace it.",
            },
            {
              q: "Does FAULTLINE provide investment advice?",
              a: "No. FAULTLINE is a macroeconomic risk intelligence platform. It provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice. Past performance of any indicator or signal does not guarantee future results. All content is for informational and educational purposes only. Users should consult a qualified financial adviser before making investment decisions.",
            },
            {
              q: "How does FAULTLINE use AI?",
              a: "FAULTLINE uses artificial intelligence and machine learning models for regime classification, signal labelling, diagnostic summaries, historical analog identification, and the Ask Intelligence feature. AI models are used to synthesise and contextualise data — to surface what is happening and what has historically happened in similar conditions. Phoenix Systems does not use AI to generate predictions or investment recommendations. All AI-generated content is clearly labelled within the platform. AI outputs are probabilistic and may contain errors. Users are encouraged to verify AI-generated content against primary sources before making financial decisions.",
            },
            {
              q: "What is Phoenix Systems?",
              a: "Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. The company develops decision-intelligence systems designed to reduce the information asymmetry between institutional and individual decision-makers. FAULTLINE is Phoenix Systems\u2019 flagship product. The company\u2019s products are built on the principle that better decisions begin with better awareness.",
            },
            {
              q: "Why was FAULTLINE created?",
              a: "FAULTLINE was created because the most consequential information in financial markets is not the information that is most visible. Price action is visible. Earnings reports are visible. What is not easily accessible to individual investors is the underlying structural state of the financial system — the level of systemic stress, the current market regime, the historical precedents for current conditions, and the range of plausible outcomes that those precedents imply. Institutional investors have access to this information as a matter of course. Phoenix Systems created FAULTLINE to give individual investors access to the same quality of situational awareness.",
            },
          ] as Array<{ q: string; a: string }>).map((item, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                padding: "20px 22px",
              }}
            >
              <p
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#E2E8F0",
                  marginBottom: "8px",
                  letterSpacing: "0.02em",
                }}
              >
                {item.q}
              </p>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "13px",
                  color: "#94A3B8",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Disclosure ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 60px",
        }}
      >
        <div
          style={{
            background: "rgba(0,212,255,0.03)",
            border: "1px solid rgba(0,212,255,0.12)",
            borderRadius: "12px",
            padding: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "16px",
              }}
            >
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.2em",
                  color: "rgba(0,212,255,0.6)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                ◆ AI Disclosure
              </div>
              <h3
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#F0F4FF",
                  margin: "0 0 12px",
                  letterSpacing: "0.03em",
                }}
              >
                Use of Artificial Intelligence
              </h3>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "13px",
                  color: "#94A3B8",
                  lineHeight: 1.7,
                  margin: "0 0 12px",
                }}
              >
                Phoenix Systems uses artificial intelligence as a foundational component of the FAULTLINE platform. The following disclosure explains how AI is used and what it is not designed to do.
              </p>
              <ul
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "13px",
                  color: "#94A3B8",
                  lineHeight: 1.8,
                  margin: "0 0 12px",
                  paddingLeft: "20px",
                }}
              >
                <li style={{ marginBottom: "8px" }}>
                  <strong style={{ color: "#CBD5E1" }}>AI assists in software development.</strong> AI-assisted development tools are used to accelerate the engineering process, improve code quality, and identify potential issues before they reach production.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong style={{ color: "#CBD5E1" }}>AI assists in data synthesis and intelligence generation.</strong> FAULTLINE uses AI models to synthesise large volumes of heterogeneous data, classify market regimes, identify historical analogs, generate signal labels and diagnostic summaries, and power the Ask Intelligence feature. AI models are used to synthesise and contextualise data — not to generate predictions, recommendations, or investment advice.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong style={{ color: "#CBD5E1" }}>Final outputs are designed to support informed decision-making.</strong> All AI-generated content is clearly labelled within the platform. AI outputs are probabilistic and reflect historical patterns and current conditions. They are intended to augment human judgment, not replace it. Users are encouraged to verify AI-generated content against primary sources before making financial decisions.
                </li>
                <li>
                  <strong style={{ color: "#CBD5E1" }}>FAULTLINE does not guarantee predictions, investment returns, or financial outcomes.</strong> AI-generated analysis is not investment advice. Past performance of any indicator or signal does not guarantee future results. The platform's AI systems are reviewed periodically for accuracy, consistency, and potential bias.
                </li>
              </ul>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "12px",
                  color: "#64748B",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                For questions about FAULTLINE’s AI systems, methodology, or data practices, contact{" "}
                <a
                  href="mailto:press@getfaultline.live"
                  style={{ color: "rgba(0,212,255,0.6)", textDecoration: "none" }}
                >
                  press@getfaultline.live
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 40px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            color: "#4B5563",
            lineHeight: 1.7,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: "24px",
          }}
        >
          FAULTLINE is a macroeconomic risk intelligence platform developed by
          Phoenix Systems. It provides educational analysis and market awareness
          tools. It is not a financial adviser and does not provide personalised
          investment advice. Past performance of any indicator or signal does not
          guarantee future results. All content is for informational purposes
          only.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            color: "#4B5563",
            letterSpacing: "0.1em",
          }}
        >
          © 2026 FAULTLINE · A{" "}
          <Link href="/phoenix-systems" style={{ color: "#4B5563" }}>
            Phoenix Systems
          </Link>{" "}
          Platform ·{" "}
          <Link href="/legal" style={{ color: "#4B5563" }}>
            Privacy &amp; Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
