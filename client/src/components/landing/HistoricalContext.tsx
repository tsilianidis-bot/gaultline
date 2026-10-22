/**
 * Historical context on the landing page.
 * Analogs are resemblance tests against hand-set reference profiles, not
 * forecasts. Current analog output is shown only when the public
 * pressure.getHistoricalContext endpoint returns it; otherwise the section is
 * descriptive text only. The query starts when the section nears the viewport
 * and only when the shared pressure snapshot is ready.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPressureAsOf } from "@/lib/pressureSnapshot";
import { usePressureSnapshot } from "@/hooks/usePressureSnapshot";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]";

export const REFERENCE_PERIODS = [
  ["1973", "1970s Stagflation"],
  ["1998", "LTCM / Russia Crisis"],
  ["2000", "Dot-Com Bubble"],
  ["2008", "Global Financial Crisis"],
  ["2020", "COVID Shock"],
  ["2022", "Rates Shock"],
] as const;

function useNearViewport<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);
  return { ref, near };
}

function LiveAnalogs({ near }: { near: boolean }) {
  // The endpoint needs a bound canonical state; do not call it when the shared
  // pressure snapshot already says there is none.
  const snapshot = usePressureSnapshot();
  const enabled = near && snapshot.status === "ready";
  const skipped = snapshot.status === "unavailable";
  const { data, isLoading, error } = trpc.pressure.getHistoricalContext.useQuery(undefined, {
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const matches = (data?.analogMatches ?? []).filter((match) => typeof match.similarity === "number" && Number.isFinite(match.similarity)).slice(0, 3);

  if (!skipped && (!enabled || isLoading)) {
    return (
      <div role="status" data-analogs-status="loading">
        <p className="text-sm font-semibold text-white">Checking current analog output…</p>
        <p className="mt-2 text-sm leading-[1.7] text-[#B7C1CD]">Nothing is shown until the public endpoint answers.</p>
      </div>
    );
  }

  if (skipped || error || !data || matches.length === 0) {
    return (
      <div role="status" data-analogs-status="unavailable">
        <p className="text-sm font-semibold text-white">Current analog output unavailable</p>
        <p className="mt-2 text-sm leading-[1.7] text-[#B7C1CD]">
          No canonical market state is bound right now, so no current resemblance ranking is shown. The reference periods above are descriptive only.
        </p>
      </div>
    );
  }

  return (
    <div data-analogs-status="available">
      <p className="text-sm font-semibold text-white">Closest reference profiles right now</p>
      <ol className="mt-3 grid gap-2">
        {matches.map((match) => (
          <li key={`${match.year}-${match.label}`} className="flex items-baseline justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#0A0D12]/60 px-4 py-3">
            <span className="text-sm text-white">
              <span className="mr-2 font-semibold text-[#65D6E5]">{match.year || match.period}</span>
              {match.label}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-[#E3E5E8]">{Math.round(match.similarity)}% similar</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] leading-[1.6] text-[#A8B4C2]">
        Reading of <time dateTime={data.timestamp}>{formatPressureAsOf(data.timestamp) ?? "an unpublished time"}</time>. Ranked against the extended fingerprint library. Similarity is resemblance to a hand-set profile. It is not an outcome and not a probability.
      </p>
    </div>
  );
}

export default function HistoricalContext() {
  const { ref, near } = useNearViewport<HTMLElement>();
  return (
    <section ref={ref} id="analogs" aria-labelledby="analogs-title" className="scroll-mt-24 border-y border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <p className="mb-4 text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]">HISTORICAL CONTEXT</p>
          <h2 id="analogs-title" className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">Resemblance, not repetition.</h2>
          <p className="mt-6 text-lg leading-[1.75] text-[#C9D4E0]">
            The analog engine compares today’s vector profile with hand-set reference profiles for past stress episodes. A closer profile ranks higher. It is a resemblance test, not a forecast, and the market can diverge from any historical match.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {REFERENCE_PERIODS.map(([year, label]) => (
              <li key={year} className="rounded-lg border border-white/[0.08] px-4 py-3">
                <span className="block text-sm font-semibold text-[#65D6E5]">{year}</span>
                <span className="mt-0.5 block text-sm text-[#E3E5E8]">{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[12px] font-semibold tracking-[0.06em] text-[#F5C16C]">NOT A RETROSPECTIVE RECONSTRUCTION OF LIVE WARNINGS</p>
          <a href="/methodology#analogs" className={`mt-6 inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5] hover:text-[#8BE6F0] ${focusRing}`}>
            FULL ANALOG LIBRARY AND METHOD <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A1018] p-5 sm:p-6">
          <LiveAnalogs near={near} />
        </div>
      </div>
    </section>
  );
}
