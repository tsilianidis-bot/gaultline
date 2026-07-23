import { useEffect } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BrainCircuit,
  Clock3,
  Eye,
  Gauge,
  History,
  Radar,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
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

const WATCH_DEEP_PATH = "/app/watch/deep";

type DevelopingCondition = {
  title: string;
  description: string;
  severity: "Low" | "Moderate" | "High" | "Critical";
  trend: "building" | "stable" | "easing";
  durationDescription: string;
  evidence: string;
  expectedImpact: string;
};

type ActivePattern = {
  name: string;
  description: string;
  confidence: number;
  daysActive: number;
  invalidationConditions: string;
};

const severityClasses: Record<DevelopingCondition["severity"], string> = {
  Low: "border-emerald-400/25 bg-emerald-400/5 text-emerald-300",
  Moderate: "border-amber-400/25 bg-amber-400/5 text-amber-300",
  High: "border-orange-400/25 bg-orange-400/5 text-orange-300",
  Critical: "border-rose-400/30 bg-rose-400/5 text-rose-300",
};

const trendCopy: Record<DevelopingCondition["trend"], { label: string; className: string }> = {
  building: { label: "BUILDING", className: "text-orange-300" },
  stable: { label: "STABLE", className: "text-slate-400" },
  easing: { label: "EASING", className: "text-emerald-300" },
};

function fallbackSeverity(riskLevel: string): DevelopingCondition["severity"] {
  if (riskLevel === "critical") return "Critical";
  if (riskLevel === "high") return "High";
  if (riskLevel === "elevated") return "Moderate";
  return "Low";
}

function fallbackTrend(delta: number): DevelopingCondition["trend"] {
  if (delta > 0.15) return "building";
  if (delta < -0.15) return "easing";
  return "stable";
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
    <section id={id} className="border-t border-white/[0.07] py-9 sm:py-12">
      <div className="grid gap-7 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-orange-300/80">{index}</div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">{eyebrow}</div>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[-0.02em] text-slate-100 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

function WatchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="border border-white/10 bg-[#090b0f] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-orange-300/80">
          WATCH · Loading canonical monitoring state
        </div>
        <div className="mt-8 h-12 max-w-3xl animate-pulse bg-white/10" />
        <div className="mt-5 h-4 max-w-5xl animate-pulse bg-white/[0.06]" />
      </div>
    </div>
  );
}

export default function Watch() {
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
    document.title = "WATCH — FAULTLINE";
  }, []);

  if (isLoading && !marketState) return <WatchLoading />;

  const isCanonical = marketMode === "canonical" && Boolean(marketState);
  const pressure = marketState?.now.pressureScore ?? output.overall.score * 10;
  const whatChanged = marketState?.watch.whatChanged ?? [
    "Canonical change records are unavailable. Deterministic risk domains are shown below without claiming measured changes.",
  ];
  const developingConditions: DevelopingCondition[] = marketState?.watch.developingConditions
    ?? output.domains.slice(0, 5).map(domain => ({
      title: domain.label,
      description: domain.description,
      severity: fallbackSeverity(domain.riskLevel),
      trend: fallbackTrend(domain.delta),
      durationDescription: "Canonical duration records are unavailable in deterministic fallback mode.",
      evidence: domain.drivers.length > 0
        ? domain.drivers.join(" · ")
        : "No domain-level evidence details are available.",
      expectedImpact: "Expected-impact language is withheld until canonical monitoring state is restored.",
    }));
  const activePatterns: ActivePattern[] = marketState?.watch.activePatterns ?? [];
  const whatToWatch = marketState?.watch.whatToWatch
    ?? output.domains.slice(0, 5).map(domain => `${domain.label}: ${domain.drivers[0] ?? domain.description}`);
  const leadingIndicators = marketState?.why.evidenceFamilies
    ?? output.domains.slice(0, 5).map(domain => ({
      name: domain.label,
      signal: domain.riskLevel === "low" ? "neutral" : "stressed",
      strength: normalizeCanonicalMetric(domain.score * 10),
      trend: domain.delta > 0.15 ? "deteriorating" : domain.delta < -0.15 ? "improving" : "stable",
      currentValue: formatCanonicalScore(domain.score * 10),
      historicalContext: "Canonical historical context is unavailable in deterministic fallback mode.",
      whyItMatters: domain.description,
    }));
  const invalidations = [
    ...(marketState?.outlook.invalidationConditions ?? []),
    ...activePatterns.map(pattern => pattern.invalidationConditions),
  ].filter((item, index, values) => item && values.indexOf(item) === index);
  const confidence = marketState?.outlook.probabilities.confidence ?? 0;
  const modeLabel = isCanonical ? "Canonical state" : "Deterministic fallback";
  const watchAcceleration = marketState?.watch.accelerating ?? false;
  const buildingPressure = marketState?.watch.buildingPressure ?? developingConditions.some(condition => condition.trend === "building");

  return (
    <main className="min-h-screen bg-[#05070a] text-slate-200" data-watch-destination="canonical">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_5%,rgba(249,115,22,0.09),transparent_27%),radial-gradient(circle_at_12%_28%,rgba(0,229,255,0.045),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-orange-300">{modeLabel}</span>
            <span className="border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              {marketState?.cache.status ?? "local baseline"}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 transition hover:border-orange-300/30 hover:text-orange-200 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {dataError ? (
          <div className="mt-5 flex gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>Canonical refresh is degraded. WATCH is showing the last defensible state or deterministic fallback. {dataError}</span>
          </div>
        ) : null}

        <header className="py-12 sm:py-16" data-watch-section="what-changed">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-end">
            <div>
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-orange-300">
                <Radar className="h-4 w-4" />
                WATCH · What should I keep watching?
              </div>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-semibold uppercase leading-[0.94] tracking-[-0.045em] text-slate-50 sm:text-6xl lg:text-7xl">
                {whatChanged[0]}
              </h1>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-400">
                WATCH separates monitored change from speculation. Every condition below carries trend, duration, evidence, expected impact, invalidation, confidence, and source state when the canonical contract provides them.
              </p>
            </div>
            <div className="grid gap-3 border-l border-orange-300/20 pl-5">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Monitoring posture</div>
                <div className="mt-2 text-lg font-semibold uppercase text-slate-100">
                  {watchAcceleration ? "Accelerating" : buildingPressure ? "Building" : "Stable"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Pressure</div>
                  <div className="mt-1 font-mono text-sm text-orange-200">{formatCanonicalScore(pressure)}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Confidence</div>
                  <div className="mt-1 font-mono text-sm text-slate-200">{formatCanonicalPercent(confidence)}</div>
                </div>
              </div>
              <div className="border-t border-white/[0.07] pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
                Updated {lastUpdated?.toLocaleString() ?? "not available"}
              </div>
            </div>
          </div>
          {whatChanged.length > 1 ? (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {whatChanged.slice(1).map(change => (
                <div key={change} className="border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm leading-6 text-slate-300">
                  {change}
                </div>
              ))}
            </div>
          ) : null}
        </header>

        <Section
          id="developing-conditions"
          index="01"
          eyebrow="Developing conditions"
          title="Conditions that are building, stable, or easing"
          description="Each monitored condition is presented with its canonical severity, evidence, trend, and expected impact. Deterministic fallback is explicitly labeled and does not manufacture duration or impact claims."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {developingConditions.length > 0 ? developingConditions.map(condition => {
              const trend = trendCopy[condition.trend];
              return (
                <article key={`${condition.title}-${condition.description}`} className="border border-white/[0.08] bg-[#090c11] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] ${severityClasses[condition.severity]}`}>
                      {condition.severity}
                    </span>
                    <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${trend.className}`}>{trend.label}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold uppercase tracking-[-0.01em] text-slate-100">{condition.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{condition.description}</p>
                  <div className="mt-4 border-t border-white/[0.07] pt-4">
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Evidence</div>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{condition.evidence}</p>
                  </div>
                </article>
              );
            }) : (
              <div className="border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-slate-400 lg:col-span-2">
                No canonical developing conditions are active in the current snapshot.
              </div>
            )}
          </div>
        </Section>

        <Section
          id="active-patterns"
          index="02"
          eyebrow="Pattern memory"
          title="Active patterns with explicit confidence"
          description="Pattern recognition is shown only when the canonical state provides a named pattern, activation duration, confidence, and invalidation condition."
        >
          {activePatterns.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {activePatterns.map(pattern => (
                <article key={pattern.name} className="border border-white/[0.08] bg-[#090c11] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-orange-300">{pattern.daysActive} days active</div>
                    <div className="font-mono text-sm text-slate-100">{formatCanonicalPercent(pattern.confidence)}</div>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold uppercase text-slate-100">{pattern.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pattern.description}</p>
                  <div className="mt-4 border-t border-white/[0.07] pt-4 text-xs leading-5 text-rose-200/80">
                    Invalidation: {pattern.invalidationConditions}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 border border-white/[0.08] bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              No canonical active-pattern record is available. WATCH does not promote deterministic domain scores into named historical patterns.
            </div>
          )}
        </Section>

        <Section
          id="leading-indicators"
          index="03"
          eyebrow="Leading indicators"
          title="Evidence families to monitor before conditions change"
          description="Strength, direction, current observation, and historical context remain attached so a signal cannot outrun its evidence."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leadingIndicators.map(indicator => (
              <article key={indicator.name} className="border border-white/[0.08] bg-[#090c11] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">{indicator.signal}</div>
                    <h3 className="mt-2 text-sm font-semibold uppercase text-slate-100">{indicator.name}</h3>
                  </div>
                  <div className="font-mono text-sm text-orange-200">{formatCanonicalScore(indicator.strength)}</div>
                </div>
                <div className="mt-4 h-1 bg-white/[0.06]">
                  <div className="h-full bg-orange-300" style={{ width: `${normalizeCanonicalMetric(indicator.strength)}%` }} />
                </div>
                <div className="mt-4 grid gap-3 text-xs leading-5">
                  <p className="text-slate-300">{indicator.currentValue}</p>
                  <p className="text-slate-500">{indicator.whyItMatters}</p>
                  <p className="border-t border-white/[0.07] pt-3 text-slate-600">{indicator.historicalContext}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Monitor next</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {whatToWatch.map(item => (
                <div key={item} className="flex gap-2 text-xs leading-5 text-slate-300">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          id="duration-trend"
          index="04"
          eyebrow="Duration and trend"
          title="How long each condition has been developing"
          description="Duration is a canonical field, not an estimate inferred from severity. Missing duration remains visibly unavailable."
        >
          <div className="divide-y divide-white/[0.07] border border-white/[0.08] bg-[#090c11]">
            {developingConditions.map(condition => (
              <div key={`${condition.title}-duration`} className="grid gap-3 p-4 sm:grid-cols-[180px_120px_minmax(0,1fr)] sm:items-center">
                <div className="text-sm font-semibold uppercase text-slate-200">{condition.title}</div>
                <div className={`font-mono text-[9px] uppercase tracking-[0.16em] ${trendCopy[condition.trend].className}`}>
                  {trendCopy[condition.trend].label}
                </div>
                <div className="flex gap-2 text-xs leading-5 text-slate-400">
                  <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                  {condition.durationDescription}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="expected-impact"
          index="05"
          eyebrow="Expected impact"
          title="What each developing condition could affect"
          description="Impact language stays conditional. WATCH describes the monitored transmission path without converting it into a trade instruction."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {developingConditions.map(condition => (
              <article key={`${condition.title}-impact`} className="border border-white/[0.08] bg-[#090c11] p-5">
                <div className="flex items-center gap-3">
                  {condition.trend === "easing" ? (
                    <TrendingDown className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-orange-300" />
                  )}
                  <h3 className="text-sm font-semibold uppercase text-slate-100">{condition.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{condition.expectedImpact}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="invalidations"
          index="06"
          eyebrow="Invalidation"
          title="What would weaken the current watch posture"
          description="A monitored condition is useful only if the evidence that would reduce or invalidate it is visible beside the alert."
        >
          {invalidations.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {invalidations.map(item => (
                <div key={item} className="flex gap-3 border border-rose-400/15 bg-rose-400/[0.035] p-4 text-sm leading-6 text-slate-300">
                  <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-rose-300" />
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-white/[0.08] bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              Canonical invalidation conditions are unavailable. WATCH does not invent thresholds in deterministic fallback mode.
            </div>
          )}
        </Section>

        <Section
          id="confidence"
          index="07"
          eyebrow="Confidence and provenance"
          title="What this watch posture rests on"
          description="Confidence, freshness, warnings, source health, and historical depth remain visible so monitoring urgency can be judged against evidence quality."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Forecast confidence</div>
              <div className="mt-3 font-mono text-2xl text-slate-100">{formatCanonicalPercent(confidence)}</div>
            </div>
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Historical observations</div>
              <div className="mt-3 font-mono text-2xl text-slate-100">{marketState?.history.observationCount ?? 0}</div>
              <div className="mt-2 text-xs text-slate-500">{marketState?.history.datasetSpan ?? "Canonical history unavailable"}</div>
            </div>
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Freshness</div>
              <div className="mt-3 text-sm font-semibold uppercase text-slate-100">{marketState?.freshness ?? "Fallback"}</div>
              <div className="mt-2 text-xs text-slate-500">
                {marketState ? `Canonical source state is ${marketState.freshness}.` : "Live canonical freshness unavailable."}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceHealth.map(source => (
              <div key={source.id} className="border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase text-slate-200">{source.label}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${source.status === "healthy" ? "text-emerald-300" : source.status === "degraded" ? "text-amber-300" : "text-rose-300"}`}>
                    {source.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p>
              </div>
            ))}
          </div>
          {marketState?.warnings.length ? (
            <div className="mt-4 border border-amber-400/20 bg-amber-400/[0.04] p-4">
              {marketState.warnings.map(warning => (
                <div key={warning} className="text-xs leading-5 text-amber-100/75">{warning}</div>
              ))}
            </div>
          ) : null}
        </Section>

        <Section
          id="asha"
          index="08"
          eyebrow="ASHA continuity"
          title="Interrogate the watch posture without losing context"
          description="Carry the current regime, monitored conditions, evidence quality, and invalidation state into the shared advisor workspace."
        >
          <div className="flex flex-col gap-5 border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-sm font-semibold uppercase text-slate-100">Ask what would make this watch posture more or less urgent</div>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                  ASHA receives the canonical market context through the shared gateway; no parallel monitoring state is created here.
                </p>
              </div>
            </div>
            <Link
              href={PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha"}
              className="inline-flex shrink-0 items-center justify-center gap-2 border border-cyan-300/25 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/10"
            >
              Open ASHA <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>

        <Section
          id="expert-handoffs"
          index="09"
          eyebrow="Expert handoffs"
          title="Open specialist tools without crowding the watch brief"
          description="The canonical destination stays focused on monitoring. Existing specialist workflows remain available through explicit, registry-owned handoffs."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link href={WATCH_DEEP_PATH} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-orange-300/30">
              <BellRing className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Preserved deep view</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">AI Watch Assistant</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open the existing sector intelligence feed and entity tracker.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID.pressure.path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-orange-300/30">
              <Gauge className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Expert workspace</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Pressure Engine</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Inspect the systemic pressure mechanics behind a monitored condition.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["smart-discovery"].path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-orange-300/30">
              <Target className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Research handoff</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Smart Discovery</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Investigate a monitored theme through the preserved discovery workspace.</p>
            </Link>
            <Link href={CANONICAL_DESTINATION_BY_ID.act.path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-emerald-300/30">
              <ArrowRight className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Decision handoff</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Continue to ACT</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Convert a monitored condition into a bounded decision workflow.</p>
            </Link>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
          <span>Regime {marketState?.now.regime ?? output.regime.label}</span>
          <Link href={PERSISTENT_UTILITY_BY_ID.alerts.path ?? CANONICAL_DESTINATION_BY_ID.watch.path} className="text-orange-300/80 transition hover:text-orange-200">
            Review alert view
          </Link>
        </div>
      </div>
    </main>
  );
}
