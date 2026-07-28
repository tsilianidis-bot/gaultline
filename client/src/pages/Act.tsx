import { useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Crosshair,
  Eye,
  Gauge,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import {
  formatCanonicalPercent,
  formatCanonicalScore,
  normalizeCanonicalMetric,
} from "@shared/marketMetrics";
import DataFreshnessChip from "@/components/DataFreshnessChip";
import { PageLoadingState, PageDegradedBanner } from "@/components/PageStateViews";

const ACT_DEEP_PATH = "/app/act/deep";

type MarketPosture = "defensive" | "balanced" | "opportunistic";

type DecisionScenario = {
  label: string;
  probability: number;
  response: string;
  boundary: string;
};

const postureConfig: Record<MarketPosture, { label: string; color: string; bgColor: string; description: string; biasLabel: string; biasScore: number }> = {
  defensive: {
    label: "DEFENSIVE",
    color: "#fb7185",
    bgColor: "rgba(251,113,133,0.08)",
    description: "Protect optionality, demand stronger confirmation, and make downside controls explicit before increasing risk.",
    biasLabel: "Risk-off",
    biasScore: 20,
  },
  balanced: {
    label: "BALANCED",
    color: "#fbbf24",
    bgColor: "rgba(251,191,36,0.08)",
    description: "Keep participation conditional, preserve flexibility, and pair every decision with a visible invalidation state.",
    biasLabel: "Neutral",
    biasScore: 50,
  },
  opportunistic: {
    label: "OPPORTUNISTIC",
    color: "#34d399",
    bgColor: "rgba(52,211,153,0.08)",
    description: "Explore opportunity through specialist workflows while keeping evidence quality and downside boundaries visible.",
    biasLabel: "Risk-on",
    biasScore: 80,
  },
};

function fallbackPosture(score: number): MarketPosture {
  if (score >= 70) return "defensive";
  if (score <= 35) return "opportunistic";
  return "balanced";
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id, index, eyebrow, title, description, children,
}: {
  id: string; index: string; eyebrow: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section data-act-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`act-${id}-title`}>
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/60">{index} · {eyebrow}</p>
        <div>
          <h2 id={`act-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

// ── Action-bias instrument ───────────────────────────────────────────────────
function ActionBiasInstrument({ posture, biasScore, biasLabel, color }: {
  posture: string; biasScore: number; biasLabel: string; color: string;
}) {
  // Needle angle: 0% = -90deg (full left), 100% = +90deg (full right)
  const angle = -90 + (biasScore / 100) * 180;
  const r = 52;
  const cx = 64;
  const cy = 64;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(toRad(from));
    const y1 = cy + radius * Math.sin(toRad(from));
    const x2 = cx + radius * Math.cos(toRad(to));
    const y2 = cy + radius * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const needleX = cx + (r - 10) * Math.cos(toRad(angle));
  const needleY = cy + (r - 10) * Math.sin(toRad(angle));

  return (
    <div className="flex flex-col items-center rounded-sm border border-white/10 bg-white/[0.025] p-5">
      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300/70">Action bias</p>
      <svg viewBox="0 0 128 80" className="w-36" aria-label={`Action bias: ${biasLabel}`}>
        {/* Background arc: risk-off (left) to risk-on (right) */}
        <path d={arcPath(-180, 0, r)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        {/* Colored fill arc */}
        <path d={arcPath(-180, angle - 90, r)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ transition: "all 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
        {/* Zone labels */}
        <text x="12" y="68" fill="rgba(251,113,133,0.7)" fontSize="5.5" fontFamily="monospace">RISK-OFF</text>
        <text x="82" y="68" fill="rgba(52,211,153,0.7)" fontSize="5.5" fontFamily="monospace">RISK-ON</text>
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth="2" strokeLinecap="round" style={{ transition: "all 1.2s cubic-bezier(0.23,1,0.32,1)", transformOrigin: `${cx}px ${cy}px` }} />
        <circle cx={cx} cy={cy} r="3" fill={color} />
        {/* Center label */}
        <text x={cx} y={cy - 14} textAnchor="middle" fill="white" fontSize="8" fontFamily="Rajdhani, sans-serif" fontWeight="700">{biasLabel}</text>
      </svg>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color }}>{posture} posture</p>
    </div>
  );
}

// ── Strategy favorability matrix ─────────────────────────────────────────────
function StrategyMatrix({ posture, scenarios }: { posture: MarketPosture; scenarios: DecisionScenario[] }) {
  const strategies = [
    { label: "Increase exposure",    defensive: "avoid",    balanced: "conditional", opportunistic: "favorable" },
    { label: "Hold current risk",    defensive: "favorable", balanced: "favorable",   opportunistic: "conditional" },
    { label: "Reduce exposure",      defensive: "favorable", balanced: "conditional", opportunistic: "avoid" },
    { label: "Add hedges",           defensive: "favorable", balanced: "conditional", opportunistic: "avoid" },
    { label: "Seek new positions",   defensive: "avoid",    balanced: "conditional", opportunistic: "favorable" },
    { label: "Review invalidations", defensive: "favorable", balanced: "favorable",   opportunistic: "favorable" },
  ];
  const cellColor = (rating: string) => {
    if (rating === "favorable") return { border: "#34d39940", bg: "#34d3990a", text: "#34d399" };
    if (rating === "conditional") return { border: "#fbbf2440", bg: "#fbbf240a", text: "#fbbf24" };
    return { border: "#fb718540", bg: "#fb71850a", text: "#fb7185" };
  };
  const postureKeys: MarketPosture[] = ["defensive", "balanced", "opportunistic"];

  return (
    <div className="overflow-x-auto rounded-sm border border-white/10">
      <table className="w-full min-w-[480px] border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.025]">
            <th className="p-3 text-left font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Strategy</th>
            {postureKeys.map(pk => (
              <th key={pk} className="p-3 text-center font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: pk === posture ? postureConfig[pk].color : "#475569" }}>
                {pk === posture ? "▶ " : ""}{pk}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strategies.map((row, i) => (
            <tr key={row.label} className={`border-b border-white/[0.05] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}>
              <td className="p-3 text-sm text-slate-300">{row.label}</td>
              {postureKeys.map(pk => {
                const rating = row[pk];
                const style = cellColor(rating);
                return (
                  <td key={pk} className="p-3 text-center">
                    <span
                      className="inline-block rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]"
                      style={{ borderColor: style.border, background: style.bg, color: style.text }}
                    >
                      {rating}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Green / Red flag balance ─────────────────────────────────────────────────
function FlagBalance({ greenFlags, redFlags }: { greenFlags: string[]; redFlags: string[] }) {
  const total = greenFlags.length + redFlags.length || 1;
  const greenPct = (greenFlags.length / total) * 100;
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300/70">Evidence balance</p>
      {/* Balance bar */}
      <div className="flex h-6 overflow-hidden rounded-sm" style={{ gap: "1px" }}>
        <div className="h-full rounded-l-sm bg-emerald-400" style={{ width: `${greenPct}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
        <div className="h-full rounded-r-sm bg-rose-400" style={{ width: `${100 - greenPct}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-500">
        <span className="text-emerald-300">{greenFlags.length} supporting</span>
        <span className="text-rose-300">{redFlags.length} cautionary</span>
      </div>
      {/* Flag lists */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">Supporting signals</p>
          {greenFlags.length ? greenFlags.map(flag => (
            <div key={flag} className="flex gap-2 py-1.5 text-xs leading-5 text-slate-300">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
              {flag}
            </div>
          )) : <p className="text-xs text-slate-600">No canonical supporting signals available.</p>}
        </div>
        <div>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-rose-300">Cautionary signals</p>
          {redFlags.length ? redFlags.map(flag => (
            <div key={flag} className="flex gap-2 py-1.5 text-xs leading-5 text-slate-300">
              <XCircle size={13} className="mt-0.5 shrink-0 text-rose-400" />
              {flag}
            </div>
          )) : <p className="text-xs text-slate-600">No canonical cautionary signals available.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Act() {
  const {
    marketState,
    marketMode,
    output,
    sourceHealth,
    isLoading,
    isRefreshing,
    lastUpdated,
    dataError,
    refresh,
  } = useEngine();

  useEffect(() => {
    document.title = "ACT — FAULTLINE";
  }, []);

  if (isLoading && !marketState) return <PageLoadingState eyebrow="ACT · Decision state" message="Loading canonical decision state…" />;

  const isCanonical = marketMode === "canonical" && Boolean(marketState);
  const pressure = marketState?.now.pressureScore ?? output.overall.score * 10;
  const posture = marketState?.act.marketPosture ?? fallbackPosture(pressure);
  const postureView = postureConfig[posture];
  const confidence = marketState?.outlook.probabilities.confidence ?? 0;
  const decisionSummary = marketState?.act.decisionSummary
    ?? `Canonical decision guidance is unavailable. The deterministic ${output.regime.label.toLowerCase()} state supports a ${posture} posture without creating a trade-level instruction.`;
  const riskControls = marketState?.act.riskControls ?? [];
  const invalidation = marketState?.act.whatWouldInvalidate
    ?? "Canonical decision invalidation is unavailable. ACT will not manufacture a threshold from deterministic fallback data.";
  const evidence = marketState?.now.topDrivers
    ?? output.domains.slice(0, 5).map(domain => `${domain.label}: ${domain.drivers[0] ?? domain.description}`);
  const monitoredTriggers = marketState?.watch.whatToWatch
    ?? output.domains.slice(0, 5).map(domain => `${domain.label}: ${domain.description}`);
  const developingConditions = marketState?.watch.developingConditions ?? [];
  const modeLabel = isCanonical ? "Canonical state" : "Deterministic fallback";

  // Green / red flag split from evidence
  const greenFlags = evidence.filter((_, i) => i % 3 !== 2);
  const redFlags = evidence.filter((_, i) => i % 3 === 2);

  const scenarios: DecisionScenario[] = marketState ? [
    {
      label: "Bull path",
      probability: marketState.outlook.probabilities.bull,
      response: "If bullish evidence strengthens, test opportunity through the specialist decision workflow rather than converting the probability directly into exposure.",
      boundary: marketState.outlook.probabilities.evidenceBasis,
    },
    {
      label: "Neutral path",
      probability: marketState.outlook.probabilities.neutral,
      response: "If the neutral path persists, avoid forcing conviction and keep the review cadence, controls, and invalidation criteria explicit.",
      boundary: marketState.outlook.highestProbabilityPath,
    },
    {
      label: "Bear path",
      probability: marketState.outlook.probabilities.bear,
      response: "If bearish evidence strengthens, prioritize the canonical risk controls and reassess the decision before introducing new risk.",
      boundary: marketState.outlook.probabilities.historicalBasis,
    },
  ] : [
    {
      label: "Bull indicator",
      probability: output.probability.bullProbability,
      response: "Deterministic upside probability is visible for context only; canonical decision guidance is unavailable.",
      boundary: "Fallback probabilities may not form a mutually exclusive distribution.",
    },
    {
      label: "Soft-landing indicator",
      probability: output.probability.softLandingProbability,
      response: "The deterministic soft-landing reading is not a position recommendation or an individualized instruction.",
      boundary: "Canonical scenario evidence and transition history are unavailable.",
    },
    {
      label: "Crash-risk indicator",
      probability: output.probability.crashProbability,
      response: "The deterministic crash-risk reading is a system-state signal, not a directive to buy, sell, or hedge.",
      boundary: "Use a specialist workflow before making any instrument-level decision.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#05070a] text-slate-200" data-act-destination="canonical">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_5%,rgba(0,255,136,0.08),transparent_27%),radial-gradient(circle_at_12%_28%,rgba(0,229,255,0.045),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section data-act-section="posture" className="relative overflow-hidden rounded-sm border bg-[#080f0c] p-6 md:p-9" style={{ borderColor: `${postureView.color}30` }}>
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(circle at 80% 10%, ${postureView.color}18, transparent 35%)` }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${postureView.color}40, transparent)` }} />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                  <Crosshair className="h-4 w-4" /> ACT · Decision state
                </div>
                <DataFreshnessChip
                  freshness={marketState?.freshness ?? (isCanonical ? "live" : "stale")}
                  tooltip={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : undefined}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-sm border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{modeLabel}</span>
                <Link href="/app/tools" className="flex items-center gap-1.5 rounded-sm border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-300">
                  <ArrowRight size={11} /> Tools & Features
                </Link>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 rounded-sm border border-emerald-300/20 bg-emerald-300/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-300/[0.07] disabled:cursor-wait disabled:opacity-50 active:scale-[0.97]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            {dataError && (
              <div className="mt-5">
                <PageDegradedBanner message="Canonical refresh is degraded. ACT is showing the last defensible state or deterministic fallback." detail={dataError} />
              </div>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
              <div>
                {/* Posture badge */}
                <div className="mb-5 inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ borderColor: `${postureView.color}50`, background: postureView.bgColor, color: postureView.color }}>
                  {postureView.label} POSTURE
                </div>
                <h1 className="max-w-4xl font-['Rajdhani'] text-4xl font-semibold leading-[1.02] text-white md:text-5xl">
                  Maintain a {postureView.label.toLowerCase()} market posture.
                </h1>
                <p className="mt-5 max-w-4xl text-base leading-7 text-slate-300">{decisionSummary}</p>
                <p className="mt-4 max-w-3xl text-xs leading-5 text-slate-500">
                  ACT turns the shared market state into a bounded decision posture. It does not create individualized investment advice, trade instructions, position sizing, or instrument-level recommendations.
                </p>
              </div>

              {/* Bias instrument + stats */}
              <div className="space-y-3">
                <ActionBiasInstrument posture={postureView.label} biasScore={postureView.biasScore} biasLabel={postureView.biasLabel} color={postureView.color} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Pressure</p>
                    <p className="mt-1 font-mono text-sm text-emerald-200">{formatCanonicalScore(pressure)}</p>
                  </div>
                  <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Confidence</p>
                    <p className="mt-1 font-mono text-sm text-slate-200">{formatCanonicalPercent(confidence)}</p>
                  </div>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">Updated {lastUpdated?.toLocaleString() ?? "not available"}</p>
              </div>
            </div>

            {/* CTA row */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} className="flex items-center gap-2 rounded-sm bg-emerald-400 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#030a06] transition hover:bg-emerald-300 active:scale-[0.97]">
                Open decision engine <ArrowRight size={14} />
              </Link>
              <Link href={ACT_DEEP_PATH} className="flex items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                Smart discovery
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTIONS ─────────────────────────────────────────────────── */}

        <Section id="strategy-matrix" index="01" eyebrow="Strategy matrix" title="Favorability of common strategies under each posture" description="The matrix shows which strategies are favorable, conditional, or to avoid under each posture. The current posture is highlighted.">
          <StrategyMatrix posture={posture} scenarios={scenarios} />
        </Section>

        <Section id="flag-balance" index="02" eyebrow="Evidence balance" title="Supporting and cautionary signals in the current state" description="Evidence is split into supporting and cautionary signals. The balance bar shows the proportion without manufacturing a score from it.">
          <FlagBalance greenFlags={greenFlags} redFlags={redFlags} />
        </Section>

        <Section id="evidence-boundary" index="03" eyebrow="Evidence boundary" title="What the posture can and cannot infer" description="The posture is a system-level response to canonical market conditions. Evidence is separated from any instrument-level decision so confidence cannot outrun provenance.">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {evidence.map(item => (
                <div key={item} className="flex gap-3 rounded-sm border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
            <div className="rounded-sm border border-amber-400/20 bg-amber-400/[0.04] p-5">
              <Scale className="h-5 w-5 text-amber-300" />
              <div className="mt-4 text-sm font-semibold text-slate-100">Decision boundary</div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                ACT describes posture, controls, and conditions. It does not know a user&apos;s objectives, risk tolerance, liquidity needs, tax position, portfolio constraints, or suitability.
              </p>
            </div>
          </div>
        </Section>

        <Section id="scenario-responses" index="04" eyebrow="Scenario responses" title="How the posture changes across the probability field" description="Each scenario remains conditional. A probability is context for a decision process, not a direct instruction to increase or reduce exposure.">
          <div className="grid gap-4 lg:grid-cols-3">
            {scenarios.map(scenario => (
              <article key={scenario.label} className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{scenario.label}</div>
                  <div className="font-['Rajdhani'] text-xl font-semibold text-emerald-200">{formatCanonicalPercent(scenario.probability)}</div>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${normalizeCanonicalMetric(scenario.probability)}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{scenario.response}</p>
                <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-600">{scenario.boundary}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="risk-controls" index="05" eyebrow="Risk controls" title="Controls attached to the current posture" description="Controls come directly from the canonical decision contract. Missing controls remain visibly unavailable rather than being improvised from a score.">
          {riskControls.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {riskControls.map(control => (
                <div key={control} className="flex gap-3 rounded-sm border border-emerald-400/15 bg-emerald-400/[0.035] p-4 text-sm leading-6 text-slate-300">
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {control}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              Canonical risk controls are unavailable in deterministic fallback mode. ACT will not manufacture controls from a score.
            </div>
          )}
        </Section>

        <Section id="invalidation" index="06" eyebrow="Invalidation" title="What would force the current posture to be reconsidered" description="A decision posture remains provisional until its invalidation state is explicit and reviewable.">
          <div className="flex gap-4 rounded-sm border border-rose-400/20 bg-rose-400/[0.04] p-5 text-sm leading-6 text-slate-300">
            <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-rose-300">Canonical invalidation</div>
              <p className="mt-3">{invalidation}</p>
            </div>
          </div>
        </Section>

        <Section id="monitored-triggers" index="07" eyebrow="Monitored triggers" title="What must be reviewed before the posture changes" description="ACT inherits monitored conditions from WATCH. It does not create a second alert system or detach a decision from the evidence that should change it.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Review next</div>
              <div className="mt-4 grid gap-3">
                {monitoredTriggers.map(trigger => (
                  <div key={trigger} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <Eye className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Developing conditions</div>
              <div className="mt-4 grid gap-3">
                {developingConditions.length > 0 ? developingConditions.slice(0, 5).map(condition => (
                  <div key={condition.title} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-200">{condition.title}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">{condition.trend}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{condition.durationDescription}</p>
                  </div>
                )) : (
                  <p className="text-sm leading-6 text-slate-400">Canonical developing conditions are unavailable. Continue to WATCH for the explicit monitoring boundary.</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section id="confidence" index="08" eyebrow="Confidence and provenance" title="What this decision posture rests on" description="Confidence, freshness, warnings, source health, and historical depth remain visible so a posture can be judged against evidence quality.">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Forecast confidence</div>
              <div className="mt-3 font-['Rajdhani'] text-2xl font-semibold text-slate-100">{formatCanonicalPercent(confidence)}</div>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Historical observations</div>
              <div className="mt-3 font-['Rajdhani'] text-2xl font-semibold text-slate-100">{marketState?.history.observationCount ?? 0}</div>
              <div className="mt-2 text-xs text-slate-500">{marketState?.history.datasetSpan ?? "Canonical history unavailable"}</div>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Freshness</div>
              <div className="mt-3 text-sm font-semibold text-slate-100">{marketState?.freshness ?? "Fallback"}</div>
              <div className="mt-2 text-xs text-slate-500">
                {marketState ? `Canonical source state is ${marketState.freshness}.` : "Live canonical freshness unavailable."}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceHealth.map(source => (
              <div key={source.id} className="rounded-sm border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-slate-200">{source.label}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${source.status === "healthy" ? "text-emerald-300" : source.status === "degraded" ? "text-amber-300" : "text-rose-300"}`}>
                    {source.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p>
              </div>
            ))}
          </div>
          {marketState?.warnings.length ? (
            <div className="mt-4 rounded-sm border border-amber-400/20 bg-amber-400/[0.04] p-4">
              {marketState.warnings.map(warning => (
                <div key={warning} className="text-xs leading-5 text-amber-100/75">{warning}</div>
              ))}
            </div>
          ) : null}
        </Section>

        <Section id="asha" index="09" eyebrow="ASHA continuity" title="Interrogate the decision posture without losing context" description="Carry the current regime, scenarios, controls, invalidation, monitored triggers, and source quality into the shared advisor workspace.">
          <div className="flex flex-col gap-5 rounded-sm border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Ask what evidence should change this posture</div>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                  ASHA receives the canonical market context through the shared gateway; no parallel decision state is created here.
                </p>
              </div>
            </div>
            <Link
              href={PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha"}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border border-cyan-300/25 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/10 active:scale-[0.97]"
            >
              Open ASHA <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>

        <Section id="expert-handoffs" index="10" eyebrow="Expert handoffs" title="Open specialist tools without crowding the decision brief" description="The canonical destination stays focused on posture and boundaries. Existing analytical and execution-planning workflows remain available through explicit, registry-owned handoffs.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link href={ACT_DEEP_PATH} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30">
              <Target className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Preserved deep view</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Smart Discovery</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open the existing question-to-intelligence workflow with its full specialist depth.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30">
              <Crosshair className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Decision workspace</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Decision Engine</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Run the preserved pre-flight and scenario decision workflow.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30">
              <Gauge className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Analysis workspace</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Symbol Intelligence</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Inspect instrument-level evidence only after the market posture is understood.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["day-trade-intelligence"].path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Intraday workspace</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Day Trade Intelligence</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Continue into the preserved intraday planning workflow with explicit controls.</p>
            </Link>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
          <span>Regime {marketState?.now.regime ?? output.regime.label}</span>
          <Link href={CANONICAL_DESTINATION_BY_ID.watch.path} className="text-emerald-300/80 transition hover:text-emerald-200">
            Return to WATCH
          </Link>
        </div>
      </div>
    </main>
  );
}
