import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  GitBranch,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Telescope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { useEngine } from "@/contexts/EngineContext";
import { useSEO } from "@/hooks/useSEO";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import { formatCanonicalPercent, formatCanonicalScore, normalizeCanonicalMetric } from "@shared/marketMetrics";
import type { CanonicalMarketState } from "@shared/marketState";
import DataFreshnessChip from "@/components/DataFreshnessChip";
import { PageLoadingState, PageDegradedBanner } from "@/components/PageStateViews";

type EvidenceFamily = CanonicalMarketState["why"]["evidenceFamilies"][number];
type ScenarioKey = keyof CanonicalMarketState["outlook"]["regimeProbabilities"];

const OUTLOOK_DEEP_PATH = "/app/outlook/deep";

const SCENARIO_DEFINITIONS: Record<ScenarioKey, { label: string; description: string; tone: string; shortLabel: string }> = {
  bull:        { label: "Bull continuation",  shortLabel: "Bull",    description: "Constructive risk conditions persist or strengthen.", tone: "#34d399" },
  softLanding: { label: "Soft landing",        shortLabel: "Soft",    description: "Growth slows without a severe credit or labor break.", tone: "#60a5fa" },
  stagflation: { label: "Stagflation",         shortLabel: "Stag",    description: "Inflation pressure remains elevated while growth weakens.", tone: "#fbbf24" },
  recession:   { label: "Recession",           shortLabel: "Rec",     description: "A broad contraction becomes the dominant macro path.", tone: "#fb923c" },
  crash:       { label: "Crash / bear",        shortLabel: "Crash",   description: "A rapid systemic dislocation overtakes the base case.", tone: "#fb7185" },
};

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id, index, eyebrow, title, description, children,
}: {
  id: string; index: string; eyebrow: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section data-outlook-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`outlook-${id}-title`}>
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300/60">{index} · {eyebrow}</p>
        <div>
          <h2 id={`outlook-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

// ── Branching scenario pathway ───────────────────────────────────────────────
function ScenarioPathways({ rankedScenarios }: { rankedScenarios: Array<{ key: ScenarioKey; probability: number; label: string; shortLabel: string; tone: string; description: string }> }) {
  const topTwo = rankedScenarios.slice(0, 2);
  const rest = rankedScenarios.slice(2);
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <p className="mb-5 font-mono text-[9px] uppercase tracking-[0.18em] text-violet-300/70">Scenario branching — highest to lowest probability</p>
      {/* Current state node */}
      <div className="flex flex-col items-center">
        <div className="rounded-sm border border-white/20 bg-white/[0.04] px-5 py-3 text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">Current state</p>
          <p className="mt-1 font-['Rajdhani'] text-lg font-semibold text-white">Market regime</p>
        </div>
        {/* Vertical connector */}
        <div className="h-6 w-px bg-white/20" />
        {/* Branch row */}
        <div className="flex w-full flex-wrap items-start justify-center gap-3">
          {topTwo.map((scenario, i) => (
            <div key={scenario.key} className="flex flex-col items-center" style={{ flex: "1 1 160px", maxWidth: "220px" }}>
              {/* Connector line */}
              <div className="h-4 w-px" style={{ background: scenario.tone + "60" }} />
              <div
                className="w-full rounded-sm border p-4 text-center"
                style={{ borderColor: `${scenario.tone}50`, background: `${scenario.tone}0a` }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: scenario.tone }}>
                  {String(i + 1).padStart(2, "0")} · {scenario.shortLabel}
                </p>
                <p className="mt-2 font-['Rajdhani'] text-3xl font-semibold" style={{ color: scenario.tone }}>
                  {formatCanonicalPercent(scenario.probability)}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">{scenario.description}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Tail scenarios */}
        {rest.length > 0 && (
          <>
            <div className="mt-4 w-full border-t border-white/10 pt-4">
              <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">Tail scenarios</p>
              <div className="flex flex-wrap gap-2">
                {rest.map((scenario, i) => (
                  <div
                    key={scenario.key}
                    className="flex items-center gap-2 rounded-sm border px-3 py-2"
                    style={{ borderColor: `${scenario.tone}30`, background: `${scenario.tone}06` }}
                  >
                    <span className="font-mono text-[9px]" style={{ color: scenario.tone }}>{String(i + 3).padStart(2, "0")}</span>
                    <span className="font-mono text-[9px] text-slate-300">{scenario.shortLabel}</span>
                    <span className="font-mono text-[9px] font-semibold" style={{ color: scenario.tone }}>{formatCanonicalPercent(scenario.probability)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Probability band bar ─────────────────────────────────────────────────────
function ProbabilityBandBar({ scenarios }: { scenarios: Array<{ key: ScenarioKey; probability: number; label: string; tone: string }> }) {
  const total = scenarios.reduce((s, sc) => s + sc.probability, 0) || 100;
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.18em] text-violet-300/70">Probability distribution band</p>
      {/* Stacked bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-sm" style={{ gap: "1px" }}>
        {scenarios.map(sc => (
          <div
            key={sc.key}
            style={{ width: `${(sc.probability / total) * 100}%`, background: sc.tone, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }}
            title={`${sc.label}: ${formatCanonicalPercent(sc.probability)}`}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {scenarios.map(sc => (
          <div key={sc.key} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: sc.tone }} />
            <span className="font-mono text-[9px] text-slate-400">{sc.label}</span>
            <span className="font-mono text-[9px] font-semibold" style={{ color: sc.tone }}>{formatCanonicalPercent(sc.probability)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analog overlay card ──────────────────────────────────────────────────────
function AnalogOverlay({ analog: topAnalog }: { analog: { period: string; label: string; similarity: number; resolution: string } }) {
  const simWidth = Math.min(100, Math.max(0, topAnalog.similarity));
  return (
    <div className="rounded-sm border border-violet-300/20 bg-violet-300/[0.03] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-violet-300">
          <History size={15} />
          <p className="font-mono text-[9px] uppercase tracking-[0.13em]">{topAnalog.period}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Similarity</p>
          <p className="font-['Rajdhani'] text-2xl font-semibold text-violet-300">{formatCanonicalPercent(topAnalog.similarity)}</p>
        </div>
      </div>
      <p className="mt-3 font-['Rajdhani'] text-xl font-semibold text-white">{topAnalog.label}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-violet-400" style={{ width: `${simWidth}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">{topAnalog.resolution}</p>
    </div>
  );
}

// ── Source status ────────────────────────────────────────────────────────────
function SourceStatus({ source }: { source: CanonicalMarketState["sourceHealth"][number] }) {
  const tone = source.status === "healthy" ? "#34d399" : source.status === "degraded" ? "#fbbf24" : "#fb7185";
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">{source.label}</p>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: tone }}>{source.status}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p>
      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">As of {new Date(source.asOf).toLocaleString()}</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Outlook() {
  useSEO({
    title: "OUTLOOK — FAULTLINE",
    description: "See the ranked scenarios, probabilities, transition evidence, invalidations, and historical context that define what is most likely next.",
  });

  const {
    output,
    marketState,
    marketMode,
    sourceHealth,
    isLoading,
    isRefreshing,
    lastUpdated,
    dataError,
    refresh,
  } = useEngine();

  const regimeProbabilities: CanonicalMarketState["outlook"]["regimeProbabilities"] = marketState?.outlook.regimeProbabilities ?? {
    bull: normalizeCanonicalMetric(output.probability.bullProbability),
    softLanding: normalizeCanonicalMetric(output.probability.softLandingProbability),
    stagflation: normalizeCanonicalMetric(output.probability.stagflationProbability),
    recession: normalizeCanonicalMetric(output.probability.recessionProbability),
    crash: normalizeCanonicalMetric(output.probability.crashProbability),
  };

  const rankedScenarios = (Object.entries(regimeProbabilities) as Array<[ScenarioKey, number]>)
    .map(([key, probability]) => ({ key, probability: normalizeCanonicalMetric(probability), ...SCENARIO_DEFINITIONS[key] }))
    .sort((a, b) => b.probability - a.probability);

  const fallbackBear = normalizeCanonicalMetric(output.probability.crashProbability);
  const fallbackBull = normalizeCanonicalMetric(output.probability.bullProbability);
  const fallbackNeutral = normalizeCanonicalMetric(Math.max(0, 100 - fallbackBull - fallbackBear));
  const topFallbackAnalog = output.analogs[0];
  const probabilityDistribution = marketState?.outlook.probabilities ?? {
    bull: fallbackBull,
    neutral: fallbackNeutral,
    bear: fallbackBear,
    confidence: 50,
    primaryDriver: [...output.domains].sort((a, b) => b.score - a.score)[0]?.label ?? "Deterministic engine composite",
    evidenceBasis: output.narrative.summary,
    historicalBasis: topFallbackAnalog ? `${topFallbackAnalog.era} ${topFallbackAnalog.year} at ${formatCanonicalPercent(topFallbackAnalog.similarity)} similarity` : "No deterministic analog available",
  };
  const transition = marketState?.outlook.transitionProbabilities ?? null;
  const topAnalog = marketState?.outlook.topAnalog ?? (topFallbackAnalog ? {
    period: `${topFallbackAnalog.era} ${topFallbackAnalog.year}`,
    label: `${topFallbackAnalog.era} analog`,
    similarity: normalizeCanonicalMetric(topFallbackAnalog.similarity),
    resolution: "Canonical resolution detail is unavailable in deterministic fallback mode.",
  } : null);
  const highestProbabilityPath = marketState?.outlook.highestProbabilityPath ?? `${rankedScenarios[0]?.label ?? "Current regime"} is the highest deterministic scenario.`;
  const probabilityChanges = marketState?.watch.whatChanged ?? [];
  const invalidationConditions = marketState?.outlook.invalidationConditions ?? [];
  const triggerEvidence = transition?.currentEvidence ?? marketState?.watch.whatToWatch ?? output.narrative.keyRisks;
  const evidenceFamilies: EvidenceFamily[] = marketState?.why.evidenceFamilies ?? output.domains.map(domain => ({
    name: domain.label,
    signal: domain.score >= 7 ? "stressed" : domain.score >= 5 ? "bearish" : domain.score <= 3 ? "recovering" : "neutral",
    strength: normalizeCanonicalMetric(domain.score * 10),
    trend: domain.delta > 0.1 ? "deteriorating" : domain.delta < -0.1 ? "improving" : "stable",
    currentValue: formatCanonicalScore(domain.score * 10),
    historicalContext: domain.description,
    whyItMatters: domain.drivers.join(" · ") || domain.description,
  }));
  const developingConditions = marketState?.watch.developingConditions ?? [];
  const ashaPath = PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha";
  const topScenario = rankedScenarios[0];

  if (isLoading && !marketState) return <PageLoadingState eyebrow="OUTLOOK · Probability analysis" message="Loading canonical probability state…" />;

  return (
    <main className="min-h-screen bg-[#04060c] text-slate-200">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section data-outlook-section="forecast" className="relative overflow-hidden rounded-sm border border-violet-300/20 bg-[#080a14] p-6 md:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 82% 12%, rgba(167,139,250,0.16), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.018), transparent 55%)" }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.35), transparent)" }} />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-violet-300">OUTLOOK · Probability state</p>
                <DataFreshnessChip
                  freshness={marketState?.freshness ?? (marketMode === "canonical" ? "live" : "stale")}
                  tooltip={lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : undefined}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
                  {marketMode === "canonical" ? "Canonical state" : "Deterministic fallback"}
                </span>
                <Link href="/app/tools" className="flex items-center gap-1.5 rounded-sm border border-white/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-300">
                  <ArrowRight size={11} /> Tools & Features
                </Link>
                <button type="button" onClick={refresh} disabled={isRefreshing} className="flex items-center gap-2 rounded-sm border border-violet-300/20 bg-violet-300/[0.04] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-violet-200 transition duration-150 active:scale-[0.97] disabled:opacity-50">
                  <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {dataError && (
              <div className="mt-5">
                <PageDegradedBanner message="Canonical refresh is degraded. OUTLOOK is showing the last defensible state or deterministic fallback." detail={dataError} />
              </div>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Highest-probability path</p>
                <h1 className="mt-4 max-w-4xl font-['Rajdhani'] text-4xl font-semibold leading-[1.02] text-white md:text-5xl">{highestProbabilityPath}</h1>
                <p className="mt-5 max-w-4xl text-base leading-7 text-slate-300">{probabilityDistribution.evidenceBasis}</p>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">Primary driver: {probabilityDistribution.primaryDriver}. Historical basis: {probabilityDistribution.historicalBasis}.</p>
              </div>

              {/* Confidence panel */}
              <div className="rounded-sm border border-violet-300/20 bg-violet-300/[0.03] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Model confidence</p>
                <p className="mt-3 font-['Rajdhani'] text-5xl font-semibold text-violet-300">{formatCanonicalPercent(probabilityDistribution.confidence)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${probabilityDistribution.confidence}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300/75">
                  Pressure {formatCanonicalScore(marketState?.now.pressureScore ?? output.overall.score * 10)}
                </p>
                <p className="mt-4 text-xs leading-5 text-slate-500">Updated {lastUpdated?.toLocaleString() ?? "unavailable"}</p>
                {/* Top scenario badge */}
                {topScenario && (
                  <div className="mt-5 rounded-sm border p-3" style={{ borderColor: `${topScenario.tone}40`, background: `${topScenario.tone}08` }}>
                    <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-500">Base case</p>
                    <p className="mt-1 font-mono text-[10px] font-semibold" style={{ color: topScenario.tone }}>{topScenario.label}</p>
                    <p className="font-['Rajdhani'] text-2xl font-semibold" style={{ color: topScenario.tone }}>{formatCanonicalPercent(topScenario.probability)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* CTA row */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href={CANONICAL_DESTINATION_BY_ID.watch.path} className="flex items-center gap-2 rounded-sm bg-violet-400 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0a0614] transition hover:bg-violet-300 active:scale-[0.97]">
                Monitor triggers <ArrowRight size={14} />
              </Link>
              <Link href={OUTLOOK_DEEP_PATH} className="flex items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                Open signal outlook center
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTIONS ─────────────────────────────────────────────────── */}

        <Section id="ranked-scenarios" index="01" eyebrow="Scenario pathways" title="How the probability stack branches from the current state" description="Scenarios are ranked by probability, not dramatized by label. The branching structure shows which paths are live and which are tail risks.">
          <ScenarioPathways rankedScenarios={rankedScenarios} />
        </Section>

        <Section id="probability-bands" index="02" eyebrow="Probability bands" title="The probability stack—ordered, not dramatized" description="Current regime probabilities are ranked from most to least likely. These are model distributions, not promises or price targets.">
          <ProbabilityBandBar scenarios={rankedScenarios} />
          <div className="mt-4 space-y-3">
            {rankedScenarios.map((scenario, index) => (
              <article
                key={scenario.key}
                className="grid gap-4 rounded-sm border border-white/10 bg-white/[0.025] p-5 md:grid-cols-[4rem_1fr_8rem] md:items-center"
                style={{ borderLeftColor: `${scenario.tone}80`, borderLeftWidth: 2 }}
              >
                <span className="font-mono text-sm" style={{ color: scenario.tone }}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-['Rajdhani'] text-xl font-semibold text-white">{scenario.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{scenario.description}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-['Rajdhani'] text-3xl font-semibold" style={{ color: scenario.tone }}>{formatCanonicalPercent(scenario.probability)}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${scenario.probability}%`, background: scenario.tone, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="probability-changes" index="03" eyebrow="Probability change" title="What changed in the probability picture" description="FAULTLINE distinguishes observed changes from inferred probability deltas. The canonical contract supplies current probabilities but does not yet publish a prior probability vector.">
          <div className="rounded-sm border border-violet-300/15 bg-violet-300/[0.025] p-5">
            <div className="flex items-center gap-2 text-violet-200"><BarChart3 size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Comparison boundary</p></div>
            <p className="mt-2 text-sm leading-6 text-slate-400">No point-change labels are manufactured without a comparable prior snapshot. The evidence below identifies what changed in the market state; it does not mislabel those observations as measured probability moves.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {probabilityChanges.length ? probabilityChanges.map(item => <div key={item} className="rounded-sm border border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-slate-300">{item}</div>) : <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500 md:col-span-2">No canonical probability-change comparison is available for this snapshot.</div>}
          </div>
        </Section>

        <Section id="horizons" index="04" eyebrow="Forecast horizons" title="Separate the current state, transition path, and historical resolution" description="The canonical state does not attach arbitrary calendar targets. OUTLOOK therefore labels each available horizon by evidence type rather than inventing dates. Canonical transition timing is unavailable in deterministic fallback mode.">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Eye size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Current state</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-semibold text-white">{marketState?.now.regime ?? output.regime.label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Direction: {marketState?.now.direction ?? "Deterministic fallback"}. This is the state from which the forecast begins.</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><GitBranch size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Transition horizon</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-semibold text-white">{transition ? `${formatCanonicalPercent(transition.remainingProbability)} remaining` : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{transition?.historicalBasis ?? "No canonical transition-horizon record in fallback mode."}</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Clock3 size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Historical resolution</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-semibold text-white">{topAnalog?.period ?? "No analog"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{topAnalog?.resolution ?? "No defensible historical resolution is attached."}</p></div>
          </div>
        </Section>

        <Section id="triggers" index="05" eyebrow="Transition triggers" title="Evidence that would move the base case" description="These are current transition inputs and watch conditions from the canonical snapshot—not generic headlines.">
          <div className="grid gap-3 md:grid-cols-2">
            {triggerEvidence.length ? triggerEvidence.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-4 rounded-sm border border-white/10 bg-white/[0.02] p-5"><Target size={15} className="mt-1 shrink-0 text-violet-300" /><p className="text-sm leading-6 text-slate-300">{item}</p></div>
            )) : <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:col-span-2">No canonical transition triggers are available.</div>}
          </div>
        </Section>

        <Section id="invalidations" index="07" eyebrow="Invalidation" title="What would weaken the highest-probability path" description="Invalidation conditions keep OUTLOOK falsifiable. If the canonical snapshot cannot support one, the gap is stated rather than filled with boilerplate.">
          <div className="grid gap-3 md:grid-cols-2">
            {invalidationConditions.length ? invalidationConditions.map(item => <div key={item} className="flex gap-3 rounded-sm border border-rose-300/15 bg-rose-300/[0.025] p-5"><ShieldCheck size={15} className="mt-1 shrink-0 text-rose-300" /><p className="text-sm leading-6 text-slate-300">{item}</p></div>) : <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500 md:col-span-2">Canonical invalidation conditions are unavailable in deterministic fallback mode.</div>}
          </div>
        </Section>

        <Section id="indicators" index="08" eyebrow="Leading indicators" title="The evidence families to monitor before the path changes" description="Strength and trend come from the same causal evidence used by WHY; developing conditions add duration and expected impact when available.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {evidenceFamilies.map(family => (
              <article key={family.name} className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3"><p className="font-['Rajdhani'] text-lg font-semibold text-white">{family.name}</p>{family.trend === "deteriorating" ? <TrendingUp size={15} className="text-rose-300" /> : family.trend === "improving" ? <TrendingDown size={15} className="text-emerald-300" /> : <ArrowRight size={15} className="text-slate-500" />}</div>
                <p className="mt-3 font-['Rajdhani'] text-2xl font-semibold text-white">{formatCanonicalScore(family.strength)}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${family.strength}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300/70">{family.signal} · {family.trend}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{family.whyItMatters}</p>
              </article>
            ))}
          </div>
          {developingConditions.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{developingConditions.slice(0, 4).map(condition => <div key={condition.title} className="rounded-sm border-l border-violet-300/30 bg-violet-300/[0.02] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{condition.title}</p><span className="font-mono text-[8px] uppercase tracking-[0.12em] text-violet-300/70">{condition.durationDescription}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{condition.expectedImpact}</p></div>)}</div>}
        </Section>

        <Section id="analogs" index="08b" eyebrow="Historical analog overlays" title="How similar conditions resolved before" description="Analog similarity is context, not destiny. The period, similarity, and recorded resolution stay attached to the forecast.">
          {topAnalog ? (
            <AnalogOverlay analog={topAnalog} />
          ) : (
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500">No historical analog is available for this snapshot.</div>
          )}
          {output.analogs.length > 1 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {output.analogs.slice(1, 3).map(analog => (
                <div key={`${analog.era}-${analog.year}`} className="rounded-sm border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{analog.era} {analog.year}</p>
                    <p className="font-mono text-[9px] text-violet-300">{formatCanonicalPercent(analog.similarity)} match</p>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-violet-400/60" style={{ width: `${analog.similarity}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section id="confidence" index="09" eyebrow="Confidence and provenance" title="What this outlook rests on" description="Model confidence, transition confidence, source health, freshness, and warnings stay visible beside the forecast.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><CheckCircle2 size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Model confidence</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-semibold text-white">{formatCanonicalPercent(probabilityDistribution.confidence)}</p><p className="mt-2 text-xs leading-5 text-slate-500">Confidence attached to the bull/neutral/bear distribution.</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><GitBranch size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Transition confidence</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-semibold text-white">{transition ? formatCanonicalPercent(transition.confidence) : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{transition?.historicalBasis ?? "No canonical transition-confidence record in fallback mode."}</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Database size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Historical record</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-semibold text-white">{marketState?.history.observationCount ?? "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{marketState?.history.datasetSpan ?? "Canonical history metadata is unavailable."}</p></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{sourceHealth.length ? sourceHealth.map(source => <SourceStatus key={source.id} source={source} />) : <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:col-span-2">Provider-level source health is unavailable in deterministic fallback mode.</div>}</div>
          {marketState?.warnings.length ? <div className="mt-4 rounded-sm border border-amber-300/15 bg-amber-300/[0.03] p-4 text-xs leading-5 text-amber-100">{marketState.warnings.join(" · ")}</div> : null}
        </Section>

        <Section id="asha" index="10" eyebrow="ASHA continuity" title="Interrogate the forecast without losing context" description="Open ASHA with the OUTLOOK handoff so the current path, alternatives, triggers, invalidations, and evidence boundaries remain attached.">
          <div className="flex flex-col justify-between gap-5 rounded-sm border border-cyan-300/15 bg-cyan-300/[0.025] p-5 md:flex-row md:items-center">
            <div><div className="flex items-center gap-2 text-cyan-300"><Sparkles size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Ask next</p></div><p className="mt-3 text-sm leading-6 text-slate-300">Ask which evidence would move the base case, which alternative is underpriced, or how the current analog resolved.</p></div>
            <Link href={`${ashaPath}?from=outlook`} className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.13em] text-cyan-100 transition hover:bg-cyan-300/15 active:scale-[0.97]">Open ASHA <ArrowRight size={13} /></Link>
          </div>
        </Section>

        <Section id="expert-handoffs" index="11" eyebrow="Expert depth" title="Open specialist tools without crowding the forecast" description="OUTLOOK stays scenario-first; the existing asset-level signal center and decision workspace remain intact as deeper tools.">
          <div className="grid gap-3 md:grid-cols-3">
            <Link href={OUTLOOK_DEEP_PATH} className="rounded-sm border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><Telescope size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Preserved deep view</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-semibold text-white">Signal Outlook Center</p><p className="mt-2 text-xs leading-5 text-slate-500">Open the existing asset search, outlook score, readiness, risk, and opportunity workflow.</p></Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["signal-outlook"].path} className="rounded-sm border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><BarChart3 size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Expert workspace</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-semibold text-white">{EXPERT_WORKSPACE_BY_ID["signal-outlook"].label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Use the registry-owned specialist route for symbol-level probability analysis.</p></Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} className="rounded-sm border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><Target size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Decision handoff</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-semibold text-white">{EXPERT_WORKSPACE_BY_ID["decision-engine"].label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Carry a chosen scenario into the preserved decision workflow.</p></Link>
          </div>
        </Section>

        <div className="border-t border-white/10 pt-8 text-center">
          <Link href={CANONICAL_DESTINATION_BY_ID.watch.path} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-orange-300 transition hover:text-orange-200">Continue to WATCH: what should I keep watching? <ArrowRight size={13} /></Link>
        </div>
      </div>
    </main>
  );
}
