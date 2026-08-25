import { useMemo } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  History,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import { formatCanonicalScore, normalizeCanonicalMetric } from "@shared/marketMetrics";
import type { CanonicalMarketState } from "@shared/marketState";
import DataFreshnessChip from "@/components/DataFreshnessChip";
import { PageLoadingState, PageDegradedBanner } from "@/components/PageStateViews";

type EvidenceFamily = CanonicalMarketState["why"]["evidenceFamilies"][number];

const WHY_DEEP_PATH = "/app/why/deep";

function fallbackSignal(score: number): EvidenceFamily["signal"] {
  if (score >= 7) return "stressed";
  if (score >= 5) return "bearish";
  if (score <= 3) return "recovering";
  return "neutral";
}

function signalTone(signal: EvidenceFamily["signal"]): string {
  if (signal === "bullish" || signal === "recovering") return "#34d399";
  if (signal === "bearish" || signal === "stressed") return "#fb7185";
  return "#fbbf24";
}

function pressureColor(score: number) {
  if (score >= 75) return "#ff4d6d";
  if (score >= 50) return "#ffaa00";
  if (score >= 30) return "#00e5ff";
  return "#00e599";
}

function trendArrow(trend: EvidenceFamily["trend"]) {
  if (trend === "deteriorating") return { icon: <TrendingUp size={11} />, color: "#fb7185", label: "↑" };
  if (trend === "improving") return { icon: <TrendingDown size={11} />, color: "#34d399", label: "↓" };
  return { icon: <ArrowRight size={11} />, color: "#64748b", label: "→" };
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id, index, eyebrow, title, description, children,
}: {
  id: string; index: string; eyebrow: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <section data-why-section={id} className="border-t border-white/10 py-10 md:py-14" aria-labelledby={`why-${id}-title`}>
      <div className="mb-7 grid gap-3 md:grid-cols-[150px_1fr] md:gap-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/60">{index} · {eyebrow}</p>
        <div>
          <h2 id={`why-${id}-title`} className="font-['Rajdhani'] text-2xl font-semibold text-white md:text-3xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="md:pl-[182px]">{children}</div>
    </section>
  );
}

// ── Driver contribution bar ──────────────────────────────────────────────────
function DriverContributionBar({ name, strength, trend, rank, whyItMatters }: {
  name: string; strength: number; trend: EvidenceFamily["trend"]; rank: number; whyItMatters: string;
}) {
  const color = pressureColor(strength);
  const ta = trendArrow(trend);
  const barWidth = Math.min(100, Math.max(0, strength));
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-slate-600">{String(rank).padStart(2, "0")}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-200">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px]" style={{ color: ta.color }}>{ta.label}</span>
          <span className="font-mono text-sm font-semibold" style={{ color }}>{formatCanonicalScore(strength)}</span>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${barWidth}%`, background: `linear-gradient(90deg, ${color}aa, ${color})`, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{whyItMatters}</p>
    </div>
  );
}

// ── Evidence family card ─────────────────────────────────────────────────────
function EvidenceCard({ family }: { family: EvidenceFamily }) {
  const tone = signalTone(family.signal);
  const ta = trendArrow(family.trend);
  return (
    <article
      className="rounded-sm border border-white/10 bg-white/[0.025] p-5"
      style={{ borderLeftColor: `${tone}80`, borderLeftWidth: 2 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-['Rajdhani'] text-lg font-semibold text-white">{family.name}</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: tone }}>{family.signal}</p>
        </div>
        <div className="text-right">
          <p className="font-['Rajdhani'] text-xl font-semibold text-white">{formatCanonicalScore(family.strength)}</p>
          <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: ta.color }}>
            {ta.icon} {family.trend}
          </div>
        </div>
      </div>
      {/* Strength bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${family.strength}%`, background: tone, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }}
        />
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{family.whyItMatters}</p>
      <div className="mt-4 border-t border-white/8 pt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Current evidence</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{family.currentValue}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{family.historicalContext}</p>
      </div>
    </article>
  );
}

// ── Fault map node ───────────────────────────────────────────────────────────
function FaultMapChain({ drivers, families }: { drivers: string[]; families: EvidenceFamily[] }) {
  const familyMap = useMemo(() => {
    const m: Record<string, EvidenceFamily> = {};
    for (const f of families) m[f.name.toLowerCase()] = f;
    return m;
  }, [families]);

  const nodes = drivers.slice(0, 4).map(d => {
    const key = Object.keys(familyMap).find(k => d.toLowerCase().includes(k) || k.includes(d.toLowerCase().split(" ")[0]));
    const fam = key ? familyMap[key] : null;
    return { name: d, strength: fam?.strength ?? 50, trend: fam?.trend ?? "stable", signal: fam?.signal ?? "neutral" };
  });

  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
      <p className="mb-5 font-mono text-[9px] uppercase tracking-[0.18em] text-amber-300/70">Transmission chain — cause to effect</p>
      <div className="flex flex-wrap items-center gap-0">
        {nodes.map((node, i) => {
          const color = pressureColor(node.strength);
          const ta = trendArrow(node.trend);
          return (
            <div key={node.name} className="flex items-center">
              <div
                className="rounded-sm border p-3 text-center"
                style={{ borderColor: `${color}40`, background: `${color}08`, minWidth: "120px" }}
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-mono text-[10px] font-semibold text-white leading-tight">{node.name}</p>
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className="h-1 w-8 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${node.strength}%`, background: color }} />
                  </div>
                  <span className="font-mono text-[8px]" style={{ color: ta.color }}>{ta.label}</span>
                </div>
              </div>
              {i < nodes.length - 1 && (
                <div className="flex items-center px-1">
                  <div className="h-px w-6 bg-white/20" />
                  <ArrowRight size={10} className="text-white/30" />
                </div>
              )}
            </div>
          );
        })}
        {/* Terminal effect */}
        {nodes.length > 0 && (
          <div className="flex items-center">
            <div className="flex items-center px-1">
              <div className="h-px w-6 bg-white/20" />
              <ArrowRight size={10} className="text-white/30" />
            </div>
            <div className="rounded-sm border border-rose-300/30 bg-rose-300/[0.06] p-3 text-center" style={{ minWidth: "100px" }}>
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-rose-300">Market effect</p>
              <p className="mt-1 font-mono text-[10px] text-slate-300 leading-tight">Elevated pressure</p>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
        Arrows represent the canonical transmission direction — not timing or certainty.
      </p>
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
export default function Why() {
  useSEO({
    title: "WHY — FAULTLINE",
    description: "Understand the drivers, transmission paths, duration, historical context, and invalidation conditions behind the current market state.",
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
  const { data: canonicalState } = trpc.marketState.canonicalCurrent.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading && !canonicalState) return <PageLoadingState eyebrow="WHY · Causal analysis" message="Loading authoritative canonical state…" />;
  if (!canonicalState) return <PageDegradedBanner message="Current canonical state is unavailable." detail="WHY withholds current-state interpretation until one authoritative state is available." />;

  const evidenceFamilies: EvidenceFamily[] = marketState?.why.evidenceFamilies ?? output.domains.map(domain => ({
    name: domain.label,
    signal: fallbackSignal(domain.score),
    strength: normalizeCanonicalMetric(domain.score * 10),
    trend: domain.delta > 0.1 ? "deteriorating" : domain.delta < -0.1 ? "improving" : "stable",
    currentValue: formatCanonicalScore(domain.score * 10),
    historicalContext: domain.description,
    whyItMatters: domain.drivers.length ? domain.drivers.join(" · ") : domain.description,
  }));

  const primaryDrivers = marketState?.now.topDrivers ?? evidenceFamilies.slice(0, 4).map(family => family.name);
  const keyDevelopments = marketState?.why.keyDevelopments ?? output.narrative.keyRisks;
  const whatChanged = marketState?.watch.whatChanged ?? [];
  const developingConditions = marketState?.watch.developingConditions ?? [];
  const positioningEvidence = evidenceFamilies.filter(family => /liquid|credit|concentration|volatil|breadth|fund/i.test(family.name));
  const positioningView = positioningEvidence.length ? positioningEvidence : evidenceFamilies.slice(0, 3);
  const invalidationConditions = marketState?.outlook.invalidationConditions ?? [];
  const pressure = canonicalState?.pressureIndex ?? marketState?.now.pressureScore ?? normalizeCanonicalMetric(output.overall.score * 10);
  const story = marketState?.why.story ?? output.narrative.summary;
  const whyThisRegime = marketState?.why.whyThisRegime ?? output.narrative.regimeAssessment;
  const whyThisScore = marketState?.why.whyThisScore ?? output.overall.description;
  const ashaPath = PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha";
  const evidenceConsensus = marketState?.why.evidenceConsensus ?? "fallback";
  const pressureColor = pressure >= 75 ? "#ff4d6d" : pressure >= 50 ? "#ffaa00" : pressure >= 30 ? "#00e5ff" : "#00e599";

  // Sort evidence families by strength descending for driver bars
  const sortedFamilies = useMemo(
    () => [...evidenceFamilies].sort((a, b) => b.strength - a.strength),
    [evidenceFamilies],
  );

  return (
    <main className="min-h-screen bg-[#04070b] text-slate-200">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 md:px-10 md:pt-12">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section data-why-section="explanation" className="relative overflow-hidden rounded-sm border border-amber-300/20 bg-[#080c13] p-6 md:p-9">
          <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at 82% 12%, rgba(251,191,36,0.12), transparent 33%), linear-gradient(135deg, rgba(255,255,255,0.018), transparent 55%)" }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)" }} />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.23em] text-amber-300">WHY · Causal interpretation</p>
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
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 rounded-sm border border-amber-300/20 bg-amber-300/[0.04] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-amber-200 transition duration-150 active:scale-[0.97] disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {dataError && (
              <div className="mt-5">
                <PageDegradedBanner message="Canonical refresh is degraded. WHY is showing the last defensible state or deterministic fallback." detail={dataError} />
              </div>
            )}

            {/* Hero content */}
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Causal explanation</p>
                <h1 className="mt-4 max-w-4xl font-['Rajdhani'] text-4xl font-semibold leading-[1.02] text-white md:text-5xl">
                  {marketState?.why.narrative.whyIsItHappening ?? whyThisRegime}
                </h1>
                <p className="mt-5 max-w-4xl text-base leading-7 text-slate-300">{story}</p>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">{whyThisScore}</p>
              </div>

              {/* Pressure being explained */}
              <div className="rounded-sm border border-amber-300/20 bg-amber-300/[0.03] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Pressure being explained</p>
                <p className="mt-3 font-['Rajdhani'] text-5xl font-semibold" style={{ color: pressureColor }}>{formatCanonicalScore(pressure)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${pressure}%`, background: pressureColor, transition: "width 1s cubic-bezier(0.23,1,0.32,1)" }} />
                </div>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300/75">{evidenceConsensus} evidence consensus</p>
                <p className="mt-4 text-xs leading-5 text-slate-500">Updated {lastUpdated?.toLocaleString() ?? "unavailable"}</p>
                {/* Top 3 driver mini-bars */}
                <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
                  <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">Top contributors</p>
                  {sortedFamilies.slice(0, 3).map(f => (
                    <div key={f.name} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 font-mono text-[8px] truncate text-slate-500">{f.name}</span>
                      <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${f.strength}%`, background: signalTone(f.signal) }} />
                      </div>
                      <span className="font-mono text-[8px] text-slate-400">{formatCanonicalScore(f.strength)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Link href={CANONICAL_DESTINATION_BY_ID.outlook.path} className="flex items-center gap-2 rounded-sm bg-amber-300 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#1a0e00] transition hover:bg-amber-200 active:scale-[0.97]">
                See what comes next <ArrowRight size={14} />
              </Link>
              <Link href={WHY_DEEP_PATH} className="flex items-center gap-2 rounded-sm border border-white/15 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.13em] text-slate-300 transition hover:border-white/30 hover:text-white active:scale-[0.97]">
                Open narrative deep view
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTIONS ─────────────────────────────────────────────────── */}

        <Section id="drivers" index="01" eyebrow="Primary drivers" title="The forces carrying the most explanatory weight" description="These drivers come from the same canonical state as NOW. They are ranked evidence, not post-hoc headlines.">
          {/* Driver contribution bars */}
          <div className="grid gap-3 md:grid-cols-2">
            {sortedFamilies.map((family, index) => (
              <DriverContributionBar
                key={family.name}
                name={family.name}
                strength={family.strength}
                trend={family.trend}
                rank={index + 1}
                whyItMatters={family.whyItMatters}
              />
            ))}
          </div>
          {keyDevelopments.length > 0 && (
            <div className="mt-4 rounded-sm border border-amber-300/15 bg-amber-300/[0.035] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/75">Key developments</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {keyDevelopments.map(item => <p key={item} className="text-sm leading-6 text-slate-300">• {item}</p>)}
              </div>
            </div>
          )}
        </Section>

        <Section id="fault-map" index="02" eyebrow="Fault map" title="How pressure moves through the system" description="The transmission chain traces the canonical causal path from primary drivers to market effect. Arrows show direction, not timing.">
          {marketState?.freshness === "stale" || (marketState?.cache.status === "stale-if-error") ? (
            <div className="mb-4 rounded-sm border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-amber-300/80">Evidence families reflect the most recent complete data — live sub-scores are temporarily unavailable</p>
            </div>
          ) : null}
          <FaultMapChain drivers={primaryDrivers} families={evidenceFamilies} />
        </Section>

        <Section id="transmission" index="03" eyebrow="Evidence families" title="Where each driver is concentrated and how strong it is" description="Every family is normalized to the same 0–100 scale. Strength and trend are shown together so concentration and direction are visible at once.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {evidenceFamilies.map(family => <EvidenceCard key={family.name} family={family} />)}
          </div>
        </Section>

        <Section id="positioning" index="04" eyebrow="Positioning" title="What observable participation evidence implies" description="FAULTLINE separates measured proxies from claims about hidden institutional positions. When no dedicated positioning feed is present, the limitation is explicit.">
          <div className="rounded-sm border border-violet-300/15 bg-violet-300/[0.025] p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-violet-200">Evidence boundary</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The canonical snapshot does not publish a standalone institutional-positioning feed. The cards below are observable liquidity, credit, concentration, volatility, or breadth proxies—not assertions about undisclosed holdings.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {positioningView.map(family => (
              <div key={family.name} className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 text-violet-300"><Network size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">{family.name}</p></div>
                <p className="mt-4 font-['Rajdhani'] text-2xl font-semibold text-white">{family.currentValue}</p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${family.strength}%`, background: signalTone(family.signal) }} />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{family.whyItMatters}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="duration-change" index="05" eyebrow="Duration and change" title="How long the condition has been developing—and what changed" description="WHY distinguishes persistent buildup from the latest acceleration. If the canonical state cannot date a development, it does not invent a start point.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 text-amber-300"><Clock3 size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Developing conditions</p></div>
              <div className="mt-4 space-y-3">
                {developingConditions.length ?
                  developingConditions.map(condition => (
                    <div key={condition.title} className="border-l border-amber-300/30 pl-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{condition.title}</p><span className="font-mono text-[8px] uppercase tracking-[0.12em] text-amber-300/70">{condition.durationDescription}</span></div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{condition.description}</p>
                    </div>
                  )) : <p className="text-sm leading-6 text-slate-500">No canonical duration records are available in the current snapshot.</p>}
              </div>
            </div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 text-cyan-300"><GitBranch size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">What changed</p></div>
              <div className="mt-4 space-y-3">
                {whatChanged.length ? whatChanged.map(item => <p key={item} className="border-l border-cyan-300/25 pl-4 text-sm leading-6 text-slate-300">{item}</p>) : (
                  <p className="text-sm leading-6 text-slate-500">{marketState?.why.narrative.whatHasChanged ?? "No canonical change list is available; the fallback engine is showing current conditions only."}</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section id="history" index="06" eyebrow="History" title="How this causal pattern compares with prior evidence" description="Historical context includes dataset depth and analog resolution so similarity is not mistaken for certainty.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><Database size={16} className="text-violet-300" /><p className="mt-4 font-['Rajdhani'] text-2xl font-semibold text-white">{marketState?.history.observationCount.toLocaleString() ?? "—"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Observations</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><History size={16} className="text-violet-300" /><p className="mt-4 font-['Rajdhani'] text-2xl font-semibold text-white">{marketState?.history.datasetSpan ?? "Unavailable"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Dataset span</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><Target size={16} className="text-violet-300" /><p className="mt-4 font-['Rajdhani'] text-2xl font-semibold text-white">{marketState?.outlook.topAnalog ? `${marketState.outlook.topAnalog.similarity}%` : "—"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.13em] text-slate-500">Top analog similarity</p></div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-violet-300/75">Current streak</p><p className="mt-3 text-sm leading-6 text-slate-300">{marketState?.history.currentStreakDescription ?? "Historical streak context is unavailable in fallback mode."}</p></div>
            <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-violet-300/75">Analog summary</p><p className="mt-3 text-sm leading-6 text-slate-300">{marketState?.history.analogSummary ?? "Canonical analog context is unavailable in fallback mode."}</p></div>
          </div>
        </Section>

        <Section id="invalidation" index="07" eyebrow="Invalidation" title="What would weaken this explanation" description="A causal interpretation is useful only if users can see which observations would disconfirm it.">
          <div className="grid gap-3 md:grid-cols-2">
            {invalidationConditions.length ? invalidationConditions.map(condition => (
              <div key={condition} className="flex gap-3 rounded-sm border border-rose-300/15 bg-rose-300/[0.025] p-5"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-rose-300" /><p className="text-sm leading-6 text-slate-300">{condition}</p></div>
            )) : <div className="rounded-sm border border-white/10 bg-white/[0.02] p-5 text-sm leading-6 text-slate-500">Canonical invalidation conditions are unavailable. {marketState?.act.whatWouldInvalidate ?? "Do not infer certainty from the fallback explanation."}</div>}
          </div>
        </Section>

        <Section id="confidence" index="08" eyebrow="Confidence and provenance" title="What this explanation rests on" description="Source health, evidence consensus, freshness, and warnings remain attached to the interpretation.">
          <div className="grid gap-3 md:grid-cols-2">
            {sourceHealth.length ? sourceHealth.map(source => <SourceStatus key={source.id} source={source} />) : (
              <div className="rounded-sm border border-amber-300/15 bg-amber-300/[0.03] p-5 text-sm leading-6 text-slate-400">No canonical source-health record is available. WHY is using the deterministic browser fallback and does not represent it as live evidence.</div>
            )}
          </div>
          {marketState?.warnings.length ? <div className="mt-4 rounded-sm border border-amber-300/15 bg-amber-300/[0.03] p-5"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-amber-300/75">Warnings</p>{marketState.warnings.map(warning => <p key={warning} className="mt-2 text-sm leading-6 text-slate-400">{warning}</p>)}</div> : null}
        </Section>

        <Section id="asha" index="09" eyebrow="ASHA" title="Continue the causal analysis with ASHA" description="Open the advisor with the same destination and canonical market context so the conversation begins from the evidence already on screen.">
          <div className="rounded-sm border border-cyan-300/20 bg-cyan-300/[0.035] p-6 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex gap-4"><BrainCircuit size={24} className="shrink-0 text-cyan-300" /><div><p className="font-['Rajdhani'] text-xl font-semibold text-white">Ask what is driving the current regime</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">ASHA can trace one driver, compare evidence families, or challenge the invalidation thesis without changing the canonical source.</p></div></div>
            <Link href={`${ashaPath}?from=why`} className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-sm border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.13em] text-cyan-100 transition hover:bg-cyan-300/15 active:scale-[0.97] md:mt-0">Open ASHA <ArrowRight size={13} /></Link>
          </div>
        </Section>

        <Section id="expert-handoffs" index="10" eyebrow="Expert depth" title="Open specialist tools without crowding the explanation" description="WHY remains causal and readable; existing narrative and pressure tools remain intact as deeper workspaces.">
          <div className="grid gap-3 md:grid-cols-2">
            <Link href={WHY_DEEP_PATH} className="group rounded-sm border border-white/10 bg-white/[0.02] p-5 transition hover:border-amber-300/30 hover:bg-amber-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-amber-300"><Sparkles size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Narrative deep view</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-semibold text-white">Today&apos;s Story</p><p className="mt-2 text-sm leading-6 text-slate-500">Open the existing AI-written narrative, opportunity, risk, institutional-activity, and invalidation workspace.</p></Link>
            <Link href={EXPERT_WORKSPACE_BY_ID.pressure.path} className="group rounded-sm border border-white/10 bg-white/[0.02] p-5 transition hover:border-amber-300/30 hover:bg-amber-300/[0.035] active:scale-[0.99]"><div className="flex items-center gap-2 text-amber-300"><ShieldCheck size={15} /><p className="font-mono text-[9px] uppercase tracking-[0.13em]">Expert workspace</p></div><p className="mt-3 font-['Rajdhani'] text-lg font-semibold text-white">{EXPERT_WORKSPACE_BY_ID.pressure.label}</p><p className="mt-2 text-sm leading-6 text-slate-500">Inspect domain scoring, stress mechanics, and the quantitative evidence beneath the current pressure reading.</p></Link>
          </div>
        </Section>

        <div className="border-t border-white/10 pt-8 text-center">
          <Link href={CANONICAL_DESTINATION_BY_ID.outlook.path} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-violet-300 transition hover:text-violet-200">Continue to OUTLOOK: what is most likely next? <ArrowRight size={13} /></Link>
        </div>
      </div>
    </main>
  );
}
