/* ============================================================
   FAULTLINE — Trust Center
   Unified transparency page: Methodology, Data Sources, Privacy,
   Terms, Disclaimers, FAQ, Security, Contact
   ============================================================ */
import { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { Link } from "wouter";

const MONO = "'IBM Plex Mono', 'Courier New', monospace";
const SANS = "'IBM Plex Sans', 'Inter', sans-serif";
const HEADING = "'Rajdhani', 'Space Grotesk', sans-serif";

const TABS = [
  { id: "methodology",   label: "Methodology"   },
  { id: "data-sources",  label: "Data Sources"  },
  { id: "disclaimers",   label: "Disclaimers"   },
  { id: "faq",           label: "FAQ"           },
  { id: "privacy",       label: "Privacy"       },
  { id: "terms",         label: "Terms"         },
  { id: "security",      label: "Security"      },
  { id: "contact",       label: "Contact"       },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Shared components ─────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
      <div style={{ width: "28px", height: "1px", background: "#00D4FF", opacity: 0.6 }} />
      <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.22em", color: "#00D4FF", textTransform: "uppercase", opacity: 0.8 }}>
        {children}
      </span>
      <div style={{ flex: 1, height: "1px", background: "rgba(0,212,255,0.12)" }} />
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      padding: "24px",
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${accent ? `rgba(${accent},0.2)` : "rgba(255,255,255,0.07)"}`,
      borderRadius: "8px",
      marginBottom: "16px",
    }}>
      {children}
    </div>
  );
}

function H2({ children }: { children: string }) {
  return (
    <h2 style={{ fontFamily: HEADING, fontWeight: 700, fontSize: "clamp(1.6rem,3.5vw,2.4rem)", color: "#F0F4FF", letterSpacing: "0.02em", lineHeight: 1.15, marginBottom: "16px" }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: string }) {
  return (
    <h3 style={{ fontFamily: HEADING, fontWeight: 600, fontSize: "1.15rem", color: "#E2E8F0", marginBottom: "10px", marginTop: "24px" }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: SANS, fontSize: "0.95rem", color: "#94A3B8", lineHeight: 1.8, marginBottom: "14px" }}>
      {children}
    </p>
  );
}

// ── Tab content ───────────────────────────────────────────────

function MethodologyTab() {
  const VECTORS = [
    { name: "Credit Stress", weight: "18%", desc: "Corporate credit spreads (Moody's Baa–Treasury), high-yield spreads, and financial conditions indices. Credit markets historically lead equity markets by 2–6 weeks." },
    { name: "Liquidity Conditions", weight: "16%", desc: "Federal Reserve balance sheet, M2 money supply growth, and bank lending standards. Liquidity is the fuel that drives asset prices." },
    { name: "Yield Curve", weight: "14%", desc: "10Y–2Y Treasury spread, 10Y–3M spread. Inversions have preceded every U.S. recession since 1955 with a median lead time of 12–18 months." },
    { name: "Inflation Regime", weight: "12%", desc: "CPI, PCE, and core inflation trends. Elevated inflation constrains Fed policy and compresses equity multiples." },
    { name: "Labor Market", weight: "10%", desc: "Unemployment rate, initial jobless claims, and JOLTS data. Labor market deterioration is a lagging but confirming recession signal." },
    { name: "Volatility & Sentiment", weight: "10%", desc: "VIX levels and trend, put/call ratios, and AAII sentiment surveys. Extreme readings identify turning points." },
    { name: "Earnings Momentum", weight: "10%", desc: "Forward earnings revisions, earnings surprise rates, and profit margin trends. Earnings drive long-term equity returns." },
    { name: "Macro Momentum", weight: "10%", desc: "Leading Economic Index (LEI), ISM Manufacturing PMI, and industrial production. These composite indicators capture broad economic direction." },
  ];

  const SCORE_SCALE = [
    { range: "0–20",  label: "Calm",           color: "#22C55E", desc: "Systemic risk is minimal. Credit markets stable, liquidity ample, no recession signals." },
    { range: "20–40", label: "Normal",          color: "#84CC16", desc: "Routine market conditions. Some indicators elevated but no systemic concern." },
    { range: "40–60", label: "Elevated",        color: "#EAB308", desc: "Multiple stress indicators building. Increased caution warranted. Historical median." },
    { range: "60–80", label: "High Risk",       color: "#F97316", desc: "Significant systemic pressure. Conditions consistent with pre-recession or pre-correction environments." },
    { range: "80–100",label: "Systemic Stress", color: "#EF4444", desc: "Crisis-level conditions. Consistent with 2008 GFC peak, COVID crash, or dot-com bust." },
  ];

  return (
    <div>
      <SectionLabel>How it works</SectionLabel>
      <H2>Pressure Index Methodology</H2>
      <P>
        The FAULTLINE Pressure Index is a composite risk score that synthesizes eight independent categories of macroeconomic and market stress into a single 0–100 reading. Higher scores indicate greater systemic pressure. The engine is designed to identify building risk <em>before</em> it becomes obvious in price action.
      </P>
      <P>
        All inputs are sourced from publicly available, time-stamped economic releases. The engine uses only data that was available at the time of each reading — no hindsight, no curve-fitting.
      </P>

      <H3>Score Scale</H3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {SCORE_SCALE.map(s => (
          <div key={s.range} style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: `1px solid ${s.color}30`, borderRadius: "6px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: "1.4rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.range}</div>
              <div style={{ fontFamily: MONO, fontSize: "9px", letterSpacing: "0.15em", color: s.color, textTransform: "uppercase", marginTop: "4px" }}>{s.label}</div>
            </div>
            <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>

      <H3>Eight Measurement Vectors</H3>
      <P>The Pressure Index weights eight independent measurement categories. No single indicator dominates the score — this multi-factor approach reduces false signals and improves robustness across different market regimes.</P>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
        {VECTORS.map(v => (
          <div key={v.name} style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", display: "grid", gridTemplateColumns: "180px 60px 1fr", gap: "16px", alignItems: "start" }}>
            <div style={{ fontFamily: MONO, fontSize: "12px", color: "#00D4FF", letterSpacing: "0.06em" }}>{v.name}</div>
            <div style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 700, color: "#F0F4FF" }}>{v.weight}</div>
            <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>{v.desc}</p>
          </div>
        ))}
      </div>

      <H3>Regime Classification</H3>
      <P>In addition to the numeric score, the engine classifies the current environment into one of five macro regimes: <strong style={{ color: "#F0F4FF" }}>Expansion, Moderate Pressure, Elevated Risk, High Risk,</strong> and <strong style={{ color: "#F0F4FF" }}>Systemic Stress</strong>. Regime classification drives the signal weighting applied to individual asset analysis.</P>

      <H3>Known Limitations</H3>
      <Card>
        <ul style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#94A3B8", lineHeight: 2, paddingLeft: "20px", margin: 0 }}>
          <li>All FRED inputs are lagging economic releases — the engine cannot see the future.</li>
          <li>The model was designed for U.S. macro conditions and may be less reliable in non-U.S. contexts.</li>
          <li>Sudden exogenous shocks (pandemics, geopolitical events) may not be captured until data releases confirm them.</li>
          <li>The Pressure Index measures systemic risk, not individual stock performance. A high score does not guarantee a market decline.</li>
          <li>Back-test results reflect what the model would have produced using data available at the time — not what it would have predicted in advance.</li>
        </ul>
      </Card>

      <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <a href="/track-record" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", color: "#00D4FF", textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "4px" }}>
          VIEW TRACK RECORD →
        </a>
        <a href="/pressure-index" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", color: "#94A3B8", textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px" }}>
          LIVE PRESSURE INDEX →
        </a>
      </div>
    </div>
  );
}

function DataSourcesTab() {
  const SOURCES = [
    {
      name: "Federal Reserve / FRED",
      url: "https://fred.stlouisfed.org",
      category: "Macroeconomic Data",
      inputs: ["Federal Funds Rate", "M2 Money Supply", "Bank Lending Standards", "Balance Sheet Data"],
      updateFreq: "Weekly / Monthly",
      notes: "Primary macroeconomic data source. All FRED series are publicly available and time-stamped.",
    },
    {
      name: "U.S. Treasury",
      url: "https://home.treasury.gov",
      category: "Fixed Income",
      inputs: ["Treasury Yield Curve (2Y, 10Y, 30Y)", "Yield Spread Data"],
      updateFreq: "Daily",
      notes: "Daily yield curve data used for yield spread calculations and inversion detection.",
    },
    {
      name: "Bureau of Labor Statistics",
      url: "https://www.bls.gov",
      category: "Labor Market",
      inputs: ["Unemployment Rate", "Initial Jobless Claims", "JOLTS Job Openings"],
      updateFreq: "Weekly / Monthly",
      notes: "Official U.S. government labor market statistics.",
    },
    {
      name: "Moody's / FRED",
      url: "https://fred.stlouisfed.org/series/BAA10Y",
      category: "Credit Markets",
      inputs: ["Baa Corporate Bond Spread", "High-Yield Spread Proxies"],
      updateFreq: "Daily",
      notes: "Credit spread data is the highest-weighted input in the Pressure Index. Moody's Baa spreads are available via FRED.",
    },
    {
      name: "Bureau of Economic Analysis",
      url: "https://www.bea.gov",
      category: "Economic Output",
      inputs: ["GDP Growth Rate", "PCE Inflation", "Personal Income"],
      updateFreq: "Monthly / Quarterly",
      notes: "Official U.S. national accounts data.",
    },
    {
      name: "Polygon.io",
      url: "https://polygon.io",
      category: "Market Data",
      inputs: ["Equity Prices (OHLCV)", "Daily Bar Data", "Ticker Reference Data"],
      updateFreq: "Real-time / Daily",
      notes: "Used for stock signal calculations, technical indicators (RSI, MACD, SMA), and sparkline data.",
    },
    {
      name: "CoinGecko",
      url: "https://www.coingecko.com",
      category: "Cryptocurrency",
      inputs: ["Crypto Prices", "Market Caps", "Global Crypto Market Data"],
      updateFreq: "Real-time",
      notes: "Used for cryptocurrency intelligence and crypto market regime analysis.",
    },
    {
      name: "Conference Board / FRED",
      url: "https://fred.stlouisfed.org/series/USSLIND",
      category: "Leading Indicators",
      inputs: ["Leading Economic Index (LEI)", "ISM Manufacturing PMI"],
      updateFreq: "Monthly",
      notes: "Composite leading indicators used for macro momentum scoring.",
    },
  ];

  return (
    <div>
      <SectionLabel>Transparency</SectionLabel>
      <H2>Data Sources</H2>
      <P>
        FAULTLINE synthesizes data from multiple publicly available, institutional-grade sources into a unified risk framework. We do not expose proprietary processing logic, but we are fully transparent about where our data originates.
      </P>
      <P>
        All data sources listed below are publicly accessible. FAULTLINE does not manufacture or estimate data — every input is sourced from a named provider with a documented update frequency.
      </P>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
        {SOURCES.map(s => (
          <div key={s.name} style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              <div>
                <div style={{ fontFamily: HEADING, fontWeight: 600, fontSize: "1rem", color: "#F0F4FF" }}>{s.name}</div>
                <div style={{ fontFamily: MONO, fontSize: "10px", color: "#00D4FF", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "3px" }}>{s.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: "10px", color: "#64748B", letterSpacing: "0.08em" }}>UPDATE FREQUENCY</div>
                <div style={{ fontFamily: MONO, fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{s.updateFreq}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
              {s.inputs.map(inp => (
                <span key={inp} style={{ fontFamily: MONO, fontSize: "10px", color: "#64748B", padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "3px" }}>
                  {inp}
                </span>
              ))}
            </div>
            <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#64748B", lineHeight: 1.6, margin: 0 }}>{s.notes}</p>
          </div>
        ))}
      </div>

      <Card>
        <div style={{ fontFamily: MONO, fontSize: "11px", color: "#22C55E", letterSpacing: "0.15em", marginBottom: "10px" }}>WHAT WE DO NOT EXPOSE</div>
        <P>FAULTLINE does not disclose proprietary weighting algorithms, signal combination logic, or internal scoring thresholds. The data sources above represent the raw inputs — the synthesis methodology is described in the Methodology tab.</P>
      </Card>
    </div>
  );
}

function DisclaimersTab() {
  return (
    <div>
      <SectionLabel>Legal</SectionLabel>
      <H2>Disclaimers &amp; Risk Disclosures</H2>

      <div style={{ padding: "20px 24px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", marginBottom: "28px" }}>
        <div style={{ fontFamily: MONO, fontSize: "11px", color: "#EF4444", letterSpacing: "0.15em", marginBottom: "10px" }}>IMPORTANT — READ BEFORE USING FAULTLINE</div>
        <P>FAULTLINE is an educational and informational platform. Nothing on this platform constitutes individualized investment advice, a recommendation to buy or sell any security, or a solicitation of any investment. All information is provided for educational purposes only.</P>
      </div>

      <H3>Not Investment Advice</H3>
      <P>The content, analysis, signals, scores, and commentary provided by FAULTLINE — including the Pressure Index, regime classifications, stock signals, crypto intelligence, and AI-generated analysis — are for <strong style={{ color: "#F0F4FF" }}>educational and informational purposes only</strong>. They do not constitute investment advice, financial advice, trading advice, or any other type of advice.</P>
      <P>FAULTLINE is not a registered investment advisor, broker-dealer, or financial planner. No content on this platform should be construed as a recommendation to buy, sell, or hold any security, cryptocurrency, or other financial instrument.</P>

      <H3>Investing Involves Risk</H3>
      <P>All investing involves risk, including the possible loss of principal. Past performance — including historical Pressure Index readings and back-tested results — does not guarantee future results. Market conditions can and do change rapidly in ways that cannot be predicted by any model.</P>
      <P>The Pressure Index and related signals are probabilistic tools, not certainties. A high Pressure Index reading does not guarantee a market decline. A low reading does not guarantee continued appreciation.</P>

      <H3>You Are Responsible for Your Decisions</H3>
      <P>Users of FAULTLINE are solely responsible for their own investment decisions. Before making any investment decision, you should conduct your own due diligence, consult with a qualified financial advisor, and consider your own financial situation, risk tolerance, and investment objectives.</P>

      <H3>Data Accuracy</H3>
      <P>While FAULTLINE makes reasonable efforts to ensure the accuracy of data sourced from third-party providers (Federal Reserve, FRED, Polygon.io, CoinGecko, and others), we cannot guarantee the accuracy, completeness, or timeliness of any data. Data may be delayed, incomplete, or subject to revision by the original source.</P>

      <H3>Forward-Looking Statements</H3>
      <P>Any statements about future market conditions, probabilities, or outcomes are forward-looking and inherently uncertain. These statements are based on historical patterns and current data — they are not predictions and should not be treated as such.</P>

      <H3>No Fiduciary Relationship</H3>
      <P>Use of FAULTLINE does not create a fiduciary relationship between FAULTLINE, Phoenix Systems, or any of their affiliates and the user. FAULTLINE provides tools and information — the user retains full responsibility for all investment decisions.</P>

      <div style={{ marginTop: "28px", padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px" }}>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#64748B", letterSpacing: "0.1em", marginBottom: "8px" }}>FULL LEGAL DOCUMENTS</div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="/legal#terms" style={{ fontFamily: MONO, fontSize: "11px", color: "#00D4FF", textDecoration: "none" }}>Terms of Service →</a>
          <a href="/legal#privacy" style={{ fontFamily: MONO, fontSize: "11px", color: "#00D4FF", textDecoration: "none" }}>Privacy Policy →</a>
        </div>
      </div>
    </div>
  );
}

function FAQTab() {
  const [open, setOpen] = useState<number | null>(null);

  const FAQS = [
    {
      q: "What is the FAULTLINE Pressure Index?",
      a: "The Pressure Index is a composite 0–100 score that measures systemic market stress across eight categories: credit markets, liquidity, yield curve, inflation, labor market, volatility, earnings momentum, and macro momentum. Higher scores indicate greater systemic pressure. It is designed to identify building risk before it becomes obvious in price action.",
    },
    {
      q: "Is FAULTLINE investment advice?",
      a: "No. FAULTLINE is an educational and informational platform. Nothing on this platform constitutes investment advice, a recommendation to buy or sell any security, or a solicitation of any investment. All content is for educational purposes only. You are solely responsible for your investment decisions.",
    },
    {
      q: "How accurate is the Pressure Index?",
      a: "The Pressure Index was back-tested against 25 years of FRED macroeconomic data. In every major market crisis since 2000 — the dot-com bust, the 2008 financial crisis, the COVID crash, and the 2022 bear market — the Pressure Index was elevated before the peak. However, past performance does not guarantee future results. The index is a probabilistic tool, not a certainty.",
    },
    {
      q: "Where does FAULTLINE get its data?",
      a: "FAULTLINE sources data from publicly available, institutional-grade providers including the Federal Reserve (FRED), U.S. Treasury, Bureau of Labor Statistics, Bureau of Economic Analysis, Moody's (via FRED), Polygon.io (market data), and CoinGecko (crypto). See the Data Sources tab for the complete list.",
    },
    {
      q: "How often is the Pressure Index updated?",
      a: "The Pressure Index is updated whenever new underlying data is released by source providers. FRED macroeconomic data is typically released weekly or monthly. The engine recalculates automatically when new inputs are available. The timestamp on the Pressure Index reading reflects the most recent calculation.",
    },
    {
      q: "What is ASHA?",
      a: "ASHA (Adaptive Systemic Heuristic Analyst) is FAULTLINE's AI intelligence layer. ASHA synthesizes the current Pressure Index reading, regime classification, and market conditions into natural-language briefings and answers questions about market conditions. ASHA does not provide investment advice.",
    },
    {
      q: "What is the difference between the plans?",
      a: "The Observer (free) plan provides access to the live Pressure Index, one daily briefing, and limited signals. The FAULTLINE Mobile plan ($9.99/mo) adds full watchlist and rotation tools. The Trader plan ($59/mo) provides full access to all intelligence modules. The Founding Member plan ($49/mo) locks in a rate for life. Lifetime Access ($299 one-time) provides permanent access to all current and future features.",
    },
    {
      q: "Is my data secure?",
      a: "Yes. FAULTLINE uses industry-standard encryption for all data in transit (TLS 1.3) and at rest. We do not sell user data to third parties. Authentication is handled via OAuth 2.0. See the Security tab for more details.",
    },
    {
      q: "Can I cancel my subscription?",
      a: "Yes. You can cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. Lifetime Access purchases are non-refundable.",
    },
    {
      q: "Who built FAULTLINE?",
      a: "FAULTLINE was built by Phoenix Systems, an independent technology company focused on making institutional-quality macro intelligence accessible to self-directed investors. See the About page for more information.",
    },
  ];

  return (
    <div>
      <SectionLabel>Common questions</SectionLabel>
      <H2>Frequently Asked Questions</H2>
      <P>If you have a question not answered here, contact us at <a href="mailto:support@getfaultline.live" style={{ color: "#00D4FF" }}>support@getfaultline.live</a>.</P>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "24px" }}>
        {FAQS.map((faq, i) => (
          <div key={i} style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", overflow: "hidden", background: open === i ? "rgba(0,212,255,0.03)" : "rgba(255,255,255,0.01)" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: "100%", textAlign: "left", padding: "18px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}
            >
              <span style={{ fontFamily: SANS, fontSize: "0.95rem", fontWeight: 600, color: "#E2E8F0", lineHeight: 1.4 }}>{faq.q}</span>
              <span style={{ fontFamily: MONO, fontSize: "16px", color: "#00D4FF", flexShrink: 0, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
            </button>
            {open === i && (
              <div style={{ padding: "0 20px 18px" }}>
                <p style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#94A3B8", lineHeight: 1.8, margin: 0 }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacyTab() {
  return (
    <div>
      <SectionLabel>Privacy</SectionLabel>
      <H2>Privacy Policy</H2>
      <P>Last updated: August 2026. For the full legal privacy policy, see <a href="/legal#privacy" style={{ color: "#00D4FF" }}>Legal → Privacy Policy</a>.</P>

      <H3>What We Collect</H3>
      <P>We collect information you provide directly (name, email, payment information via Stripe), information collected automatically (page views, session data, device type, browser, IP address for geo-analytics), and data from third-party authentication providers (OAuth).</P>

      <H3>How We Use It</H3>
      <P>We use your data to provide and improve the FAULTLINE service, process payments, send service-related communications, and analyze aggregate usage patterns. We do not sell your personal data to third parties.</P>

      <H3>Data Providers</H3>
      <P>FAULTLINE uses the following third-party services that may process your data: Stripe (payments), Google Analytics (anonymous usage analytics), Sentry (error tracking), and Manus Auth (authentication). Each provider has their own privacy policy.</P>

      <H3>Your Rights</H3>
      <P>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:privacy@getfaultline.live" style={{ color: "#00D4FF" }}>privacy@getfaultline.live</a>.</P>

      <a href="/legal#privacy" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", color: "#00D4FF", textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "4px", display: "inline-block", marginTop: "16px" }}>
        READ FULL PRIVACY POLICY →
      </a>
    </div>
  );
}

function TermsTab() {
  return (
    <div>
      <SectionLabel>Legal</SectionLabel>
      <H2>Terms of Service</H2>
      <P>Last updated: August 2026. For the full legal terms of service, see <a href="/legal#terms" style={{ color: "#00D4FF" }}>Legal → Terms of Service</a>.</P>

      <H3>Service Description</H3>
      <P>FAULTLINE is a subscription-based market intelligence platform providing macroeconomic analysis, risk scoring, and educational content. The service is provided "as is" without warranties of any kind.</P>

      <H3>Acceptable Use</H3>
      <P>You may use FAULTLINE for personal, non-commercial investment research and education. You may not redistribute, resell, or republish FAULTLINE content without written permission. You may not use automated tools to scrape or extract data from the platform.</P>

      <H3>Subscriptions and Payments</H3>
      <P>Subscriptions are billed monthly or as a one-time payment (Lifetime Access). Subscriptions renew automatically unless cancelled. Cancellation takes effect at the end of the current billing period. Lifetime Access purchases are non-refundable.</P>

      <H3>Limitation of Liability</H3>
      <P>FAULTLINE and Phoenix Systems are not liable for any investment losses, trading decisions, or financial outcomes resulting from use of the platform. The platform is for educational purposes only.</P>

      <a href="/legal#terms" style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.15em", color: "#00D4FF", textDecoration: "none", padding: "10px 20px", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "4px", display: "inline-block", marginTop: "16px" }}>
        READ FULL TERMS OF SERVICE →
      </a>
    </div>
  );
}

function SecurityTab() {
  const MEASURES = [
    { title: "Encryption in Transit", desc: "All data transmitted between your browser and FAULTLINE servers is encrypted using TLS 1.3. HTTPS is enforced on all endpoints." },
    { title: "Authentication", desc: "Authentication is handled via OAuth 2.0 through Manus Auth. Passwords are never stored by FAULTLINE. Session tokens are signed with a secure JWT secret." },
    { title: "Payment Security", desc: "All payment processing is handled by Stripe, a PCI-DSS Level 1 certified payment processor. FAULTLINE never stores full card numbers, CVV codes, or raw payment data." },
    { title: "API Key Security", desc: "All third-party API keys (FRED, Polygon.io, CoinGecko) are stored as server-side environment variables and are never exposed to the client or included in API responses." },
    { title: "Data Isolation", desc: "User data is stored in isolated database tables with row-level access controls. Users can only access their own data." },
    { title: "Error Monitoring", desc: "Production errors are monitored via Sentry with PII scrubbing enabled. Error reports do not contain sensitive user data." },
  ];

  return (
    <div>
      <SectionLabel>Security</SectionLabel>
      <H2>Security Practices</H2>
      <P>FAULTLINE takes the security of user data seriously. The following measures are in place to protect your information.</P>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        {MEASURES.map(m => (
          <div key={m.title} style={{ padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px" }}>
            <div style={{ fontFamily: HEADING, fontWeight: 600, fontSize: "0.95rem", color: "#E2E8F0", marginBottom: "8px" }}>{m.title}</div>
            <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.7, margin: 0 }}>{m.desc}</p>
          </div>
        ))}
      </div>

      <H3>Responsible Disclosure</H3>
      <P>If you discover a security vulnerability in FAULTLINE, please report it to <a href="mailto:security@getfaultline.live" style={{ color: "#00D4FF" }}>security@getfaultline.live</a>. We will acknowledge your report within 48 hours and work to resolve confirmed vulnerabilities promptly.</P>
    </div>
  );
}

function ContactTab() {
  return (
    <div>
      <SectionLabel>Get in touch</SectionLabel>
      <H2>Contact</H2>
      <P>We respond to all inquiries within 1–2 business days.</P>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "General Inquiries", email: "hello@getfaultline.live", desc: "Questions about FAULTLINE, the platform, or our methodology." },
          { label: "Support", email: "support@getfaultline.live", desc: "Technical issues, billing questions, or account help." },
          { label: "Privacy", email: "privacy@getfaultline.live", desc: "Data access, deletion requests, or privacy concerns." },
          { label: "Security", email: "security@getfaultline.live", desc: "Responsible disclosure of security vulnerabilities." },
          { label: "Press & Media", email: "press@getfaultline.live", desc: "Media inquiries, interviews, or partnership discussions." },
          { label: "Business", email: "business@getfaultline.live", desc: "Enterprise licensing, API access, or institutional partnerships." },
        ].map(c => (
          <div key={c.label} style={{ padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px" }}>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: "#00D4FF", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>{c.label}</div>
            <a href={`mailto:${c.email}`} style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#F0F4FF", textDecoration: "none", display: "block", marginBottom: "6px" }}>{c.email}</a>
            <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#64748B", lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px" }}>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#64748B", letterSpacing: "0.1em", marginBottom: "8px" }}>FULL CONTACT FORM</div>
        <P>For a structured contact form with category routing, visit <a href="/contact" style={{ color: "#00D4FF" }}>getfaultline.live/contact</a>.</P>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function TrustCenter() {
  const [activeTab, setActiveTab] = useState<TabId>("methodology");

  useSEO({
    title: "Trust Center — FAULTLINE",
    description: "FAULTLINE Trust Center: methodology, data sources, disclaimers, privacy policy, terms of service, security practices, FAQ, and contact information.",
    canonical: "/trust",
  });

  const tabContent: Record<TabId, React.ReactNode> = {
    "methodology":  <MethodologyTab />,
    "data-sources": <DataSourcesTab />,
    "disclaimers":  <DisclaimersTab />,
    "faq":          <FAQTab />,
    "privacy":      <PrivacyTab />,
    "terms":        <TermsTab />,
    "security":     <SecurityTab />,
    "contact":      <ContactTab />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050608", color: "#F0F4FF" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(0,212,255,0.08)", padding: "40px 0 0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <Link href="/" style={{ fontFamily: MONO, fontSize: "11px", color: "#64748B", textDecoration: "none", letterSpacing: "0.1em" }}>FAULTLINE</Link>
            <span style={{ color: "#334155" }}>/</span>
            <span style={{ fontFamily: MONO, fontSize: "11px", color: "#00D4FF", letterSpacing: "0.1em" }}>TRUST CENTER</span>
          </div>
          <h1 style={{ fontFamily: HEADING, fontWeight: 700, fontSize: "clamp(2rem,5vw,3.2rem)", color: "#F0F4FF", letterSpacing: "0.02em", lineHeight: 1.1, marginBottom: "12px" }}>
            Trust Center
          </h1>
          <p style={{ fontFamily: SANS, fontSize: "1.05rem", color: "#94A3B8", lineHeight: 1.6, maxWidth: "600px", marginBottom: "32px" }}>
            Transparency about how FAULTLINE works, where data comes from, and how we protect your information.
          </p>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: "0", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: activeTab === tab.id ? "#00D4FF" : "#64748B",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid #00D4FF" : "2px solid transparent",
                  padding: "12px 20px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px 80px" }}>
        {tabContent[activeTab]}
      </div>

      {/* Footer disclaimer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "24px", textAlign: "center" }}>
        <p style={{ fontFamily: MONO, fontSize: "10px", color: "#334155", letterSpacing: "0.1em", maxWidth: "700px", margin: "0 auto", lineHeight: 1.8 }}>
          FAULTLINE IS FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY. NOT INVESTMENT ADVICE. INVESTING INVOLVES RISK. PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS. © {new Date().getFullYear()} PHOENIX SYSTEMS. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
}
