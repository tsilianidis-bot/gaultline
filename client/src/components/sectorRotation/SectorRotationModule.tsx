/**
 * FAULTLINE Sector Rotation Map™ + Top 5 Winners / Losers, integrated into the
 * Pentagonal Thesis five questions (NOW / WHY / OUTLOOK / WATCH / ACT).
 *
 * Render-only: every number and sentence comes from the server-computed
 * SectorRotationReading (server/sectorRotation/calc.ts). This component never
 * computes rankings, scores, catalysts or probabilities and never substitutes a
 * value — missing data is shown as Unavailable / Stale with its as-of time.
 */
import type { ReactElement } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CANONICAL_DESTINATION_BY_ID } from "@shared/routeRegistry";
import { formatEt } from "@shared/credibilityLabels";
import {
  ACTION_LABEL, ARROW_GLYPH, CATALYST_LABEL, LEADERSHIP_GROUP_LABEL, QUADRANT_LABEL,
  type DailyChangeBasis, type LeadershipGroup, type MoverRow, type Quadrant, type SectorActionClass, type SectorRotationReading, type SectorRotationServed, type SectorRow,
} from "@shared/sectorRotation";

export type ThesisQuestion = "now" | "why" | "outlook" | "watch" | "act";
export const SECTOR_ROTATION_ANCHOR = "sector-rotation";

const QUADRANT_STYLE: Record<Quadrant, { color: string; title: string }> = {
  LEADING: { color: "#00e599", title: "LEADING" },
  IMPROVING: { color: "#00e5ff", title: "IMPROVING" },
  LOSING_MOMENTUM: { color: "#ffaa00", title: "LOSING MOMENTUM" },
  LAGGING: { color: "#ff4d6d", title: "LAGGING" },
};
const ACTION_COLOR: Record<SectorActionClass, string> = {
  OVERWEIGHT: "#00e599", WATCH_FOR_CONFIRMATION: "#00e5ff", NEUTRAL: "#94a3b8", UNDERWEIGHT: "#ffaa00", AVOID: "#ff4d6d",
};
const MAP_ORDER: Quadrant[] = ["IMPROVING", "LEADING", "LAGGING", "LOSING_MOMENTUM"];

export function useSectorRotation() {
  // Own HTTP request (skipBatch → splitLink in main.tsx): never batched with marketState.current.
  return trpc.sectorRotation.current.useQuery(undefined, { staleTime: 5 * 60_000, refetchOnWindowFocus: false, retry: 1, trpc: { context: { skipBatch: true } } });
}

const signed = (x: number | null | undefined, unit = "%") =>
  x == null || !Number.isFinite(x) ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}${unit}`;
const toneOf = (x: number | null | undefined) => (x == null ? "text-slate-500" : x > 0 ? "text-emerald-300" : x < 0 ? "text-rose-300" : "text-slate-300");

export function basisLabel(basis: DailyChangeBasis | null | undefined): string {
  if (!basis) return "Daily change unavailable";
  if (basis.kind === "INTRADAY") return `Intraday · as of ${formatEt(basis.asOf) ?? "time not reported"}`;
  return `Session close ${basis.sessionDate}`;
}

function Shell({ question, children, title, subtitle }: { question: ThesisQuestion; children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <section id={SECTOR_ROTATION_ANCHOR} data-sector-rotation={question} className="mt-6 rounded border border-white/10 bg-[#060a10] p-5 md:p-7" aria-labelledby={`sector-rotation-${question}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">{subtitle}</p>
          <h2 id={`sector-rotation-${question}-title`} className="mt-1 font-['Rajdhani'] text-2xl font-semibold text-white md:text-[28px]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StateLine({ reading, served }: { reading: SectorRotationReading; served: SectorRotationServed }) {
  return (
    <>
      <p className="mt-2 font-mono text-[9px] uppercase leading-5 tracking-[0.12em] text-slate-500" data-sector-rotation-asof>
        Snapshot · completed session {reading.benchmark.latestCompletedSession ?? "unavailable"} · Daily %: {basisLabel(reading.benchmark.dailyBasis)} · Computed {formatEt(reading.generatedAt) ?? "—"} · {reading.methodVersion}
        {reading.status !== "OK" && <span className="ml-2 rounded border border-amber-300/40 px-1.5 py-0.5 text-amber-300">{reading.status}</span>}
        {served.freshness === "STALE" && <span className="ml-2 rounded border border-amber-300/40 px-1.5 py-0.5 text-amber-300" data-sector-rotation-stale>STALE</span>}
      </p>
      {served.freshness === "STALE" && served.freshnessReason && (
        <p className="mt-1 text-xs leading-5 text-amber-200/80" data-sector-rotation-stale-reason>
          {served.freshnessReason}{served.lastRefresh.nextAttemptAfter ? ` Next attempt after ${formatEt(served.lastRefresh.nextAttemptAfter) ?? served.lastRefresh.nextAttemptAfter}.` : ""}
        </p>
      )}
    </>
  );
}

function Unavailable({ question, title, subtitle, detail }: { question: ThesisQuestion; title: string; subtitle: string; detail: string }) {
  return (
    <Shell question={question} title={title} subtitle={subtitle}>
      <div className="mt-4 rounded border border-amber-300/25 bg-amber-300/[0.04] p-4" data-sector-rotation-unavailable>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">Unavailable</p>
        <p className="mt-1 text-sm text-slate-300">{detail}</p>
      </div>
    </Shell>
  );
}

function useReadingOrState(question: ThesisQuestion, title: string, subtitle: string) {
  const query = useSectorRotation();
  if (query.isLoading) return { node: <Shell question={question} title={title} subtitle={subtitle}><p className="mt-4 text-sm text-slate-500">Loading the latest saved sector rotation snapshot…</p></Shell>, reading: null, served: null };
  if (query.error || !query.data) return { node: <Unavailable question={question} title={title} subtitle={subtitle} detail="Sector rotation data could not be loaded. No values are shown in its place." />, reading: null, served: null };
  const served = query.data as SectorRotationServed;
  if (served.freshness === "UNAVAILABLE" || !served.reading) {
    return { node: <Unavailable question={question} title={title} subtitle={subtitle} detail={served.freshnessReason ?? "No saved sector rotation snapshot is available. No values are shown in its place."} />, reading: null, served: null };
  }
  const reading = served.reading;
  if (reading.status === "UNAVAILABLE") {
    const reasons = reading.missingData.filter(m => m.id === "SPY" || m.status === "UNAVAILABLE").slice(0, 3).map(m => m.reason).join(" ");
    return { node: <Unavailable question={question} title={title} subtitle={subtitle} detail={`Sector rankings are withheld until benchmark and sector bars are available. ${reasons}`} />, reading: null, served: null };
  }
  return { node: null, reading, served };
}

// ── NOW: the Map ─────────────────────────────────────────────────────────────

function SectorChip({ s }: { s: SectorRow }) {
  const st = QUADRANT_STYLE[s.quadrant!];
  return (
    <span className="inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] text-slate-100" style={{ borderColor: `${st.color}40`, background: `${st.color}0d` }} title={`${s.sector} · RS-Ratio ${s.rsRatio?.toFixed(2)} · RS-Momentum ${s.rsMomentum?.toFixed(2)} · rank ${s.rank}`} data-sector-chip={s.ticker}>
      <span className="font-semibold">{s.ticker}</span>
      <span style={{ color: st.color }} aria-label={`momentum ${s.arrow}`}>{ARROW_GLYPH[s.arrow!]}</span>
      <span className="text-slate-500">#{s.rank}</span>
      {s.rankChange != null && s.rankChange !== 0 && <span className={s.rankChange > 0 ? "text-emerald-300" : "text-rose-300"}>{s.rankChange > 0 ? `▲${s.rankChange}` : `▼${Math.abs(s.rankChange)}`}</span>}
    </span>
  );
}

function RotationMap({ reading }: { reading: SectorRotationReading }) {
  const ranked = reading.sectors.filter(s => s.status === "RANKED");
  const unavailable = reading.sectors.filter(s => s.status === "UNAVAILABLE");
  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-white/10 bg-white/10" data-sector-rotation-map>
        {MAP_ORDER.map(q => {
          const st = QUADRANT_STYLE[q];
          const items = ranked.filter(s => s.quadrant === q);
          return (
            <div key={q} className="min-h-[112px] bg-[#070b12] p-3 md:p-4" data-quadrant={q}>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: st.color }}>{st.title}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {items.length ? items.map(s => <SectorChip key={s.ticker} s={s} />) : <span className="text-xs text-slate-600">None</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
        <span>X: RS-Ratio vs SPY (≥100 right) · Y: RS-Momentum (≥100 top) · ↑ → ↓ momentum · #rank by RS-Ratio · ▲▼ vs prior session</span>
        {unavailable.length > 0 && <span className="text-amber-300/80" data-sector-unavailable>Unavailable (not ranked): {unavailable.map(s => s.ticker).join(", ")}</span>}
      </div>
    </div>
  );
}

function RankingTable({ reading }: { reading: SectorRotationReading }) {
  return (
    <details className="mt-4 rounded border border-white/10 bg-white/[0.02]" data-sector-ranking>
      <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Sector ranking detail · 11 Select Sector SPDRs</summary>
      <div className="overflow-x-auto px-2 pb-3">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
            <tr><th className="px-2 py-2">#</th><th className="px-2">Sector</th><th className="px-2">Daily</th><th className="px-2">5D</th><th className="px-2">20D</th><th className="px-2">vs SPY 20D</th><th className="px-2">RS-Ratio</th><th className="px-2">RS-Mom</th><th className="px-2">Breadth &gt;50D</th><th className="px-2">Quadrant</th></tr>
          </thead>
          <tbody>
            {reading.sectors.map(s => (
              <tr key={s.ticker} className="border-t border-white/5 text-slate-300">
                <td className="px-2 py-1.5 font-mono">{s.rank ?? "—"}{s.rankChange ? <span className={s.rankChange > 0 ? "ml-1 text-emerald-300" : "ml-1 text-rose-300"}>{s.rankChange > 0 ? "▲" : "▼"}{Math.abs(s.rankChange)}</span> : null}</td>
                <td className="px-2"><span className="font-mono font-semibold text-white">{s.ticker}</span> <span className="text-slate-500">{s.sector}</span></td>
                {s.status === "UNAVAILABLE" ? <td colSpan={8} className="px-2 text-amber-300/80">Unavailable — {s.unavailableReason}</td> : <>
                  <td className={`px-2 font-mono ${toneOf(s.dailyChangePct)}`}>{signed(s.dailyChangePct)}</td>
                  <td className={`px-2 font-mono ${toneOf(s.return5dPct)}`}>{signed(s.return5dPct)}</td>
                  <td className={`px-2 font-mono ${toneOf(s.return20dPct)}`}>{signed(s.return20dPct)}</td>
                  <td className={`px-2 font-mono ${toneOf(s.relReturn20dPct)}`}>{signed(s.relReturn20dPct, " pp")}</td>
                  <td className="px-2 font-mono">{s.rsRatio?.toFixed(2)}</td>
                  <td className="px-2 font-mono">{s.rsMomentum?.toFixed(2)} {ARROW_GLYPH[s.arrow!]}</td>
                  <td className="px-2 font-mono">{s.breadth.pctAboveSma != null ? `${s.breadth.pctAboveSma.toFixed(1)}%` : <span className="text-amber-300/80" title={s.breadth.reason ?? ""}>Unavailable</span>}</td>
                  <td className="px-2 font-mono" style={{ color: QUADRANT_STYLE[s.quadrant!].color }}>{QUADRANT_LABEL[s.quadrant!]}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 pt-2 text-[10px] leading-4 text-slate-600">Daily: {basisLabel(reading.benchmark.dailyBasis)}. 5D / 20D / RS / breadth use completed daily bars only (a session counts after 4 PM ET + 60 min). Breadth = constituents above their 50-session average.</p>
      </div>
    </details>
  );
}

function MoverCard({ m }: { m: MoverRow }) {
  const cls = m.catalyst.class;
  return (
    <li className="border-t border-white/5 py-3 first:border-t-0" data-mover={m.ticker}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-white">{m.ticker} <span className="ml-1 font-sans text-xs font-normal text-slate-400">{m.company}</span></p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-500">{m.sector} · {m.sectorEtf}</p>
        </div>
        <p className={`shrink-0 font-['Rajdhani'] text-xl font-semibold ${toneOf(m.todayPct)}`}>{signed(m.todayPct)}</p>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400">
        <span>5D <span className={toneOf(m.return5dPct)}>{m.return5dPct != null ? signed(m.return5dPct) : <span className="text-amber-300/80" title={m.return5dReason ?? ""}>Unavailable</span>}</span></span>
        <span>Vol vs normal {m.volumeRatio != null ? <span className="text-slate-200">{m.volumeRatio.toFixed(1)}×</span> : <span className="text-slate-500" title={m.volumeRatioReason ?? ""}>Unavailable</span>}</span>
        <span className={cls === "CATALYST_UNCLEAR" ? "text-slate-500" : "text-cyan-300"}>{CATALYST_LABEL[cls]}</span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-300" data-mover-why>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Why: </span>
        {m.catalyst.news ? <>“{m.catalyst.why}” <a href={m.catalyst.news.url} target="_blank" rel="noreferrer noopener" className="text-slate-500 underline-offset-2 hover:underline">— {m.catalyst.news.publisher}, {formatEt(m.catalyst.news.publishedAt) ?? m.catalyst.news.publishedAt}</a></> : m.catalyst.why}
      </p>
    </li>
  );
}

function MoversPanel({ reading }: { reading: SectorRotationReading }) {
  const mv = reading.movers;
  if (mv.status === "UNAVAILABLE") {
    return (
      <div className="mt-5 rounded border border-amber-300/25 bg-amber-300/[0.04] p-4" data-movers-unavailable>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">Today's Top 5 Winners / Losers · Unavailable</p>
        <p className="mt-1 text-sm text-slate-300">{mv.reason}</p>
      </div>
    );
  }
  const col = (title: string, rows: MoverRow[], accent: string, side: string) => (
    <div className="rounded border border-white/10 bg-[#070b12] p-4" data-movers-side={side}>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: accent }}>{title}</p>
      {rows.length ? <ul className="mt-2">{rows.map(m => <MoverCard key={m.ticker} m={m} />)}</ul> : <p className="mt-3 text-xs text-slate-500">No constituent moved {side === "winners" ? "up" : "down"} on this basis.</p>}
    </div>
  );
  return (
    <div className="mt-5" data-sector-movers>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-['Rajdhani'] text-lg font-semibold text-white">Today's Top 5 Winners / Top 5 Losers</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{basisLabel(mv.basis)} · {mv.universe.ranked} of {mv.universe.total} S&amp;P 500 constituents ranked · list as of {mv.universe.asOf ?? "—"}{mv.universe.status === "STALE" ? " (stale)" : ""}</p>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {col("Top 5 winners", mv.winners, "#00e599", "winners")}
        {col("Top 5 losers", mv.losers, "#ff4d6d", "losers")}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-600">
        Why = mechanical catalyst rule: dated, ticker-tagged news item (event keywords → EVENT-DRIVEN; otherwise COMPANY-SPECIFIC when the sector ETF does not explain the move), else sector or SPY co-move, else CATALYST UNCLEAR.
        {mv.newsStatus !== "OK" && <span className="text-amber-300/80"> News source unavailable ({mv.newsReason}); company/event catalysts cannot be assigned.</span>}
        {mv.reason && <span> {mv.reason}</span>}
      </p>
    </div>
  );
}

const QUESTION_LINKS: Array<{ id: ThesisQuestion; label: string; key: keyof SectorRotationReading["narrative"] }> = [
  { id: "now", label: "What's happening", key: "happening" },
  { id: "why", label: "Why", key: "why" },
  { id: "outlook", label: "What's next", key: "next" },
  { id: "watch", label: "What to watch", key: "watch" },
  { id: "act", label: "What to do", key: "act" },
];

export function SectorRotationMap() {
  const title = "FAULTLINE Sector Rotation Map™";
  const subtitle = "Market leadership · 11 S&P 500 sectors vs SPY";
  const { node, reading, served } = useReadingOrState("now", title, subtitle);
  if (!reading) return node;
  return (
    <Shell question="now" title={title} subtitle={subtitle}>
      <StateLine reading={reading} served={served!} />
      <RotationMap reading={reading} />
      <p className="mt-4 border-l-2 border-cyan-300/60 bg-cyan-300/[0.04] px-4 py-3 text-sm leading-6 text-slate-200" data-why-it-matters>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Why it matters: </span>
        {reading.narrative.whyItMatters ?? "Withheld — the summary could not be verified against the computed data."}
      </p>
      <MoversPanel reading={reading} />
      <div className="mt-5 grid gap-2 md:grid-cols-5" data-sector-five-questions>
        {QUESTION_LINKS.map((q, i) => {
          const dest = CANONICAL_DESTINATION_BY_ID[q.id];
          const text = reading.narrative[q.key];
          return (
            <Link key={q.id} href={`${dest.path}#${SECTOR_ROTATION_ANCHOR}`} className="group flex flex-col rounded border border-white/10 bg-white/[0.02] p-3 transition hover:border-cyan-300/40">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-300">0{i + 1} · {q.label}</p>
              <p className="mt-2 line-clamp-4 text-[11px] leading-[1.15rem] text-slate-400">{text ?? "Unavailable"}</p>
              <span className="mt-auto pt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500 group-hover:text-cyan-300">{dest.label} <ArrowRight className="inline" size={10} /></span>
            </Link>
          );
        })}
      </div>
      <RankingTable reading={reading} />
    </Shell>
  );
}

// ── WHY / OUTLOOK / WATCH / ACT slices ───────────────────────────────────────

function WhySlice({ reading }: { reading: SectorRotationReading }) {
  const movers = [...reading.movers.winners, ...reading.movers.losers];
  const links = reading.driverLinks.filter(l => l.observed === "CONSISTENT" || l.observed === "DIVERGING");
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Measured macro inputs</p>
        <ul className="mt-2 divide-y divide-white/5 rounded border border-white/10">
          {reading.drivers.map(d => (
            <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs" data-driver={d.id}>
              <div><p className="text-slate-200">{d.label}</p><p className="font-mono text-[9px] text-slate-600">{d.source}{d.asOf ? ` · as of ${d.asOf}` : ""}</p></div>
              {d.status === "UNAVAILABLE"
                ? <span className="shrink-0 font-mono text-[10px] text-amber-300/80" title={d.reason ?? ""}>Unavailable</span>
                : <span className="shrink-0 text-right font-mono text-[10px] text-slate-300">{d.latest}{d.latestUnit === "%" ? "%" : d.latestUnit === "level" ? "" : ` ${d.latestUnit}`}{d.change != null && <span className={toneOf(d.change)}> {signed(d.change, d.changeUnit === "%" ? "%" : ` ${d.changeUnit}`)}</span>}<br /><span className="text-slate-500">{d.direction}{d.status === "STALE" ? " · STALE" : ""}</span></span>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Observed co-movement (not established causation)</p>
        <ul className="mt-2 space-y-2">
          {links.length ? links.map(l => <li key={`${l.sector}-${l.driver}`} className={`border-l-2 pl-3 text-xs leading-5 ${l.observed === "CONSISTENT" ? "border-emerald-300/50 text-slate-300" : "border-amber-300/50 text-slate-400"}`}>{l.text}</li>) : <li className="text-xs text-slate-500">No sector–driver pair has a measurable joint direction.</li>}
        </ul>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Top-mover catalysts</p>
        {reading.movers.status === "UNAVAILABLE" ? <p className="mt-2 text-xs text-amber-300/80">{reading.movers.reason}</p> : (
          <ul className="mt-2 space-y-1.5">
            {movers.map(m => <li key={m.ticker} className="text-xs leading-5 text-slate-300"><span className="font-mono text-white">{m.ticker}</span> <span className={toneOf(m.todayPct)}>{signed(m.todayPct)}</span> · <span className="font-mono text-[10px] text-cyan-300/80">{CATALYST_LABEL[m.catalyst.class]}</span>{m.catalyst.class === "CATALYST_UNCLEAR" ? null : <> — {m.catalyst.news ? <>“{m.catalyst.why}” ({m.catalyst.news.publisher}, {formatEt(m.catalyst.news.publishedAt)})</> : m.catalyst.why}</>}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function OutlookSlice({ reading }: { reading: SectorRotationReading }) {
  const groups: LeadershipGroup[] = ["CURRENT_LEADERSHIP", "EMERGING_LEADERSHIP", "DETERIORATING_LEADERSHIP", "CONFIRMED_WEAKNESS"];
  const groupColor: Record<LeadershipGroup, string> = { CURRENT_LEADERSHIP: "#00e599", EMERGING_LEADERSHIP: "#00e5ff", DETERIORATING_LEADERSHIP: "#ffaa00", CONFIRMED_WEAKNESS: "#ff4d6d" };
  const movers = [...reading.movers.winners.map(m => ({ m, side: "Winner" })), ...reading.movers.losers.map(m => ({ m, side: "Loser" }))];
  return (
    <div className="mt-4">
      <div className="grid gap-2 md:grid-cols-4">
        {groups.map(g => {
          const items = reading.sectors.filter(s => s.leadershipGroup === g);
          return (
            <div key={g} className="rounded border border-white/10 bg-white/[0.02] p-3" data-leadership-group={g}>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: groupColor[g] }}>{LEADERSHIP_GROUP_LABEL[g]}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {items.length ? items.map(s => <li key={s.ticker}><span className="font-mono text-white">{s.ticker}</span> {ARROW_GLYPH[s.arrow!]} <span className="text-slate-500">{s.sessionsInQuadrant} session{s.sessionsInQuadrant === 1 ? "" : "s"} in quadrant</span></li>) : <li className="text-slate-600">None</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {reading.leadershipChanges.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-400">{reading.leadershipChanges.map(c => <li key={c.ticker}>{c.text}</li>)}</ul>}
      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Do today's movers reinforce or contradict the sector map?</p>
      {reading.movers.status === "UNAVAILABLE" ? <p className="mt-2 text-xs text-amber-300/80">{reading.movers.reason}</p> : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {movers.map(({ m, side }) => <span key={m.ticker} className={`rounded border px-2 py-1 font-mono text-[10px] ${m.thesisAlignment === "REINFORCES" ? "border-emerald-300/30 text-emerald-200" : m.thesisAlignment === "CONTRADICTS" ? "border-amber-300/30 text-amber-200" : "border-white/10 text-slate-500"}`}>{side} {m.ticker} · {m.sectorEtf} · {m.thesisAlignment}</span>)}
        </div>
      )}
      <p className="mt-3 text-[10px] leading-4 text-slate-600">Rule: a winner in a Leading/Improving sector or a loser in a Lagging/Losing-momentum sector reinforces; the opposite contradicts. Rotation patterns describe current measured state, not a forecast or probability.</p>
    </div>
  );
}

function WatchSlice({ reading }: { reading: SectorRotationReading }) {
  const early = [...reading.movers.winners, ...reading.movers.losers].filter(m => m.earlyIndicator.flagged);
  const stateStyle = { CONFIRMING: "text-emerald-300 border-emerald-300/30", NOT_CONFIRMING: "text-amber-300 border-amber-300/30", UNAVAILABLE: "text-slate-500 border-white/10" } as const;
  return (
    <div className="mt-4">
      <div className="grid gap-2 md:grid-cols-2">
        {reading.watch.map(w => (
          <div key={w.id} className="rounded border border-white/10 bg-white/[0.02] p-3" data-watch-indicator={w.id}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-white">{w.label}</p>
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${stateStyle[w.state]}`}>{w.state.replace("_", " ")}</span>
            </div>
            <p className="mt-1 font-mono text-[10px] leading-4 text-slate-400">{w.current}</p>
            <p className="mt-2 text-[11px] leading-4 text-slate-400"><span className="text-emerald-300/80">Confirms:</span> {w.confirms}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400"><span className="text-rose-300/80">Invalidates:</span> {w.invalidates}</p>
            <p className="mt-1 font-mono text-[9px] text-slate-600">{w.source}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Possible early indicators among today's movers</p>
      {reading.movers.status === "UNAVAILABLE" ? <p className="mt-2 text-xs text-amber-300/80">{reading.movers.reason}</p> : early.length ? (
        <ul className="mt-2 space-y-1">{early.map(m => <li key={m.ticker} className="text-xs leading-5 text-slate-300">{m.earlyIndicator.text}</li>)}</ul>
      ) : <p className="mt-2 text-xs text-slate-500">No top mover meets the early-indicator rule.</p>}
      <p className="mt-2 text-[10px] leading-4 text-slate-600">{reading.movers.winners[0]?.earlyIndicator.rule ?? reading.movers.losers[0]?.earlyIndicator.rule ?? ""} Thresholds are the RS quadrant lines (100) and stated directional bands only.</p>
    </div>
  );
}

function ActSlice({ reading }: { reading: SectorRotationReading }) {
  const ranked = reading.sectors.filter(s => s.action);
  return (
    <div className="mt-4">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {ranked.map(s => (
          <div key={s.ticker} className="rounded border border-white/10 bg-white/[0.02] p-3" data-sector-action={s.ticker}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-white">{s.ticker} <span className="font-sans text-xs font-normal text-slate-500">{s.sector}</span></p>
              <span className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: ACTION_COLOR[s.action!.class], borderColor: `${ACTION_COLOR[s.action!.class]}50` }}>{ACTION_LABEL[s.action!.class]}</span>
            </div>
            <ul className="mt-2 space-y-0.5">
              {s.action!.evidence.map(e => <li key={e.id} className="flex justify-between gap-2 text-[11px] text-slate-400"><span>{e.passed === true ? "✓" : e.passed === false ? "✗" : "–"} {e.label}</span><span className="font-mono text-slate-300">{e.observed}</span></li>)}
            </ul>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">{s.action!.rule}</p>
          </div>
        ))}
      </div>
      {reading.sectors.some(s => !s.action) && <p className="mt-2 text-xs text-amber-300/80">Unavailable (no class): {reading.sectors.filter(s => !s.action).map(s => s.ticker).join(", ")}</p>}
      <p className="mt-3 text-[10px] leading-4 text-slate-600">Bounded classes from a mechanical rule of rotation quadrant + evidence. They are positioning context, not trade recommendations, and carry no probabilities.</p>
    </div>
  );
}

const SLICE_META: Record<Exclude<ThesisQuestion, "now">, { subtitle: string; title: string; Body: (p: { reading: SectorRotationReading }) => ReactElement }> = {
  why: { subtitle: "Sector rotation · Why", title: "What is moving with sector leadership", Body: WhySlice },
  outlook: { subtitle: "Sector rotation · What's next", title: "Where leadership is rotating", Body: OutlookSlice },
  watch: { subtitle: "Sector rotation · What to watch", title: "What would confirm or invalidate the rotation", Body: WatchSlice },
  act: { subtitle: "Sector rotation · What to do", title: "Sector positioning classes and their evidence", Body: ActSlice },
};

export function SectorRotationQuestion({ question }: { question: Exclude<ThesisQuestion, "now"> }) {
  const meta = SLICE_META[question];
  const { node, reading, served } = useReadingOrState(question, meta.title, meta.subtitle);
  if (!reading) return node;
  const key = question === "outlook" ? "next" : question;
  return (
    <Shell question={question} title={meta.title} subtitle={meta.subtitle}>
      <StateLine reading={reading} served={served!} />
      {reading.narrative[key] && <p className="mt-3 text-sm leading-6 text-slate-300">{reading.narrative[key]}</p>}
      <meta.Body reading={reading} />
      <Link href={`${CANONICAL_DESTINATION_BY_ID.now.path}#${SECTOR_ROTATION_ANCHOR}`} className="mt-4 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-cyan-300 hover:text-cyan-200">Open the Sector Rotation Map <ArrowRight size={11} /></Link>
    </Shell>
  );
}
