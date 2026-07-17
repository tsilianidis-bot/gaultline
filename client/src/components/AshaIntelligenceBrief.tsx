/* ============================================================
   FAULTLINE — AshaIntelligenceBrief
   Standardized 6-section ASHA Intelligence Brief format.
   Sections: Current State / Primary Drivers / Hidden Pressure /
             Historical Context / Risk Transition / ASHA Monitoring
   Includes: confidence badge, transparency panel, copy button.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAshaContext } from "@/contexts/AshaContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Copy, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
export interface AshaIntelligenceBriefProps {
  variant:
    | "market-brief"
    | "seismic-report"
    | "pressure-brief"
    | "symbol-interpretation"
    | "crypto-brief"
    | "command-narrator";
  seedQuestion?: string;
  contextSummary?: string;
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
    borderColor: "rgba(0,229,255,0.20)",
  },
  "seismic-report": {
    label: "ASHA SEISMIC REPORT",
    sublabel: "Market stress and transition intelligence",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.20)",
  },
  "pressure-brief": {
    label: "ASHA PRESSURE BRIEF",
    sublabel: "Risk vector analysis and pressure drivers",
    accentColor: "#FFAA00",
    borderColor: "rgba(255,170,0,0.20)",
  },
  "symbol-interpretation": {
    label: "ASHA INTERPRETATION",
    sublabel: "Asset intelligence and setup analysis",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.20)",
  },
  "crypto-brief": {
    label: "ASHA CRYPTO RISK BRIEF",
    sublabel: "Digital asset risk and regime intelligence",
    accentColor: "#D09EFF",
    borderColor: "rgba(208,158,255,0.20)",
  },
  "command-narrator": {
    label: "ASHA COMMAND BRIEF",
    sublabel: "Situation room market operations intelligence",
    accentColor: "#00E5FF",
    borderColor: "rgba(0,229,255,0.20)",
  },
};

// ── Parsed brief structure (6 sections) ───────────────────────
interface ParsedBrief {
  currentState: string;
  primaryDrivers: string;
  hiddenPressure: string;
  historicalContext: string;
  riskTransition: string;
  ashaMonitoring: string;
  confidence: "high" | "moderate" | "early-signal";
  enginesConsulted: string[];
  raw: string;
}

function parseBrief(text: string, enginesConsulted: string[]): ParsedBrief {
  const sections: ParsedBrief = {
    currentState: "",
    primaryDrivers: "",
    hiddenPressure: "",
    historicalContext: "",
    riskTransition: "",
    ashaMonitoring: "",
    confidence: "moderate",
    enginesConsulted,
    raw: text,
  };

  // Extract sections by header patterns
  const patterns: [keyof Omit<ParsedBrief, "raw" | "confidence" | "enginesConsulted">, RegExp][] = [
    ["currentState",     /(?:current state|what is happening|current condition)[:\s]*([\s\S]*?)(?=(?:primary drivers|why it|what is building|hidden|historical|risk transition|asha monitoring|$))/i],
    ["primaryDrivers",   /(?:primary drivers|why it matters|the significance)[:\s]*([\s\S]*?)(?=(?:hidden pressure|what is building|historical|risk transition|asha monitoring|$))/i],
    ["hiddenPressure",   /(?:hidden pressure|what is building|emerging pressure)[:\s]*([\s\S]*?)(?=(?:historical|risk transition|asha monitoring|$))/i],
    ["historicalContext",/(?:historical context|relevant analog|history)[:\s]*([\s\S]*?)(?=(?:risk transition|what could change|asha monitoring|$))/i],
    ["riskTransition",   /(?:risk transition|what could change|what would change)[:\s]*([\s\S]*?)(?=(?:asha monitoring|monitoring|$))/i],
    ["ashaMonitoring",   /(?:asha monitoring|monitoring|watching)[:\s]*([\s\S]*?)(?=$)/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      sections[key] = match[1]
        .replace(/^#+\s*/gm, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 5)
        .join(" ");
    }
  }

  // Fallback: if parsing fails, put everything in currentState
  if (!sections.currentState && !sections.primaryDrivers) {
    const cleaned = text
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .trim()
      .split("\n")
      .filter(Boolean);

    sections.currentState = cleaned.slice(0, 3).join(" ");
    sections.primaryDrivers = cleaned.slice(3, 5).join(" ");
    sections.hiddenPressure = cleaned.slice(5, 7).join(" ");
    sections.historicalContext = cleaned.slice(7, 9).join(" ");
    sections.riskTransition = cleaned.slice(9, 11).join(" ");
    sections.ashaMonitoring = cleaned.slice(11, 13).join(" ");
  }

  // Infer confidence
  const lower = text.toLowerCase();
  if (lower.includes("high confidence") || lower.includes("strongly suggests") || lower.includes("clearly confirmed")) {
    sections.confidence = "high";
  } else if (lower.includes("early signal") || lower.includes("insufficient data") || lower.includes("uncertain") || lower.includes("unclear")) {
    sections.confidence = "early-signal";
  } else {
    sections.confidence = "moderate";
  }

  return sections;
}

// ── Confidence badge ───────────────────────────────────────────
function ConfidenceBadge({ level, accentColor }: { level: "high" | "moderate" | "early-signal"; accentColor: string }) {
  const config = {
    high:           { label: "HIGH CONFIDENCE",   color: "#00FF99", bg: "rgba(0,255,153,0.08)",   border: "rgba(0,255,153,0.25)" },
    moderate:       { label: "MODERATE CONFIDENCE", color: "#FFD700", bg: "rgba(255,215,0,0.08)", border: "rgba(255,215,0,0.25)" },
    "early-signal": { label: "EARLY SIGNAL",       color: "#FF9500", bg: "rgba(255,149,0,0.08)",  border: "rgba(255,149,0,0.25)" },
  }[level];

  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 8px",
      borderRadius: "2px",
      background: config.bg,
      border: `1px solid ${config.border}`,
    }}>
      <div style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: config.color,
        boxShadow: `0 0 6px ${config.color}`,
      }} />
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "8px",
        letterSpacing: "0.15em",
        color: config.color,
        fontWeight: 700,
      }}>
        {config.label}
      </span>
    </div>
  );
}

// ── Section row ────────────────────────────────────────────────
function BriefSection({ label, content, accentColor, isLast = false }: {
  label: string;
  content: string;
  accentColor: string;
  isLast?: boolean;
}) {
  if (!content) return null;
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      paddingBottom: isLast ? "0" : "12px",
      borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "9px",
        letterSpacing: "0.18em",
        color: accentColor,
        textTransform: "uppercase",
        fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: "13px",
        lineHeight: 1.7,
        color: "#D8E8F8",
      }}>
        {content}
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────
function BriefSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {["CURRENT STATE", "PRIMARY DRIVERS", "HIDDEN PRESSURE"].map((label, i) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "9px",
            letterSpacing: "0.18em",
            color: accentColor,
            textTransform: "uppercase",
            fontWeight: 700,
            opacity: 0.5,
          }}>
            {label}
          </div>
          <div style={{
            height: "12px",
            borderRadius: "2px",
            background: "rgba(255,255,255,0.05)",
            width: i === 0 ? "88%" : i === 1 ? "72%" : "60%",
            animation: "pulse 1.8s ease-in-out infinite",
          }} />
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
  const { user } = useAuth();
  const [brief, setBrief] = useState<ParsedBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [showTransparency, setShowTransparency] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetchedRef = useRef(false);
  const askMutation = trpc.asha.ask.useMutation();

  const buildQuestion = () => {
    if (seedQuestion) return seedQuestion;
    const ctx = contextSummary || "";
    const questions: Record<AshaIntelligenceBriefProps["variant"], string> = {
      "market-brief":
        `Provide an ASHA Intelligence Brief using this exact structure with these exact section headers:\n\nCurrent State: What is happening in the market right now.\nPrimary Drivers: What is causing the current condition.\nHidden Pressure: What is developing beneath the surface.\nHistorical Context: Relevant market parallels and analogs.\nRisk Transition: What could increase or reduce pressure.\nASHA Monitoring: The specific signals being watched next.\n\nUse the current regime, pressure score, and key risk drivers. Be concise, institutional, data-grounded. ${ctx}`,
      "seismic-report":
        `Provide an ASHA Intelligence Brief using this exact structure with these exact section headers:\n\nCurrent State: What the seismograph is detecting right now.\nPrimary Drivers: What is driving the current stress reading.\nHidden Pressure: What is building beneath the surface.\nHistorical Context: Closest analog period and what followed.\nRisk Transition: Conditions that would shift the regime.\nASHA Monitoring: Signals being watched for confirmation.\n\nInclude transition probability and stress level. Be concise, institutional. ${ctx}`,
      "pressure-brief":
        `Provide an ASHA Intelligence Brief using this exact structure with these exact section headers:\n\nCurrent State: Current pressure index reading and which risk vectors are elevated.\nPrimary Drivers: Which engines are contributing most to pressure.\nHidden Pressure: What is building that is not yet fully visible.\nHistorical Context: Similar pressure environments and outcomes.\nRisk Transition: What would cause pressure to rise or fall.\nASHA Monitoring: The specific indicators being tracked. ${ctx}`,
      "symbol-interpretation":
        `Provide an ASHA Intelligence Brief using this exact structure with these exact section headers:\n\nCurrent State: What is happening with this asset right now.\nPrimary Drivers: What is driving the current setup.\nHidden Pressure: Risk factors developing beneath the surface.\nHistorical Context: Similar setups and what followed.\nRisk Transition: What would change the current view.\nASHA Monitoring: Key levels and signals being watched. ${ctx}`,
      "crypto-brief":
        `Provide an ASHA Intelligence Brief using this exact structure with these exact section headers:\n\nCurrent State: Current crypto market conditions including liquidity and risk appetite.\nPrimary Drivers: What is driving BTC leadership and altcoin behavior.\nHidden Pressure: Regime shifts developing beneath the surface.\nHistorical Context: Comparable crypto cycle periods.\nRisk Transition: What would change the current crypto regime.\nASHA Monitoring: On-chain and macro signals being tracked. ${ctx}`,
      "command-narrator":
        `Provide an ASHA Intelligence Brief for the Situation Room using this exact structure with these exact section headers:\n\nCurrent State: What is happening across all monitored markets right now.\nPrimary Drivers: The dominant forces shaping current conditions.\nHidden Pressure: What is building beneath the surface.\nHistorical Context: The closest comparable macro environment.\nRisk Transition: Conditions that would change the operational picture.\nASHA Monitoring: The highest-priority signals for the next session. ${ctx}`,
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
      const parsed = parseBrief(result.reply, result.enginesConsulted ?? []);
      setBrief(parsed);
      setLastFetched(Date.now());
      fetchedRef.current = true;
    } catch {
      setError("Intelligence temporarily unavailable. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && !fetchedRef.current && user) {
      fetchBrief();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, user]);

  const handleCopy = async () => {
    if (!brief) return;
    const text = [
      `${meta.label}`,
      `Generated: ${lastFetched ? new Date(lastFetched).toLocaleString() : "—"}`,
      "",
      `CURRENT STATE\n${brief.currentState}`,
      "",
      `PRIMARY DRIVERS\n${brief.primaryDrivers}`,
      "",
      `HIDDEN PRESSURE\n${brief.hiddenPressure}`,
      "",
      `HISTORICAL CONTEXT\n${brief.historicalContext}`,
      "",
      `RISK TRANSITION\n${brief.riskTransition}`,
      "",
      `ASHA MONITORING\n${brief.ashaMonitoring}`,
      "",
      "ASHA · FAULTLINE INTELLIGENCE SYSTEM · NOT FINANCIAL ADVICE",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(135deg, rgba(8,10,16,0.98) 0%, rgba(5,6,8,0.99) 100%)",
        border: `1px solid ${meta.borderColor}`,
        borderLeft: `3px solid ${meta.accentColor}`,
        borderRadius: "4px",
        padding: "20px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient top glow */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: `linear-gradient(90deg, ${meta.accentColor}40, transparent 60%)`,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "16px",
        flexWrap: "wrap",
        gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* ASHA pulse dot */}
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: meta.accentColor,
            boxShadow: `0 0 8px ${meta.accentColor}, 0 0 16px ${meta.accentColor}50`,
            flexShrink: 0,
            animation: loading ? "pulse 1.2s ease-in-out infinite" : undefined,
          }} />
          <div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.2em",
              color: meta.accentColor,
              fontWeight: 700,
            }}>
              {meta.label}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.30)",
              marginTop: "2px",
            }}>
              {meta.sublabel}
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {brief && <ConfidenceBadge level={brief.confidence} accentColor={meta.accentColor} />}
          {lastFetched && (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              color: "rgba(255,255,255,0.22)",
              letterSpacing: "0.08em",
            }}>
              {new Date(lastFetched).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          {brief && (
            <button
              onClick={handleCopy}
              title="Copy brief"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                background: "transparent",
                border: `1px solid ${copied ? "rgba(0,255,153,0.3)" : "rgba(255,255,255,0.10)"}`,
                borderRadius: "2px",
                cursor: "pointer",
                color: copied ? "#00FF99" : "rgba(255,255,255,0.40)",
                transition: "all 0.15s ease",
                padding: 0,
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          <button
            onClick={fetchBrief}
            disabled={loading}
            title="Refresh"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.12em",
              color: loading ? "rgba(255,255,255,0.20)" : meta.accentColor,
              background: "transparent",
              border: `1px solid ${loading ? "rgba(255,255,255,0.06)" : meta.borderColor}`,
              borderRadius: "2px",
              padding: "4px 10px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              height: "24px",
              whiteSpace: "nowrap",
            }}
          >
            <RefreshCw size={9} style={{ animation: loading ? "spin 1s linear infinite" : undefined }} />
            {loading ? "ANALYZING" : "REFRESH"}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && !brief && <BriefSkeleton accentColor={meta.accentColor} />}

      {error && !brief && (
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          color: "rgba(255,59,92,0.70)",
          letterSpacing: "0.08em",
          padding: "12px 0",
        }}>
          {error}
        </div>
      )}

      {brief && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <BriefSection label="CURRENT STATE"      content={brief.currentState}      accentColor={meta.accentColor} />
          <BriefSection label="PRIMARY DRIVERS"    content={brief.primaryDrivers}    accentColor={meta.accentColor} />
          <BriefSection label="HIDDEN PRESSURE"    content={brief.hiddenPressure}    accentColor={meta.accentColor} />
          <BriefSection label="HISTORICAL CONTEXT" content={brief.historicalContext} accentColor={meta.accentColor} />
          <BriefSection label="RISK TRANSITION"    content={brief.riskTransition}    accentColor={meta.accentColor} />
          <BriefSection label="ASHA MONITORING"    content={brief.ashaMonitoring || "Monitoring for regime shift signals."} accentColor={meta.accentColor} isLast />

          {/* Transparency panel */}
          {brief.enginesConsulted && brief.enginesConsulted.length > 0 && (
            <div style={{ marginTop: "4px" }}>
              <button
                onClick={() => setShowTransparency(v => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "transparent",
                  border: "none",
                  padding: "0",
                  cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.30)",
                  transition: "color 0.15s",
                }}
              >
                {showTransparency ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                WHY IS ASHA SAYING THIS?
              </button>
              {showTransparency && (
                <div style={{
                  marginTop: "10px",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "3px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.15em",
                    color: meta.accentColor,
                    fontWeight: 700,
                  }}>
                    ENGINES CONSULTED
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {brief.enginesConsulted.map(e => (
                      <span key={e} style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "9px",
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.55)",
                        padding: "2px 7px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "2px",
                      }}>
                        {e}
                      </span>
                    ))}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
                    fontSize: "11px",
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: "2px",
                  }}>
                    ASHA interprets live data from FAULTLINE's engine network. Every conclusion reflects the current readings from the engines listed above. Confidence reflects the consistency and completeness of the available signals.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: "16px",
        paddingTop: "10px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}>
        <div style={{
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: meta.accentColor,
          opacity: 0.5,
        }} />
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.20)",
        }}>
          ASHA · FAULTLINE INTELLIGENCE SYSTEM · NOT FINANCIAL ADVICE
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

export default AshaIntelligenceBrief;
