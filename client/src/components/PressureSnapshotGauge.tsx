/* ============================================================
   PressureSnapshotGauge — ring gauge bound to ONE pressure snapshot.

   Ring fill, centre number, regime badge and as-of timestamp are all read
   from the same PressureSnapshotView (see usePressureSnapshot). The ring is
   drawn at the snapshot score on first render; there is no animate-from-0
   state, so a screenshot, a throttled tab or a slow frame can never show a
   0 ring next to a real score. Loading and unavailable states render
   explicitly and never as 0.
   ============================================================ */
// Explicit React import keeps the component renderable under the vitest (classic JSX) transform.
import React from "react";
import {
  PRESSURE_BANDS,
  PRESSURE_UNAVAILABLE_COLOR,
  formatPressureAsOf,
  pressureRingFraction,
  type PressureSnapshotView,
} from "@/lib/pressureSnapshot";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const UNAVAILABLE_COPY: Record<Extract<PressureSnapshotView, { status: "unavailable" }>["reason"], string> = {
  NO_STATE: "No canonical state published",
  QUERY_ERROR: "Canonical state could not be loaded",
  WITHHELD: "Canonical evidence withheld",
  INVALID_SCORE: "Canonical score missing or invalid",
};

function snapshotAttrs(view: PressureSnapshotView) {
  return {
    "data-pressure-snapshot-state": view.status,
    "data-pressure-score": view.status === "ready" ? String(view.displayScore) : undefined,
    "data-pressure-state-id": view.status === "loading" ? undefined : view.provenance?.stateId,
  };
}

export function PressureSnapshotGauge({ snapshot }: { snapshot: PressureSnapshotView }) {
  const fraction = pressureRingFraction(snapshot);
  const color = snapshot.status === "ready" ? snapshot.band.color : PRESSURE_UNAVAILABLE_COLOR;
  const asOf = snapshot.status === "loading" ? null : formatPressureAsOf(snapshot.provenance?.asOf);

  return (
    <div className="flex flex-col items-center gap-5" {...snapshotAttrs(snapshot)}>
      <div
        className="relative w-52 h-52"
        {...(snapshot.status === "ready"
          ? {
              role: "meter",
              "aria-valuemin": 0,
              "aria-valuemax": 100,
              "aria-valuenow": snapshot.displayScore,
              "aria-valuetext": `${snapshot.displayScore} of 100, ${snapshot.regime}`,
              "aria-label": "FAULTLINE Pressure Index",
            }
          : { role: "status", "aria-live": "polite" as const })}
      >
        {snapshot.status === "ready" && (
          <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 60px ${color}20, 0 0 120px ${color}08` }} />
        )}
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
          {fraction != null && (
            <>
              <circle cx="60" cy="60" r={RADIUS} fill="none" stroke={`${color}20`} strokeWidth="10" />
              <circle
                cx="60" cy="60" r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                style={{
                  // Only animates between two real snapshots; first paint is already at the score.
                  transition: "stroke-dashoffset 1.4s cubic-bezier(0.23,1,0.32,1), stroke 0.6s ease",
                  filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color}80)`,
                }}
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          {snapshot.status === "ready" ? (
            <>
              <div
                className="text-6xl font-bold font-mono tabular-nums leading-none"
                style={{ color, textShadow: `0 0 60px ${color}50, 0 0 120px ${color}20`, transition: "color 0.6s ease" }}
              >
                {snapshot.displayScore}
              </div>
              <div className="text-[10px] font-mono text-white/25 tracking-[0.3em] mt-1">/ 100</div>
            </>
          ) : snapshot.status === "loading" ? (
            <>
              <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-400/60 rounded-full animate-spin" />
              <div className="text-[9px] font-mono text-white/35 tracking-[0.25em] mt-3">LOADING SNAPSHOT…</div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold font-mono leading-none text-white/35">—</div>
              <div className="text-[10px] font-mono text-red-400/60 tracking-[0.25em] mt-2">DATA UNAVAILABLE</div>
              <div className="text-[8px] font-mono text-white/30 tracking-[0.12em] mt-1 uppercase">{UNAVAILABLE_COPY[snapshot.reason]}</div>
            </>
          )}
        </div>
      </div>

      <div
        className="px-6 py-2.5 rounded-full text-xs font-mono tracking-[0.25em] font-bold uppercase"
        style={{ color, background: `${color}12`, border: `1px solid ${color}35`, boxShadow: `0 0 24px ${color}20` }}
      >
        {snapshot.status === "ready" ? snapshot.regime : snapshot.status === "loading" ? "LOADING" : "UNAVAILABLE"}
      </div>

      <div className="text-[9px] font-mono tracking-[0.2em] text-white/30 text-center">
        {asOf ? `AS OF ${asOf}` : snapshot.status === "loading" ? "AWAITING CANONICAL STATE" : "NO TIMESTAMP — NOT PUBLISHED"}
        {snapshot.status === "ready" && snapshot.refreshFailed && (
          <div className="mt-1 text-amber-300/60">LAST GOOD SNAPSHOT — REFRESH FAILED</div>
        )}
        {snapshot.status === "ready" && !snapshot.regimeMatchesBand && (
          <div className="mt-1 text-amber-300/60">PUBLISHED REGIME DIFFERS FROM SCORE BAND ({snapshot.band.regime})</div>
        )}
      </div>
    </div>
  );
}

/** Legend for the engine bands; highlights the band of a ready snapshot. */
export function PressureBandLegend({ snapshot }: { snapshot: PressureSnapshotView }) {
  const active = snapshot.status === "ready" ? snapshot.band.regime : null;
  return (
    <div className="grid grid-cols-5 gap-1.5 mt-8 w-full max-w-sm" aria-label="Pressure Index bands">
      {PRESSURE_BANDS.map((band) => (
        <div
          key={band.regime}
          className="rounded-lg px-1 py-2 text-center"
          aria-current={band.regime === active ? "true" : undefined}
          style={{
            background: band.regime === active ? `${band.color}18` : `${band.color}06`,
            border: `1px solid ${band.color}${band.regime === active ? "60" : "20"}`,
          }}
        >
          <div className="text-[8px] font-mono tracking-wider mb-0.5 leading-tight" style={{ color: band.color }}>{band.label}</div>
          <div className="text-[8px] font-mono text-white/30">{band.range}</div>
        </div>
      ))}
    </div>
  );
}
