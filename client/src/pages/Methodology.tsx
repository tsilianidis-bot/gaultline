/**
 * FAULTLINE — Methodology & Transparency Page
 *
 * Explains the scoring model, data sources, limitations, and disclaimers
 * in plain language. This page is publicly accessible (no auth required).
 */
import { useEffect } from "react";
import { Link } from "wouter";

// ── Data source table ─────────────────────────────────────────
const DATA_SOURCES = [
  {
    vector: "Credit Market Stress",
    inputs: "HY OAS spread, IG OAS spread",
    source: "FRED (ICE BofA indices)",
    frequency: "Daily",
    status: "Live",
    statusColor: "#00FF88",
    lag: "T+1 business day",
  },
  {
    vector: "Yield Curve / Rate Shock",
    inputs: "10Y yield, 30Y yield, 10Y–2Y spread",
    source: "FRED (DGS10, DGS30, T10Y2Y)",
    frequency: "Daily",
    status: "Live",
    statusColor: "#00FF88",
    lag: "T+1 business day",
  },
  {
    vector: "Inflation Pressure",
    inputs: "CPI YoY, PPI YoY, Fed Funds Rate",
    source: "FRED (CPIAUCSL, PPIACO, FEDFUNDS)",
    frequency: "Monthly / Daily",
    status: "Delayed",
    statusColor: "#F59E0B",
    lag: "CPI/PPI: 30–45 day lag",
  },
  {
    vector: "AI Bubble / Speculation",
    inputs: "AI/mega-cap S&P concentration, hyperscaler capex growth",
    source: "Static model estimate",
    frequency: "Manual update",
    status: "Static",
    statusColor: "#F59E0B",
    lag: "No live feed — baseline is a model estimate adjusted by live FRED inputs",
  },
  {
    vector: "Sovereign Debt Stress",
    inputs: "Treasury auction bid-to-cover, debt-to-GDP %",
    source: "FRED (MSPUS, GFDEGDQ188S)",
    frequency: "Quarterly / Auction-based",
    status: "Delayed",
    statusColor: "#F59E0B",
    lag: "Quarterly lag for debt-to-GDP",
  },
  {
    vector: "Liquidity Conditions",
    inputs: "Bank liquidity stress composite, Fed balance sheet, VIX, unemployment",
    source: "FRED (DPCREDIT, WALCL, VIXCLS, UNRATE)",
    frequency: "Daily / Monthly",
    status: "Live / Delayed",
    statusColor: "#F59E0B",
    lag: "Unemployment: monthly lag",
  },
  {
    vector: "Recession Probability",
    inputs: "Unemployment (Sahm Rule proxy), yield curve inversion, credit spreads, CRE stress",
    source: "FRED composite",
    frequency: "Monthly / Daily",
    status: "Live / Delayed",
    statusColor: "#F59E0B",
    lag: "Unemployment: monthly lag",
  },
];

// ── Scoring methodology cards ─────────────────────────────────
const METHODOLOGY_CARDS = [
  {
    icon: "◈",
    title: "Weighted Composite Scoring",
    body: "Each risk vector is scored 0–10 using a piecewise linear function calibrated to historical stress episodes (2008 GFC, 2020 COVID crash, 2022 rate shock). The overall Pressure Index is a weighted composite of all vectors. Weights are fixed and disclosed in the open-source model.",
    color: "#00D4FF",
  },
  {
    icon: "◉",
    title: "Regime Classification",
    body: "The overall score maps to five regimes: Low Risk (0–3.5), Moderate Risk (3.5–5.5), Elevated Stress (5.5–7.0), Late-Cycle Fragility (7.0–8.5), and Systemic Crisis (8.5–10). Regime boundaries were calibrated against NBER recession dates and CBOE VIX spike events.",
    color: "#22D3EE",
  },
  {
    icon: "◆",
    title: "Historical Analog Matching",
    body: "The engine computes cosine similarity between the current indicator vector and a library of historical episodes. Similarity scores above 70% are surfaced as analogs. This is a pattern-recognition tool, not a prediction. Past structural similarity does not guarantee future outcomes.",
    color: "#A78BFA",
  },
  {
    icon: "◇",
    title: "Probability Estimates",
    body: "Crash, recession, bull, and stagflation probabilities are derived from a logistic regression model trained on the same historical library. These are model outputs — not forecasts. They reflect the base rate of outcomes given similar historical conditions, not certainty about the future.",
    color: "#F472B6",
  },
];

// ── Known limitations ─────────────────────────────────────────
const LIMITATIONS = [
  {
    title: "AI Bubble vector uses a static baseline",
    detail: "The AI/mega-cap concentration input (currently 32.4%) is a manually maintained estimate. No live market-cap data feed is wired. The score is dynamically adjusted by live FRED rate and spread inputs, but the concentration baseline does not update automatically.",
  },
  {
    title: "Monthly indicators introduce lag",
    detail: "CPI, PPI, unemployment, and debt-to-GDP are released monthly with a 30–45 day lag. The engine uses the most recent available release. During fast-moving macro environments, these inputs may not reflect current conditions.",
  },
  {
    title: "Model weights are static",
    detail: "Vector weights and scoring functions were calibrated on historical data and are not dynamically updated. The model does not learn from new data in real time. Regime boundaries may not be optimal for future structural shifts.",
  },
  {
    title: "No intraday data",
    detail: "All FRED data is end-of-day or lower frequency. The engine does not use intraday price feeds, order flow, or options market data. The Pressure Index reflects macro structural conditions, not short-term price action.",
  },
  {
    title: "Analog matching is pattern recognition, not prediction",
    detail: "Historical analog similarity identifies structural resemblance to past episodes. It does not predict that outcomes will repeat. Markets can diverge from historical patterns for extended periods.",
  },
];

export default function Methodology() {
  useEffect(() => {
    document.title = "Methodology & Transparency — FAULTLINE";
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080A10",
        color: "#E2E8F0",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
              fontWeight: 800,
              fontSize: "20px",
              letterSpacing: "0.15em",
              color: "#00D4FF",
              cursor: "pointer",
            }}
          >
            FAULTLINE
          </span>
        </Link>
        <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          <Link href="/track-record"><span style={{ cursor: "pointer" }}>Track Record</span></Link>
          <Link href="/contact"><span style={{ cursor: "pointer" }}>Contact</span></Link>
          <Link href="/legal"><span style={{ cursor: "pointer" }}>Legal</span></Link>
        </div>
      </nav>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "60px 24px 120px" }}>

        {/* Header */}
        <div style={{ marginBottom: "64px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.25)",
              marginBottom: "16px",
            }}
          >
            TRANSPARENCY DISCLOSURE
          </div>
          <h1
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(32px, 6vw, 52px)",
              lineHeight: 1.05,
              marginBottom: "20px",
              background: "linear-gradient(135deg, #FFFFFF 0%, rgba(255,255,255,0.6) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Methodology &<br />Data Transparency
          </h1>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: "640px" }}>
            FAULTLINE is a macro risk intelligence tool. This page explains exactly how the Pressure Index is
            calculated, where the data comes from, what the known limitations are, and what the scores do and
            do not mean. We believe transparency is non-negotiable for any tool used to inform financial decisions.
          </p>
        </div>

        {/* Scoring Methodology */}
        <section style={{ marginBottom: "64px" }}>
          <SectionHeader label="SCORING MODEL" title="How the Pressure Index is calculated" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: "16px" }}>
            {METHODOLOGY_CARDS.map(card => (
              <div
                key={card.title}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "24px",
                }}
              >
                <div style={{ fontSize: "20px", color: card.color, marginBottom: "10px" }}>{card.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "10px", color: "#E2E8F0" }}>{card.title}</div>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources */}
        <section style={{ marginBottom: "64px" }}>
          <SectionHeader label="DATA SOURCES" title="Where the data comes from" />
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Risk Vector", "Inputs", "Source", "Frequency", "Status", "Data Lag"].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "9px",
                        letterSpacing: "0.2em",
                        color: "rgba(255,255,255,0.3)",
                        fontWeight: 400,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATA_SOURCES.map((row, i) => (
                  <tr
                    key={row.vector}
                    style={{
                      borderBottom: i < DATA_SOURCES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#E2E8F0", whiteSpace: "nowrap" }}>{row.vector}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>{row.inputs}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.45)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", whiteSpace: "nowrap" }}>{row.source}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>{row.frequency}</td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: "'IBM Plex Mono', monospace",
                          letterSpacing: "0.1em",
                          color: row.statusColor,
                          background: `${row.statusColor}15`,
                          border: `1px solid ${row.statusColor}30`,
                          borderRadius: "4px",
                          padding: "2px 6px",
                        }}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>{row.lag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "12px", fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "'IBM Plex Mono', monospace" }}>
            FRED = Federal Reserve Bank of St. Louis Economic Data. All FRED series are publicly available at fred.stlouisfed.org.
          </p>
        </section>

        {/* Known Limitations */}
        <section style={{ marginBottom: "64px" }}>
          <SectionHeader label="KNOWN LIMITATIONS" title="What the model does not do" />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {LIMITATIONS.map(lim => (
              <div
                key={lim.title}
                style={{
                  background: "rgba(251,191,36,0.04)",
                  border: "1px solid rgba(251,191,36,0.12)",
                  borderRadius: "10px",
                  padding: "20px 24px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ color: "#F59E0B", fontSize: "14px", marginTop: "2px", flexShrink: 0 }}>⚠</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#E2E8F0", marginBottom: "6px" }}>{lim.title}</div>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: 0 }}>{lim.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section>
          <SectionHeader label="IMPORTANT DISCLAIMER" title="This is not investment advice" />
          <div
            style={{
              background: "rgba(255,45,85,0.05)",
              border: "1px solid rgba(255,45,85,0.15)",
              borderRadius: "12px",
              padding: "28px 32px",
            }}
          >
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, margin: "0 0 16px" }}>
              <strong style={{ color: "#E2E8F0" }}>FAULTLINE is an informational and educational tool only.</strong> The Pressure Index,
              regime classifications, probability estimates, historical analogs, and all other outputs are model-generated
              indicators — not financial advice, investment recommendations, or predictions of future market performance.
            </p>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, margin: "0 0 16px" }}>
              Past structural similarity to historical episodes does not guarantee that future outcomes will resemble those episodes.
              Markets can remain irrational for extended periods and can diverge from any model's expectations indefinitely.
            </p>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.8, margin: 0 }}>
              <strong style={{ color: "#E2E8F0" }}>Always consult a qualified financial advisor before making investment decisions.</strong> FAULTLINE
              does not know your personal financial situation, risk tolerance, investment horizon, or tax circumstances.
              Nothing on this platform should be construed as a solicitation to buy or sell any security.
            </p>
          </div>
          <p style={{ marginTop: "16px", fontSize: "12px", color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
            For the full legal disclaimer, see our <Link href="/legal"><span style={{ color: "rgba(0,212,255,0.6)", cursor: "pointer" }}>Terms of Service and Legal Disclosure</span></Link>.
            For questions about the methodology, contact us at <Link href="/contact"><span style={{ color: "rgba(0,212,255,0.6)", cursor: "pointer" }}>the contact page</span></Link>.
          </p>
        </section>

      </div>
    </div>
  );
}

// ── Section header helper ─────────────────────────────────────
function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.3em",
          color: "rgba(255,255,255,0.25)",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <h2
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: "22px",
          color: "#E2E8F0",
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
  );
}
