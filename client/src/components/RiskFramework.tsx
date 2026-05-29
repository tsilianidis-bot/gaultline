// ============================================================
// FAULTLINE — Multi-Tier Risk Framework Component
//
// Displays Trade Stop, Swing Stop, Thesis Failure Level
// with Conservative / Balanced / Aggressive profile toggle.
// ============================================================
import { useState } from "react";

export interface RiskTier {
  price: number;
  pctFromEntry: number;
  label: string;
}

export interface RiskLevels {
  tradeStop: RiskTier;
  swingStop: RiskTier;
  thesisFailure: RiskTier;
  riskReward: number;
  tradeStopExplanation: string;
  swingStopExplanation: string;
  thesisFailureExplanation: string;
}

type RiskProfile = "conservative" | "balanced" | "aggressive";

interface ProfileMultipliers {
  tradeStop: number;  // multiplier on pct distance
  swingStop: number;
  thesisFailure: number;
}

const PROFILE_MULTIPLIERS: Record<RiskProfile, ProfileMultipliers> = {
  conservative: { tradeStop: 0.6, swingStop: 0.65, thesisFailure: 0.7 },
  balanced:     { tradeStop: 1.0, swingStop: 1.0,  thesisFailure: 1.0 },
  aggressive:   { tradeStop: 1.5, swingStop: 1.4,  thesisFailure: 1.3 },
};

const PROFILE_LABELS: Record<RiskProfile, string> = {
  conservative: "CONSERVATIVE",
  balanced:     "BALANCED",
  aggressive:   "AGGRESSIVE",
};

const PROFILE_DESCRIPTIONS: Record<RiskProfile, string> = {
  conservative: "Tighter stops. Smaller losses, more frequent exits.",
  balanced:     "Standard stops based on technical levels.",
  aggressive:   "Wider stops. Fewer exits, larger potential drawdowns.",
};

function applyProfile(
  entry: number,
  tier: RiskTier,
  multiplier: number
): RiskTier {
  // Adjust the pct distance by the multiplier, then recompute price
  const adjustedPct = tier.pctFromEntry * multiplier;
  const adjustedPrice = parseFloat((entry * (1 + adjustedPct / 100)).toFixed(2));
  return {
    ...tier,
    price: adjustedPrice,
    pctFromEntry: parseFloat(adjustedPct.toFixed(1)),
  };
}

interface RiskFrameworkProps {
  entry: number;
  target: number;
  riskLevels: RiskLevels;
  isCrypto?: boolean;
}

export function RiskFramework({ entry, target, riskLevels, isCrypto = false }: RiskFrameworkProps) {
  const [profile, setProfile] = useState<RiskProfile>("balanced");
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const multipliers = PROFILE_MULTIPLIERS[profile];

  // Apply profile multipliers to each tier
  const tradeStop = applyProfile(entry, riskLevels.tradeStop, multipliers.tradeStop);
  const swingStop = applyProfile(entry, riskLevels.swingStop, multipliers.swingStop);
  const thesisFailure = applyProfile(entry, riskLevels.thesisFailure, multipliers.thesisFailure);

  // Recompute R:R using adjusted trade stop
  const tradeRisk = Math.abs(entry - tradeStop.price);
  const reward = Math.abs(target - entry);
  const riskReward = tradeRisk > 0 ? parseFloat((reward / tradeRisk).toFixed(1)) : 0;

  const priceDecimals = isCrypto && entry < 1 ? 6 : 2;
  const fmt = (n: number) => `$${n.toFixed(priceDecimals)}`;

  const tiers = [
    {
      key: "tradeStop",
      label: "TRADE STOP",
      sublabel: "Active traders",
      tier: tradeStop,
      color: "#FF6B35",
      bgColor: "rgba(255,107,53,0.06)",
      borderColor: "rgba(255,107,53,0.2)",
      explanation: riskLevels.tradeStopExplanation,
      icon: "⚡",
    },
    {
      key: "swingStop",
      label: "SWING STOP",
      sublabel: "Swing traders",
      tier: swingStop,
      color: "#FFD700",
      bgColor: "rgba(255,215,0,0.05)",
      borderColor: "rgba(255,215,0,0.18)",
      explanation: riskLevels.swingStopExplanation,
      icon: "◈",
    },
    {
      key: "thesisFailure",
      label: "THESIS FAILURE",
      sublabel: "Structural invalidation",
      tier: thesisFailure,
      color: "#FF2D55",
      bgColor: "rgba(255,45,85,0.05)",
      borderColor: "rgba(255,45,85,0.18)",
      explanation: riskLevels.thesisFailureExplanation,
      icon: "✕",
    },
  ];

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* ── Section header ─────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "10px",
      }}>
        <div style={{
          fontSize: "11px",
          letterSpacing: "0.1em",
          color: "rgba(100,116,139,0.75)",
          textTransform: "uppercase",
        }}>
          RISK FRAMEWORK
        </div>
        <div style={{
          fontSize: "10px",
          letterSpacing: "0.05em",
          color: "rgba(100,116,139,0.5)",
        }}>
          R:R {riskReward.toFixed(1)}x
        </div>
      </div>

      {/* ── Entry + Target row ─────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px",
        marginBottom: "8px",
      }}>
        <div style={{
          background: "rgba(0,212,255,0.06)",
          border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: "3px",
          padding: "7px 10px",
        }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.65)", marginBottom: "3px" }}>ENTRY</div>
          <div style={{ fontSize: "14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#00D4FF", letterSpacing: "0.02em" }}>
            {fmt(entry)}
          </div>
        </div>
        <div style={{
          background: "rgba(52,211,153,0.06)",
          border: "1px solid rgba(52,211,153,0.2)",
          borderRadius: "3px",
          padding: "7px 10px",
        }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.65)", marginBottom: "3px" }}>TARGET</div>
          <div style={{ fontSize: "14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#34D399", letterSpacing: "0.02em" }}>
            {fmt(target)}
          </div>
        </div>
      </div>

      {/* ── Profile toggle ─────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: "4px",
        marginBottom: "8px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "3px",
      }}>
        {(["conservative", "balanced", "aggressive"] as RiskProfile[]).map(p => (
          <button
            key={p}
            onClick={() => setProfile(p)}
            style={{
              flex: 1,
              padding: "5px 4px",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "9px",
              letterSpacing: "0.08em",
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: profile === p ? 700 : 400,
              background: profile === p
                ? p === "conservative" ? "rgba(52,211,153,0.15)"
                  : p === "balanced" ? "rgba(0,212,255,0.12)"
                  : "rgba(255,107,53,0.15)"
                : "transparent",
              color: profile === p
                ? p === "conservative" ? "#34D399"
                  : p === "balanced" ? "#00D4FF"
                  : "#FF6B35"
                : "rgba(100,116,139,0.5)",
              transition: "all 0.15s ease",
            }}
          >
            {PROFILE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Profile description */}
      <div style={{
        fontSize: "10px",
        color: "rgba(100,116,139,0.45)",
        marginBottom: "8px",
        letterSpacing: "0.02em",
        fontStyle: "italic",
      }}>
        {PROFILE_DESCRIPTIONS[profile]}
      </div>

      {/* ── Three-tier stop display ─────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {tiers.map(({ key, label, sublabel, tier, color, bgColor, borderColor, explanation, icon }) => {
          const isExpanded = expandedTier === key;
          return (
            <div
              key={key}
              style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: "3px",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
              }}
            >
              {/* Main row */}
              <button
                onClick={() => setExpandedTier(isExpanded ? null : key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: "8px",
                }}
              >
                {/* Left: icon + label */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span style={{ fontSize: "11px", color, opacity: 0.8, flexShrink: 0 }}>{icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.65)", textTransform: "uppercase" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "9px", color: "rgba(100,116,139,0.4)", letterSpacing: "0.04em" }}>
                      {sublabel}
                    </div>
                  </div>
                </div>

                {/* Right: price + pct */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      fontSize: "14px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 600,
                      color,
                      letterSpacing: "0.02em",
                    }}>
                      {fmt(tier.price)}
                    </div>
                    <div style={{
                      fontSize: "10px",
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: `${color}99`,
                      letterSpacing: "0.02em",
                    }}>
                      {tier.pctFromEntry.toFixed(1)}%
                    </div>
                  </div>
                  <span style={{
                    fontSize: "9px",
                    color: "rgba(100,116,139,0.35)",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                    flexShrink: 0,
                  }}>▼</span>
                </div>
              </button>

              {/* Expandable AI explanation */}
              {isExpanded && (
                <div style={{
                  padding: "0 10px 9px 10px",
                  borderTop: `1px solid ${borderColor}`,
                  paddingTop: "8px",
                  animation: "fl-fade-in 0.15s ease",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "rgba(148,163,184,0.75)",
                    lineHeight: 1.6,
                    letterSpacing: "0.01em",
                  }}>
                    {explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── R:R summary ────────────────────────────────── */}
      <div style={{
        marginTop: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px",
        background: riskReward >= 2.5
          ? "rgba(52,211,153,0.06)"
          : riskReward >= 1.5
          ? "rgba(255,215,0,0.05)"
          : "rgba(255,45,85,0.05)",
        border: `1px solid ${
          riskReward >= 2.5
            ? "rgba(52,211,153,0.18)"
            : riskReward >= 1.5
            ? "rgba(255,215,0,0.15)"
            : "rgba(255,45,85,0.15)"
        }`,
        borderRadius: "3px",
      }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.1em", color: "rgba(100,116,139,0.6)", textTransform: "uppercase" }}>
          RISK / REWARD
        </div>
        <div style={{
          fontSize: "15px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 700,
          color: riskReward >= 2.5 ? "#34D399" : riskReward >= 1.5 ? "#FFD700" : "#FF2D55",
          letterSpacing: "0.02em",
        }}>
          {riskReward.toFixed(1)}x
        </div>
      </div>

      {/* R:R quality note */}
      <div style={{
        marginTop: "4px",
        fontSize: "10px",
        color: "rgba(100,116,139,0.4)",
        letterSpacing: "0.02em",
        textAlign: "right",
        fontStyle: "italic",
      }}>
        {riskReward >= 3.0
          ? "Excellent setup — strong asymmetry"
          : riskReward >= 2.0
          ? "Solid setup — favorable risk/reward"
          : riskReward >= 1.5
          ? "Acceptable — monitor closely"
          : "Marginal — consider tightening entry or waiting for better setup"}
      </div>
    </div>
  );
}
