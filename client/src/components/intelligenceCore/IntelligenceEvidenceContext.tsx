import { Database, Eye, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

type ContextMode = "why" | "outlook" | "watch" | "act";

const COPY: Record<ContextMode, { label: string; title: string; detail: string }> = {
  why: {
    label: "Verified evidence context",
    title: "Source status beneath the causal explanation",
    detail: "This read-only context lists validated source availability. It does not turn source support into a causal claim.",
  },
  outlook: {
    label: "Verified evidence boundary",
    title: "Current source coverage beside the scenario set",
    detail: "The evidence map is not a probability update, forecast horizon, or scenario confirmation.",
  },
  watch: {
    label: "Verified monitoring context",
    title: "Source availability before a watch posture changes",
    detail: "Unavailable evidence is shown as unavailable; it is not transformed into a watch trigger or calm condition.",
  },
  act: {
    label: "Decision evidence boundary",
    title: "Verified inputs beside the decision posture",
    detail: "This source record does not generate an individualized action, allocation, or recommendation.",
  },
};

const tone = (status: "healthy" | "degraded" | "unavailable") => status === "healthy" ? "#62e7d5" : status === "degraded" ? "#f6c45d" : "#8e9aac";

/** Compact evidence context; hidden until the separately gated Core visual surface is enabled. */
export function IntelligenceEvidenceContext({ mode }: { mode: ContextMode }) {
  const query = trpc.intelligenceEvidence.visual.useQuery(undefined, { staleTime: 60_000, retry: false, refetchOnWindowFocus: false });
  const payload = query.data;
  if (!payload || payload.status === "DISABLED" || !payload.snapshot) return null;
  const copy = COPY[mode];
  return (
    <section className="mt-6 rounded-sm border border-amber-300/15 bg-[#090b10] p-4" data-intelligence-evidence-context={mode}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><Database size={16} className="mt-0.5 text-amber-200" /><div><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-amber-200/80">{copy.label}</p><h2 className="mt-1 font-['Rajdhani'] text-xl font-semibold text-white">{copy.title}</h2></div></div><span className="rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-amber-100">{payload.status}</span></div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{copy.detail}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{payload.snapshot.providerHealth.map(provider => <div key={provider.id} className="rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2"><div className="flex items-center justify-between gap-2"><p className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-400">{provider.label}</p><span className="h-2 w-2 rounded-full" style={{ background: tone(provider.status) }} /></div><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.11em]" style={{ color: tone(provider.status) }}>{provider.status}</p></div>)}</div>
      <div className="mt-4 flex items-start gap-2 border-t border-white/8 pt-3 text-xs leading-5 text-slate-500"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-slate-500" />Original source timestamps and per-observation validation remain available in the Intelligence Core on NOW. No new score is calculated here.</div>
    </section>
  );
}
