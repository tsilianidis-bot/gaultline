/* ============================================================
   FAULTLINE — AshaIntelligenceBrief
   Reusable inline ASHA intelligence section.
   Renders the 5-section FAULTLINE Intelligence Brief format:
   What Is Happening / Why It Matters / What Is Building /
   Historical Context / What Would Change The Outlook
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAshaContext } from "@/contexts/AshaContext";

// ── Types ─────────────────────────────────────────────────────

export interface AshaIntelligenceBriefProps {
  /** Variant controls the header label and color accent */
  variant:
    | "market-brief"
    | "seismic-report"
    | "pressure-brief"
    | "symbol-interpretation"
    | "crypto-brief"
    | "command-narrator";
  /** Optional pre-seeded question to ask ASHA on mount */
  seedQuestion?: string;
  /** Extra context to inject into the question */
  contextSummary?: string;
  /** Whether to auto-fetch on mount (default true) */
  autoFetch?: boolean;
  className?: string;
}

const VARIANT_META: Record<
  AshaIntelligenceBriefProps["variant"],
  { label: string; sublabel: string; accentColor: string; borderColor: string }
> = {
  "market-brief": {
    label: "ASHA MARKET BRIEF",
    sublabel: "Current intelligence assessment",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.25)",
  },
  "seismic-report": {
    label: "ASHA SEISMIC REPORT",
    sublabel: "Market stress and transition intelligence",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.25)",
  },
  "pressure-brief": {
    label: "ASHA PRESSURE BRIEF",
    sublabel: "Risk vector analysis and pressure drivers",
    accentColor: "#FFAA00",
    borderColor: "rgba(255,170,0,0.25)",
  },
  "symbol-interpretation": {
    label: "ASHA INTERPRETATION",
    sublabel: "Asset intelligence and setup analysis",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.25)",
  },
  "crypto-brief": {
    label: "ASHA CRYPTO RISK BRIEF",
    sublabel: "Digital asset risk and regime intelligence",
    accentColor: "#D09EFF",
    borderColor: "rgba(208,158,255,0.25)",
  },
  "command-narrator": {
    label: "ASHA COMMAND BRIEF",
    sublabel: "Situation room market operations intelligence",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.25)",
  },
};

// ── Section parser ─────────────────────────────────────────────
// Parses ASHA's markdown response into the 5 named sections

interface ParsedBrief {
  whatIsHappening: string;
  whyItMatters: string;
  whatIsBuilding: string;
  historicalContext: string;
  whatWouldChange: string;
  raw: string;
}

function parseBrief(text: string): ParsedBrief {
  const sections: ParsedBrief = {
    whatIsHappening: "",
    whyItMatters: "",
    whatIsBuilding: "",
    historicalContext: "",
    whatWouldChange: "",
    raw: text,
  };

  const patterns: [keyof Omit<ParsedBrief, "raw">, RegExp][] = [
    ["whatIsHappening", /(?:what is happening|current condition)[:\s]*([\s\S]*?)(?=(?:why it matters|the significance|what is building|historical|what would|$))/i],
    ["whyItMatters", /(?:why it matters|the significance)[:\s]*([\s\S]*?)(?=(?:what is building|historical|what would|$))/i],
    ["whatIsBuilding", /(?:what is building|emerging pressure)[:\s]*([\s\S]*?)(?=(?:historical|what would|$))/i],
    ["historicalContext", /(?:historical context|relevant analog)[:\s]*([\s\S]*?)(?=(?:what would|invalidation|$))/i],
    ["whatWouldChange", /(?:what would change|invalidation)[:\s]*([\s\S]*?)(?=$)/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      sections[key] = match[1]
        .replace(/^#+\s*/gm, "")
        .replace(/\*\*/g, "")
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 4)
        .join(" ");
    }
  }

  // Fallback: if parsing fails, put everything in whatIsHappening
  if (!sections.whatIsHappening && !sections.whyItMatters) {
    sections.whatIsHappening = text
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "")
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(0, 6)
      .join(" ");
  }

  return sections;
}

// ── Section row ────────────────────────────────────────────────

function BriefSection({
  label,
  content,
  accentColor,
}: {
  label: string;
  content: string;
  accentColor: string;
}) {
  if (!content) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        paddingBottom: "12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: accentColor,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          fontSize: "13px",
          lineHeight: 1.65,
          color: "#D8E8F8",
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────

function BriefSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {["WHAT IS HAPPENING", "WHY IT MATTERS", "WHAT IS BUILDING"].map((label) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.18em",
              color: accentColor,
              textTransform: "uppercase",
              fontWeight: 600,
              opacity: 0.6,
            }}
          >
            {label}
          </div>
          <div
            style={{
              height: "12px",
              borderRadius: "2px",
              background: "rgba(255,255,255,0.06)",
              width: label === "WHAT IS HAPPENING" ? "90%" : label === "WHY IT MATTERS" ? "75%" : "60%",
              animation: "pulse 1.8s ease-in-out infinite",
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function AshaIntelligenceBrief({
  variant,
  seedQuestion,
  contextSummary,
  autoFetch = true,
  className,
}: AshaIntelligenceBriefProps) {
  const meta = VARIANT_META[variant];
  const { pageContext } = useAshaContext();
  const [brief, setBrief] = useState<ParsedBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  const askMutation = trpc.asha.ask.useMutation();

  const buildQuestion = () => {
    if (seedQuestion) return seedQuestion;

    const ctx = contextSummary || "";
    const questions: Record<AshaIntelligenceBriefProps["variant"], string> = {
      "market-brief":
        `Provide a FAULTLINE Intelligence Brief covering: What Is Happening in the market right now, Why It Matters, What Is Building beneath the surface, Historical Context with the closest analog, and What Would Change The Outlook. Use the current regime, pressure score, and key risk drivers. ${ctx}`,
      "seismic-report":
        `Provide a FAULTLINE Seismic Report covering: What Is Happening with market stress and the seismograph reading, Why It Matters for current positioning, What Is Building in terms of hidden pressure, Historical Context with the closest analog period, and What Would Change The Outlook. Include transition probability and stress level. ${ctx}`,
      "pressure-brief":
        `Provide a FAULTLINE Pressure Brief covering: What Is Happening with the pressure index and which risk vectors are rising, Why It Matters, What Is Building in terms of which markets are contributing, Historical Context of similar pressure environments, and What Would Change The Outlook. ${ctx}`,
      "symbol-interpretation":
        `Provide a FAULTLINE Symbol Interpretation covering: Current Setup (what is happening with this asset), Why It Matters for the current macro environment, Risk Factors (what is building), Historical Context of similar setups, and What Changes The View. ${ctx}`,
      "crypto-brief":
        `Provide a FAULTLINE Crypto Risk Brief covering: What Is Happening with crypto market conditions including liquidity, risk appetite, BTC leadership, and altcoin stress, Why It Matters, What Is Building in terms of regime shifts, Historical Context, and What Would Change The Outlook. ${ctx}`,
      "command-narrator":
        `You are narrating the FAULTLINE Situation Room. Provide a command-level intelligence brief covering: What Is Happening across all monitored markets, Why It Matters, What Is Building beneath the surface, Historical Context, and What Would Change The Outlook. Speak as a macro strategist briefing a trading desk. ${ctx}`,
    };
    return questions[variant];
  };

  const fetchBrief = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await askMutation.mutateAsync({
        userMessage: buildQuestion(),
        pageContext: pageContext ?? { page: variant },
        history: [],
      });
      const parsed = parseBrief(result.reply);
      setBrief(parsed);
      setLastFetched(Date.now());
      fetchedRef.current = true;
    } catch {
      setError("Intelligence temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && !fetchedRef.current) {
      fetchBrief();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(135deg, rgba(0,229,255,0.04) 0%, rgba(0,0,0,0) 60%)",
        border: `1px solid ${meta.borderColor}`,
        borderRadius: "4px",
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient corner glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "120px",
          height: "120px",
          background: `radial-gradient(circle at top left, ${meta.accentColor}08 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* ASHA orb indicator */}
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: meta.accentColor,
              boxShadow: `0 0 8px ${meta.accentColor}, 0 0 16px ${meta.accentColor}60`,
              flexShrink: 0,
              animation: loading ? "pulse 1.2s ease-in-out infinite" : undefined,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: meta.accentColor,
                fontWeight: 700,
              }}
            >
              {meta.label}
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.35)",
                marginTop: "1px",
              }}
            >
              {meta.sublabel}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastFetched && (
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.1em",
              }}
            >
              {new Date(lastFetched).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <button
            onClick={fetchBrief}
            disabled={loading}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.15em",
              color: loading ? "rgba(255,255,255,0.25)" : meta.accentColor,
              background: "transparent",
              border: `1px solid ${loading ? "rgba(255,255,255,0.08)" : meta.borderColor}`,
              borderRadius: "2px",
              padding: "4px 10px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              minHeight: "unset",
              height: "24px",
            }}
          >
            {loading ? "ANALYZING..." : "REFRESH"}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && !brief && <BriefSkeleton accentColor={meta.accentColor} />}

      {error && !brief && (
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            color: "rgba(255,59,92,0.7)",
            letterSpacing: "0.1em",
          }}
        >
          {error}
        </div>
      )}

      {brief && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <BriefSection
            label="WHAT IS HAPPENING"
            content={brief.whatIsHappening}
            accentColor={meta.accentColor}
          />
          <BriefSection
            label="WHY IT MATTERS"
            content={brief.whyItMatters}
            accentColor={meta.accentColor}
          />
          <BriefSection
            label="WHAT IS BUILDING"
            content={brief.whatIsBuilding}
            accentColor={meta.accentColor}
          />
          <BriefSection
            label="HISTORICAL CONTEXT"
            content={brief.historicalContext}
            accentColor={meta.accentColor}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.18em",
                color: meta.accentColor,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              WHAT WOULD CHANGE THE OUTLOOK
            </div>
            <div
              style={{
                fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                fontSize: "13px",
                lineHeight: 1.65,
                color: "#D8E8F8",
              }}
            >
              {brief.whatWouldChange || "Monitoring for regime shift signals."}
            </div>
          </div>
        </div>
      )}

      {/* Footer attribution */}
      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: meta.accentColor,
            opacity: 0.6,
          }}
        />
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          ASHA · FAULTLINE INTELLIGENCE SYSTEM · NOT FINANCIAL ADVICE
        </div>
      </div>
    </div>
  );
}

export default AshaIntelligenceBrief;
