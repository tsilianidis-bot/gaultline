import { useEffect } from "react";
import { Link } from "wouter";
import {
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
import { trpc } from "@/lib/trpc";
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

const severityColors: Record<DevelopingCondition["severity"], string> = {
  Low: "#34d399",
  Moderate: "#fbbf24",
  High: "#fb923c",
  Critical: "#fb7185",
};

const trendCopy: Record<DevelopingCondition["trend"], { label: string; color: string }> = {
  building: { label: "BUILDING", color: "#fb923c" },
  stable:   { label: "STABLE",   color: "#64748b" },
  easing:   { label: "EASING",   color: "#34d399" },
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

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id, index, eyebrow, title, description, children,
}: {
  id: string; index: string; eyebrow: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section data-watch-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`watch-${id}-title`}>
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-orange-300/60">{index} · {eyebrow}</p>
        <div>
          <h2 id={`watch-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

// ── Threshold proximity meter (radar-style arc) ──────────────────────────────
function ThresholdMeter({ name, strength, severity, trend }: {
  name: string; strength: number; severity: DevelopingCondition["severity"]; trend: DevelopingCondition["trend"];
}) {
  const color = severityColors[severity];
  const trendInfo = trendCopy[trend];
  const r = 36;
  const cx = 44;
  const cy = 44;
  const startAngle = -210;
  const sweepAngle = 240;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(toRad(from));
    const y1 = cy + radius * Math.sin(toRad(from));
    const x2 = cx + radius * Math.cos(toRad(to));
    const y2 = cy + radius * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const endAngle = startAngle + sweepAngle;
  const fillAngle = startAngle + (sweepAngle * Math.min(100, Math.max(0, strength))) / 100;
  // Distance to threshold (100 = at threshold)
  const distancePct = Math.max(0, 100 - strength);

  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start gap-4">
        {/* Mini arc gauge */}
        <svg viewBox="0 0 88 72" className="w-20 shrink-0" aria-hidden="true">
          <path d={arcPath(startAngle, endAngle, r)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeLinecap="round" />
          {strength > 0 && (
            <path
              d={arcPath(startAngle, fillAngle, r)}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              style={{ transition: "all 1s cubic-bezier(0.23,1,0.32,1)" }}
            />
          )}
          <text x={cx} y={cy - 2} textAnchor="middle" fill="white" fontSize="12" fontFamily="Rajdhani, sans-serif" fontWeight="700">
            {Math.round(strength)}
          </text>
          <text x={cx} y={cx + 10} textAnchor="middle" fill={color} fontSize="5" fontFamily="monospace" letterSpacing="1">
            {severity.toUpperCase()}
          </text>
        </svg>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-200 truncate">{name}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[9px]" style={{ color: trendInfo.color }}>{trendInfo.label}</span>
          </div>
          {/* Distance bar */}
          <div className="mt-2">
            <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-600">
              {distancePct < 10 ? "Near threshold" : distancePct < 30 ? "Approaching" : "Distance to threshold"}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${strength}%`,
                  background: `linear-gradient(90deg, ${color}60, ${color})`,
                  transition: "width 1s cubic-bezier(0.23,1,0.32,1)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Trigger distance display ─────────────────────────────────────────────────
function TriggerDistanceRow({ condition }: { condition: DevelopingCondition }) {
  const color = severityColors[condition.severity];
  const trendInfo = trendCopy[condition.trend];
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-200">{condition.title}</p>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em]" style={{ borderColor: `${color}40`, color }}>
              {condition.severity}
            </span>
            <span className="font-mono text-[9px]" style={{ color: trendInfo.color }}>{trendInfo.label}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{condition.durationDescription}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{condition.description}</p>
      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-600">Evidence</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{condition.evidence}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
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
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading && !canonicalState) return <PageLoadingState eyebrow="WATCH · Monitoring state" message="Loading authoritative canonical state…" />;
  if (!canonicalState) return <PageDegradedBanner message="Current canonical state is unavailable." detail="WATCH withholds current monitoring interpretation until one authoritative state is available." />;

  useEffect(() => {
    document.title = "WATCH — FAULTLINE";
  }, []);

  const isCanonical = marketMode === "canonical" && Boolean(marketState);
  const pressure = canonicalState?.pressureIndex ?? marketState?.now.pressureScore ?? output.overall.score * 10;
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
      evidence: domain.drivers.length > 0 ? domain.drivers.join(" · ") : "No domain-level evidence details are available.",
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
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section data-watch-section="what-changed" className="relative overflow-hidden rounded-sm border border-orange-300/20 bg-[#090c11] p-6 md:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 80% 10%, rgba(249,115,22,0.14), transparent 35%)" }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)" }} />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-orange-300">
                  <Radar className="h-4 w-4" /> WATCH · Monitoring state
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
                  className="flex items-center gap-2 rounded-sm border border-orange-300/20 bg-orange-300/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-orange-200 transition hover:bg-orange-300/[0.07] disabled:cursor-wait disabled:opacity-50 active:scale-[0.97]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            {dataError && (
              <div className="mt-5">
                <PageDegradedBanner message="Canonical refresh is degraded. WATCH is showing the last defensible state or deterministic fallback." detail={dataError} />
              </div>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">What changed</p>
                <h1 className="mt-4 max-w-4xl font-['Rajdhani'] text-4xl font-semibold leading-[1.02] text-white md:text-5xl">
                  {whatChanged[0]}
                </h1>
                <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-400">
                  WATCH separates monitored change from speculation. Every condition below carries trend, duration, evidence, expected impact, invalidation, confidence, and source state when the canonical contract provides them.
                </p>
                {whatChanged.length > 1 && (
                  <div className="mt-5 grid gap-2 md:grid-cols-2">
                    {whatChanged.slice(1).map(change => (
                      <div key={change} className="rounded-sm border border-white/10 bg-white/[0.02] px-4 py-3 text-sm leading-6 text-slate-300">{change}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Monitoring posture panel */}
              <div className="rounded-sm border border-orange-300/20 bg-orange-300/[0.03] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">Monitoring posture</p>
                <p className="mt-3 font-['Rajdhani'] text-3xl font-semibold text-orange-300">
                  {watchAcceleration ? "Accelerating" : buildingPressure ? "Building" : "Stable"}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Pressure</p>
                    <p className="mt-1 font-mono text-sm text-orange-200">{formatCanonicalScore(pressure)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Confidence</p>
                    <p className="mt-1 font-mono text-sm text-slate-200">{formatCanonicalPercent(confidence)}</p>
                  </div>
                </div>
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
                  Updated {lastUpdated?.toLocaleString() ?? "not available"}
                </p>
                {/* Severity summary */}
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">Active severity</p>
                  <div className="flex flex-wrap gap-2">
                    {(["Critical", "High", "Moderate", "Low"] as DevelopingCondition["severity"][]).map(sev => {
                      const count = developingConditions.filter(c => c.severity === sev).length;
                      if (!count) return null;
                      return (
                        <div key={sev} className="flex items-center gap-1.5 rounded-sm border px-2 py-1" style={{ borderColor: `${severityColors[sev]}40`, background: `${severityColors[sev]}08` }}>
                          <span className="font-mono text-[9px]" style={{ color: severityColors[sev] }}>{count}</span>
                          <span className="font-mono text-[8px] text-slate-500">{sev}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href={CANONICAL_DESTINATION_BY_ID.act.path} className="flex items-center gap-2 rounded-sm bg-orange-400 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#1a0800] transition hover:bg-orange-300 active:scale-[0.97]">
                Move to ACT <ArrowRight size={14} />
              </Link>
              <Link href={WATCH_DEEP_PATH} className="flex items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                Open AI watch assistant
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTIONS ─────────────────────────────────────────────────── */}

        <Section id="threshold-meters" index="01" eyebrow="Threshold proximity" title="How close each domain is to its alert threshold" description="Each meter shows the current pressure reading against a normalized 0–100 scale. The closer to 100, the closer the domain is to a critical threshold.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {developingConditions.map(condition => (
              <ThresholdMeter
                key={condition.title}
                name={condition.title}
                strength={condition.severity === "Critical" ? 90 : condition.severity === "High" ? 75 : condition.severity === "Moderate" ? 55 : 30}
                severity={condition.severity}
                trend={condition.trend}
              />
            ))}
          </div>
        </Section>

        <Section id="developing-conditions" index="02" eyebrow="Developing conditions" title="Conditions that are building, stable, or easing" description="Each monitored condition is presented with its canonical severity, evidence, trend, and expected impact. Deterministic fallback is explicitly labeled and does not manufacture duration or impact claims.">
          <div className="grid gap-4 lg:grid-cols-2">
            {developingConditions.length > 0 ? developingConditions.map(condition => (
              <TriggerDistanceRow key={`${condition.title}-${condition.description}`} condition={condition} />
            )) : (
              <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400 lg:col-span-2">
                No canonical developing conditions are active in the current snapshot.
              </div>
            )}
          </div>
        </Section>

        <Section id="active-patterns" index="03" eyebrow="Pattern memory" title="Active patterns with explicit confidence" description="Pattern recognition is shown only when the canonical state provides a named pattern, activation duration, confidence, and invalidation condition.">
          {activePatterns.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {activePatterns.map(pattern => (
                <article key={pattern.name} className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-orange-300">{pattern.daysActive} days active</div>
                    <div className="font-mono text-sm text-slate-100">{formatCanonicalPercent(pattern.confidence)}</div>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-100">{pattern.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pattern.description}</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${pattern.confidence}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-rose-200/80">
                    Invalidation: {pattern.invalidationConditions}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              No canonical active-pattern record is available. WATCH does not promote deterministic domain scores into named historical patterns.
            </div>
          )}
        </Section>

        <Section id="leading-indicators" index="04" eyebrow="Leading indicators" title="Evidence families to monitor before conditions change" description="Strength, direction, current observation, and historical context remain attached so a signal cannot outrun its evidence.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leadingIndicators.map(indicator => (
              <article key={indicator.name} className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">{indicator.signal}</div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-100">{indicator.name}</h3>
                  </div>
                  <div className="font-mono text-sm text-orange-200">{formatCanonicalScore(indicator.strength)}</div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-orange-300" style={{ width: `${normalizeCanonicalMetric(indicator.strength)}%`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <div className="mt-4 grid gap-3 text-xs leading-5">
                  <p className="text-slate-300">{indicator.currentValue}</p>
                  <p className="text-slate-500">{indicator.whyItMatters}</p>
                  <p className="border-t border-white/10 pt-3 text-slate-600">{indicator.historicalContext}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 rounded-sm border border-white/10 bg-white/[0.02] px-4 py-4">
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

        <Section id="duration-trend" index="05" eyebrow="Duration and trend" title="How long each condition has been developing" description="Duration is a canonical field, not an estimate inferred from severity. Missing duration remains visibly unavailable.">
          <div className="divide-y divide-white/10 rounded-sm border border-white/10 bg-white/[0.025]">
            {developingConditions.map(condition => (
              <div key={`${condition.title}-duration`} className="grid gap-3 p-4 sm:grid-cols-[180px_120px_minmax(0,1fr)] sm:items-center">
                <div className="text-sm font-semibold text-slate-200">{condition.title}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: trendCopy[condition.trend].color }}>
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

        <Section id="expected-impact" index="06" eyebrow="Expected impact" title="What each developing condition could affect" description="Impact language stays conditional. WATCH describes the monitored transmission path without converting it into a trade instruction.">
          <div className="grid gap-4 lg:grid-cols-2">
            {developingConditions.map(condition => (
              <article key={`${condition.title}-impact`} className="rounded-sm border border-white/10 bg-white/[0.025] p-5">
                <div className="flex items-center gap-3">
                  {condition.trend === "easing" ? (
                    <TrendingDown className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-orange-300" />
                  )}
                  <h3 className="text-sm font-semibold text-slate-100">{condition.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{condition.expectedImpact}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="invalidations" index="07" eyebrow="Invalidation" title="What would weaken the current watch posture" description="A monitored condition is useful only if the evidence that would reduce or invalidate it is visible beside the alert.">
          {invalidations.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {invalidations.map(item => (
                <div key={item} className="flex gap-3 rounded-sm border border-rose-400/15 bg-rose-400/[0.035] p-4 text-sm leading-6 text-slate-300">
                  <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-rose-300" />
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              Canonical invalidation conditions are unavailable. WATCH does not invent thresholds in deterministic fallback mode.
            </div>
          )}
        </Section>

        <Section id="confidence" index="08" eyebrow="Confidence and provenance" title="What this watch posture rests on" description="Confidence, freshness, warnings, source health, and historical depth remain visible so monitoring urgency can be judged against evidence quality.">
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

        <Section id="asha" index="09" eyebrow="ASHA continuity" title="Interrogate the watch posture without losing context" description="Carry the current regime, monitored conditions, evidence quality, and invalidation state into the shared advisor workspace.">
          <div className="flex flex-col gap-5 rounded-sm border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Ask what would make this watch posture more or less urgent</div>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                  ASHA receives the canonical market context through the shared gateway; no parallel monitoring state is created here.
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

        <Section id="expert-handoffs" index="10" eyebrow="Expert handoffs" title="Open specialist tools without crowding the watch brief" description="The canonical destination stays focused on monitoring. Existing specialist workflows remain available through explicit, registry-owned handoffs.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link href={WATCH_DEEP_PATH} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-orange-300/30">
              <BellRing className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Preserved deep view</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">AI Watch Assistant</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open the existing sector intelligence feed and entity tracker.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID.pressure.path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-orange-300/30">
              <Gauge className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Expert workspace</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Pressure Engine</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Inspect the systemic pressure mechanics behind a monitored condition.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["smart-discovery"].path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-orange-300/30">
              <Target className="h-4 w-4 text-orange-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Research handoff</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Smart Discovery</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Investigate a monitored theme through the preserved discovery workspace.</p>
            </Link>
            <Link href={CANONICAL_DESTINATION_BY_ID.act.path} className="group rounded-sm border border-white/10 bg-white/[0.025] p-5 transition hover:border-emerald-300/30">
              <ArrowRight className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Decision handoff</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">Continue to ACT</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Convert a monitored condition into a bounded decision workflow.</p>
            </Link>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
          <span>Regime {marketState?.now.regime ?? output.regime.label}</span>
          <Link href={PERSISTENT_UTILITY_BY_ID.alerts.path ?? CANONICAL_DESTINATION_BY_ID.watch.path} className="text-orange-300/80 transition hover:text-orange-200">
            Review alert view
          </Link>
        </div>
      </div>
    </main>
  );
}
