import { useMemo } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  History,
  RefreshCw,
  ShieldCheck,
  Telescope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import { formatCanonicalPercent, formatCanonicalScore } from "@shared/marketMetrics";

const NOW_DEEP_PATH = "/app/now/deep";

function pressureColor(score: number) {
  if (score >= 75) return "#ff4d6d";
  if (score >= 50) return "#ffaa00";
  if (score >= 30) return "#00e5ff";
  return "#00e599";
}

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
    <section
      data-now-section={id}
      className="border-t border-white/10 py-10 md:py-14"
      aria-labelledby={`now-${id}-title`}
    >
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">
          {index} · {eyebrow}
        </p>
        <div>
          <h2 id={`now-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

function MetricBar({ label, value, trend }: { label: string; value: number; trend: string }) {
  const color = pressureColor(value);
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">{label}</p>
          <p className="mt-1 text-xs capitalize text-slate-500">{trend}</p>
        </div>
        <span className="font-mono text-sm font-semibold" style={{ color }}>
          {formatCanonicalScore(value)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function ProbabilityCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-[#090d14] p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 font-['Rajdhani'] text-3xl font-semibold" style={{ color: accent }}>
        {formatCanonicalPercent(value)}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: accent }} />
      </div>
    </div>
  );
}

function DestinationLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 flex-col justify-between rounded-sm border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-300">{label}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="text-sm leading-5 text-slate-400">{detail}</p>
        <ArrowRight className="shrink-0 text-cyan-300 transition-transform group-hover:translate-x-1" size={16} />
      </div>
    </Link>
  );
}

export default function Now() {
  const {
    output,
    marketState,
    marketMode,
    sourceHealth,
    isLoading,
    isLive,
    lastUpdated,
    dataError,
    refresh,
  } = useEngine();

  const fallbackDomains = useMemo(
    () => output.domains.slice(0, 5).map(domain => ({
      name: domain.label,
      signal: domain.riskLevel,
      strength: domain.score * 10,
      trend: domain.delta > 0.1 ? "deteriorating" : domain.delta < -0.1 ? "improving" : "stable",
      currentValue: formatCanonicalScore(domain.score * 10),
      historicalContext: "Canonical history is temporarily unavailable.",
      whyItMatters: domain.description,
    })),
    [output.domains],
  );

  const evidenceFamilies = marketState?.why.evidenceFamilies ?? fallbackDomains;
  const pressure = marketState?.now.pressureScore ?? output.overall.score * 10;
  const regime = marketState?.now.regime ?? output.regime.label;
  const stressLevel = marketState?.now.stressLevel ?? output.overall.riskLevel;
  const direction = marketState?.now.direction
    ?? (output.overall.delta > 0.1 ? "Deteriorating" : output.overall.delta < -0.1 ? "Improving" : "Stable");
  const headline = marketState?.now.headline ?? output.narrative.summary;
  const historicalPercentile = marketState?.now.historicalPercentile ?? null;
  const topDrivers = marketState?.now.topDrivers
    ?? [...output.domains].sort((a, b) => b.score - a.score).slice(0, 3).map(domain => domain.label);
  const building = evidenceFamilies.filter(item => item.trend === "deteriorating").length;
  const easing = evidenceFamilies.filter(item => item.trend === "improving").length;
  const probabilities = marketState?.outlook.regimeProbabilities ?? {
    bull: output.probability.bullProbability,
    softLanding: output.probability.softLandingProbability,
    stagflation: output.probability.stagflationProbability,
    recession: output.probability.recessionProbability,
    crash: output.probability.crashProbability,
  };
  const topAnalog = marketState?.outlook.topAnalog ?? (output.analogs[0]
    ? {
        period: output.analogs[0].year,
        label: output.analogs[0].era,
        similarity: output.analogs[0].similarity,
        resolution: "Deterministic fallback analog; canonical resolution unavailable.",
      }
    : null);
  const watchItems = marketState?.watch.whatToWatch ?? output.narrative.keyRisks;
  const changedItems = marketState?.watch.whatChanged
    ?? output.domains.filter(domain => Math.abs(domain.delta) > 0.1).map(domain => `${domain.label}: ${domain.delta > 0 ? "pressure increased" : "pressure eased"}.`);
  const modeLabel = marketState ? (isLive ? "Canonical live state" : "Canonical protected state") : "Protected fallback state";
  const accent = pressureColor(pressure);

  if (isLoading && !marketState) {
    return (
      <main className="min-h-[70vh] bg-[#05080d] px-5 py-16 text-white md:px-10">
        <div className="mx-auto max-w-6xl animate-pulse rounded-sm border border-cyan-300/15 bg-cyan-300/[0.025] p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">NOW · Loading canonical market state</p>
          <div className="mt-8 h-12 w-2/3 rounded bg-white/10" />
          <div className="mt-5 h-4 w-full rounded bg-white/5" />
          <div className="mt-3 h-4 w-5/6 rounded bg-white/5" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-white">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">
        <section data-now-section="verdict" className="relative overflow-hidden rounded-sm border border-white/10 bg-[#080c13] p-6 md:p-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: `radial-gradient(circle at 85% 15%, ${accent}22, transparent 42%)` }}
          />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">
                  NOW · Current market state
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{modeLabel}</span>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-300 active:scale-[0.97]"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {dataError && (
              <div className="mt-5 border-l-2 border-amber-400 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80">
                Live refresh is degraded. FAULTLINE is preserving the latest verified state: {dataError}
              </div>
            )}

            <div className="mt-9 grid items-end gap-8 lg:grid-cols-[1fr_260px]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">FAULTLINE verdict</p>
                <h1 className="mt-4 max-w-4xl font-['Rajdhani'] text-4xl font-semibold leading-[1.02] text-white md:text-6xl">
                  {headline}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
                  {marketState?.why.narrative.whatIsHappening ?? output.narrative.regimeAssessment}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300">{regime}</span>
                  <span className="rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300">{direction}</span>
                  <span className="rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-300">{stressLevel} pressure</span>
                </div>
              </div>
              <div className="border-l border-white/10 pl-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">FAULTLINE pressure</p>
                <p className="mt-3 font-['Rajdhani'] text-6xl font-semibold leading-none" style={{ color: accent }}>
                  {formatCanonicalScore(pressure)}
                </p>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  {historicalPercentile === null
                    ? "Historical percentile unavailable while canonical history is offline."
                    : `${formatCanonicalPercent(historicalPercentile)} historical percentile.`}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href={CANONICAL_DESTINATION_BY_ID.why.path} className="flex items-center gap-2 rounded-sm bg-cyan-300 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#031014] transition hover:bg-cyan-200 active:scale-[0.97]">
                Understand why <ArrowRight size={14} />
              </Link>
              <Link href={NOW_DEEP_PATH} className="flex items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                Open deep dashboard
              </Link>
            </div>
          </div>
        </section>

        <Section id="summary" index="01" eyebrow="Summary" title="The market in plain English" description="A direct synthesis before charts, modules, or specialist tools.">
          <p className="max-w-4xl text-lg leading-8 text-slate-200">
            {marketState?.why.story ?? output.narrative.summary}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[`Regime: ${regime}`, `Top risk: ${topDrivers[0] ?? "No dominant risk"}`, `Breadth: ${building} rising domains`].map(item => (
              <div key={item} className="border-l-2 border-cyan-300/50 bg-white/[0.025] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-300">{item}</div>
            ))}
          </div>
        </Section>

        <Section id="changed" index="02" eyebrow="Change" title="What changed—and how long it has been developing" description="Direction matters more than a single reading. FAULTLINE separates rising pressure from easing conditions without inventing a false start date.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-rose-400/15 bg-rose-400/[0.04] p-5">
              <TrendingUp size={17} className="text-rose-300" />
              <p className="mt-4 font-['Rajdhani'] text-3xl text-white">{building}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-rose-200/70">Building domains</p>
            </div>
            <div className="rounded-sm border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
              <TrendingDown size={17} className="text-emerald-300" />
              <p className="mt-4 font-['Rajdhani'] text-3xl text-white">{easing}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-200/70">Easing domains</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <Clock3 size={17} className="text-cyan-300" />
              <p className="mt-4 text-sm font-semibold text-white">{marketState?.history.currentStreakDescription ?? "Duration unavailable in fallback state"}</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Development window</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {(changedItems.length ? changedItems : ["No verified directional change is available in the current comparison window."]).slice(0, 4).map(item => (
              <p key={item} className="border-l border-white/15 pl-4 text-sm leading-6 text-slate-400">{item}</p>
            ))}
          </div>
        </Section>

        <Section id="breadth" index="03" eyebrow="Breadth" title="Where pressure is concentrated" description="Every domain is normalized to the same 0–100 scale so concentration and breadth can be compared directly.">
          <div className="grid gap-3 md:grid-cols-2">
            {evidenceFamilies.map(family => (
              <MetricBar key={family.name} label={family.name} value={family.strength} trend={family.trend} />
            ))}
          </div>
        </Section>

        <Section id="probabilities" index="04" eyebrow="Probabilities" title="What the current state implies" description="Scenario probabilities are distributions, not certainty. They update from the same canonical market state used across FAULTLINE.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <ProbabilityCard label="Bull continuation" value={probabilities.bull} accent="#00e599" />
            <ProbabilityCard label="Soft landing" value={probabilities.softLanding} accent="#00e5ff" />
            <ProbabilityCard label="Stagflation" value={probabilities.stagflation} accent="#ffaa00" />
            <ProbabilityCard label="Recession" value={probabilities.recession} accent="#ff7a45" />
            <ProbabilityCard label="Crash / bear" value={probabilities.crash} accent="#ff4d6d" />
          </div>
          {marketState?.outlook.highestProbabilityPath && (
            <p className="mt-5 border-l-2 border-violet-300/50 bg-violet-300/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
              Highest-probability path: {marketState.outlook.highestProbabilityPath}
            </p>
          )}
        </Section>

        <Section id="why" index="05" eyebrow="Why" title="The primary drivers beneath the reading" description="NOW provides the causal headline; WHY carries the full transmission map, positioning evidence, and historical explanation.">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-300">Why this score</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{marketState?.why.whyThisScore ?? output.narrative.regimeAssessment}</p>
              <p className="mt-4 text-sm leading-7 text-slate-400">{marketState?.why.narrative.whatIsBuildingBeneathSurface ?? output.narrative.keyRisks.join(" ")}</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Dominant drivers</p>
              <ol className="mt-4 space-y-3">
                {topDrivers.slice(0, 4).map((driver, index) => (
                  <li key={driver} className="flex gap-3 text-sm text-slate-300"><span className="font-mono text-cyan-300">0{index + 1}</span>{driver}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-5"><DestinationLink href={CANONICAL_DESTINATION_BY_ID.why.path} label="Open WHY" detail="Trace drivers, transmission, positioning, and history." /></div>
        </Section>

        <Section id="history" index="06" eyebrow="History" title="How current conditions compare with the past" description="Historical context is shown with sample size, dataset span, analog similarity, and resolution—not as a prediction.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5"><Database size={16} className="text-cyan-300" /><p className="mt-4 font-['Rajdhani'] text-2xl text-white">{marketState?.history.observationCount.toLocaleString() ?? "—"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Observations</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5"><History size={16} className="text-violet-300" /><p className="mt-4 text-sm font-semibold text-white">{marketState?.history.datasetSpan ?? "Canonical history unavailable"}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Dataset span</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.025] p-5"><Telescope size={16} className="text-amber-300" /><p className="mt-4 text-sm font-semibold text-white">{topAnalog ? `${topAnalog.label} · ${formatCanonicalPercent(topAnalog.similarity)}` : "No verified analog"}</p><p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Closest analog</p></div>
          </div>
          {topAnalog && <p className="mt-5 text-sm leading-7 text-slate-400">{topAnalog.period}: {topAnalog.resolution}</p>}
        </Section>

        <Section id="watch-next" index="07" eyebrow="Watch next" title="What could confirm—or invalidate—the current state" description="A focused monitoring list keeps NOW actionable without turning it into the WATCH workspace.">
          <div className="grid gap-3 md:grid-cols-2">
            {watchItems.slice(0, 6).map(item => (
              <div key={item} className="flex gap-3 rounded-sm border border-white/10 bg-white/[0.025] p-4">
                <Activity size={15} className="mt-0.5 shrink-0 text-orange-300" />
                <p className="text-sm leading-6 text-slate-300">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5"><DestinationLink href={CANONICAL_DESTINATION_BY_ID.watch.path} label="Open WATCH" detail="Set thresholds, monitor signals, and follow developing conditions." /></div>
        </Section>

        <Section id="asha" index="08" eyebrow="ASHA" title="Continue the interpretation with ASHA" description="Carry today’s canonical market state into a focused conversation without changing the evidence source.">
          <div className="rounded-sm border border-cyan-300/20 bg-cyan-300/[0.035] p-6 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 shrink-0 text-cyan-300" size={22} />
              <div><p className="font-['Rajdhani'] text-xl font-semibold text-white">Ask what is happening, why it matters, or what would change the conclusion.</p><p className="mt-2 text-sm leading-6 text-slate-400">ASHA receives the same regime, pressure, evidence, probability, history, and source-health context shown here.</p></div>
            </div>
            <Link href={PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha"} className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-sm bg-cyan-300 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#031014] transition hover:bg-cyan-200 active:scale-[0.97] md:mt-0">Open ASHA <ArrowRight size={14} /></Link>
          </div>
        </Section>

        <Section id="expert-tools" index="09" eyebrow="Expert tools" title="Go deeper without crowding the primary answer" description="Specialist workspaces remain available for expert analysis while NOW stays conclusion-first.">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID.pressure.path} label="Pressure Engine" detail="Inspect pressure domains and scoring detail." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["signal-outlook"].path} label="Signal Outlook" detail="Open scenario and transition analysis." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} label="Decision Engine" detail="Stress-test a response against the regime." />
            <DestinationLink href={EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path} label="Symbol Intelligence" detail="Analyze a specific asset in context." />
          </div>
        </Section>

        <Section id="confidence" index="10" eyebrow="Confidence" title="What this conclusion rests on" description="Freshness, source health, fallback status, and warnings remain visible so users can distinguish evidence from certainty.">
          <div className="grid gap-3 md:grid-cols-2">
            {(sourceHealth.length ? sourceHealth : [{ id: "fallback", label: "Deterministic fallback", status: "degraded", required: true, asOf: lastUpdated?.toISOString() ?? "Unavailable", detail: "Canonical source health is not currently available." }]).map(source => (
              <div key={source.id} className="flex gap-3 rounded-sm border border-white/10 bg-white/[0.025] p-4">
                {source.status === "healthy" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={16} /> : <ShieldCheck className="mt-0.5 shrink-0 text-amber-300" size={16} />}
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">{source.label}</p><span className="font-mono text-[8px] uppercase tracking-[0.13em] text-slate-500">{source.status}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{source.detail}</p><p className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">As of {source.asOf}</p></div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Mode: {marketMode} · Updated {lastUpdated ? lastUpdated.toLocaleString() : "unavailable"}</p>
            <Link href={NOW_DEEP_PATH} className="font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-300 hover:text-cyan-200">Inspect every legacy dashboard module →</Link>
          </div>
        </Section>
      </div>
    </main>
  );
}
