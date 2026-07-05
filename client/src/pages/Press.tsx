import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { useState } from "react";

// ── Press kit assets ─────────────────────────────────────────────
const PRESS_KIT_ASSETS = [
  {
    id: "company-overview",
    label: "Company Overview",
    desc: "One-page summary of Phoenix Systems and FAULTLINE.",
    type: "PDF",
    icon: "📄",
  },
  {
    id: "product-overview",
    label: "Product Overview",
    desc: "FAULTLINE platform capabilities, feature summary, and use cases.",
    type: "PDF",
    icon: "📋",
  },
  {
    id: "fact-sheet",
    label: "Fact Sheet",
    desc: "Key data points, platform metrics, and product facts.",
    type: "PDF",
    icon: "📊",
  },
  {
    id: "press-release",
    label: "Press Release",
    desc: "Official launch announcement for FAULTLINE.",
    type: "PDF",
    icon: "📰",
  },
  {
    id: "boilerplate",
    label: "Company Boilerplate",
    desc: "Standard approved language for use in articles and publications.",
    type: "TXT",
    icon: "📝",
  },
];

const BOILERPLATE = `About Phoenix Systems

Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. Its flagship product, FAULTLINE, is a macroeconomic risk intelligence platform that continuously monitors systemic stress across economic, financial, and market systems — detecting regime shifts before they become obvious.

FAULTLINE is designed for investors, traders, and analysts who want to understand the risk environment before it reprices. The platform provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

About FAULTLINE

FAULTLINE is a macroeconomic risk intelligence platform developed by Phoenix Systems. It monitors the economic, financial, and market fault lines where stress builds beneath the surface, providing a continuous Pressure Index, regime detection, and institutional-grade intelligence tools. FAULTLINE is available at getfaultline.live.

Press Contact

press@getfaultline.live`;

const FACT_SHEET = `FAULTLINE — Fact Sheet
Platform: Macroeconomic risk intelligence
Developer: Phoenix Systems
Website: getfaultline.live
Category: Financial intelligence / Market awareness
Primary metric: Pressure Index (0–100 composite score)
Data sources: FRED (Federal Reserve), live market feeds, institutional flow data
Key features: Pressure Index, Regime Detection, Signal Intelligence, Market Scenarios, Symbol Intelligence, Decision Engine
Availability: Web (getfaultline.live) + Progressive Web App (iOS/Android)
Pricing tiers: Observer (free), Trader, Institutional
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
Tiers: Observer (free), Trader, Institutional

DISCLAIMER
FAULTLINE provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

PRESS CONTACT
press@getfaultline.live`;

const ASSET_CONTENT: Record<string, string> = {
  "company-overview": COMPANY_OVERVIEW,
  "product-overview": PRODUCT_OVERVIEW,
  "fact-sheet": FACT_SHEET,
  "press-release": PRESS_RELEASE,
  boilerplate: BOILERPLATE,
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
            { label: "TIERS", value: "Observer · Trader · Institutional" },
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
              a: "FAULTLINE is a macroeconomic risk intelligence platform that monitors systemic financial pressure in real time. It aggregates data across seven risk vectors — credit, liquidity, volatility, yield curve, systemic risk, inflation, and geopolitical — to produce a unified Pressure Index score and regime classification.",
            },
            {
              q: "Who built FAULTLINE?",
              a: "FAULTLINE is developed by Phoenix Systems, an independent technology studio focused on financial intelligence infrastructure. The platform is designed for retail traders, independent investors, and financial professionals who want institutional-grade risk awareness without institutional overhead.",
            },
            {
              q: "Is FAULTLINE a financial adviser?",
              a: "No. FAULTLINE is an information and analysis tool. It does not provide personalised investment advice, portfolio management, or regulated financial services. All content is for informational and educational purposes only. Users should consult a qualified financial adviser before making investment decisions.",
            },
            {
              q: "What data sources does FAULTLINE use?",
              a: "FAULTLINE aggregates data from public and licensed sources including the Federal Reserve Economic Data (FRED) system, financial market data providers, and macroeconomic databases. All data sources are documented in the platform’s methodology section.",
            },
            {
              q: "What subscription tiers are available?",
              a: "FAULTLINE offers four tiers: Observer (free), Trader ($9.99/mo), Power ($59/mo), and Founding ($49/mo, rate locked for life). Observer provides access to the live Pressure Index and limited signal previews. Trader unlocks the full signals screener, portfolio tracker, and watchlists. Power adds AI diagnostic intelligence, crypto intelligence, and the full institutional suite.",
            },
            {
              q: "How can I request a media briefing or embargo access?",
              a: "Contact press@getfaultline.live with your publication, deadline, and the specific angle you’re covering. We accommodate embargo requests for product launches and major platform updates. Response time is typically within 24 hours on business days.",
            },
            {
              q: "Are screenshots and brand assets available for editorial use?",
              a: "Yes. The press kit assets above include platform screenshots, the FAULTLINE wordmark, and company boilerplate. All assets are cleared for editorial use with attribution. Commercial use requires written permission.",
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
                  margin: "0 0 10px",
                }}
              >
                FAULTLINE uses artificial intelligence and machine learning models to classify market regimes, generate signal labels, produce diagnostic summaries, and power the Ask Intelligence feature. AI-generated content is clearly labelled within the platform and is intended to augment — not replace — human analysis and judgment.
              </p>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: "13px",
                  color: "#94A3B8",
                  lineHeight: 1.7,
                  margin: "0 0 10px",
                }}
              >
                AI outputs are probabilistic and may contain errors. FAULTLINE does not represent AI-generated analysis as investment advice. The platform’s AI systems are reviewed periodically for accuracy and bias. Users are encouraged to verify AI-generated content against primary sources before making financial decisions.
              </p>
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
