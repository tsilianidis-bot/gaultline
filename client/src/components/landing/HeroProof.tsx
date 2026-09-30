/**
 * Hero product proof: the live public Pressure Index reading.
 * Score, band, regime, as-of time and freshness label all come from one
 * canonical snapshot (usePressureSnapshot, PR #40). The number is rendered at
 * its value on first paint: no ring, no counter, no start-at-0 animation.
 * Loading and unavailable states are explicit and never render a number.
 */
import { useLandingPressure, formatPressureAsOf, formatReadingAge, INTEGRITY_COPY } from "./useLandingPressure";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]";

const INTEGRITY_TONE: Record<string, string> = {
  LIVE: "border-[#65D6E5]/40 text-[#8BE6F0]",
  CACHED: "border-[#B7C1CD]/35 text-[#D5DCE4]",
  STALE: "border-[#F5C16C]/45 text-[#F5C16C]",
  FALLBACK: "border-[#F5A15C]/45 text-[#F7B27A]",
  UNAVAILABLE: "border-[#94A3B8]/35 text-[#C3CCD6]",
};

export default function HeroProof() {
  const reading = useLandingPressure();

  return (
    <aside
      aria-labelledby="hero-proof-title"
      aria-busy={reading.status === "loading"}
      data-proof-status={reading.status}
      className="relative w-full rounded-2xl border border-[#65D6E5]/20 bg-[#070B11]/85 p-5 shadow-[0_24px_80px_-32px_rgba(0,212,255,0.35)] backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="hero-proof-title" className="text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]">
          FAULTLINE PRESSURE INDEX™ · PUBLIC READING
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] ${
            reading.status === "available" ? INTEGRITY_TONE[reading.integrity] : INTEGRITY_TONE.UNAVAILABLE
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {reading.status === "loading" ? "LOADING" : reading.status === "available" ? reading.integrity : "UNAVAILABLE"}
        </span>
      </div>

      {reading.status === "loading" && (
        <div className="mt-5" role="status">
          <p className="text-2xl font-semibold text-white">Loading the latest reading…</p>
          <div className="mt-4 h-2 w-40 animate-pulse rounded-full bg-white/10" aria-hidden="true" />
          <p className="mt-4 text-sm leading-[1.7] text-[#B7C1CD]">No score is shown until the canonical state arrives.</p>
        </div>
      )}

      {reading.status === "unavailable" && (
        <div className="mt-5" role="status">
          <p className="text-3xl font-semibold tracking-[-0.02em] text-white">Reading unavailable</p>
          <p className="mt-3 text-sm leading-[1.7] text-[#C9D4E0]">
            {reading.reason} FAULTLINE withholds the score instead of showing a placeholder.
          </p>
        </div>
      )}

      {reading.status === "available" && (
        <div className="mt-5">
          <p className="flex items-baseline gap-2">
            <span className="text-6xl font-semibold tabular-nums leading-none tracking-[-0.03em] text-white sm:text-7xl" data-testid="hero-pressure-score">
              {Math.round(reading.score)}
            </span>
            <span className="text-sm tracking-[0.06em] text-[#B7C1CD]">/ 100</span>
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] tracking-[0.06em] text-[#A8B4C2]">REGIME</dt>
              <dd className="mt-0.5 font-semibold text-white">{reading.regime}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.06em] text-[#A8B4C2]">BAND RANGE</dt>
              <dd className="mt-0.5 font-semibold text-white">{reading.bandRange}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] tracking-[0.06em] text-[#A8B4C2]">AS OF</dt>
              <dd className="mt-0.5 text-[#E3E5E8]">
                <time dateTime={reading.asOf}>{formatPressureAsOf(reading.asOf) ?? "Timestamp unavailable"}</time>
                {formatReadingAge(reading.asOf) && <span className="text-[#B7C1CD]"> · {formatReadingAge(reading.asOf)}</span>}
              </dd>
            </div>
          </dl>
          {!reading.regimeMatchesBand && (
            <p className="mt-3 text-[12px] leading-[1.6] text-[#F5C16C]">Published regime differs from the score band ({reading.band}).</p>
          )}
          {reading.refreshFailed && (
            <p className="mt-3 text-[12px] leading-[1.6] text-[#F5C16C]">Last good snapshot. The latest refresh failed.</p>
          )}
          <p className="mt-4 text-[13px] leading-[1.65] text-[#B7C1CD]">{INTEGRITY_COPY[reading.integrity]}</p>
        </div>
      )}

      <div className="mt-5 border-t border-white/[0.08] pt-4">
        <a href="/pressure-index" className={`inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5] hover:text-[#8BE6F0] ${focusRing}`}>
          SEE THE FULL READING <span aria-hidden="true">→</span>
        </a>
        <p className="mt-2 text-[12px] leading-[1.6] text-[#A8B4C2]">Measures pressure inside this framework. Not a crash forecast.</p>
      </div>
    </aside>
  );
}
