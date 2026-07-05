import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";

export default function PhoenixSystems() {
  useSEO({
    title: "Phoenix Systems — Creator of FAULTLINE",
    description:
      "Phoenix Systems is an AI-first technology company developing intelligent platforms that transform complex information into actionable insight. FAULTLINE is its flagship product.",
    canonical: "/phoenix-systems",
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
      {/* ── Nav bar ── */}
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
            {/* Phoenix Systems wordmark */}
            <div
              style={{
                width: "28px",
                height: "28px",
                background: "linear-gradient(135deg, #FF6B35 0%, #FF3D00 100%)",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2 L14 6 L14 10 L8 14 L2 10 L2 6 Z"
                  stroke="white"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
                <circle cx="8" cy="8" r="2" fill="white" />
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
              PHOENIX SYSTEMS
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
            ← FAULTLINE
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "96px 24px 72px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.35em",
            color: "#FF6B35",
            marginBottom: "20px",
          }}
        >
          COMPANY PROFILE
        </div>
        <h1
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "#F0F4FF",
            lineHeight: 1.15,
            marginBottom: "28px",
          }}
        >
          Phoenix Systems
        </h1>
        <p
          style={{
            fontSize: "1.15rem",
            color: "#CBD5E1",
            lineHeight: 1.8,
            maxWidth: "680px",
            marginBottom: "16px",
          }}
        >
          Phoenix Systems is an AI-first technology company focused on building
          intelligent software that helps people understand complex systems,
          identify emerging patterns, and make better-informed decisions.
        </p>
        <p
          style={{
            fontSize: "1rem",
            color: "#94A3B8",
            lineHeight: 1.8,
            maxWidth: "680px",
          }}
        >
          Rather than replacing human judgment, Phoenix Systems creates products
          that enhance it — through data, probabilistic reasoning, and contextual
          intelligence that surfaces what matters before it becomes obvious.
        </p>
      </section>

      {/* ── Divider ── */}
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,107,53,0.4), transparent)",
          }}
        />
      </div>

      {/* ── Mission & Philosophy ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "72px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "40px",
        }}
      >
        {[
          {
            label: "MISSION",
            heading: "Intelligence That Enhances Judgment",
            body:
              "Phoenix Systems develops AI-assisted intelligence systems that help people make better decisions by transforming complex data into actionable understanding. Every product we build is designed to reduce the information asymmetry between institutional and individual decision-makers.",
          },
          {
            label: "PHILOSOPHY",
            heading: "Awareness Before Action",
            body:
              "We believe the most valuable intelligence is not a recommendation — it is context. Our products are built around the principle that informed people make better decisions when they understand the environment they are operating in, not just the next move to make.",
          },
          {
            label: "APPROACH",
            heading: "Probabilistic, Not Prescriptive",
            body:
              "Phoenix Systems products emphasise probabilistic reasoning over binary predictions. We surface likelihoods, regimes, and stress indicators — not buy or sell signals. The goal is to give users a more complete picture of risk, not to make decisions for them.",
          },
        ].map((item) => (
          <div key={item.label}>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.35em",
                color: "#FF6B35",
                marginBottom: "12px",
              }}
            >
              {item.label}
            </div>
            <h2
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "15px",
                fontWeight: 700,
                color: "#F0F4FF",
                marginBottom: "14px",
                lineHeight: 1.4,
              }}
            >
              {item.heading}
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#94A3B8",
                lineHeight: 1.75,
              }}
            >
              {item.body}
            </p>
          </div>
        ))}
      </section>

      {/* ── Flagship Product ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 72px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: "12px",
            padding: "40px",
            background: "rgba(0,212,255,0.03)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle glow */}
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
            FLAGSHIP PLATFORM
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
            <div style={{ flex: 1, minWidth: "240px" }}>
              <h2
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#F0F4FF",
                  letterSpacing: "0.15em",
                  marginBottom: "16px",
                }}
              >
                FAULTLINE
              </h2>
              <p
                style={{
                  fontSize: "0.95rem",
                  color: "#CBD5E1",
                  lineHeight: 1.75,
                  maxWidth: "520px",
                  marginBottom: "12px",
                }}
              >
                FAULTLINE is Phoenix Systems' flagship platform and the first in
                a growing portfolio of decision-intelligence systems. It
                continuously monitors the economic, financial, and market fault
                lines where stress builds beneath the surface — detecting regime
                shifts before they become obvious.
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#64748B",
                  lineHeight: 1.7,
                  maxWidth: "520px",
                }}
              >
                FAULTLINE is a macroeconomic risk intelligence platform. It
                provides educational analysis and market awareness tools. It is
                not a financial adviser and does not provide personalised
                investment advice.
              </p>
            </div>
            <div>
              <Link
                href="/"
                style={{
                  display: "inline-block",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                  color: "#050608",
                  background: "#00D4FF",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                VISIT FAULTLINE →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Portfolio Vision ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 72px",
        }}
      >
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.35em",
            color: "#64748B",
            marginBottom: "20px",
          }}
        >
          LONG-TERM VISION
        </div>
        <h2
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "18px",
            fontWeight: 700,
            color: "#F0F4FF",
            marginBottom: "20px",
            lineHeight: 1.4,
          }}
        >
          A Portfolio of Decision-Intelligence Systems
        </h2>
        <p
          style={{
            fontSize: "0.95rem",
            color: "#94A3B8",
            lineHeight: 1.8,
            maxWidth: "680px",
            marginBottom: "16px",
          }}
        >
          FAULTLINE is the first product in a broader Phoenix Systems portfolio.
          The company is building a family of intelligence platforms that apply
          the same core philosophy — probabilistic reasoning, regime awareness,
          and contextual intelligence — across finance and other complex domains
          where information asymmetry creates risk.
        </p>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#64748B",
            lineHeight: 1.75,
            maxWidth: "680px",
          }}
        >
          Each platform is designed to stand independently while sharing a
          consistent premium, institutional identity. Phoenix Systems maintains
          the infrastructure, data pipelines, and AI systems that power the
          entire portfolio.
        </p>
      </section>

      {/* ── Contact ── */}
      <section
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "0 24px 96px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            padding: "32px 40px",
            background: "rgba(255,255,255,0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.35em",
                color: "#64748B",
                marginBottom: "10px",
              }}
            >
              CONTACT
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#94A3B8",
                lineHeight: 1.6,
              }}
            >
              For press inquiries, partnership discussions, or general
              correspondence, contact Phoenix Systems via the FAULTLINE press
              page.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Link
              href="/press"
              style={{
                display: "inline-block",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "#F0F4FF",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              PRESS PAGE →
            </Link>
            <a
              href="/contact"
              style={{
                display: "inline-block",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "#00D4FF",
                border: "1px solid rgba(0,212,255,0.3)",
                padding: "10px 20px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              CONTACT →
            </a>
          </div>
        </div>
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
          © 2026 Phoenix Systems · FAULTLINE is a product of Phoenix Systems ·{" "}
          <a
            href="/legal"
            style={{ color: "#4B5563", textDecoration: "none" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#00D4FF")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#4B5563")
            }
          >
            Privacy &amp; Terms
          </a>
        </p>
      </footer>
    </div>
  );
}
