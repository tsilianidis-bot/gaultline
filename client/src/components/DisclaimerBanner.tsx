/**
 * DisclaimerBanner — Compliance footer for all pages with trading/investment content.
 *
 * Usage:
 *   import DisclaimerBanner from "@/components/DisclaimerBanner";
 *   <DisclaimerBanner />
 *
 * Variants:
 *   - default: standard one-liner with methodology link
 *   - compact: single-line for tight layouts (mobile, sidebars)
 *   - full: multi-paragraph for high-risk pages (signals, scenarios, portfolio)
 */

interface DisclaimerBannerProps {
  variant?: "default" | "compact" | "full";
  className?: string;
}

export default function DisclaimerBanner({ variant = "default", className }: DisclaimerBannerProps) {
  const base: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "10px",
    color: "rgba(255,255,255,0.2)",
    lineHeight: 1.6,
    letterSpacing: "0.02em",
  };

  if (variant === "compact") {
    return (
      <div
        className={className}
        style={{
          ...base,
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          textAlign: "center",
        }}
      >
        For informational purposes only. Not financial advice.{" "}
        <a href="/methodology" style={{ color: "rgba(0,212,255,0.35)", textDecoration: "none" }}>
          Methodology
        </a>{" "}
        ·{" "}
        <a href="/legal" style={{ color: "rgba(0,212,255,0.35)", textDecoration: "none" }}>
          Legal
        </a>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={className}
        style={{
          ...base,
          padding: "16px 20px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "8px",
          marginTop: "24px",
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.3)", marginBottom: "6px", fontWeight: 600 }}>
          ⚠ IMPORTANT DISCLAIMER
        </div>
        <p style={{ margin: "0 0 6px" }}>
          All content on this platform — including pressure scores, regime classifications, signals, rotation
          suggestions, scenario outputs, and historical analogs — is for <strong style={{ color: "rgba(255,255,255,0.35)" }}>informational and educational purposes only</strong>.
          Nothing here constitutes financial advice, investment recommendations, or a solicitation to buy or sell
          any security, cryptocurrency, or other financial instrument.
        </p>
        <p style={{ margin: 0 }}>
          Past structural similarity to historical episodes does not guarantee future outcomes. Always consult a
          qualified financial advisor before making investment decisions.{" "}
          <a href="/methodology" style={{ color: "rgba(0,212,255,0.35)", textDecoration: "none" }}>
            Read our full methodology →
          </a>
        </p>
      </div>
    );
  }

  // default
  return (
    <div
      className={className}
      style={{
        ...base,
        padding: "10px 16px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.15)" }}>⚠</span>
      <span>
        For informational purposes only. Not financial advice. Past performance does not guarantee future results.
      </span>
      <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
      <a href="/methodology" style={{ color: "rgba(0,212,255,0.35)", textDecoration: "none" }}>
        Methodology
      </a>
      <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>
      <a href="/legal" style={{ color: "rgba(0,212,255,0.35)", textDecoration: "none" }}>
        Legal Disclosure
      </a>
    </div>
  );
}
