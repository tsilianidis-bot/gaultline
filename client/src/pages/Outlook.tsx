import {
  AlertTriangle,
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

type EvidenceFamily = CanonicalMarketState["why"]["evidenceFamilies"][number];
type ScenarioKey = keyof CanonicalMarketState["outlook"]["regimeProbabilities"];

const OUTLOOK_DEEP_PATH = "/app/outlook/deep";

const SCENARIO_DEFINITIONS: Record<ScenarioKey, { label: string; description: string; tone: string }> = {
  bull: { label: "Bull", description: "Constructive risk conditions persist or strengthen.", tone: "#34d399" },
  softLanding: { label: "Soft landing", description: "Growth slows without a severe credit or labor break.", tone: "#60a5fa" },
  stagflation: { label: "Stagflation", description: "Inflation pressure remains elevated while growth weakens.", tone: "#fbbf24" },
  recession: { label: "Recession", description: "A broad contraction becomes the dominant macro path.", tone: "#fb923c" },
  crash: { label: "Crash", description: "A rapid systemic dislocation overtakes the base case.", tone: "#fb7185" },
};

function Section({
  id,
  index,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section data-outlook-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`outlook-${id}-title`}>
      <div className="mb-7 grid gap-4 md:grid-cols-[5rem_1fr]">
        <span className="font-mono text-[10px] tracking-[0.24em] text-violet-300/70">{index}</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300/75">{eyebrow}</p>
          <h2 id={`outlook-${id}-title`} className="mt-2 max-w-4xl font-['Rajdhani'] text-2xl font-bold uppercase tracking-[0.04em] text-white md:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-20">{children}</div>
    </section>
  );
}

function SourceStatus({ source }: { source: CanonicalMarketState["sourceHealth"][number] }) {
  const tone = source.status === "healthy" ? "#34d399" : source.status === "degraded" ? "#fbbf24" : "#fb7185";
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">{source.label}</p>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: tone }}>{source.status}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p>
      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">As of {new Date(source.asOf).toLocaleString()}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-16 md:px-10">
      <div className="border border-violet-300/15 bg-[#080a14] p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-violet-300">OUTLOOK · Loading canonical probability state</p>
        <div className="mt-8 h-12 max-w-3xl animate-pulse bg-white/10" />
        <div className="mt-5 h-4 animate-pulse bg-white/5" />
        <div className="mt-3 h-4 w-4/5 animate-pulse bg-white/5" />
      </div>
    </div>
  );
}

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

  if (isLoading && !marketState) return <LoadingState />;

  return (
    <main className="min-h-screen bg-[#04060c] text-slate-200">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">
        <section data-outlook-section="forecast" className="relative overflow-hidden border border-violet-300/20 bg-[#080a14] p-6 md:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 82% 12%, rgba(167,139,250,0.16), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.018), transparent 55%)" }} />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-violet-300">OUTLOOK · Probability state</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-white/10 bg-black/30 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
                  {marketMode === "canonical" ? "Canonical state" : "Deterministic fallback"}
                </span>
                <button type="button" onClick={refresh} disabled={isRefreshing} className="flex items-center gap-2 border border-violet-300/20 bg-violet-300/[0.04] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-violet-200 transition duration-150 active:scale-[0.97] disabled:opacity-50">
                  <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {dataError && (
              <div className="mt-5 flex gap-3 border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-100">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>Canonical refresh is degraded. OUTLOOK is showing the last defensible state or deterministic fallback. {dataError}</p>
              </div>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_19rem] lg:items-end">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-violet-300/70">Highest-probability path</p>
                <h1 className="mt-3 max-w-4xl font-['Rajdhani'] text-3xl font-bold uppercase leading-[1.05] tracking-[0.025em] text-white md:text-5xl">{highestProbabilityPath}</h1>
                <p className="mt-5 max-w-4xl text-base leading-7 text-slate-300 md:text-lg">{probabilityDistribution.evidenceBasis}</p>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">Primary driver: {probabilityDistribution.primaryDriver}. Historical basis: {probabilityDistribution.historicalBasis}.</p>
              </div>
              <div className="border-l border-violet-300/25 pl-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Model confidence</p>
                <p className="mt-2 font-['Rajdhani'] text-4xl font-bold text-white">{formatCanonicalPercent(probabilityDistribution.confidence)}</p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300/75">Pressure {formatCanonicalScore(marketState?.now.pressureScore ?? output.overall.score * 10)}</p>
                <p className="mt-4 text-xs leading-5 text-slate-500">Updated {lastUpdated?.toLocaleString() ?? "unavailable"}</p>
              </div>
            </div>
          </div>
        </section>

        <Section id="ranked-scenarios" index="01" eyebrow="Ranked scenarios" title="The probability stack—ordered, not dramatized" description="Current regime probabilities are ranked from most to least likely. These are model distributions, not promises or price targets.">
          <div className="space-y-3">
            {rankedScenarios.map((scenario, index) => (
              <article key={scenario.key} className="grid gap-4 border border-white/10 bg-white/[0.025] p-5 md:grid-cols-[4rem_1fr_8rem] md:items-center" style={{ borderLeftColor: `${scenario.tone}80`, borderLeftWidth: 2 }}>
                <span className="font-mono text-sm" style={{ color: scenario.tone }}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-['Rajdhani'] text-xl font-bold uppercase tracking-[0.04em] text-white">{scenario.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{scenario.description}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-['Rajdhani'] text-3xl font-bold" style={{ color: scenario.tone }}>{formatCanonicalPercent(scenario.probability)}</p>
                  <div className="mt-2 h-1 overflow-hidden bg-white/5"><div className="h-full" style={{ width: `${scenario.probability}%`, background: scenario.tone }} /></div>
                </div>
              </article>
            ))}
          </div>
        </Section>

        <Section id="probability-changes" index="02" eyebrow="Probability change" title="What changed in the probability picture" description="FAULTLINE distinguishes observed changes from inferred probability deltas. The canonical contract supplies current probabilities but does not yet publish a prior probability vector.">
          <div className="border border-violet-300/15 bg-violet-300/[0.025] p-5">
            <div className="flex items-center gap-2 text-violet-200"><BarChart3 size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Comparison boundary</p></div>
            <p className="mt-2 text-sm leading-6 text-slate-400">No point-change labels are manufactured without a comparable prior snapshot. The evidence below identifies what changed in the market state; it does not mislabel those observations as measured probability moves.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {probabilityChanges.length ? probabilityChanges.map(item => <div key={item} className="border border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-slate-300">{item}</div>) : <div className="border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500 md:col-span-2">No canonical probability-change comparison is available for this snapshot.</div>}
          </div>
        </Section>

        <Section id="horizons" index="03" eyebrow="Forecast horizons" title="Separate the current state, transition path, and historical resolution" description="The canonical state does not attach arbitrary calendar targets. OUTLOOK therefore labels each available horizon by evidence type rather than inventing dates.">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Eye size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Current state</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-bold uppercase text-white">{marketState?.now.regime ?? output.regime.label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Direction: {marketState?.now.direction ?? "Deterministic fallback"}. This is the state from which the forecast begins.</p></div>
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><GitBranch size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Transition horizon</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-bold uppercase text-white">{transition ? `${formatCanonicalPercent(transition.remainInRegime)} remain` : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{transition?.historicalBasis ?? "Canonical transition timing is unavailable in deterministic fallback mode."}</p></div>
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Clock3 size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Historical resolution</p></div><p className="mt-4 font-['Rajdhani'] text-xl font-bold uppercase text-white">{topAnalog?.period ?? "No analog"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{topAnalog?.resolution ?? "No defensible historical resolution is attached."}</p></div>
          </div>
        </Section>

        <Section id="triggers" index="04" eyebrow="Transition triggers" title="Evidence that would move the base case" description="These are current transition inputs and watch conditions from the canonical snapshot—not generic headlines.">
          <div className="grid gap-3 md:grid-cols-2">
            {triggerEvidence.length ? triggerEvidence.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-4 border border-white/10 bg-white/[0.02] p-5"><Target size={15} className="mt-1 shrink-0 text-violet-300" /><p className="text-sm leading-6 text-slate-300">{item}</p></div>
            )) : <div className="border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:col-span-2">No canonical transition triggers are available.</div>}
          </div>
        </Section>

        <Section id="invalidations" index="05" eyebrow="Invalidation" title="What would weaken the highest-probability path" description="Invalidation conditions keep OUTLOOK falsifiable. If the canonical snapshot cannot support one, the gap is stated rather than filled with boilerplate.">
          <div className="grid gap-3 md:grid-cols-2">
            {invalidationConditions.length ? invalidationConditions.map(item => <div key={item} className="flex gap-3 border border-rose-300/15 bg-rose-300/[0.025] p-5"><ShieldCheck size={15} className="mt-1 shrink-0 text-rose-300" /><p className="text-sm leading-6 text-slate-300">{item}</p></div>) : <div className="border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500 md:col-span-2">Canonical invalidation conditions are unavailable in deterministic fallback mode.</div>}
          </div>
        </Section>

        <Section id="indicators" index="06" eyebrow="Leading indicators" title="The evidence families to monitor before the path changes" description="Strength and trend come from the same causal evidence used by WHY; developing conditions add duration and expected impact when available.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {evidenceFamilies.map(family => (
              <article key={family.name} className="border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3"><p className="font-['Rajdhani'] text-lg font-bold uppercase text-white">{family.name}</p>{family.trend === "deteriorating" ? <TrendingUp size={15} className="text-rose-300" /> : family.trend === "improving" ? <TrendingDown size={15} className="text-emerald-300" /> : <ArrowRight size={15} className="text-slate-500" />}</div>
                <p className="mt-3 font-['Rajdhani'] text-2xl font-bold text-white">{formatCanonicalScore(family.strength)}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-violet-300/70">{family.signal} · {family.trend}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{family.whyItMatters}</p>
              </article>
            ))}
          </div>
          {developingConditions.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-2">{developingConditions.slice(0, 4).map(condition => <div key={condition.title} className="border-l border-violet-300/30 bg-violet-300/[0.02] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{condition.title}</p><span className="font-mono text-[8px] uppercase tracking-[0.12em] text-violet-300/70">{condition.durationDescription}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{condition.expectedImpact}</p></div>)}</div>}
        </Section>

        <Section id="analogs" index="07" eyebrow="Historical analog" title="How similar conditions resolved before" description="Analog similarity is context, not destiny. The period, similarity, and recorded resolution stay attached to the forecast.">
          {topAnalog ? <div className="grid gap-4 border border-white/10 bg-white/[0.02] p-5 md:grid-cols-[1fr_10rem] md:items-center"><div><div className="flex items-center gap-2 text-violet-300"><History size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">{topAnalog.period}</p></div><p className="mt-3 font-['Rajdhani'] text-2xl font-bold uppercase text-white">{topAnalog.label}</p><p className="mt-3 text-sm leading-6 text-slate-400">{topAnalog.resolution}</p></div><div className="border-l border-violet-300/25 pl-5"><p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Similarity</p><p className="mt-2 font-['Rajdhani'] text-4xl font-bold text-white">{formatCanonicalPercent(topAnalog.similarity)}</p></div></div> : <div className="border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500">No historical analog is available for this snapshot.</div>}
        </Section>

        <Section id="confidence" index="08" eyebrow="Confidence and provenance" title="What this outlook rests on" description="Model confidence, transition confidence, source health, freshness, and warnings stay visible beside the forecast.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><CheckCircle2 size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Model confidence</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-bold text-white">{formatCanonicalPercent(probabilityDistribution.confidence)}</p><p className="mt-2 text-xs leading-5 text-slate-500">Confidence attached to the bull/neutral/bear distribution.</p></div>
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><GitBranch size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Transition confidence</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-bold text-white">{transition ? formatCanonicalPercent(transition.confidence) : "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{transition?.historicalBasis ?? "No canonical transition-confidence record in fallback mode."}</p></div>
            <div className="border border-white/10 bg-white/[0.02] p-5"><div className="flex items-center gap-2 text-violet-300"><Database size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Historical record</p></div><p className="mt-4 font-['Rajdhani'] text-3xl font-bold text-white">{marketState?.history.observationCount ?? "Unavailable"}</p><p className="mt-2 text-xs leading-5 text-slate-500">{marketState?.history.datasetSpan ?? "Canonical history metadata is unavailable."}</p></div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{sourceHealth.length ? sourceHealth.map(source => <SourceStatus key={source.id} source={source} />) : <div className="border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-500 md:col-span-2">Provider-level source health is unavailable in deterministic fallback mode.</div>}</div>
          {marketState?.warnings.length ? <div className="mt-4 border border-amber-300/15 bg-amber-300/[0.03] p-4 text-xs leading-5 text-amber-100">{marketState.warnings.join(" · ")}</div> : null}
        </Section>

        <Section id="asha" index="09" eyebrow="ASHA continuity" title="Interrogate the forecast without losing context" description="Open ASHA with the OUTLOOK handoff so the current path, alternatives, triggers, invalidations, and evidence boundaries remain attached.">
          <div className="flex flex-col justify-between gap-5 border border-cyan-300/15 bg-cyan-300/[0.025] p-5 md:flex-row md:items-center">
            <div><div className="flex items-center gap-2 text-cyan-300"><Sparkles size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Ask next</p></div><p className="mt-3 text-sm leading-6 text-slate-300">Ask which evidence would move the base case, which alternative is underpriced, or how the current analog resolved.</p></div>
            <Link href={`${ashaPath}?from=outlook`} className="inline-flex shrink-0 items-center gap-2 border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.13em] text-cyan-100 transition hover:bg-cyan-300/15 active:scale-[0.97]">Open ASHA <ArrowRight size={13} /></Link>
          </div>
        </Section>

        <Section id="expert-handoffs" index="10" eyebrow="Expert depth" title="Open specialist tools without crowding the forecast" description="OUTLOOK stays scenario-first; the existing asset-level signal center and decision workspace remain intact as deeper tools.">
          <div className="grid gap-3 md:grid-cols-3">
            <Link href={OUTLOOK_DEEP_PATH} className="border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><Telescope size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Preserved deep view</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-bold uppercase text-white">Signal Outlook Center</p><p className="mt-2 text-xs leading-5 text-slate-500">Open the existing asset search, outlook score, readiness, risk, and opportunity workflow.</p></Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["signal-outlook"].path} className="border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><BarChart3 size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Expert workspace</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-bold uppercase text-white">{EXPERT_WORKSPACE_BY_ID["signal-outlook"].label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Use the registry-owned specialist route for symbol-level probability analysis.</p></Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} className="border border-white/10 bg-white/[0.02] p-5 transition hover:border-violet-300/30 hover:bg-violet-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-violet-300"><Target size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Decision handoff</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-bold uppercase text-white">{EXPERT_WORKSPACE_BY_ID["decision-engine"].label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Carry a chosen scenario into the preserved decision workflow.</p></Link>
          </div>
        </Section>

        <div className="border-t border-white/10 pt-8 text-center">
          <Link href={CANONICAL_DESTINATION_BY_ID.watch.path} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-orange-300 transition hover:text-orange-200">Continue to WATCH: what should I keep watching? <ArrowRight size={13} /></Link>
        </div>
      </div>
    </main>
  );
}
