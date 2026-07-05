import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";

const TEAM_PRINCIPLES = [
  {
    icon: "◆",
    title: "Risk-first, always",
    body:
      "Every feature we build starts with the question: does this help users understand the risk environment they are operating in? We do not build noise. We build signal.",
  },
  {
    icon: "◆",
    title: "Probabilistic over binary",
    body:
      "Markets do not operate in certainties. FAULTLINE surfaces likelihoods, regimes, and stress indicators — not buy or sell signals. We believe informed investors make better decisions when they understand the probability landscape.",
  },
  {
    icon: "◆",
    title: "Transparency in methodology",
    body:
      "Every indicator, score, and classification in FAULTLINE is documented. We publish our data sources, weighting logic, and regime definitions. If you cannot audit it, you should not trust it.",
  },
  {
    icon: "◆",
    title: "Institutional intelligence, individual access",
    body:
      "The information asymmetry between institutional and individual investors is a structural problem. FAULTLINE is built to close that gap — not by dumbing things down, but by making complexity navigable.",
  },
];

const PLATFORM_PILLARS = [
  {
    label: "Pressure Index",
    desc:
      "A composite 0–100 score synthesising macroeconomic, financial, and market stress indicators across seven risk vectors. Updated continuously.",
    color: "#00D4FF",
  },
  {
    label: "Regime Detection",
    desc:
      "Classifies the current macro environment into five regimes: Low Risk, Moderate Risk, Elevated Risk, High Risk, and Critical. Regime context is applied to every signal.",
    color: "#22D3EE",
  },
  {
    label: "Signal Intelligence",
    desc:
      "Institutional-grade signals across equities, crypto, and macro. Includes directional bias, conviction scores, and regime context for every signal.",
    color: "#00D4FF",
  },
  {
    label: "Ask Intelligence",
    desc:
      "An AI-powered diagnostic layer that answers questions about the current macro environment, specific assets, and risk scenarios — grounded in live platform data.",
    color: "#22D3EE",
  },
  {
    label: "Decision Engine",
    desc:
      "A structured decision-support tool that evaluates trade ideas against the current macro regime, pressure score, and signal context.",
    color: "#00D4FF",
  },
  {
    label: "Symbol Intelligence",
    desc:
      "Deep-dive analysis for individual stocks and crypto assets. Includes pressure context, institutional flow, signal overlay, and AI diagnostic summary.",
    color: "#22D3EE",
  },
];

export default function About() {
  useSEO({
    title: "About — FAULTLINE by Phoenix Systems",
    description:
      "FAULTLINE is a macroeconomic risk intelligence platform developed by Phoenix Systems. Learn about our mission, methodology, and the team behind the platform.",
    canonical: "/about",
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
                paddingLeft: "4px",
              }}
            >
              ABOUT
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Link
              href="/"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "#64748B",
                textDecoration: "none",
              }}
            >
              HOME
            </Link>
            <Link
              href="/press"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "#64748B",
                textDecoration: "none",
              }}
            >
              PRESS
            </Link>
            <Link
              href="/app/discover"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: "#00D4FF",
                textDecoration: "none",
                border: "1px solid rgba(0,212,255,0.3)",
                padding: "6px 14px",
                borderRadius: "5px",
              }}
            >
              OPEN APP →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "72px 24px 56px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "rgba(0,212,255,0.5)",
            textTransform: "uppercase",
            marginBottom: "16px",
          }}
        >
          ◆ About FAULTLINE
        </div>
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "clamp(32px, 5vw, 52px)",
            fontWeight: 700,
            color: "#F0F4FF",
            lineHeight: 1.1,
            letterSpacing: "0.03em",
            margin: "0 0 24px",
          }}
        >
          Built to see what markets
          <br />
          <span style={{ color: "#00D4FF" }}>miss before they reprice.</span>
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "#94A3B8",
            lineHeight: 1.75,
            maxWidth: "640px",
            margin: 0,
          }}
        >
          FAULTLINE is a macroeconomic risk intelligence platform developed by
          Phoenix Systems. It monitors the economic, financial, and market fault
          lines where stress builds beneath the surface — detecting regime shifts
          before they become obvious in price action.
        </p>
      </section>

      {/* ── Divider ── */}
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      />

      {/* ── Mission ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "56px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "48px",
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            ◆ Our Mission
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "26px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.03em",
              margin: "0 0 16px",
            }}
          >
            Close the intelligence gap
          </h2>
          <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.75, margin: "0 0 14px" }}>
            The most valuable intelligence is not a recommendation — it is
            context. Institutional investors have always had access to
            sophisticated risk monitoring, regime analysis, and macro
            intelligence. Individual investors have not.
          </p>
          <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.75, margin: 0 }}>
            FAULTLINE is built to close that gap. Not by simplifying the
            complexity, but by making it navigable. Every feature is designed to
            help users understand the risk environment they are operating in —
            before markets reprice it.
          </p>
        </div>
        <div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            ◆ The Company
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "26px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.03em",
              margin: "0 0 16px",
            }}
          >
            Phoenix Systems
          </h2>
          <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.75, margin: "0 0 14px" }}>
            Phoenix Systems is an AI-first technology company building
            intelligent platforms that transform complex information into
            actionable understanding. FAULTLINE is its flagship product.
          </p>
          <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.75, margin: "0 0 20px" }}>
            We are an independent studio. We are not affiliated with any
            financial institution, brokerage, or investment firm. Our incentives
            are aligned with our users — not with the products we might be
            tempted to recommend.
          </p>
          <Link
            href="/phoenix-systems"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.15em",
              color: "#00D4FF",
              textDecoration: "none",
            }}
          >
            LEARN MORE ABOUT PHOENIX SYSTEMS →
          </Link>
        </div>
      </section>

      {/* ── Principles ── */}
      <section
        style={{
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div
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
              letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.5)",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            ◆ How We Build
          </div>
          <h2
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#F0F4FF",
              letterSpacing: "0.03em",
              margin: "0 0 36px",
            }}
          >
            Guiding Principles
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
              gap: "16px",
            }}
          >
            {TEAM_PRINCIPLES.map((p, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "10px",
                  padding: "22px 24px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "10px",
                    color: "#00D4FF",
                    marginBottom: "8px",
                  }}
                >
                  {p.icon}
                </div>
                <div
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#E2E8F0",
                    marginBottom: "8px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {p.title}
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#94A3B8",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Pillars ── */}
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
            letterSpacing: "0.2em",
            color: "rgba(0,212,255,0.5)",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          ◆ The Platform
        </div>
        <h2
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: "24px",
            fontWeight: 700,
            color: "#F0F4FF",
            letterSpacing: "0.03em",
            margin: "0 0 36px",
          }}
        >
          Six Intelligence Pillars
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "14px",
          }}
        >
          {PLATFORM_PILLARS.map((pillar, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${pillar.color}22`,
                borderRadius: "10px",
                padding: "20px 20px",
              }}
            >
              <div
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: pillar.color,
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}
              >
                {pillar.label}
              </div>
              <p
                style={{
                  fontSize: "12px",
                  color: "#94A3B8",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {pillar.desc}
              </p>
            </div>
          ))}
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
          <Link href="/press" style={{ color: "#4B5563" }}>
            Press
          </Link>{" "}
          ·{" "}
          <Link href="/legal" style={{ color: "#4B5563" }}>
            Privacy &amp; Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
