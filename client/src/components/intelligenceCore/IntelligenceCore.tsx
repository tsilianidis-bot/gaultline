import { lazy, Suspense } from "react";
import { Circle, Eye } from "lucide-react";
import type { EvidenceInterfaceStatus, IntelligenceEvidenceResponse } from "@shared/intelligenceEvidence";
import { trpc } from "@/lib/trpc";

const IntelligenceCoreVisual = lazy(() => import("./IntelligenceCoreVisual"));

const statusStyle: Record<EvidenceInterfaceStatus, { label: string; color: string; border: string; surface: string }> = {
  CURRENT: { label: "CURRENT", color: "#62e7d5", border: "rgba(98,231,213,0.45)", surface: "rgba(98,231,213,0.08)" },
  DEGRADED: { label: "DEGRADED", color: "#f6c45d", border: "rgba(246,196,93,0.48)", surface: "rgba(246,196,93,0.08)" },
  UNAVAILABLE: { label: "UNAVAILABLE", color: "#8e9aac", border: "rgba(142,154,172,0.42)", surface: "rgba(142,154,172,0.08)" },
  DISABLED: { label: "DISABLED", color: "#6d788a", border: "rgba(109,120,138,0.42)", surface: "rgba(109,120,138,0.08)" },
};

function StatusSurface({ status, reason, loading = false }: { status: EvidenceInterfaceStatus; reason?: string | null; loading?: boolean }) {
  const style = statusStyle[status];
  return <section className="rounded-sm border bg-[#070a0f] p-5" style={{ borderColor: style.border }} data-intelligence-core={status.toLowerCase()}><div className="flex flex-wrap items-center gap-2"><Eye size={15} style={{ color: style.color }} /><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-100">Intelligence Core</p><span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[8px] font-semibold tracking-[0.14em]" style={{ color: style.color, borderColor: style.border, background: style.surface }}><Circle size={6} fill="currentColor" />{style.label}</span></div><p className="mt-3 text-sm leading-6 text-slate-300">{loading ? "Checking the feature-gated verified-evidence interface…" : reason ?? "A verified evidence record is not available for current presentation."}</p><p className="mt-2 text-xs leading-5 text-slate-500">The canonical market state remains the authority. No placeholder system map is shown as live intelligence.</p></section>;
}

/** Small rollout boundary; it never imports WebGL when the visual flag is off. */
export default function IntelligenceCore() {
  const query = trpc.intelligenceEvidence.visual.useQuery(undefined, { staleTime: 60_000, retry: false, refetchOnWindowFocus: false });
  if (query.isLoading) return <StatusSurface status="DISABLED" loading />;
  if (query.error) return <StatusSurface status="UNAVAILABLE" reason="Verified evidence could not be retrieved by this authorized session. The Core withholds the visual map rather than rendering an inferred substitute." />;
  if (!query.data || query.data.status === "DISABLED") return <StatusSurface status="DISABLED" reason={query.data?.reason} />;
  if (!query.data.snapshot) return <StatusSurface status={query.data.status} reason={query.data.reason} />;
  return <Suspense fallback={<StatusSurface status="UNAVAILABLE" loading reason="Loading the verified visual evidence record…" />}><IntelligenceCoreVisual response={query.data as IntelligenceEvidenceResponse} /></Suspense>;
}
