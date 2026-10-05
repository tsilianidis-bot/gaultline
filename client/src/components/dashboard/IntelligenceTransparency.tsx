/**
 * Intelligence transparency panel — "WHY is the Pressure Index here?"
 * Display / interpretation only. Reads canonical state + Champion weights.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { CHAMPION_VECTOR_WEIGHTS } from "../../../../server/pressure/championBaseline";
import {
  buildIntelligenceTransparency,
  championWeightsFromBaseline,
  type ComponentTransparency,
  type IntelligenceTransparencyModel,
} from "@shared/intelligenceTransparency";
import type { ProbabilityDisplay } from "@shared/probabilityContract";
import { engineProbabilityText } from "@/lib/marketStateProjection";
import { useEngine } from "@/contexts/EngineContext";

const WEIGHTS = championWeightsFromBaseline(CHAMPION_VECTOR_WEIGHTS);

const FRESHNESS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  LIVE: { bg: "rgba(0,255,136,0.08)", border: "rgba(0,255,136,0.28)", text: "rgba(0,255,136,0.95)" },
  DELAYED: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.28)", text: "rgba(251,191,36,0.95)" },
  STALE: { bg: "rgba(255,107,53,0.10)", border: "rgba(255,107,53,0.30)", text: "rgba(255,107,53,0.95)" },
  UNAVAILABLE: { bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.25)", text: "rgba(148,163,184,0.75)" },
};

function scoreColor(score: number | null): string {
  if (score == null) return "#94A3B8";
  if (score >= 65) return "#FF2D55";
  if (score >= 45) return "#F59E0B";
  if (score >= 25) return "#00E5FF";
  return "#00FF88";
}

function MonoBadge({ label, tone }: { label: string; tone: keyof typeof FRESHNESS_STYLE | "cyan" | "gray" | "purple" }) {
  const styles =
    tone in FRESHNESS_STYLE
      ? FRESHNESS_STYLE[tone as keyof typeof FRESHNESS_STYLE]
      : tone === "cyan"
        ? { bg: "rgba(0,229,255,0.08)", border: "rgba(0,229,255,0.25)", text: "rgba(0,229,255,0.9)" }
        : tone === "purple"
          ? { bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.25)", text: "rgba(168,85,247,0.9)" }
          : { bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)", text: "rgba(148,163,184,0.7)" };
  return (
    <span
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 4,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.text,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ContributionRow({ row, maxPoints }: { row: ComponentTransparency; maxPoints: number }) {
  const color = scoreColor(row.score);
  const width =
    row.contributionPoints != null && maxPoints > 0
      ? Math.min(100, Math.max(4, (row.contributionPoints / maxPoints) * 100))
      : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.4fr) 52px 64px 56px",
        gap: 8,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#E2E8F0", letterSpacing: "0.04em" }}>
          {row.rank != null ? String(row.rank).padStart(2, "0") : "—"} · {row.label}
        </div>
        <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: `${width}%`, height: "100%", background: color, boxShadow: `0 0 8px ${color}55` }} />
        </div>
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, color, textAlign: "right" }}>
        {row.score != null ? row.score : "—"}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(148,163,184,0.8)", textAlign: "right" }}>
        {row.weightPct}%
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#CBD5E1", textAlign: "right" }}>
        {row.contributionPoints != null ? row.contributionPoints : "—"}
      </div>
    </div>
  );
}

function ComponentCard({ row }: { row: ComponentTransparency }) {
  const color = scoreColor(row.score);
  const muted = row.availability === "unavailable";
  return (
    <article
      style={{
        background: muted ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${muted ? "rgba(255,255,255,0.06)" : `${color}22`}`,
        borderRadius: 14,
        padding: "14px 16px",
        opacity: muted ? 0.72 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(100,116,139,0.7)", marginBottom: 4 }}>
            {row.rank != null ? `RANK ${String(row.rank).padStart(2, "0")}` : "NOT CITED"}
            {row.contributionPct != null ? ` · ${row.contributionPct}% OF PI` : ""}
          </div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 15, color: "#E2E8F0", letterSpacing: "0.03em" }}>
            {row.label}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
            {row.score != null ? row.score : "—"}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.55)" }}>/100</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <MonoBadge label={row.freshness} tone={row.freshness} />
        <MonoBadge label={row.posture} tone="gray" />
        <MonoBadge label={`WT ${row.weightPct}%`} tone="cyan" />
        {row.contributionPoints != null && <MonoBadge label={`${row.contributionPoints} pts`} tone="purple" />}
        {row.staticBaseline && <MonoBadge label="Static baseline" tone="gray" />}
      </div>

      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.65, margin: "0 0 10px" }}>
        {row.plainEnglishReason}
      </p>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, letterSpacing: "0.18em", color: "rgba(100,116,139,0.55)", marginBottom: 6 }}>
          PRIMARY INDICATORS
        </div>
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(148,163,184,0.75)", lineHeight: 1.55 }}>
          {row.primaryIndicators.length > 0 ? row.primaryIndicators.join(" · ") : "No verified indicators on this state"}
        </div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.7)" }}>
          <span>AS-OF {row.asOf ?? "—"}</span>
          {row.delayedAgeLabel && <span>· {row.delayedAgeLabel}</span>}
        </div>
      </div>
    </article>
  );
}

function HowBuiltBlock({ model }: { model: IntelligenceTransparencyModel }) {
  if (!model.howBuilt || model.pressureIndex == null) return null;
  const maxPoints = Math.max(
    0.1,
    ...model.components.map((c) => c.contributionPoints ?? 0),
  );
  const sorted = [...model.components].sort((a, b) => {
    if (a.rank == null && b.rank == null) return a.label.localeCompare(b.label);
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(7,9,16,0.95) 55%)",
        border: "1px solid rgba(0,229,255,0.18)",
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: "rgba(0,229,255,0.7)", marginBottom: 6 }}>
        HOW {model.pressureIndex} IS BUILT
      </div>
      <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 18, color: "#E2E8F0", marginBottom: 10 }}>
        Weighted Champion composite — not a simple average
      </div>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.65, margin: "0 0 12px" }}>
        {model.howBuilt.explanation}
      </p>
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: "rgba(100,116,139,0.85)", lineHeight: 1.6, margin: "0 0 16px" }}>
        {model.howBuilt.methodNote}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <MonoBadge label={`PI ${model.pressureIndex}`} tone="cyan" />
        {model.regime && <MonoBadge label={model.regime} tone="purple" />}
        <MonoBadge label={`Σ ${model.howBuilt.weightedSum} → round ${model.howBuilt.roundedScore}`} tone="gray" />
        <MonoBadge label={model.howBuilt.reconciles ? "Reconciles" : "Review reconcile"} tone={model.howBuilt.reconciles ? "LIVE" : "STALE"} />
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.4fr) 52px 64px 56px",
            gap: 8,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 8,
            letterSpacing: "0.14em",
            color: "rgba(100,116,139,0.65)",
            marginBottom: 4,
          }}
        >
          <span>COMPONENT</span>
          <span style={{ textAlign: "right" }}>SCORE</span>
          <span style={{ textAlign: "right" }}>WEIGHT</span>
          <span style={{ textAlign: "right" }}>POINTS</span>
        </div>
        {sorted.map((row) => (
          <ContributionRow key={row.engineId} row={row} maxPoints={maxPoints} />
        ))}
      </div>
    </div>
  );
}

export function IntelligenceTransparency() {
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const { output } = useEngine();

  const bullDisplay = output.probabilityDisplay?.bullProbability as ProbabilityDisplay | undefined;
  const crashDisplay = output.probabilityDisplay?.crashProbability as ProbabilityDisplay | undefined;

  const model = useMemo(
    () =>
      buildIntelligenceTransparency(canonicalState ?? null, WEIGHTS, {
        bullDisplay: bullDisplay ?? null,
        crashDisplay: crashDisplay ?? null,
      }),
    [canonicalState, bullDisplay, crashDisplay],
  );

  if (!canonicalState) return null;

  if (model.status === "unavailable") {
    return (
      <div
        style={{
          background: "rgba(7,9,16,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: "rgba(100,116,139,0.6)" }}>
          PRESSURE TRANSPARENCY
        </div>
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: "rgba(148,163,184,0.75)", marginTop: 10 }}>
          {model.unavailableReason}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <HowBuiltBlock model={model} />

      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.28em", color: "rgba(100,116,139,0.6)", marginBottom: 10 }}>
          COMPONENT READOUT · VERIFIED CANONICAL STATE
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          {model.components.map((row) => (
            <ComponentCard key={row.engineId} row={row} />
          ))}
        </div>
      </div>

      {model.asOf && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(100,116,139,0.55)", letterSpacing: "0.08em" }}>
          STATE {model.stateId ?? "—"} · EFFECTIVE {model.asOf}
        </div>
      )}
    </div>
  );
}

/** Demoted scenario chips for MacroRegimePanel — never implied probabilities. */
export function DemotedScenarioChips() {
  const { output } = useEngine();
  const bull = engineProbabilityText(output, "bullProbability");
  const crash = engineProbabilityText(output, "crashProbability");
  return (
    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
      <div
        className="rounded-xl p-2 text-center"
        style={{ background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.18)" }}
        data-probability-demoted="bull"
      >
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.18em", color: "rgba(100,116,139,0.55)", marginBottom: 2 }}>
          BULL SCENARIO · NOT A PROBABILITY
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: "rgba(148,163,184,0.75)" }}>
          {bull}
        </div>
      </div>
      <div
        className="rounded-xl p-2 text-center"
        style={{ background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.18)" }}
        data-probability-demoted="crash"
      >
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, letterSpacing: "0.18em", color: "rgba(100,116,139,0.55)", marginBottom: 2 }}>
          CRASH · NOT OFFERED AS PROBABILITY
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: "rgba(148,163,184,0.7)" }}>
          {crash}
        </div>
      </div>
    </div>
  );
}
