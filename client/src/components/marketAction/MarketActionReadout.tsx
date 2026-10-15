import { Activity, Clock3, Eye, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";

type QuestionLens = "now" | "why" | "outlook" | "watch" | "act";

const COPY: Record<QuestionLens, { eyebrow: string; title: string; noEvent: string }> = {
  now: {
    eyebrow: "MARKET ACTION · OBSERVED NOW",
    title: "Material conditions from the latest verified observations",
    noEvent: "No material Market Action threshold is currently met under the available source coverage.",
  },
  why: {
    eyebrow: "MARKET ACTION · VERIFIED DRIVERS",
    title: "Observed inputs behind the active condition",
    noEvent: "No material Market Action condition is active, so no short-horizon driver claim is made.",
  },
  outlook: {
    eyebrow: "MARKET ACTION · WHAT WOULD CONFIRM",
    title: "The next observations that would strengthen or weaken the condition",
    noEvent: "No material Market Action condition is active. OUTLOOK remains governed by the canonical scenario contract.",
  },
  watch: {
    eyebrow: "MARKET ACTION · WATCH CONDITIONS",
    title: "Source-backed conditions to monitor",
    noEvent: "No material Market Action threshold is active. Coverage remains visible so missing data is not treated as calm.",
  },
  act: {
    eyebrow: "MARKET ACTION · DECISION BOUNDARY",
    title: "A measured condition—not a trade instruction",
    noEvent: "No material Market Action condition is active. No action change is implied by this monitor.",
  },
};

function formatEt(iso: string | null | undefined) {
  if (!iso) return "unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unavailable";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
}

function severityTone(severity: string) {
  if (severity === "critical") return "border-rose-300/35 bg-rose-300/[0.07] text-rose-200";
  if (severity === "high") return "border-orange-300/35 bg-orange-300/[0.07] text-orange-100";
  if (severity === "moderate") return "border-amber-300/35 bg-amber-300/[0.07] text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/[0.05] text-cyan-100";
}

/**
 * Shared read-only view of persisted Market Action observations. It never
 * triggers collection and never asserts that an unavailable source is calm.
 */
export function MarketActionReadout({ lens }: { lens: QuestionLens }) {
  const query = trpc.marketAction.current.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const served = query.data;
  const snapshot = served?.snapshot ?? null;
  const event = served?.latestEvent ?? null;
  const copy = COPY[lens];

  return (
    <section data-market-action={lens} className="rounded-sm border border-cyan-300/15 bg-cyan-300/[0.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.17em] text-cyan-200/80">{copy.eyebrow}</p>
          <h2 className="mt-2 text-base font-semibold text-slate-100">{copy.title}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-sm border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-slate-400">
          <Clock3 size={11} className="text-cyan-300/75" /> {served?.freshness ?? "LOADING"}
        </div>
      </div>

      {!snapshot ? (
        <div className="mt-4 flex gap-3 border-l-2 border-amber-300/50 bg-amber-300/[0.04] px-3 py-3 text-xs leading-5 text-amber-50/85">
          <Eye size={15} className="mt-0.5 shrink-0 text-amber-200" />
          <p>{served?.freshnessReason ?? "Loading the saved Market Action monitor. No current condition is inferred until a verified snapshot exists."}</p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs leading-5 text-slate-400">{served?.freshnessReason}</p>
          {event ? (
            <div className={`mt-4 rounded-sm border p-4 ${severityTone(event.severity)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><ShieldAlert size={15} /><span className="font-mono text-[9px] uppercase tracking-[0.14em]">{event.severity} · {event.kind.replaceAll("_", " ")}</span></div>
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] opacity-75">Detected {formatEt(event.detectedAt)}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-100">{event.headline}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{event.inference}</p>
              {lens === "why" && event.evidence.length > 0 && <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">{event.evidence.slice(0, 4).map(item => <p key={item} className="font-mono text-[9px] text-slate-300">{item}</p>)}</div>}
              {(lens === "outlook" || lens === "watch") && event.watchConditions.length > 0 && <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">{event.watchConditions.slice(0, 3).map(item => <p key={item} className="text-xs leading-5 text-slate-300">{item}</p>)}</div>}
              {lens === "act" && <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-300">{event.decisionBoundary}</p>}
            </div>
          ) : (
            <div className="mt-4 flex gap-3 rounded-sm border border-white/10 bg-white/[0.02] p-4 text-xs leading-5 text-slate-400"><Activity size={15} className="mt-0.5 shrink-0 text-cyan-300/75" /><p>{copy.noEvent}</p></div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {snapshot.coverage.map(item => <span key={item.id} title={item.detail} className={`rounded-sm border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.11em] ${item.status === "available" ? "border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100/80" : "border-amber-300/20 bg-amber-300/[0.04] text-amber-100/80"}`}>{item.label}: {item.status === "available" ? item.freshness : "unavailable"}</span>)}
          </div>
          <p className="mt-3 font-mono text-[8px] leading-4 text-slate-600">Latest source observation {formatEt(snapshot.latestObservedAt)} · collection {formatEt(snapshot.capturedAt)} · {snapshot.sourceNote}</p>
        </>
      )}
    </section>
  );
}
