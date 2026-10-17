import { Canvas, useFrame } from "@react-three/fiber";
import { Activity, AlertTriangle, Circle, Database, PauseCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type {
  EvidenceInterfaceStatus,
  EvidenceProviderStatus,
  IntelligenceEvidenceDomainProjection,
  IntelligenceEvidenceResponse,
  IntelligenceEvidenceSnapshot,
  ValidatedIntelligenceEvidence,
} from "@shared/intelligenceEvidence";

const STATUS_STYLE: Record<EvidenceInterfaceStatus | EvidenceProviderStatus, { label: string; color: string; border: string; surface: string }> = {
  CURRENT: { label: "CURRENT", color: "#62e7d5", border: "rgba(98,231,213,0.45)", surface: "rgba(98,231,213,0.08)" },
  healthy: { label: "CURRENT", color: "#62e7d5", border: "rgba(98,231,213,0.45)", surface: "rgba(98,231,213,0.08)" },
  DEGRADED: { label: "DEGRADED", color: "#f6c45d", border: "rgba(246,196,93,0.48)", surface: "rgba(246,196,93,0.08)" },
  degraded: { label: "DEGRADED", color: "#f6c45d", border: "rgba(246,196,93,0.48)", surface: "rgba(246,196,93,0.08)" },
  UNAVAILABLE: { label: "UNAVAILABLE", color: "#8e9aac", border: "rgba(142,154,172,0.42)", surface: "rgba(142,154,172,0.08)" },
  unavailable: { label: "UNAVAILABLE", color: "#8e9aac", border: "rgba(142,154,172,0.42)", surface: "rgba(142,154,172,0.08)" },
  DISABLED: { label: "DISABLED", color: "#6d788a", border: "rgba(109,120,138,0.42)", surface: "rgba(109,120,138,0.08)" },
};

const DOMAIN_POSITIONS: Record<string, [number, number, number]> = {
  equities: [-2.5, 0.8, 0.1],
  bonds_rates: [2.45, 0.9, -0.1],
  credit: [2.05, -1.55, 0.2],
  liquidity: [-1.9, -1.6, -0.15],
  volatility: [0.1, 2.05, 0.3],
  crypto: [0.15, -2.2, -0.2],
};

const RELATIONSHIPS: ReadonlyArray<readonly [string, string]> = [
  ["equities", "volatility"],
  ["equities", "credit"],
  ["bonds_rates", "credit"],
  ["bonds_rates", "liquidity"],
  ["liquidity", "crypto"],
  ["volatility", "crypto"],
];

type DomainView = IntelligenceEvidenceDomainProjection & { observations: ValidatedIntelligenceEvidence[] };

function formatTimestamp(timestamp: string | null) {
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function statusStyle(status: EvidenceInterfaceStatus | EvidenceProviderStatus) {
  return STATUS_STYLE[status] ?? STATUS_STYLE.UNAVAILABLE;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function webGlAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function StatusPill({ status }: { status: EvidenceInterfaceStatus | EvidenceProviderStatus }) {
  const style = statusStyle(status);
  return <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[8px] font-semibold tracking-[0.14em]" style={{ color: style.color, borderColor: style.border, background: style.surface }}><Circle size={6} fill="currentColor" />{style.label}</span>;
}

function relationshipGeometry(from: [number, number, number], to: [number, number, number]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
  return geometry;
}

function RelationshipEdge({ from, to, reduced }: { from: [number, number, number]; to: [number, number, number]; reduced: boolean }) {
  const geometry = useMemo(() => relationshipGeometry(from, to), [from, to]);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: reduced ? "#806a3d" : "#d8b45b", transparent: true, opacity: reduced ? 0.26 : 0.42 }), [reduced]);
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <primitive object={line} />;
}

function CoreNode({ domain, position, selected, onSelect, reduced }: {
  domain: DomainView; position: [number, number, number]; selected: boolean; onSelect: () => void; reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const tone = statusStyle(domain.status);
  useFrame(({ clock }) => {
    if (!group.current || reduced) return;
    group.current.rotation.y = clock.getElapsedTime() * 0.12;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.25 + position[0]) * 0.025;
    group.current.scale.setScalar(selected ? 1.22 : pulse);
  });
  return (
    <group ref={group} position={position} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <mesh>
        <sphereGeometry args={[selected ? 0.34 : 0.28, 30, 30]} />
        <meshStandardMaterial color={tone.color} emissive={tone.color} emissiveIntensity={selected ? 1.2 : 0.55} roughness={0.25} metalness={0.7} />
      </mesh>
      <mesh scale={selected ? 1.76 : 1.52}>
        <sphereGeometry args={[0.28, 18, 18]} />
        <meshBasicMaterial color={tone.color} transparent opacity={selected ? 0.15 : 0.07} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function ConstellationScene({ domains, selectedId, onSelect, reduced }: {
  domains: DomainView[]; selectedId: string | null; onSelect: (id: string) => void; reduced: boolean;
}) {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 48 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={["#070a0f"]} />
      <ambientLight intensity={0.42} />
      <pointLight position={[0, 1.5, 3]} color="#e2bd5e" intensity={1.5} />
      <pointLight position={[-2, -2, 2]} color="#5eead4" intensity={0.75} />
      {RELATIONSHIPS.map(([fromId, toId]) => {
        const from = DOMAIN_POSITIONS[fromId];
        const to = DOMAIN_POSITIONS[toId];
        return from && to ? <RelationshipEdge key={`${fromId}-${toId}`} from={from} to={to} reduced={reduced} /> : null;
      })}
      <mesh rotation={[0.35, 0.2, 0]}>
        <icosahedronGeometry args={[0.64, 2]} />
        <meshStandardMaterial color="#d7b45a" emissive="#9f7b2f" emissiveIntensity={0.45} metalness={0.82} roughness={0.25} />
      </mesh>
      {domains.map(domain => (
        <CoreNode key={domain.id} domain={domain} position={DOMAIN_POSITIONS[domain.id] ?? [0, 0, 0]} selected={domain.id === selectedId} onSelect={() => onSelect(domain.id)} reduced={reduced} />
      ))}
    </Canvas>
  );
}

function EvidenceDetail({ domain }: { domain: DomainView }) {
  const style = statusStyle(domain.status);
  return (
    <aside className="rounded-sm border border-white/10 bg-black/30 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200/80">Selected evidence module</p>
          <h3 className="mt-1 font-['Rajdhani'] text-2xl font-semibold text-white">{domain.label}</h3>
        </div>
        <StatusPill status={domain.status} />
      </div>
      {domain.limitation && <p className="mt-3 rounded-sm border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-xs leading-5 text-amber-100/80">{domain.limitation}</p>}
      <div className="mt-4 space-y-3">
        {domain.observations.length ? domain.observations.map(observation => (
          <article key={observation.id} className="border-t border-white/8 pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-sm font-medium text-slate-100">{observation.label}</p><p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.13em] text-slate-500">{observation.provider} · {observation.temporalStatus.replace(/_/g, " ")}</p></div>
              <span className="font-mono text-xs text-amber-100">{observation.value === null ? "Unavailable" : `${observation.value}${observation.unit ? ` ${observation.unit}` : ""}`}</span>
            </div>
            <div className="mt-2 grid gap-1 text-[11px] leading-5 text-slate-500 sm:grid-cols-2">
              <p>Observed: <span className="text-slate-300">{formatTimestamp(observation.observedAt)}</span></p>
              <p>Received: <span className="text-slate-300">{formatTimestamp(observation.receivedAt)}</span></p>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">{observation.validationReason}</p>
          </article>
        )) : <p className="text-sm text-slate-500">No validated observation is mapped to this domain.</p>}
      </div>
      <p className="mt-4 border-t border-white/8 pt-3 font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: style.color }}>Evidence detail retains original source timestamps and does not calculate a domain score.</p>
    </aside>
  );
}

const ENGINE_LABELS: Record<string, string> = {
  equities: "Equities & Breadth",
  bonds_rates: "Rates & Curve",
  credit: "Credit Stress",
  liquidity: "Liquidity Conditions",
  volatility: "Volatility Regime",
  crypto: "Crypto Cross-Market",
};

function latestEvidenceTime(observations: ValidatedIntelligenceEvidence[]) {
  const times = observations
    .flatMap(observation => [observation.observedAt, observation.receivedAt])
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))));
  if (!times.length) return null;
  return times.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function AnalystCommandCenter({ domains, selectedId, onSelect }: { domains: DomainView[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="mt-4 rounded-sm border border-white/10 bg-black/20 p-4" aria-labelledby="core-command-center-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber-200">AI analyst command center</p><h3 id="core-command-center-title" className="mt-1 font-['Rajdhani'] text-2xl font-semibold text-white">Six verified analytical domains</h3></div>
        <p className="max-w-sm text-xs leading-5 text-slate-500">Operational indicators reflect mapped source observations—not synthetic engine uptime, confidence, or activity.</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {domains.map(domain => {
          const style = statusStyle(domain.status);
          const observedAt = latestEvidenceTime(domain.observations);
          const usableCount = domain.observations.filter(observation => observation.supportsCurrentClaim).length;
          return <button key={domain.id} type="button" onClick={() => onSelect(domain.id)} className="rounded-sm border p-3 text-left transition hover:border-amber-200/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" style={{ borderColor: domain.id === selectedId ? style.border : "rgba(255,255,255,0.10)", background: domain.id === selectedId ? style.surface : "rgba(255,255,255,0.018)" }} aria-pressed={domain.id === selectedId}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[8px] uppercase tracking-[0.13em] text-slate-500">{ENGINE_LABELS[domain.id] ?? domain.label} engine</p><p className="mt-1 text-sm font-medium text-white">{domain.label}</p></div><span className="mt-1 h-2 w-2 rounded-full" style={{ background: style.color, boxShadow: `0 0 10px ${style.color}` }} /></div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-white/8 pt-2"><span className="font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: style.color }}>{style.label}</span><span className="text-right font-mono text-[8px] text-slate-500">{usableCount}/{domain.observations.length} current<br />{observedAt ? formatTimestamp(observedAt) : "No timestamp"}</span></div>
          </button>;
        })}
      </div>
    </section>
  );
}

function VerifiedActivityStream({ snapshot }: { snapshot: IntelligenceEvidenceSnapshot }) {
  const activities = useMemo(() => snapshot.observations
    .map(observation => ({ observation, occurredAt: observation.receivedAt ?? observation.observedAt }))
    .sort((left, right) => Date.parse(right.occurredAt ?? "") - Date.parse(left.occurredAt ?? ""))
    .slice(0, 6), [snapshot]);
  return (
    <section className="mt-4 rounded-sm border border-white/10 bg-black/20 p-4" aria-labelledby="core-activity-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200">Intelligence activity stream</p><h3 id="core-activity-title" className="mt-1 font-['Rajdhani'] text-2xl font-semibold text-white">Verified evidence activity</h3></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-100">Read-only source timeline</span></div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Entries are a completed evidence capture and its original source observations. Material-change and assessment records appear only after the separately enabled append-only ledger writes one; no activity is simulated here.</p>
      <ol className="mt-4 space-y-0 border-l border-cyan-300/20 pl-4">
        <li className="relative pb-4"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-cyan-200 bg-[#070a0f]" /><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm text-slate-200">Verified evidence capture completed</p><p className="mt-1 text-xs leading-5 text-slate-500">Six-domain source projection evaluated without changing canonical MarketState or the Pressure Index.</p></div><time className="font-mono text-[8px] uppercase tracking-[0.11em] text-cyan-100/80">{formatTimestamp(snapshot.capturedAt)}</time></div></li>
        {activities.map(({ observation }) => { const style = statusStyle(observation.supportsCurrentClaim ? "CURRENT" : observation.validationStatus === "stale" ? "DEGRADED" : "UNAVAILABLE"); return <li key={observation.id} className="relative pb-4 last:pb-0"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border bg-[#070a0f]" style={{ borderColor: style.color }} /><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm text-slate-200">{observation.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{observation.provider} · {observation.validationReason}</p></div><time className="font-mono text-[8px] uppercase tracking-[0.11em]" style={{ color: style.color }}>{formatTimestamp(observation.observedAt ?? observation.receivedAt)}</time></div></li>; })}
      </ol>
    </section>
  );
}

function SnapshotContent({ response }: { response: IntelligenceEvidenceResponse }) {
  const snapshot = response.snapshot as IntelligenceEvidenceSnapshot;
  const reduced = useReducedMotion();
  const canUseWebGl = !reduced && typeof window !== "undefined" && webGlAvailable();
  const domains = useMemo<DomainView[]>(() => snapshot.domains.map(domain => ({
    ...domain,
    observations: snapshot.observations.filter(observation => domain.observationIds.includes(observation.id)),
  })), [snapshot]);
  const [selectedId, setSelectedId] = useState<string | null>(domains[0]?.id ?? null);
  const selected = domains.find(domain => domain.id === selectedId) ?? domains[0];

  return (
    <section className="relative overflow-hidden rounded-sm border border-amber-300/25 bg-[#070a0f] p-4 shadow-[0_0_70px_rgba(217,180,90,0.07)] md:p-6" data-intelligence-core="verified">
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: "radial-gradient(circle at 50% 4%, rgba(222,185,89,0.14), transparent 36%), radial-gradient(circle at 12% 92%, rgba(94,234,212,0.08), transparent 32%)" }} />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-200">Intelligence Core · verified system map</p><StatusPill status={response.status} /></div>
            <h2 className="mt-2 font-['Rajdhani'] text-3xl font-semibold text-white md:text-4xl">Six domains. One evidence boundary.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Node status reflects only validated source observations. Gold connections are a conceptual systems map—not a measured transmission path, causal estimate, or trading signal.</p>
          </div>
          <div className="rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-right"><p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">Latest verified capture</p><p className="mt-1 font-mono text-[10px] text-slate-300">{formatTimestamp(snapshot.capturedAt)}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.11em] text-slate-600">{snapshot.persistence.replace(/_/g, " ")}</p></div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.28fr)_minmax(290px,0.72fr)]">
          <div className="overflow-hidden rounded-sm border border-white/10 bg-[#05070b]">
            {canUseWebGl ? <div className="h-[340px] sm:h-[390px]"><ConstellationScene domains={domains} selectedId={selectedId} onSelect={setSelectedId} reduced={reduced} /></div> : <div className="flex min-h-[240px] items-center justify-center p-5 text-center"><div><PauseCircle className="mx-auto h-6 w-6 text-amber-200/70" /><p className="mt-3 font-mono text-[9px] uppercase tracking-[0.15em] text-amber-100">Accessible constellation fallback</p><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">WebGL or motion is unavailable. Select a verified domain below to inspect the same source record.</p></div></div>}
            <div className="border-t border-white/8 p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{domains.map(domain => { const style = statusStyle(domain.status); return <button key={domain.id} type="button" onClick={() => setSelectedId(domain.id)} className="rounded-sm border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" style={{ borderColor: domain.id === selectedId ? style.border : "rgba(255,255,255,0.10)", background: domain.id === selectedId ? style.surface : "rgba(255,255,255,0.018)" }} aria-pressed={domain.id === selectedId}><span className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-200">{domain.label}</span><span className="h-2 w-2 rounded-full" style={{ background: style.color, boxShadow: `0 0 10px ${style.color}` }} /></span><span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.11em]" style={{ color: style.color }}>{style.label}</span></button>; })}</div></div>
          </div>
          {selected && <EvidenceDetail domain={selected} />}
        </div>

        <AnalystCommandCenter domains={domains} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.25fr]">
          <div className="rounded-sm border border-white/10 bg-white/[0.02] p-4"><div className="flex items-center gap-2 text-amber-200"><Database size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Source health</p></div><div className="mt-3 space-y-2">{snapshot.providerHealth.map(provider => <div key={provider.id} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">{provider.label}</span><StatusPill status={provider.status} /></div>)}</div></div>
          <div className="rounded-sm border border-white/10 bg-white/[0.02] p-4"><div className="flex items-center gap-2 text-cyan-200"><Activity size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Verified activity</p></div><p className="mt-3 text-sm leading-6 text-slate-300">Latest evidence capture completed at {formatTimestamp(snapshot.capturedAt)}.</p><p className="mt-2 text-xs leading-5 text-slate-500">The source timeline below shows this capture and original observations. Material-change or assessment records appear only after an immutable ledger record exists.</p></div>
          <div className="rounded-sm border border-amber-300/15 bg-amber-300/[0.035] p-4"><div className="flex items-center gap-2 text-amber-200"><ShieldCheck size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Interpretation boundary</p></div><p className="mt-3 text-sm leading-6 text-slate-300">The Core groups verified evidence for review. It does not calculate a new Pressure Index, fabricate an event, assign a confidence score, or replace the canonical NOW answer.</p></div>
        </div>
        <VerifiedActivityStream snapshot={snapshot} />
        {snapshot.limitations.length > 0 && <div className="mt-4 rounded-sm border border-white/10 bg-black/20 p-4"><div className="flex items-center gap-2 text-slate-400"><AlertTriangle size={14} /><p className="font-mono text-[9px] uppercase tracking-[0.14em]">Declared limitations</p></div><ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-500">{snapshot.limitations.map(limitation => <li key={limitation}>• {limitation}</li>)}</ul></div>}
      </div>
    </section>
  );
}

/**
 * Heavy WebGL detail chunk. It is loaded only after the small rollout boundary
 * has received an enabled, validated evidence snapshot.
 */
export default function IntelligenceCoreVisual({ response }: { response: IntelligenceEvidenceResponse }) {
  if (!response.snapshot) return null;
  return <SnapshotContent response={response} />;
}
