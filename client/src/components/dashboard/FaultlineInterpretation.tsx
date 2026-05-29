/**
 * FAULTLINE Interpretation Section
 * "What today's readings actually mean"
 *
 * Dynamically derives all content from EngineOutput:
 *   - Pressure Index + Regime from overall + regime
 *   - Bull/Crash probabilities from probability
 *   - Top threat from highest-scoring domain
 *   - Easing/building signals from domain deltas
 *   - Closest historical analog from analogs[0]
 *   - AI concentration from indicators.aiConcentration
 *
 * Displays:
 *   - Status chips row (Moderate Risk, AI Concentration, etc.)
 *   - Plain-English narrative paragraphs
 *   - 3 takeaway cards: Clean Read · Guidance · Most Important
 */
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { getRiskColor } from "@/components/RiskBadge";

// ── Helpers ────────────────────────────────────────────────────────────────────

function deltaLabel(delta: number): "easing" | "building" | "stable" {
  if (delta < -0.15) return "easing";
  if (delta > 0.15) return "building";
  return "stable";
}

const CHIP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  green:  { bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.25)",  text: "rgba(0,255,136,0.9)" },
  cyan:   { bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.25)",  text: "rgba(0,212,255,0.9)" },
  amber:  { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", text: "rgba(251,191,36,0.9)" },
  red:    { bg: "rgba(255,45,85,0.08)",  border: "rgba(255,45,85,0.25)",  text: "rgba(255,45,85,0.9)" },
  purple: { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)", text: "rgba(168,85,247,0.9)" },
  gray:   { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", text: "rgba(148,163,184,0.7)" },
};

type ChipColor = keyof typeof CHIP_COLORS;

function StatusChip({ label, color }: { label: string; color: ChipColor }) {
  const c = CHIP_COLORS[color];
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
      padding: "4px 10px", borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function TakeawayCard({
  label, labelColor, title, body,
}: {
  label: string; labelColor: ChipColor; title: string; body: string;
}) {
  const c = CHIP_COLORS[labelColor];
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: `1px solid ${c.border}`,
      borderRadius: 14, padding: "18px 20px",
      flex: "1 1 220px", minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
        color: c.text, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 15, fontWeight: 700, color: "#E2E8F0",
        marginBottom: 8, lineHeight: 1.3,
      }}>
        {title}
      </div>
      <p style={{
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12, color: "rgba(148,163,184,0.75)",
        lineHeight: 1.65, margin: 0,
      }}>
        {body}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FaultlineInterpretation() {
  const { output, indicators } = useEngine();
  const { overall, regime, probability, domains, analogs } = output;

  // Derive key signals dynamically
  const topDomain = useMemo(
    () => [...domains].sort((a, b) => b.score - a.score)[0],
    [domains]
  );

  const closestAnalog = analogs[0];

  const domainById = useMemo(
    () => Object.fromEntries(domains.map(d => [d.id, d])),
    [domains]
  );

  const treasuryDelta  = deltaLabel(domainById["treasury-debt"]?.delta ?? 0);
  const recessionDelta = deltaLabel(domainById["recession"]?.delta ?? 0);
  const liquidityDelta = deltaLabel(domainById["liquidity"]?.delta ?? 0);
  const bankingDelta   = deltaLabel(domainById["banking"]?.delta ?? 0);
  const creditDelta    = deltaLabel(domainById["credit-stress"]?.delta ?? 0);

  const inflationDomain = domainById["inflation-fed"];
  const bankingDomain   = domainById["banking"];
  const creditDomain    = domainById["credit-stress"];
  const creDomain       = domainById["commercial-real-estate"] ?? domainById["cre-stress"];
  const aiBubbleDomain  = domainById["ai-bubble"] ?? topDomain;

  const aiConcentration = indicators.aiConcentration;
  const pressureScore   = overall.score;
  const regimeLabel     = regime.label;
  const bullPct         = probability.bullProbability;
  const crashPct        = probability.crashProbability;

  // Regime-based chip color
  const regimeChipColor: ChipColor =
    regime.code === "CRITICAL_SYSTEMIC" ? "red" :
    regime.code === "LATE_CYCLE_FRAGILITY" ? "red" :
    regime.code === "ELEVATED_STRESS" ? "amber" :
    regime.code === "MODERATE_RISK" ? "amber" : "green";

  // Top threat chip color
  const topThreatColor: ChipColor =
    topDomain?.riskLevel === "critical" ? "red" :
    topDomain?.riskLevel === "high" ? "red" :
    topDomain?.riskLevel === "elevated" ? "amber" : "amber";

  // Crash risk chip color
  const crashChipColor: ChipColor = crashPct >= 50 ? "red" : crashPct >= 35 ? "amber" : "green";

  // Liquidity chip color
  const liquidityChipColor: ChipColor = liquidityDelta === "easing" ? "green" : liquidityDelta === "building" ? "amber" : "cyan";

  // Build dynamic narrative paragraphs
  const para1 = `Overall, FAULTLINE is showing ${regimeLabel.toLowerCase()} systemic risk. The current Pressure Index is ${pressureScore.toFixed(1)}/10, placing the market in a ${regimeLabel} regime. Bull probability ${bullPct > crashPct ? "remains slightly favored" : "is below crash probability"} at ${bullPct}%, while crash/bear probability is ${crashPct >= 40 ? "elevated" : "contained"} at ${crashPct}%.`;

  const para2 = `The strongest warning is not broad recession pressure. The main risk is ${aiBubbleDomain?.label ?? "speculative concentration"}, scoring ${aiBubbleDomain?.score.toFixed(1) ?? "—"}/10.${aiConcentration > 25 ? ` AI/mega-cap concentration stands at ${aiConcentration.toFixed(1)}% of the S&P 500.` : ""}${closestAnalog ? ` The closest historical analog is the ${closestAnalog.era} (${closestAnalog.year}), with a ${closestAnalog.similarity}% similarity score.` : ""}`;

  const easingZones: string[] = [];
  const dangerZones: string[] = [];

  if (treasuryDelta === "easing")  easingZones.push("Treasury/Debt Stress");
  else if (treasuryDelta === "building") dangerZones.push("Treasury/Debt Stress");

  if (recessionDelta === "easing")  easingZones.push("Recession Risk");
  else if (recessionDelta === "building") dangerZones.push("Recession Risk");

  if (liquidityDelta === "easing")  easingZones.push("Liquidity Conditions");
  else if (liquidityDelta === "building") dangerZones.push("Liquidity Conditions");

  if (bankingDelta === "building")  dangerZones.push("Banking System Stress");
  if (creditDelta === "building")   dangerZones.push("Credit Market Stress");
  if (inflationDomain && inflationDomain.score >= 4) dangerZones.push("Inflation/Fed Pressure");
  if (creDomain && creDomain.score >= 6) dangerZones.push("Commercial Real Estate Stress");

  const para3 = easingZones.length > 0
    ? `Several major stress areas are easing, including ${easingZones.join(", ")}. This means the system is not currently confirming a broad liquidity collapse — risk-on assets may still have room to move.`
    : `Systemic stress remains broadly elevated across multiple domains. No major easing signals are present at this time.`;

  const para4 = dangerZones.length > 0
    ? `However, several danger zones remain active: ${dangerZones.join(", ")}. The market can continue climbing, but the foundation is fragile if ${aiBubbleDomain?.label ?? "AI leadership"} breaks down, credit conditions worsen, or liquidity reverses.`
    : `Risk conditions are broadly contained. Monitor for any deterioration in credit spreads or liquidity metrics.`;

  // Takeaway card content — dynamically adapted to regime
  const cleanReadTitle = crashPct >= 50
    ? "Elevated crash risk — defensive posture warranted"
    : "Not a 'crash now' signal";

  const cleanReadBody = crashPct >= 50
    ? `Crash/bear probability has crossed 50%. The market is showing structural fragility. Reduce exposure to high-beta and speculative names.`
    : `This is not a "crash now" signal. It is a "market is vulnerable if ${aiBubbleDomain?.label ?? "the AI trade"} cracks, credit worsens, or liquidity reverses" signal.`;

  const guidanceBody = bullPct >= 55
    ? "Stay invested selectively, but do not ignore risk. Favor stronger assets, avoid chasing weak speculative names, monitor AI concentration, watch credit spreads, track liquidity, and be careful with high-beta stocks that depend on cheap money."
    : "Reduce speculative exposure. Favor quality, cash-flow positive assets. Watch credit spreads and liquidity conditions closely. Avoid adding risk until the regime clarifies.";

  const mostImportantBody = `The market can ${bullPct > 50 ? "keep climbing" : "stabilize"}, but the foundation is fragile. The biggest risk is ${aiBubbleDomain?.label ?? "an AI/mega-cap unwind"}, not a traditional recession shock right now.`;

  return (
    <div style={{
      background: "rgba(7,9,16,0.8)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "24px",
      marginTop: 0,
    }}>
      {/* Section header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase",
          color: "rgba(100,116,139,0.5)", marginBottom: 6,
        }}>
          FAULTLINE INTERPRETATION
        </div>
        <div style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 20, fontWeight: 700, color: "#E2E8F0",
          letterSpacing: "0.04em",
        }}>
          What today's readings actually mean
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        <StatusChip label={regimeLabel} color={regimeChipColor} />
        {aiBubbleDomain && (
          <StatusChip label={`${aiBubbleDomain.label} ${aiBubbleDomain.score.toFixed(1)}/10`} color={topThreatColor} />
        )}
        {aiConcentration > 25 && (
          <StatusChip label={`AI Concentration ${aiConcentration.toFixed(1)}%`} color="amber" />
        )}
        <StatusChip
          label={`Liquidity ${liquidityDelta === "easing" ? "Stable" : liquidityDelta === "building" ? "Tightening" : "Neutral"}`}
          color={liquidityChipColor}
        />
        <StatusChip label={`Crash Risk ${crashPct}%`} color={crashChipColor} />
        {closestAnalog && (
          <StatusChip label={`Analog: ${closestAnalog.era} ${closestAnalog.similarity}%`} color="purple" />
        )}
      </div>

      {/* Narrative paragraphs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {[para1, para2, para3, para4].map((para, i) => (
          <p key={i} style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13, color: "rgba(148,163,184,0.8)",
            lineHeight: 1.7, margin: 0,
          }}>
            {para}
          </p>
        ))}
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }} />

      {/* 3 Takeaway Cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <TakeawayCard
          label="⬡ Clean Read"
          labelColor={crashPct >= 50 ? "red" : "cyan"}
          title={cleanReadTitle}
          body={cleanReadBody}
        />
        <TakeawayCard
          label="◈ Guidance"
          labelColor="amber"
          title={bullPct >= 55 ? "Stay invested, stay selective" : "Reduce risk exposure"}
          body={guidanceBody}
        />
        <TakeawayCard
          label="▲ Most Important"
          labelColor="purple"
          title="The foundation is fragile"
          body={mostImportantBody}
        />
      </div>
    </div>
  );
}
