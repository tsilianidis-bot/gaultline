import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import PageHeader from "@/components/PageHeader";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";
import {
  emptyPublicTrackRecord,
  type PublicChronologyItem,
  type PublicMetric,
  type PublicTrackRecord,
  type ResolutionStatus,
} from "@shared/intelligenceAccountability";

type ViewMode = "example" | "empty" | "live";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date) + " UTC";
}

function formatMetric(metric: PublicMetric): string {
  if (metric.status !== "reported" || metric.value == null) return "Insufficient evidence";
  if (metric.unit === "days") {
    const days = Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(1);
    return `${days} days`;
  }
  return `${(metric.value * 100).toFixed(1)}%`;
}

function statusStyle(status: ResolutionStatus): { label: string; color: string; border: string } {
  if (status === "supported") return { label: "Supported", color: "#34d399", border: "rgba(52,211,153,0.35)" };
  if (status === "contradicted") return { label: "Contradicted", color: "#fb7185", border: "rgba(251,113,133,0.35)" };
  return { label: "Unresolved", color: "#a1a1aa", border: "rgba(161,161,170,0.35)" };
}

function MetricCard({ metric, regime }: { metric: PublicMetric; regime?: string }) {
  const withheld = metric.status !== "reported";
  return (
    <article
      data-testid={`metric-${metric.id}${regime ? `-${regime}` : ""}`}
      className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{regime ?? "Measurement"}</p>
      <h3 className="mt-2 text-sm leading-5 text-zinc-200">{metric.label}</h3>
      <p className={`mt-3 font-['Rajdhani'] text-2xl font-semibold ${withheld ? "text-zinc-400" : "text-white"}`}>
        {formatMetric(metric)}
      </p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{metric.detail}</p>
    </article>
  );
}

function ChronologyCard({ item }: { item: PublicChronologyItem }) {
  const status = statusStyle(item.currentStatus);
  return (
    <article data-testid="chronology-item" className="rounded-xl border border-zinc-800 bg-zinc-950/50">
      <header className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">{item.provenanceLabel}</p>
          <h3 className="mt-2 text-base font-medium leading-6 text-white">{item.summary}</h3>
          <p className="mt-2 font-mono text-xs text-zinc-500">{formatWhen(item.assessedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">
            Pressure Index {item.pressureIndex == null ? "not recorded" : item.pressureIndex}
          </span>
          <span className="rounded border border-zinc-700 px-2 py-1 font-mono text-[11px] text-zinc-300">
            {item.regime ?? "Regime not recorded"}
          </span>
          <span className="rounded border px-2 py-1 font-mono text-[11px]" style={{ color: status.color, borderColor: status.border }}>
            {status.label}
          </span>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-3 sm:px-5">
        {item.scenarios.map(scenario => (
          <div key={scenario.id} className="rounded-lg border border-zinc-800 bg-black/30 p-3">
            <p className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">SCENARIO {scenario.id}</p>
            <p className="mt-2 text-sm leading-5 text-zinc-200">{scenario.expectation}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Invalidation: {scenario.invalidation}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-zinc-800 px-4 py-4 sm:px-5 lg:grid-cols-2">
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Verified observations</h4>
          {item.supportingObservations.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No verified observation was attached.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {item.supportingObservations.map(observation => (
                <li key={`${observation.observedAt}-${observation.source}`} className="text-sm leading-5 text-zinc-300">
                  <span className="block font-mono text-[11px] text-zinc-500">{formatWhen(observation.observedAt)} · {observation.source}</span>
                  {observation.statement}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Later observations</h4>
          {item.developments.length === 0 && item.resolutions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">Unresolved. No later observation has been appended.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {item.developments.map(development => (
                <li key={development.observedAt + development.statement} className="text-sm leading-5 text-zinc-300">
                  <span className="block font-mono text-[11px] text-zinc-500">{formatWhen(development.observedAt)}</span>
                  {development.statement}
                </li>
              ))}
              {item.resolutions.map(resolution => (
                <li key={resolution.resolvedAt + resolution.statement} className="text-sm leading-5 text-zinc-300">
                  <span className="block font-mono text-[11px]" style={{ color: statusStyle(resolution.status).color }}>
                    {formatWhen(resolution.resolvedAt)} · {statusStyle(resolution.status).label}
                  </span>
                  {resolution.statement}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

export function IntelligenceTrackRecordView({ record, mode }: { record: PublicTrackRecord; mode: ViewMode }) {
  return (
    <div data-testid="intelligence-track-record" data-track-record-state={mode} className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-black/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="text-sm font-bold tracking-widest text-white">FAULTLINE</Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/track-record" className="hover:text-white">Historical archive</Link>
            <Link href="/methodology" className="hidden hover:text-white sm:inline">Methodology</Link>
            <Link href="/app" className="rounded border border-zinc-700 px-3 py-1.5 hover:border-zinc-500 hover:text-white">Open Platform</Link>
          </nav>
        </div>
      </header>
      <PageHeader
        title="Intelligence Track Record"
        subtitle="What was recorded, what was observed later, and what remains unresolved."
        badge={mode === "example" ? "EXAMPLE DATA" : "ACCOUNTABILITY"}
        badgeColor={mode === "example" ? "amber" : "gray"}
        showBack={false}
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {mode === "example" && (
          <div className="mb-8 rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm leading-6 text-amber-100">
            EXAMPLE DATA. These rows are fixtures for review. They are not forward-recorded production assessments and they are excluded from every measurement.
          </div>
        )}
        <section className="mb-10 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Accountability record</p>
          <h2 className="mt-3 font-['Rajdhani'] text-3xl font-semibold leading-tight text-white sm:text-5xl">
            Original assessments, next to what happened later.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            This page lists recorded assessments in time order, including ones that were later contradicted. The historical Pressure Index archive is a separate reconstruction and is not mixed into these rows or into any figure.
          </p>
        </section>

        <section className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ledger inventory">
          {[
            ["Forward-recorded", record.inventory.forwardRecorded],
            ["Unresolved", record.inventory.unresolvedForward],
            ["Historical reconstructions", record.inventory.historicalReconstructions],
            ["Example rows", record.inventory.exampleRows],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="font-['Rajdhani'] text-3xl font-semibold text-white">{value}</div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">{label}</div>
            </div>
          ))}
        </section>
        <p className="mb-10 text-xs leading-5 text-zinc-500">Inventory counts are not a measure of skill. Unresolved assessments stay unresolved.</p>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white">Measurements</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            A figure appears only after the minimum number of real forward observations. Until then the status is insufficient evidence.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {record.metrics.map(metric => <MetricCard key={metric.id} metric={metric} />)}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {record.regimeMetrics.length === 0 ? (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <h3 className="text-sm text-zinc-200">Resolved assessments by recorded regime</h3>
                <p className="mt-3 font-['Rajdhani'] text-2xl text-zinc-400">Insufficient evidence</p>
              </article>
            ) : record.regimeMetrics.map(metric => (
              <MetricCard key={metric.regime} metric={metric} regime={metric.regime} />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-white">Chronological record</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Each card keeps the original assessment, the verified observations attached to it, and every later append. Supported and contradicted outcomes are shown the same way.
          </p>
          {record.chronology.length === 0 ? (
            <div className="mt-5 rounded-xl border border-zinc-800 px-4 py-8 text-sm leading-6 text-zinc-400">
              No assessments are published. Insufficient evidence. Unresolved.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {record.chronology.map(item => <ChronologyCard key={item.assessmentKey} item={item} />)}
            </div>
          )}
        </section>

        <section className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Methodology</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
              {record.methodology.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Limitations</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
              {record.limitations.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </section>
      </main>
      <footer className="border-t border-zinc-800/80 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{PUBLIC_DISCLAIMER}</p>
          <div className="flex gap-4">
            <Link href="/track-record" className="hover:text-zinc-300">Historical Pressure Index archive</Link>
            <Link href="/legal" className="hover:text-zinc-300">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ExamplePreview() {
  const [record, setRecord] = useState<PublicTrackRecord | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("@shared/intelligenceAccountability").then(mod => {
      if (!cancelled) setRecord(mod.examplePublicTrackRecord());
    });
    return () => { cancelled = true; };
  }, []);
  if (!record) return <div className="min-h-screen bg-black px-6 py-16 text-sm text-zinc-500">Loading example preview.</div>;
  return <IntelligenceTrackRecordView record={record} mode="example" />;
}

function previewMode(): ViewMode | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview === "example" || preview === "empty") return preview;
  return null;
}

export default function IntelligenceTrackRecord() {
  useSEO({
    title: "Intelligence Track Record | FAULTLINE",
    description: "Chronological record of FAULTLINE assessments and later observations. Figures stay withheld until enough forward observations exist. Not investment advice.",
    canonical: "/intelligence-track-record",
  });
  const preview = previewMode();
  const query = trpc.intelligenceAccountability.publicRecord.useQuery(undefined, { retry: false, enabled: preview == null });
  if (import.meta.env.DEV && preview === "example") return <ExamplePreview />;
  if (preview === "empty") return <IntelligenceTrackRecordView record={emptyPublicTrackRecord()} mode="empty" />;
  if (query.isLoading) {
    return <div className="min-h-screen bg-black px-6 py-16 text-sm text-zinc-500">Loading the accountability record.</div>;
  }
  if (!query.data || query.data.enabled !== true) {
    return (
      <div data-testid="intelligence-track-record" data-track-record-state="unpublished" className="min-h-screen bg-black text-white">
        <main className="mx-auto max-w-xl px-4 py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Accountability record</p>
          <h1 className="mt-3 font-['Rajdhani'] text-4xl font-semibold">This record is not published.</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-400">No assessments or figures are shown while publication is off.</p>
          <p className="mt-6 text-xs leading-5 text-zinc-500">{PUBLIC_DISCLAIMER}</p>
        </main>
      </div>
    );
  }
  return <IntelligenceTrackRecordView record={query.data} mode="live" />;
}
