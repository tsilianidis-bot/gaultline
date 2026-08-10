/**
 * V3-H Shadow Monitor — Admin-only dashboard
 * Route: /app/admin/shadow-monitor
 * Access: admin only
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { useState } from "react";
import { CANONICAL_HOME } from "@shared/routeRegistry";

function fmt(n: number | null | undefined, d = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(d);
}

function diffColor(diff: number): string {
  if (Math.abs(diff) >= 10) return "text-red-400";
  if (Math.abs(diff) >= 5) return "text-amber-400";
  return "text-emerald-400";
}

function StatsPanel() {
  const { data: stats } = trpc.admin.getShadowStats.useQuery();
  if (!stats || (stats as any).readingCount === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
        No shadow readings yet. Runs automatically on every pressure engine call.
      </div>
    );
  }
  const s = stats as any;
  const items = [
    { label: "Total Readings", value: s.readingCount?.toString() ?? "—" },
    { label: "Latest V1", value: s.latestV1?.toString() ?? "—" },
    { label: "Latest V3-H", value: s.latestV3H?.toString() ?? "—" },
    { label: "Latest Diff", value: s.latestDiff !== undefined ? (s.latestDiff > 0 ? `+${s.latestDiff}` : s.latestDiff.toString()) : "—" },
    { label: "Avg |Diff|", value: fmt(s.avgAbsDiff) },
    { label: "Regime Agreement", value: `${fmt(s.regimeAgreementRate)}%` },
    { label: "Divergence ≥10", value: s.divergence10Count?.toString() ?? "—" },
    { label: "STLFSI4 Spikes", value: s.stlfsiSpikeCount?.toString() ?? "—" },
    { label: "Fallback Runs", value: s.fallbackCount?.toString() ?? "—" },
    { label: "Latest STLFSI4", value: fmt(s.latestStlfsiRaw, 3) },
    { label: "Latest Z-Score", value: fmt(s.latestStlfsiZ, 2) },
    { label: "Shadow Period End", value: s.shadowPeriodEnd ?? "—" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {items.map(item => (
        <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/40 mb-1">{item.label}</div>
          <div className="text-lg font-mono font-semibold text-white">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ReadingsTable() {
  const [limit, setLimit] = useState(50);
  const { data } = trpc.admin.getShadowReadings.useQuery({ limit });
  const readings = (data as any)?.readings ?? [];
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recent Readings</h3>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/60">
          {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} rows</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {["Time", "V1", "V3-H", "Diff", "V1 Regime", "V3-H Regime", "STLFSI4", "Z", "Flags"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-white/40 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {readings.map((r: any) => {
              const diff = r.scoreDiff;
              const flags = [r.flagDivergence10 && "DIV10", r.flagRegimeDisagreement && "REGIME", r.flagStlfsiSpike && "SPIKE", r.flagFallback && "FALLBACK"].filter(Boolean).join(" ");
              return (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1.5 text-white/40">{new Date(r.readingAt).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-3 py-1.5 text-white">{r.v1Pressure}</td>
                  <td className="px-3 py-1.5 text-white">{r.v3hPressure}</td>
                  <td className={`px-3 py-1.5 font-bold ${diffColor(diff)}`}>{diff > 0 ? `+${diff}` : diff}</td>
                  <td className="px-3 py-1.5 text-white/60 text-xs">{r.v1Regime}</td>
                  <td className="px-3 py-1.5 text-white/60 text-xs">{r.v3hRegime}</td>
                  <td className="px-3 py-1.5 text-white/60">{r.stlfsiRaw ? parseFloat(r.stlfsiRaw).toFixed(3) : "—"}</td>
                  <td className="px-3 py-1.5 text-white/60">{r.stlfsiZ ? parseFloat(r.stlfsiZ).toFixed(2) : "—"}</td>
                  <td className="px-3 py-1.5 text-amber-400 text-xs">{flags || "—"}</td>
                </tr>
              );
            })}
            {readings.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-white/30">No readings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StressAnnotations() {
  const { data } = trpc.admin.getStressAnnotations.useQuery();
  const addAnnotation = trpc.admin.addStressAnnotation.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ eventAt: new Date().toISOString().slice(0, 16), eventType: "credit_widening", title: "", severity: "moderate" as const });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addAnnotation.mutateAsync({ ...form, eventAt: new Date(form.eventAt).toISOString() });
    utils.admin.getStressAnnotations.invalidate();
    setForm(f => ({ ...f, title: "" }));
  };
  const annotations = (data as any)?.annotations ?? [];
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Stress Event Annotations</h3>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg border border-white/10 bg-white/5">
        <input type="datetime-local" value={form.eventAt} onChange={e => setForm(f => ({ ...f, eventAt: e.target.value }))} className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white" />
        <select value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white">
          {["credit_widening", "banking_stress", "equity_selloff", "liquidity_crunch", "fed_action", "macro_shock", "other"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as any }))} className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white">
          {["low", "moderate", "high", "critical"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="text" placeholder="Event title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="flex-1 min-w-32 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/30" />
        <button type="submit" disabled={!form.title || addAnnotation.isPending} className="bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 rounded px-3 py-1 text-xs font-semibold text-white">
          {addAnnotation.isPending ? "Adding..." : "Add"}
        </button>
      </form>
      <div className="space-y-2">
        {annotations.map((a: any) => (
          <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5">
            <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${a.severity === "critical" ? "bg-red-900/60 text-red-300" : a.severity === "high" ? "bg-orange-900/60 text-orange-300" : a.severity === "moderate" ? "bg-amber-900/60 text-amber-300" : "bg-white/10 text-white/50"}`}>{a.severity.toUpperCase()}</span>
            <div><div className="text-xs font-semibold text-white">{a.title}</div><div className="text-xs text-white/40">{new Date(a.eventAt).toLocaleDateString()} · {a.eventType}</div></div>
          </div>
        ))}
        {annotations.length === 0 && <div className="text-xs text-white/30 text-center py-4">No annotations yet</div>}
      </div>
    </div>
  );
}

export default function ShadowMonitor() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== "admin") return <Redirect to={CANONICAL_HOME} />;
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-900/40 text-amber-400 border border-amber-700/40">ADMIN ONLY</span>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-900/40 text-purple-400 border border-purple-700/40">SHADOW PERIOD: 2026-08-09 → 2026-11-07</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">V3-H Shadow Monitor</h1>
        <p className="text-sm text-white/40 mt-1">V3-H (V2-G + STLFSI4) running alongside V1. Users see V1 only. No tuning during shadow period.</p>
        <div className="mt-3 p-3 rounded-lg border border-amber-700/30 bg-amber-900/10 text-xs text-amber-300/80">
          <strong>NO-TUNING RULE:</strong> Do not adjust V3-H weights, thresholds, or STLFSI4 calibration during the 90-day period.
        </div>
      </div>
      <div className="mb-8"><h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Shadow Period Statistics</h2><StatsPanel /></div>
      <div className="mb-8"><ReadingsTable /></div>
      <div className="mb-8"><StressAnnotations /></div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">V3-H Architecture Reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div><div className="text-white/40 mb-2">STRUCTURAL LAYER (35%)</div><div className="space-y-1 text-white/70"><div>Macro × 0.40</div><div>Breadth × 0.30</div><div>AI Bubble × 0.30</div></div></div>
          <div><div className="text-white/40 mb-2">ACUTE LAYER (65%)</div><div className="space-y-1 text-white/70"><div>Credit × 0.35</div><div>Liquidity × 0.35</div><div>Volatility × 0.15</div><div className="text-purple-300">STLFSI4 × 0.15 ← NEW</div></div></div>
          <div><div className="text-white/40 mb-2">STLFSI4 CALIBRATION (FROZEN)</div><div className="space-y-1 text-white/70"><div>Mean: −0.17 | Std: 0.80</div><div>z=−1 → 0, z=+4 → 100</div><div>Spike threshold: z ≥ 2.0</div></div></div>
          <div><div className="text-white/40 mb-2">DIVERGENCE FLAGS</div><div className="space-y-1 text-white/70"><div>DIV5: |diff| ≥ 5</div><div>DIV10: |diff| ≥ 10</div><div>REGIME: different classification</div><div>SPIKE: STLFSI4 z ≥ 2.0</div></div></div>
        </div>
      </div>
    </div>
  );
}
