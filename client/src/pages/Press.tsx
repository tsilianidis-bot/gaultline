import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { useState } from "react";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";

// ─────────────────────────────────────────────────────────────────────────────
// DOWNLOADABLE ASSET CONTENT
// ─────────────────────────────────────────────────────────────────────────────

const BOILERPLATE_50 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. Its flagship product, FAULTLINE, is a structural market intelligence platform that identifies where systemic pressure is building across credit, funding, rates, macro conditions, equities, and crypto. PLATO, its AI interpretation layer, explains what those readings mean together. Available at getfaultline.live.`;

const BOILERPLATE_150 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. The company develops decision-intelligence systems designed to reduce the information asymmetry between institutional and individual decision-makers.

Its flagship product, FAULTLINE, is a structural market intelligence platform. Its Faultline Pressure Index™ combines six weighted vectors built from eight FRED series and one static reference value into a 0–100 reading of systemic pressure. PLATO, its AI interpretation layer, reads that shared market state — pressure, regime, historical resemblance, crypto and signal context — and explains in plain language where pressure is building and what would change the picture.

FAULTLINE is designed for investors, traders, and analysts who want to understand the risk environment they are operating in. The platform provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice.

FAULTLINE is available at getfaultline.live. The public Pressure Index and methodology are free to read; full intelligence is offered through one $99/month membership; checkout is not open yet.

Press contact: press@getfaultline.live`;

const BOILERPLATE_500 = `About Phoenix Systems

Phoenix Systems is an AI-first technology company focused on building intelligent platforms that transform complex information into actionable understanding. The company was founded on a straightforward observation: most individual investors are making decisions with fundamentally incomplete situational awareness. They can see price action. They can access earnings data. What they cannot easily access is a continuous, integrated view of the underlying structural conditions that drive markets — the systemic pressures, regime shifts, and macroeconomic fault lines that institutional investors monitor as a matter of course.

Phoenix Systems was created to close that gap.

The company's approach to artificial intelligence is deliberately calibrated. Phoenix Systems does not use AI to generate predictions or recommendations. It uses AI to synthesise, classify, and contextualise — to surface what is happening, why it is happening, how long it has been building, and what has historically happened in similar conditions. Every product Phoenix Systems builds is designed to reduce information asymmetry, not to manufacture false certainty.

FAULTLINE is Phoenix Systems' flagship product: a structural market intelligence platform built around the Pentagonal Thesis™ — five questions about what is happening, why, what could come next, what to watch, and how to frame a decision. Rather than beginning with stock selection or trading signals, FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system?

PLATO — Spirit of FAULTLINE — is the interpretation layer of FAULTLINE. PLATO reads the same persisted market state every surface uses — the Pressure Index and its vectors, regime readings, historical resemblance, crypto context, and signals — and explains what those measurements mean together. Where an input is unavailable, stale, or not supported by governed evidence, PLATO says so rather than filling the gap. PLATO explains measurements; it does not rescore them.

The platform's primary metric is the Faultline Pressure Index™ — a 0–100 composite of high-yield credit spreads, SOFR, the Treasury curve, inflation, federal funds, unemployment, and a static AI-concentration baseline, classified into five bands from LOW RISK to SYSTEMIC CRISIS. The Seismograph™ records those readings over time, so a level can be read next to the path that produced it.

All FAULTLINE outputs are probabilistic rather than deterministic. The platform does not generate buy or sell signals. It generates probability-weighted assessments of current conditions, historical analog distributions, and scenario likelihoods — designed to support informed judgment, not to replace it.

FAULTLINE is available at getfaultline.live via web browser and as a Progressive Web App (PWA) on iOS and Android. The public Pressure Index and methodology are free to read; full intelligence is offered through one $99/month membership; checkout is not open yet.

Press contact: press@getfaultline.live
Website: getfaultline.live`;

const FACT_SHEET = `FAULTLINE — Fact Sheet
As of July 2026

Platform: Macroeconomic Risk Intelligence
Developer: Phoenix Systems
Founder: JT
Website: getfaultline.live
Category: AI-powered financial intelligence / Systemic risk awareness
AI Intelligence Layer: PLATO (Spirit of FAULTLINE)
Primary metric: Pressure Index™ (0–100 composite of six weighted vectors; five bands, LOW RISK to SYSTEMIC CRISIS)
Pressure record: Seismograph™ (stored Pressure Index readings over time)

Intelligence areas PLATO interprets from one shared market state:
  1. Market Regime Engine
  2. Pressure Index™
  3. Liquidity Intelligence
  4. Treasury Conditions
  5. Volatility Engine
  6. Credit Risk Engine
  7. Historical Analog Engine
  8. Probability Engine
  9. Crypto Intelligence
  10. Signal Intelligence

Data sources: FRED (Federal Reserve Economic Data) for credit spreads, rates, inflation, labor and financial-stress series; Polygon daily equity aggregates; Yahoo Finance quotes; CoinGecko crypto market statistics. No on-chain or institutional-flow feed is ingested.

Platform capabilities: PLATO AI Intelligence, Seismograph™, Pressure Index™, Regime Detection, Signal Intelligence, Historical Analog Engine, Decision Engine, Day Trade Intelligence, Symbol Intelligence, Crypto Hub, Portfolio Intelligence, Market Scenarios, Aftershock Engine

Availability: Web (getfaultline.live) + Progressive Web App (iOS/Android)

Access:
  Public — Pressure Index and methodology, no account required
  FAULTLINE Intelligence — $99/month
  Membership checkout — not open yet

Press contact: press@getfaultline.live`;

const PRESS_RELEASE = `FOR IMMEDIATE RELEASE

PHOENIX SYSTEMS INTRODUCES PLATO — THE AI INTERPRETATION LAYER OF FAULTLINE'S STRUCTURAL MARKET INTELLIGENCE

PLATO explains FAULTLINE's systemic-pressure readings in plain language, so individual investors can see where pressure is building beneath the surface.

[Mentor, Ohio — July 2026] — Phoenix Systems today announced PLATO, the AI intelligence layer at the core of FAULTLINE, its macroeconomic risk intelligence platform. PLATO — Spirit of FAULTLINE — reads FAULTLINE's shared market state and explains where systemic pressure, regime change, and structural risk are building beneath the surface.

Unlike AI assistants that answer questions in isolation, PLATO answers from the same persisted market state every FAULTLINE surface reads: the Pressure Index and its vectors, regime readings, historical resemblance, crypto context, and signals. PLATO explains what those readings mean together and states plainly when an input is unavailable or not supported by governed evidence — delivering an interpretation rather than a raw data output.

"Most investors see price action. PLATO sees the structural conditions beneath it," said JT, Founder of Phoenix Systems. "FAULTLINE synthesizes multiple market-risk engines into one decision framework. That is not a chatbot. That is an intelligence layer."

FAULTLINE's Seismograph™ records Pressure Index readings over time and gives PLATO the path behind today's level. The platform also includes a Historical Analog Engine, Decision Engine, Day Trade Intelligence, Symbol Intelligence, Crypto Hub, Aftershock Engine, and Portfolio Intelligence tools.

FAULTLINE is available at getfaultline.live. The public Pressure Index and methodology are free to read, and full intelligence is offered through one $99/month membership; checkout is not open yet.

About Phoenix Systems
Phoenix Systems is an AI-first technology company building intelligent platforms that transform complex information into actionable understanding. FAULTLINE is its flagship product.

Press Contact
press@getfaultline.live
getfaultline.live/press

###`;

const COMPANY_OVERVIEW = `PHOENIX SYSTEMS — COMPANY OVERVIEW
As of July 2026

Company: Phoenix Systems
Founder: JT
Product: FAULTLINE (flagship)
Website: getfaultline.live
Category: AI-first financial intelligence / Macroeconomic risk intelligence

WHAT WE BUILD
Phoenix Systems develops AI-powered intelligence systems that help investors, traders, and analysts make better decisions by transforming complex macroeconomic and market data into clear, actionable understanding. Every product Phoenix Systems builds is designed to reduce the information asymmetry between institutional and individual decision-makers — giving individuals access to the same structural awareness that professional risk managers use as a matter of course.

FAULTLINE — FLAGSHIP PLATFORM
FAULTLINE is a structural market intelligence platform. It identifies where systemic pressure is building across credit, funding, rates, macro conditions, equities, and crypto, and PLATO — its AI interpretation layer — explains what those readings mean together.

The platform's primary metric is the Faultline Pressure Index™ (0–100), and the Seismograph™ records those readings over time. The Historical Analog Engine ranks how closely today's vector profile resembles hand-set reference profiles of past stress episodes; resemblance is not a forecast. PLATO answers from that shared market state and discloses unavailable inputs.

Intelligence areas PLATO interprets:
1. Market Regime — the Pressure Index band, plus separate equity, crypto, and systemic-regime models
2. Pressure Index™ — 0–100 composite of six weighted vectors from eight FRED series and one static baseline
3. Liquidity — high-yield credit spreads and SOFR funding rates
4. Treasury Conditions — the 10-year minus 2-year curve and the 10-year yield level
5. Volatility — VIX quotes on the markets board and the VIX close in the separate systemic-regime model (the Pressure Index does not read VIX)
6. Credit Risk — high-yield spreads in the Pressure Index; investment-grade spreads in the systemic-regime model
7. Historical Analog Engine — ranks resemblance to hand-set reference profiles of past stress episodes; not a forecast or a return distribution
8. Probability Engine — assigns regime transition probabilities across 1M/3M/6M/12M horizons
9. Crypto Intelligence — CoinGecko prices, Bitcoin dominance, 24-hour ranges, crypto regime, and the Pressure Index
10. Signal Intelligence — regime-contextualised directional labels across equities and crypto

PHILOSOPHY
We believe the most valuable intelligence is not a recommendation — it is context. Phoenix Systems products emphasise probabilistic reasoning over binary predictions. We surface likelihoods, regimes, and stress indicators — not buy or sell signals. PLATO is designed to augment human judgment, not replace it.

DISCLAIMER
FAULTLINE is a macroeconomic risk intelligence platform. ${PUBLIC_DISCLAIMER} It is not a financial adviser.

CONTACT
press@getfaultline.live
getfaultline.live/press`;

const PRODUCT_OVERVIEW = `FAULTLINE — PRODUCT OVERVIEW
As of July 2026

Platform: Macroeconomic Risk Intelligence
Developer: Phoenix Systems
Website: getfaultline.live
AI Intelligence Layer: PLATO (Spirit of FAULTLINE)

WHAT FAULTLINE DOES
FAULTLINE monitors the economic, financial, and market fault lines where stress builds beneath the surface. It gives investors, traders, and analysts an integrated view of systemic pressure, and PLATO — its AI interpretation layer — explains what the readings mean together. The platform answers three questions before any other: What is happening? Why is it happening? How long has it been building?

PLATO — THE INTELLIGENCE LAYER
PLATO (Spirit of FAULTLINE) is the interpretation layer of FAULTLINE. Each time she answers, PLATO reads the same persisted market state the rest of the platform uses, explains what the measurements mean together, and says plainly when an input is unavailable. PLATO explains measurements; it does not replace them.

CORE CAPABILITIES

1. Seismograph™
   The record of Pressure Index readings over time — score, band, and direction — so today's level is read next to the path that produced it.

2. Pressure Index™
   A 0–100 composite of six weighted vectors built from eight FRED series (high-yield spread, SOFR, 10-year and 2-year yields, CPI, PPI, federal funds, unemployment) and one static AI-concentration baseline. Recalculated when source data is published; monthly series lag. Five bands: LOW RISK / MODERATE RISK / ELEVATED RISK / HIGH STRESS / SYSTEMIC CRISIS.

3. PLATO Daily Intelligence Brief
   A daily AI-generated briefing from the engine snapshot — what is happening, why it is happening, how long it has been developing, and what to watch next.

4. Historical Analog Engine
   Ranks how closely today's vector profile resembles hand-set reference profiles of past stress episodes. Resemblance is context, not a prediction, and not a computed return distribution.

5. Signal Intelligence
   Regime-contextualised directional labels across equities and crypto. Includes conviction scores, regime context, and PLATO interpretation.

6. Decision Engine
   A structured decision-support framework that evaluates trade ideas against the current macro regime, pressure environment, and signal consensus.

7. Day Trade Intelligence
   Intraday intelligence layer for active traders. Regime-aware setups, pre-market context, and regularly refreshed PLATO synthesis.


8. Symbol Intelligence
   Deep-dive analysis for individual stocks and crypto assets. Includes pressure context, regime overlay, and PLATO interpretation. Prices come from Polygon daily aggregates and Yahoo quotes.

9. Crypto Hub & Crypto Intelligence
    Dedicated crypto intelligence layer covering CoinGecko market statistics, Bitcoin dominance, crypto regime classification, digital asset stress indicators, and PLATO crypto interpretation.

10. Portfolio Intelligence
    Portfolio-level regime awareness. Evaluates holdings against current macro conditions and surfaces concentration risk, regime misalignment, and hedging considerations.

11. Aftershock Engine
    Detects secondary market stress events and systemic contagion risk following initial regime shifts.

12. Market Scenarios
    Probabilistic scenario analysis for key macro events. Assigns likelihood scores and potential market impact to multiple outcomes.

AVAILABILITY
Web: getfaultline.live
PWA: Available on iOS and Android
Access: public Pressure Index (no account) · FAULTLINE Intelligence $99/month · checkout not open yet

DISCLAIMER
${PUBLIC_DISCLAIMER} FAULTLINE is not a financial adviser.

PRESS CONTACT
press@getfaultline.live`;

const OUTREACH_EMAIL = `Subject: FAULTLINE — AI Market Intelligence Operating System | Press Inquiry

Dear [Editor/Reporter Name],

I am writing on behalf of Phoenix Systems to introduce FAULTLINE and PLATO — a macroeconomic risk intelligence platform and AI intelligence layer that takes a fundamentally different approach to market analysis.

Most investing platforms begin with stock selection or trading signals. FAULTLINE begins with the question that institutional risk managers ask first: what is the current state of the system? At its core is the Faultline Pressure Index™, a published 0–100 composite of credit, funding, rates, inflation, and labor series, and PLATO — an AI interpretation layer that reads the same shared market state and explains, in plain language, where systemic pressure is building and what would change the picture.

FAULTLINE is available at getfaultline.live and is designed for investors, traders, and analysts who want to understand the risk environment before making investment decisions.

I would welcome the opportunity to provide a briefing, product demonstration, or embargo access ahead of any planned coverage. Full press materials — including a press release, fact sheet, product overview, and company boilerplate — are available at getfaultline.live/press.

Please let me know if you have any questions or would like to arrange a call.

Best regards,
Phoenix Systems Press Team
press@getfaultline.live
getfaultline.live/press`;

const FOLLOWUP_EMAIL = `Subject: Following Up — FAULTLINE Press Materials

Dear [Editor/Reporter Name],

I wanted to follow up on my previous note regarding FAULTLINE, Phoenix Systems' AI Market Intelligence Operating System.

I understand your schedule is demanding. I am writing briefly to confirm that full press materials remain available at getfaultline.live/press, including a press release, company fact sheet, product overview, and company boilerplate in multiple formats.

If FAULTLINE is relevant to any upcoming coverage of financial technology, macroeconomic risk, retail investor tools, AI applications in financial services, or the democratisation of institutional-quality intelligence, I would be glad to arrange a briefing or product demonstration at your convenience.

I am also available to answer any specific questions you may have about the platform, its methodology, or Phoenix Systems' broader product vision.

Thank you for your time.

Best regards,
Phoenix Systems Press Team
press@getfaultline.live
getfaultline.live/press`;

const EXECUTIVE_SUMMARY = `FAULTLINE — EXECUTIVE SUMMARY
For Journalists, Investors, Enterprise Customers, and Strategic Partners
As of July 2026

WHAT FAULTLINE IS
FAULTLINE is an AI Market Intelligence Operating System that monitors the economic, financial, and market fault lines where stress builds beneath the surface and shows where systemic pressure is building. At its core are the Faultline Pressure Index™ and PLATO, an AI interpretation layer that explains those readings in plain language.

THE PROBLEM
Markets have become increasingly complex. Information has become abundant. Understanding has become scarce. Most individual investors are making consequential financial decisions with fundamentally incomplete situational awareness. They can see price action. They can access earnings data. What they cannot easily access is a continuous, integrated view of the underlying structural conditions that drive markets — the systemic pressures, regime shifts, and macroeconomic fault lines that institutional investors monitor as a matter of course. FAULTLINE was created to close that gap.

WHY NOW
The convergence of AI capability, modern data infrastructure, and growing retail investor sophistication has created a unique moment. It is now practical to deliver structural market intelligence to individual investors at scale — not as a simplified summary, but as an interpretation layer that reads multiple data streams, identifies structural patterns, and communicates what is building beneath the surface.

KEY DIFFERENTIATORS
• Risk-first architecture: FAULTLINE begins with the state of the system, not a stock pick
• One shared market state: every surface, and PLATO, reads the same persisted reading
• Historical context: the Analog Engine ranks resemblance to reference profiles of past stress episodes
• Probabilistic framing: likelihoods and distributions, not binary predictions
• Plain language intelligence: structural analysis delivered in clear, direct language
• Published method: every Pressure Index input, weight, and band is documented on the methodology page

CORE TECHNOLOGY
The Pressure Index™ (0–100) combines six weighted vectors built from eight FRED series and one static reference value, and its bands set the regime label. The Seismograph™ records those readings over time. The Historical Analog Engine ranks resemblance to hand-set reference profiles of past stress episodes; resemblance is not a forecast. PLATO interprets that shared state and discloses unavailable inputs.

PLATO'S ROLE
PLATO (Spirit of FAULTLINE) is the unified intelligence interface of FAULTLINE. She is not a chatbot. Each time she answers, PLATO reads the persisted market state the platform publishes, explains what the measurements mean together, and states plainly what is unavailable or not established. She transforms complexity into clarity.

TARGET CUSTOMERS
• Individual investors seeking structural situational awareness
• Active traders who need regime context before executing
• Financial advisers who want to communicate macro conditions to clients
• Enterprise clients requiring embedded macro intelligence in their workflows
• Media and research organisations covering financial markets

CURRENT PLATFORM CAPABILITIES
Seismograph™ · Pressure Index™ · PLATO Daily Intelligence Brief · Historical Analog Engine · Signal Intelligence · Decision Engine · Day Trade Intelligence · Symbol Intelligence · Crypto Hub · Portfolio Intelligence · Aftershock Engine · Market Scenarios

LONG-TERM VISION
To become the world's most trusted AI Market Intelligence Operating System — the platform that serious investors, traders, advisers, and institutions rely on to understand what markets are communicating before they move.

PRESS CONTACT
press@getfaultline.live
getfaultline.live/press`;

const PRESS_KIT_ASSETS = [
  { id: "executive-summary", label: "Executive Summary", desc: "Two-minute overview for journalists, investors, enterprise customers, and strategic partners.", type: "TXT", icon: "⚡" },
  { id: "company-overview", label: "Company Overview", desc: "One-page summary of Phoenix Systems and FAULTLINE.", type: "TXT", icon: "📄" },
  { id: "product-overview", label: "Product Overview", desc: "FAULTLINE platform capabilities, feature summary, and use cases.", type: "TXT", icon: "📋" },
  { id: "fact-sheet", label: "Fact Sheet", desc: "Key data points, platform metrics, and product facts.", type: "TXT", icon: "📊" },
  { id: "press-release", label: "Press Release", desc: "Official PLATO announcement for FAULTLINE.", type: "TXT", icon: "📰" },
  { id: "boilerplate-50", label: "Company Boilerplate — 50 Words", desc: "Approved short-form boilerplate for editorial use.", type: "TXT", icon: "📝" },
  { id: "boilerplate-150", label: "Company Boilerplate — 150 Words", desc: "Standard boilerplate for articles and publications.", type: "TXT", icon: "📝" },
  { id: "boilerplate-500", label: "Company Boilerplate — 500 Words", desc: "Long-form boilerplate for feature articles and profiles.", type: "TXT", icon: "📝" },
  { id: "outreach-email", label: "Media Outreach Email", desc: "Approved template for journalist outreach. Customise the recipient name before sending.", type: "TXT", icon: "✉️" },
  { id: "followup-email", label: "Follow-Up Email", desc: "Approved follow-up template for unanswered media inquiries.", type: "TXT", icon: "✉️" },
];

const ASSET_CONTENT: Record<string, string> = {
  "executive-summary": EXECUTIVE_SUMMARY,
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET CARD
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: (typeof PRESS_KIT_ASSETS)[0] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const content = ASSET_CONTENT[asset.id] ?? "";
  return (
    <div
      style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", background: "rgba(255,255,255,0.02)", overflow: "hidden", transition: "border-color 0.2s" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,212,255,0.25)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)")}
    >
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "20px" }}>{asset.icon}</span>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#F0F4FF", marginBottom: "3px" }}>{asset.label}</div>
            <div style={{ fontSize: "11px", color: "#64748B" }}>{asset.desc}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.2em", color: "#64748B", border: "1px solid rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: "3px" }}>{asset.type}</span>
          <span style={{ color: "#64748B", fontSize: "12px", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 24px" }}>
          <pre style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#94A3B8", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: "16px", background: "rgba(0,0,0,0.3)", padding: "16px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)", maxHeight: "320px", overflowY: "auto" }}>{content}</pre>
          <button
            onClick={(e) => { e.stopPropagation(); copyToClipboard(content, setCopied); }}
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: copied ? "#00D4FF" : "#F0F4FF", background: copied ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.06)", border: `1px solid ${copied ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.15)"}`, padding: "8px 18px", borderRadius: "5px", cursor: "pointer", transition: "all 0.2s" }}
          >
            {copied ? "✓ COPIED" : "COPY TEXT"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────

function SectionEyebrow({ text }: { text: string }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.35em", color: "rgba(0,212,255,0.6)", textTransform: "uppercase", marginBottom: "10px" }}>
      ◆ {text}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "#F0F4FF", letterSpacing: "0.04em", margin: "0 0 24px" }}>
      {children}
    </h2>
  );
}

const prose: React.CSSProperties = { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.85, marginBottom: "18px" };
const card: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "32px" };
const divider: React.CSSProperties = { height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent)", margin: "0 24px" };
const maxW: React.CSSProperties = { maxWidth: "900px", margin: "0 auto", padding: "0 24px" };

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function Press() {
  useSEO({ title: "Press | FAULTLINE", description: "Press package for FAULTLINE — the AI Market Intelligence Operating System powered by PLATO. Press releases, fact sheets, brand standards, and media assets." });
  const [contactCopied, setContactCopied] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#050608", color: "#F0F4FF" }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(5,6,8,0.95)", backdropFilter: "blur(12px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8 L6 4 L10 9 L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, letterSpacing: "0.2em", color: "#F0F4FF" }}>FAULTLINE</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", paddingLeft: "8px", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>PRESS</span>
        </div>
        <Link href="/" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#00D4FF", textDecoration: "none" }}>← HOME</Link>
      </nav>

      {/* ── Cover / Hero ── */}
      <section style={{ maxWidth: "900px", margin: "0 auto", padding: "100px 24px 80px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.4em", color: "rgba(0,212,255,0.6)", marginBottom: "24px" }}>PRESS PACKAGE · JULY 2026</div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 700, letterSpacing: "0.04em", color: "#F0F4FF", lineHeight: 1.05, marginBottom: "28px" }}>
          The Intelligence<br />Behind the Market.
        </h1>
        <p style={{ ...prose, fontSize: "16px", maxWidth: "580px", color: "#CBD5E1", marginBottom: "40px" }}>
          FAULTLINE is an AI Market Intelligence Operating System. It monitors the economic, financial, and market fault lines where stress builds beneath the surface and shows where systemic pressure is building. See the pressure before the break.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="mailto:press@getfaultline.live" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#050608", background: "#00D4FF", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontWeight: 700 }}>EMAIL PRESS TEAM →</a>
          <a href="https://getfaultline.live" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#94A3B8", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", padding: "12px 24px", borderRadius: "6px", textDecoration: "none" }}>VIEW PLATFORM →</a>
        </div>
      </section>

      <div style={divider} />

      {/* ── Founder's Letter ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Founder's Letter" />
        <SectionHeading>A Letter from the Founder</SectionHeading>
        <div style={card}>
          <p style={prose}>
            I built FAULTLINE because I kept asking a question that no platform could answer.
          </p>
          <p style={prose}>
            Not "what should I buy?" — that question has a thousand answers, most of them wrong. The question I kept asking was simpler and more important: <em style={{ color: "#CBD5E1" }}>what is actually happening right now, beneath the surface of the market?</em>
          </p>
          <p style={prose}>
            Markets communicate long before they move. Pressure builds in credit markets before it appears in equity prices. Liquidity deteriorates before volatility spikes. Yield curves invert months before recessions arrive. The signals are there. They have always been there. The problem is that synthesising them — across dozens of data sources, as new data is published, with the historical context needed to understand what they mean — has historically required an institutional research desk, not a retail account.
          </p>
          <p style={prose}>
            That asymmetry is not a feature of markets. It is a failure of infrastructure. And it is the problem FAULTLINE was built to solve.
          </p>
          <p style={prose}>
            FAULTLINE synthesizes multiple market-risk engines into one decision framework. Not a prediction. Not a recommendation. A clear, evidence-based understanding of the current state of the system.
          </p>
          <p style={prose}>
            Our mission is straightforward: to help every investor understand markets with greater clarity through evidence-based intelligence. Not to replace human judgment — to make it better informed.
          </p>
          <p style={{ ...prose, marginBottom: 0 }}>
            The greatest investment advantage is not speed. It is clarity.
          </p>
          <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", fontWeight: 700, color: "#F0F4FF", marginBottom: "4px" }}>JT</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B", letterSpacing: "0.1em" }}>FOUNDER · PHOENIX SYSTEMS</div>
          </div>
        </div>
      </section>

      <div style={divider} />

      {/* ── Executive Summary ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Executive Summary" />
        <SectionHeading>FAULTLINE in Under Two Minutes</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {[
            { label: "WHAT IT IS", body: "An AI Market Intelligence Operating System that identifies and interprets systemic pressure, regime change, and structural risk building beneath the surface." },
            { label: "THE PROBLEM", body: "Information is abundant. Understanding is scarce. Individual investors lack the structural situational awareness that institutional risk managers use as a matter of course." },
            { label: "WHY NOW", body: "The convergence of AI capability, modern data infrastructure, and retail investor sophistication makes structural market intelligence practical for individual investors." },
            { label: "KEY DIFFERENTIATOR", body: "FAULTLINE begins with the state of the system — not a stock pick. Every surface and every PLATO answer reads the same published market state, and every Pressure Index input, weight, and band is documented." },
            { label: "CORE TECHNOLOGY", body: "Pressure Index™ · Seismograph™ · Shared market state · Historical Analog Engine · Probability Engine · PLATO interpretation layer." },
            { label: "LONG-TERM VISION", body: "To become the world's most trusted AI Market Intelligence Operating System — the platform serious investors rely on to understand what markets are communicating before they move." },
          ].map((item) => (
            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "24px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "rgba(0,212,255,0.6)", marginBottom: "10px" }}>{item.label}</div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.75, margin: 0 }}>{item.body}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, borderColor: "rgba(0,212,255,0.15)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "rgba(0,212,255,0.6)", marginBottom: "12px" }}>TARGET CUSTOMERS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Individual Investors", "Active Traders", "Financial Advisers", "Hedge Funds", "Family Offices", "Enterprise Clients", "Financial Media", "Research Organisations"].map((c) => (
              <span key={c} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#CBD5E1", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", padding: "5px 12px", borderRadius: "4px" }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      <div style={divider} />

      {/* ── PLATO ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="The Intelligence Behind FAULTLINE" />
        <SectionHeading>Meet PLATO</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
          <div style={card}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "rgba(0,212,255,0.6)", marginBottom: "12px" }}>WHO SHE IS</div>
            <p style={{ ...prose, marginBottom: 0 }}>PLATO — Spirit of FAULTLINE — is the unified intelligence interface of FAULTLINE. She is not a chatbot. She is the interpretation layer that reads FAULTLINE's persisted market state and turns it into clear, evidence-based understanding.</p>
          </div>
          <div style={card}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "rgba(0,212,255,0.6)", marginBottom: "12px" }}>WHAT SHE DOES</div>
            <p style={{ ...prose, marginBottom: 0 }}>PLATO answers from the same market state every surface reads — pressure, regime, historical resemblance, crypto context, and signals — explains what those readings mean together, and states plainly when an input is unavailable. She transforms complexity into clarity.</p>
          </div>
        </div>
        <div style={{ ...card, borderColor: "rgba(0,212,255,0.12)", background: "rgba(0,212,255,0.02)" }}>
          <blockquote style={{ borderLeft: "2px solid rgba(0,212,255,0.5)", paddingLeft: "24px", margin: 0, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "16px", color: "#CBD5E1", fontStyle: "italic", lineHeight: 1.75 }}>
            "Most investors see price action. PLATO sees the structural conditions beneath it. FAULTLINE synthesizes multiple market-risk engines into one decision framework. That is not a chatbot. That is an intelligence layer."
            <div style={{ fontStyle: "normal", fontSize: "11px", color: "#64748B", marginTop: "12px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}>JT · FOUNDER · PHOENIX SYSTEMS</div>
          </blockquote>
        </div>
      </section>

      <div style={divider} />

      {/* ── How FAULTLINE Thinks ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Architecture" />
        <SectionHeading>How FAULTLINE Thinks</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>Every conclusion FAULTLINE generates is evidence-based and traceable to the readings that produced it. No single data point drives a conclusion. PLATO interprets the shared market state; it does not rescore it.</p>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0", margin: "40px 0" }}>
          {[
            { label: "Market & Economic Data", sub: "FRED · Polygon · Yahoo Finance · CoinGecko", color: "#64748B" },
            { label: "Pressure Index™", sub: "0–100 Composite Systemic Stress Score", color: "#94A3B8" },
            { label: "Intelligence Engines", sub: "Regime · Liquidity · Treasury · Volatility · Credit · Analog · Probability · Crypto · Signal", color: "#CBD5E1" },
            { label: "Seismograph™", sub: "Shared market state and pressure record over time", color: "#E2E8F0" },
            { label: "PLATO", sub: "Spirit of FAULTLINE", color: "#00D4FF" },
            { label: "Clear Market Understanding", sub: "What is happening · Why · How long it has been building", color: "#F0F4FF" },
          ].map((step, i, arr) => (
            <div key={step.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <div style={{ background: i === 4 ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 4 ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: "10px", padding: "18px 32px", textAlign: "center", width: "100%", maxWidth: "520px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: step.color, letterSpacing: "0.05em", marginBottom: "4px" }}>{step.label}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B", lineHeight: 1.5 }}>{step.sub}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0" }}>
                  <div style={{ width: "1px", height: "20px", background: "rgba(0,212,255,0.3)" }} />
                  <div style={{ color: "rgba(0,212,255,0.5)", fontSize: "12px", lineHeight: 1 }}>↓</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── Philosophy ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Philosophy" />
        <SectionHeading>The Philosophy of FAULTLINE</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>FAULTLINE was built on a set of beliefs about markets, intelligence, and the role of technology in human decision-making. These beliefs are not marketing language. They are the architectural principles behind every feature we build.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginTop: "32px" }}>
          {[
            { principle: "Markets whisper before they roar.", detail: "Hidden pressure builds long before headlines appear. The signals are always there — they simply require the right instruments to read them." },
            { principle: "Understanding begins beneath the surface.", detail: "Price action is the last thing to move. FAULTLINE monitors the structural conditions that drive price action, not the price action itself." },
            { principle: "Information is abundant. Understanding is scarce.", detail: "The problem facing investors is not access to data. It is the synthesis of data into coherent situational awareness. That is what FAULTLINE provides." },
            { principle: "Evidence matters more than emotion.", detail: "Every FAULTLINE conclusion is derived from multiple data sources and historical precedents. No single indicator drives a conclusion. No emotion influences an output." },
            { principle: "Clarity creates confidence.", detail: "Investors who understand the environment they are operating in make better decisions. Not because they have a prediction — because they have context." },
            { principle: "Artificial intelligence should amplify human judgment, never replace it.", detail: "PLATO is designed to make human judgment better informed, not to substitute for it. Every output is a tool for thinking, not a substitute for thinking." },
            { principle: "Every conclusion should be explainable.", detail: "FAULTLINE does not produce black-box outputs. Every assessment is traceable to the engines that produced it and the historical evidence that supports it." },
            { principle: "Institutional-quality intelligence should be available to everyone.", detail: "The information asymmetry between institutional and individual investors is not a feature of markets. It is a failure of infrastructure. FAULTLINE exists to close that gap." },
            { principle: "The greatest investment advantage is clarity, not speed.", detail: "Speed is a commodity. Clarity is rare. Understanding what is building beneath the surface — before it becomes obvious — is the most durable edge in markets." },
          ].map((item) => (
            <div key={item.principle} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", padding: "22px" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "15px", fontWeight: 700, color: "#E2E8F0", marginBottom: "8px", lineHeight: 1.3 }}>{item.principle}</div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.7, margin: 0 }}>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── Platform Capabilities ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Platform" />
        <SectionHeading>One Connected Intelligence System</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>FAULTLINE is not a collection of features. It is one connected operating system. Every module feeds into PLATO. Every conclusion is contextualised against the current regime. Every output is traceable to the engines that produced it.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "32px" }}>
          {[
            { name: "Seismograph™", role: "The record of Pressure Index readings over time. Shows how pressure has built, not just today's level." },
            { name: "Pressure Index™", role: "0–100 composite score. Five regime classifications. The single most important number on the platform." },
            { name: "PLATO", role: "The unified intelligence interface. Interprets the shared market state and discloses unavailable inputs. Transforms complexity into clarity." },
            { name: "Regime Detection", role: "Classifies current conditions into one of five bands, LOW RISK to SYSTEMIC CRISIS. The equity, crypto, and interpretation layers read it." },
            { name: "Historical Analog Engine", role: "Ranks resemblance to hand-set reference profiles of past stress episodes — precedents, not predictions." },
            { name: "Probability Engine", role: "Assigns regime transition probabilities across 1M, 3M, 6M, and 12M horizons." },
            { name: "Signal Intelligence", role: "Directional labels across equities and crypto. Always contextualised against the current regime." },
            { name: "Decision Engine", role: "Evaluates trade ideas against the current macro regime, pressure environment, and signal consensus." },
            { name: "Day Trade Intelligence", role: "Intraday intelligence layer for active traders. Regime-aware setups and regularly refreshed PLATO synthesis." },
            { name: "Symbol Intelligence", role: "Deep-dive analysis for individual stocks and crypto assets. Pressure context, regime overlay, and PLATO synthesis." },
            { name: "Crypto Hub", role: "Dedicated crypto intelligence layer. CoinGecko market statistics, crypto regime classification, and PLATO crypto interpretation." },
            { name: "Portfolio Intelligence", role: "Portfolio-level regime awareness. Surfaces concentration risk, regime misalignment, and hedging considerations." },
            { name: "Aftershock Engine", role: "Detects secondary market stress events and systemic contagion risk following initial regime shifts." },
            { name: "Market Scenarios", role: "Probabilistic scenario analysis for key macro events. Likelihood scores and potential market impact." },
          ].map((item) => (
            <div key={item.name} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "18px 20px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: "#00D4FF", marginBottom: "6px" }}>{item.name}</div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.65, margin: 0 }}>{item.role}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── What Makes FAULTLINE Different ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Differentiation" />
        <SectionHeading>What Makes FAULTLINE Different</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>Rather than comparing features, compare purpose. The question is not what each platform does. The question is what problem each platform is designed to solve.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", overflow: "hidden", background: "rgba(255,255,255,0.07)", marginTop: "32px" }}>
          {[
            { name: "Bloomberg", purpose: "Information", color: "#64748B" },
            { name: "Yahoo Finance", purpose: "Market Data", color: "#64748B" },
            { name: "TradingView", purpose: "Charts", color: "#64748B" },
            { name: "Generic AI", purpose: "General Answers", color: "#64748B" },
            { name: "FAULTLINE", purpose: "Market Intelligence", color: "#00D4FF", highlight: true },
          ].map((item) => (
            <div key={item.name} style={{ padding: "24px 20px", background: item.highlight ? "rgba(0,212,255,0.05)" : "#050608", borderLeft: item.highlight ? "2px solid rgba(0,212,255,0.4)" : "none" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", fontWeight: 700, color: item.highlight ? "#F0F4FF" : "#64748B", marginBottom: "6px" }}>{item.name}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: item.color, fontWeight: item.highlight ? 600 : 400 }}>{item.purpose}</div>
            </div>
          ))}
        </div>
        <p style={{ ...prose, marginTop: "24px", maxWidth: "600px" }}>
          FAULTLINE does not display markets. It interprets them. The distinction is the difference between a weather station and a meteorologist — one reports conditions, the other explains what they mean and what could come next.
        </p>
      </section>

      <div style={divider} />

      {/* ── Press Kit Assets ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Press Kit" />
        <SectionHeading>Downloadable Assets</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>All approved press materials for FAULTLINE and Phoenix Systems. Expand any asset to view and copy the full text. For interview requests, embargoed briefings, or additional assets, contact the press team directly.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
          {PRESS_KIT_ASSETS.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── Quick Facts ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Quick Reference" />
        <SectionHeading>Platform Facts</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", overflow: "hidden", background: "rgba(255,255,255,0.07)" }}>
          {[
            { label: "PLATFORM", value: "FAULTLINE" },
            { label: "DEVELOPER", value: "Phoenix Systems" },
            { label: "FOUNDER", value: "JT" },
            { label: "CATEGORY", value: "AI Market Intelligence OS" },
            { label: "WEBSITE", value: "getfaultline.live" },
            { label: "AVAILABILITY", value: "Web + PWA (iOS / Android)" },
            { label: "PRIMARY METRIC", value: "Pressure Index™ (0–100)" },
            { label: "AI LAYER", value: "PLATO" },
            { label: "ACCESS", value: "FAULTLINE Intelligence $99/month · checkout not open yet" },
            { label: "PRESS CONTACT", value: "press@getfaultline.live" },
          ].map((fact) => (
            <div key={fact.label} style={{ padding: "20px 24px", background: "#050608" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", marginBottom: "8px" }}>{fact.label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#F0F4FF", fontWeight: 600 }}>{fact.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── Press Release ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="For Immediate Release" />
        <SectionHeading>Press Release</SectionHeading>
        <div style={card}>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#64748B", marginBottom: "20px" }}>FOR IMMEDIATE RELEASE · PHOENIX SYSTEMS PRESS TEAM · press@getfaultline.live</p>
          <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "22px", fontWeight: 700, color: "#F0F4FF", lineHeight: 1.3, marginBottom: "8px", letterSpacing: "0.03em" }}>
            Phoenix Systems Introduces PLATO — The AI Interpretation Layer of FAULTLINE's Structural Market Intelligence
          </h3>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "rgba(0,212,255,0.7)", fontStyle: "italic", marginBottom: "28px", lineHeight: 1.6 }}>
            PLATO explains FAULTLINE's systemic-pressure readings in plain language, so individual investors can see where pressure is building beneath the surface
          </p>
          <p style={prose}>
            Phoenix Systems, an AI-first technology company focused on decision intelligence, today announced PLATO, the AI intelligence layer at the core of FAULTLINE, its macroeconomic risk intelligence platform. PLATO — Spirit of FAULTLINE — reads FAULTLINE's shared market state and explains where systemic pressure, regime change, and structural risk are building beneath the surface.
          </p>
          <p style={prose}>
            Unlike AI assistants that answer questions in isolation, PLATO answers from the same persisted market state every FAULTLINE surface reads: the Pressure Index and its vectors, regime readings, historical resemblance, crypto context, and signals. PLATO explains what those readings mean together and states plainly when an input is unavailable or not supported by governed evidence — delivering an interpretation rather than a raw data output.
          </p>
          <blockquote style={{ borderLeft: "2px solid rgba(0,212,255,0.4)", paddingLeft: "20px", margin: "24px 0", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "15px", color: "#CBD5E1", fontStyle: "italic", lineHeight: 1.7 }}>
            "Most investors see price action. PLATO sees the structural conditions beneath it. FAULTLINE synthesizes multiple market-risk engines into one decision framework. That is not a chatbot. That is an intelligence layer."
            <div style={{ fontStyle: "normal", fontSize: "11px", color: "#64748B", marginTop: "8px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em" }}>JT · FOUNDER · PHOENIX SYSTEMS</div>
          </blockquote>
          <p style={prose}>
            FAULTLINE is available at getfaultline.live via web browser and as a Progressive Web App (PWA) on iOS and Android. The public Pressure Index and methodology are free to read; full intelligence is offered through one $99/month membership; checkout is not open yet.
          </p>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.7, margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            FAULTLINE is a macroeconomic risk intelligence platform. {PUBLIC_DISCLAIMER} It is not a financial adviser. Past performance of any indicator or signal does not guarantee future results.
          </p>
        </div>
      </section>

      <div style={divider} />

      {/* ── FAQ ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Press FAQ" />
        <SectionHeading>Frequently Asked Questions</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {([
            {
              q: "What is FAULTLINE?",
              a: "FAULTLINE is an AI Market Intelligence Operating System that monitors the economic, financial, and market fault lines where stress builds beneath the surface. It identifies where systemic pressure is building across credit, funding, rates, macro conditions, equities, and crypto — giving investors, traders, and analysts an integrated view of systemic risk. At its core is PLATO, an AI interpretation layer that explains those readings in plain language. FAULTLINE does not predict a specific crash or name a date.",
            },
            {
              q: "What is the Pressure Index™?",
              a: "The Pressure Index™ is FAULTLINE's primary composite metric — a 0–100 score that combines six weighted vectors built from eight FRED series (high-yield spread, SOFR, 10-year and 2-year yields, CPI, PPI, federal funds, unemployment) and one static AI-concentration baseline. It is recalculated when source data is published; monthly series carry publication lag. Its bands set the regime label: LOW RISK, MODERATE RISK, ELEVATED RISK, HIGH STRESS, and SYSTEMIC CRISIS. It measures pressure inside this framework; it is not a crash forecast. The full method is published at getfaultline.live/methodology.",
            },
            {
              q: "Who is PLATO?",
              a: "PLATO — Spirit of FAULTLINE — is the AI interpretation layer at the core of FAULTLINE. She is not a chatbot. Each time she answers, PLATO reads the persisted market state every FAULTLINE surface uses — pressure, regime, historical resemblance, crypto context, and signals — explains what those readings mean together, and states plainly when an input is unavailable. PLATO transforms complexity into clarity.",
            },
            {
              q: "How is this different from Bloomberg, TradingView, Yahoo Finance, or generic AI?",
              a: "Bloomberg provides information. Yahoo Finance provides market data. TradingView provides charts. Generic AI provides general answers. FAULTLINE provides market intelligence — a synthesised understanding of what is building beneath the surface of markets. The distinction is the difference between a weather station and a meteorologist. FAULTLINE does not display markets. It interprets them.",
            },
            {
              q: "Does FAULTLINE provide investment advice?",
              a: "No. FAULTLINE is a macroeconomic risk intelligence platform. It provides educational analysis and market awareness tools. It is not a financial adviser and does not provide personalised investment advice. FAULTLINE generates probability-weighted assessments of current conditions, historical analog distributions, and scenario likelihoods — designed to support informed human judgment, not to replace it. Users should consult a qualified financial adviser before making investment decisions.",
            },
            {
              q: "How are conclusions generated?",
              a: "Every FAULTLINE conclusion is derived from the published engine readings and historical reference profiles. PLATO answers only from the supplied market state and evidence — surfacing agreement or conflict only where the evidence establishes it, and disclosing unavailable inputs — so each assessment is traceable to the data that produced it. No single indicator drives a conclusion. No black-box model produces an unexplained output.",
            },
            {
              q: "How often is intelligence updated?",
              a: "The Seismograph™, Pressure Index™, and underlying data feeds refresh regularly as new data is published; macro series follow their official publication schedules. PLATO's Daily Intelligence Brief is generated each morning before market open. Signal Intelligence updates as new data is published as market conditions change. Historical Analog and Probability Engine outputs update as new data is incorporated.",
            },
            {
              q: "What data powers the platform?",
              a: "The Pressure Index reads eight FRED (Federal Reserve Economic Data) series plus one static reference value. A separate systemic-regime model reads a broader FRED panel, including investment-grade spreads, NFCI, the St. Louis Fed Financial Stress Index, the VIX close, and the S&P 500. Equity data comes from Polygon daily aggregates and Yahoo Finance quotes; crypto data comes from CoinGecko. FAULTLINE does not ingest on-chain or institutional-flow data. Daily FRED values are the latest published observations and monthly series lag; none of it is a tick feed.",
            },
          ] as Array<{ q: string; a: string }>).map((item, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "22px" }}>
              <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "15px", fontWeight: 700, color: "#E2E8F0", marginBottom: "8px", letterSpacing: "0.02em" }}>{item.q}</p>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.7, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── Brand Standards ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Brand Standards" />
        <SectionHeading>Visual Identity & Usage Guidelines</SectionHeading>
        <p style={{ ...prose, maxWidth: "600px" }}>All brand assets are cleared for editorial use with attribution. Commercial use requires written permission. Contact press@getfaultline.live to request high-resolution assets.</p>

        {/* Typography */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", marginBottom: "16px" }}>TYPOGRAPHY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {[
              { name: "Rajdhani", role: "Headlines & Display", sample: "FAULTLINE", style: { fontFamily: "'Rajdhani', sans-serif", fontSize: "22px", fontWeight: 700 } },
              { name: "IBM Plex Mono", role: "Labels, Data & UI", sample: "PRESSURE INDEX™", style: { fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", letterSpacing: "0.15em" } },
              { name: "IBM Plex Sans", role: "Body & Prose", sample: "Intelligence that explains markets.", style: { fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px" } },
            ].map((t) => (
              <div key={t.name} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "20px" }}>
                <div style={{ ...t.style, color: "#F0F4FF", marginBottom: "10px" }}>{t.sample}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#00D4FF", marginBottom: "2px" }}>{t.name}</div>
                <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#64748B" }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", marginBottom: "16px" }}>COLOR PALETTE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[
              { name: "PLATO Cyan", hex: "#00D4FF", bg: "#00D4FF", text: "#050608" },
              { name: "Deep Navy", hex: "#050608", bg: "#050608", text: "#F0F4FF", border: "rgba(255,255,255,0.1)" },
              { name: "Primary Text", hex: "#F0F4FF", bg: "#F0F4FF", text: "#050608" },
              { name: "Secondary Text", hex: "#94A3B8", bg: "#94A3B8", text: "#050608" },
              { name: "Muted", hex: "#64748B", bg: "#64748B", text: "#F0F4FF" },
              { name: "Signal Blue", hex: "#0066FF", bg: "#0066FF", text: "#F0F4FF" },
            ].map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px 16px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: c.bg, border: c.border ?? "none", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#F0F4FF", fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#64748B" }}>{c.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PLATO Usage Guidelines */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", marginBottom: "16px" }}>PLATO USAGE GUIDELINES</div>
          <div style={{ ...card, borderColor: "rgba(0,212,255,0.12)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(0,212,255,0.7)", marginBottom: "12px", letterSpacing: "0.15em" }}>APPROVED USAGE</div>
                {["PLATO (full name, first reference)", "PLATO (subsequent references)", "PLATO — the AI intelligence layer of FAULTLINE", "Ask PLATO (as a call to action)", "PLATO synthesises / PLATO reads / PLATO identifies"].map((item) => (
                  <div key={item} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", lineHeight: 1.7, paddingLeft: "12px", borderLeft: "1px solid rgba(0,212,255,0.2)", marginBottom: "6px" }}>✓ {item}</div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "rgba(251,191,36,0.7)", marginBottom: "12px", letterSpacing: "0.15em" }}>AVOID</div>
                {["PLATO chatbot", "PLATO AI assistant", "PLATO bot", "PLATO predicts / PLATO recommends", "PLATO tells you what to buy"].map((item) => (
                  <div key={item} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.7, paddingLeft: "12px", borderLeft: "1px solid rgba(251,191,36,0.2)", marginBottom: "6px" }}>✗ {item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Asset Downloads */}
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.3em", color: "#64748B", marginBottom: "16px" }}>BRAND ASSETS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
            {[
              { label: "Phoenix Systems Logo", format: "PNG" },
              { label: "Phoenix Systems Logo", format: "SVG" },
              { label: "FAULTLINE Wordmark", format: "PNG" },
              { label: "FAULTLINE Wordmark", format: "SVG" },
              { label: "FAULTLINE Icon", format: "PNG" },
              { label: "PLATO Orb", format: "PNG" },
              { label: "Platform Screenshot", format: "PNG" },
              { label: "Seismograph™ Screenshot", format: "PNG" },
            ].map((asset, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "2px 6px" }}>{asset.format}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: "rgba(251,191,36,0.7)" }}>⏳ Pending</span>
                </div>
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#94A3B8", margin: 0, lineHeight: 1.4 }}>{asset.label}</p>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "11px", color: "#4B5563", marginTop: "16px", lineHeight: 1.6 }}>
            Visual assets are in preparation. To request assets in advance of publication, contact{" "}
            <a href="mailto:press@getfaultline.live" style={{ color: "rgba(0,212,255,0.5)", textDecoration: "none" }}>press@getfaultline.live</a>.
          </p>
        </div>
      </section>

      <div style={divider} />

      {/* ── About Phoenix Systems ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="About the Company" />
        <SectionHeading>About Phoenix Systems</SectionHeading>
        <div style={card}>
          <p style={prose}>Phoenix Systems is an AI-first technology company focused on building intelligent platforms that transform complex information into actionable understanding. The company develops decision-intelligence systems designed to reduce the information asymmetry between institutional and individual decision-makers.</p>
          <p style={prose}>Phoenix Systems was founded on a straightforward observation: most individual investors are making decisions with fundamentally incomplete situational awareness. They can see price action. They can access earnings data. What they cannot easily access is a continuous, integrated view of the underlying structural conditions that drive markets — the systemic pressures, regime shifts, and macroeconomic fault lines that institutional investors monitor as a matter of course. Phoenix Systems was created to close that gap.</p>
          <p style={prose}>The company's approach to artificial intelligence is deliberately calibrated. Phoenix Systems does not use AI to generate predictions or recommendations. It uses AI to synthesise, classify, and contextualise — to surface what is happening, why it is happening, how long it has been building, and what has historically happened in similar conditions. Every product Phoenix Systems builds is designed to reduce information asymmetry, not to manufacture false certainty.</p>
          <p style={{ ...prose, marginBottom: 0 }}>FAULTLINE is Phoenix Systems' flagship product and the first in a growing portfolio of decision-intelligence platforms. Each product in the portfolio applies the same core philosophy — probabilistic reasoning, regime awareness, and contextual intelligence — to domains where information asymmetry creates risk and where better awareness leads to better decisions.</p>
        </div>
      </section>

      <div style={divider} />

      {/* ── AI Disclosure ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <div style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: "12px", padding: "32px" }}>
          <SectionEyebrow text="AI Disclosure" />
          <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "18px", fontWeight: 700, color: "#F0F4FF", margin: "0 0 16px", letterSpacing: "0.03em" }}>Use of Artificial Intelligence</h3>
          <p style={prose}>Phoenix Systems uses artificial intelligence as a foundational component of the FAULTLINE platform. The following disclosure explains how AI is used and what it is not designed to do.</p>
          <ul style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "13px", color: "#94A3B8", lineHeight: 1.8, margin: "0 0 12px", paddingLeft: "20px" }}>
            <li style={{ marginBottom: "10px" }}><strong style={{ color: "#CBD5E1" }}>AI assists in software development.</strong> AI-assisted development tools are used to accelerate the engineering process, improve code quality, and identify potential issues before they reach production.</li>
            <li style={{ marginBottom: "10px" }}><strong style={{ color: "#CBD5E1" }}>AI assists in data synthesis and intelligence generation.</strong> FAULTLINE uses AI models to synthesise large volumes of heterogeneous data, classify market regimes, identify historical analogs, generate signal labels and diagnostic summaries, and power PLATO. AI models are used to synthesise and contextualise data — not to generate predictions, recommendations, or investment advice.</li>
            <li style={{ marginBottom: "10px" }}><strong style={{ color: "#CBD5E1" }}>Final outputs are designed to support informed decision-making.</strong> All AI-generated content is clearly labelled within the platform. AI outputs are probabilistic and reflect historical patterns and current conditions. They are intended to augment human judgment, not replace it.</li>
            <li><strong style={{ color: "#CBD5E1" }}>FAULTLINE does not guarantee predictions, investment returns, or financial outcomes.</strong> AI-generated analysis is not investment advice. Past performance of any indicator or signal does not guarantee future results.</li>
          </ul>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "12px", color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            For questions about FAULTLINE's AI systems, methodology, or data practices, contact{" "}
            <a href="mailto:press@getfaultline.live" style={{ color: "rgba(0,212,255,0.6)", textDecoration: "none" }}>press@getfaultline.live</a>.
          </p>
        </div>
      </section>

      <div style={divider} />

      {/* ── THE FAULTLINE MANIFESTO ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Founding Document" />
        <SectionHeading>The FAULTLINE Manifesto</SectionHeading>
        <div style={{ background: "rgba(0,212,255,0.02)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "12px", padding: "48px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)" }} />
          {[
            { declaration: "Markets communicate long before they move.", body: "Pressure builds in credit markets before it appears in equity prices. Liquidity deteriorates before volatility spikes. Yield curves invert months before recessions arrive. The signals are always there. They have always been there. The problem has never been the absence of signals — it has been the absence of the instruments needed to read them." },
            { declaration: "Information is abundant. Understanding is scarce.", body: "The defining challenge of modern markets is not access to data. It is the synthesis of data into coherent situational awareness. Every investor has access to more information than any investor in history. Almost none of them have access to a continuous, integrated understanding of what that information means. FAULTLINE was built to close that gap." },
            { declaration: "Hidden pressure builds long before headlines appear.", body: "By the time a market event appears in the news, the structural conditions that produced it have been building for months or years. FAULTLINE exists to reveal what is building beneath the surface before it becomes obvious — to give investors the awareness they need before the market forces the question." },
            { declaration: "Artificial intelligence should amplify human judgment, never replace it.", body: "PLATO is not designed to tell investors what to do. She is designed to ensure that when investors make decisions, those decisions are informed by the clearest possible understanding of the current state of the system. The judgment belongs to the human. The intelligence belongs to PLATO." },
            { declaration: "Every conclusion should be explainable.", body: "FAULTLINE does not produce black-box outputs. Every assessment is traceable to the engines that produced it and the historical evidence that supports it. If PLATO cannot explain why she reached a conclusion, she should not reach it." },
            { declaration: "Every probability should be evidence-based.", body: "FAULTLINE does not generate predictions. It generates probability-weighted assessments derived from historical precedent, current conditions, and multi-engine synthesis. The difference matters. A prediction claims to know the future. A probability-weighted assessment acknowledges uncertainty while providing the best available evidence about what is likely." },
            { declaration: "Institutional-quality intelligence should be available to everyone.", body: "The information asymmetry between institutional and individual investors is not a feature of markets. It is a failure of infrastructure. Institutional risk managers have access to continuous systemic awareness as a matter of course. Individual investors have historically had access to price action and earnings reports. FAULTLINE exists to change that." },
            { declaration: "The greatest investment advantage is clarity, not speed.", body: "Speed is a commodity. High-frequency traders have already won that competition. The durable edge in markets belongs to investors who understand the environment they are operating in — who know what regime they are in, what historical precedents apply, and what the range of plausible outcomes looks like. Clarity is the advantage that compounds." },
            { declaration: "Better understanding leads to better decisions.", body: "This is the principle on which FAULTLINE was built. Not better predictions. Not better signals. Better understanding. When investors understand what is happening, why it is happening, how long it has been building, and what has historically happened in similar conditions — they make better decisions. That is the mission." },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: i < 8 ? "40px" : 0, paddingBottom: i < 8 ? "40px" : 0, borderBottom: i < 8 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(16px, 2.5vw, 20px)", fontWeight: 700, color: "#F0F4FF", letterSpacing: "0.02em", marginBottom: "12px", lineHeight: 1.3 }}>
                {i + 1}. {item.declaration}
              </div>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: "14px", color: "#94A3B8", lineHeight: 1.85, margin: 0 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div style={divider} />

      {/* ── OUR MISSION ── */}
      <section style={{ ...maxW, padding: "80px 24px" }}>
        <SectionEyebrow text="Mission" />
        <SectionHeading>Our Mission</SectionHeading>
        <div style={{ ...card, borderColor: "rgba(0,212,255,0.15)", background: "rgba(0,212,255,0.02)", textAlign: "center", padding: "56px 48px" }}>
          <div style={{ position: "relative" }}>
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "#F0F4FF", lineHeight: 1.5, marginBottom: "28px", letterSpacing: "0.02em" }}>
              "Our mission is to help every investor understand markets with greater clarity through evidence-based intelligence."
            </p>
            <p style={{ ...prose, maxWidth: "600px", margin: "0 auto 28px", textAlign: "center" }}>
              Phoenix Systems is building toward a single long-term vision: to become the world's most trusted AI Market Intelligence Operating System — the platform that serious investors, traders, advisers, and institutions rely on to understand what markets are communicating before they move.
            </p>
            <p style={{ ...prose, maxWidth: "600px", margin: "0 auto", textAlign: "center" }}>
              We are at the beginning of that journey. FAULTLINE is the first product in a growing portfolio of decision-intelligence platforms. Each one will apply the same core philosophy — probabilistic reasoning, regime awareness, and contextual intelligence — to domains where information asymmetry creates risk and where better awareness leads to better decisions.
            </p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "rgba(0,212,255,0.8)", letterSpacing: "0.1em", marginTop: "36px", fontWeight: 700 }}>
              FAULTLINE EXISTS TO REVEAL WHAT IS BUILDING BENEATH THE SURFACE<br />BEFORE IT BECOMES OBVIOUS.
            </p>
          </div>
        </div>
      </section>

      <div style={divider} />

      {/* ── Media Contact ── */}
      <section style={{ ...maxW, padding: "80px 24px 96px" }}>
        <div style={{ border: "1px solid rgba(0,212,255,0.2)", borderRadius: "10px", padding: "40px", background: "rgba(0,212,255,0.03)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)" }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.35em", color: "#00D4FF", marginBottom: "16px" }}>MEDIA CONTACT</div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "16px", fontWeight: 700, color: "#F0F4FF", marginBottom: "10px" }}>Phoenix Systems Press Team</h2>
              <p style={{ fontSize: "0.9rem", color: "#94A3B8", lineHeight: 1.7, maxWidth: "460px", marginBottom: "16px" }}>For interview requests, embargoed briefings, product demonstrations, partnership inquiries, or additional press materials, contact the Phoenix Systems press team.</p>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#00D4FF", marginBottom: "6px" }}>press@getfaultline.live</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#64748B" }}>Response within 1 business day</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a href="mailto:press@getfaultline.live" style={{ display: "inline-block", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: "#050608", background: "#00D4FF", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontWeight: 700, textAlign: "center" }}>EMAIL PRESS TEAM →</a>
              <button onClick={() => copyToClipboard("press@getfaultline.live", setContactCopied)} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.2em", color: contactCopied ? "#00D4FF" : "#94A3B8", background: "transparent", border: `1px solid ${contactCopied ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.12)"}`, padding: "10px 24px", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s" }}>
                {contactCopied ? "✓ COPIED" : "COPY EMAIL"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Disclaimer ── */}
      <section style={{ ...maxW, padding: "0 24px 40px" }}>
        <p style={{ fontSize: "11px", color: "#4B5563", lineHeight: 1.7, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px" }}>
          FAULTLINE is a macroeconomic risk intelligence platform developed by Phoenix Systems. {PUBLIC_DISCLAIMER} It is not a financial adviser. Past performance of any indicator or signal does not guarantee future results.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#4B5563", letterSpacing: "0.1em" }}>
          © 2026 FAULTLINE · A{" "}
          <Link href="/phoenix-systems" style={{ color: "#4B5563" }}>Phoenix Systems</Link>{" "}
          Platform ·{" "}
          <Link href="/legal" style={{ color: "#4B5563" }}>Privacy &amp; Terms</Link>
        </p>
      </footer>

    </div>
  );
}
