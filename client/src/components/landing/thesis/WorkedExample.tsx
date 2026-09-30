/**
 * Data container for the worked example. One shared pressure snapshot (the
 * same cached query as the hero), plus two public extras that start only when
 * the section nears the viewport. The analog query also waits for a ready
 * snapshot, because the endpoint withholds output without a bound state.
 */
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePressureSnapshot } from "@/hooks/usePressureSnapshot";
import { buildWorkedExample, type AnalogInput, type RegimeInput } from "./workedExample";
import WorkedExampleView from "./WorkedExampleView";

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

export default function WorkedExample() {
  const { ref, near } = useNearViewport<HTMLDivElement>();
  const snapshot = usePressureSnapshot();
  const ready = snapshot.status === "ready";

  const analogQuery = trpc.pressure.getHistoricalContext.useQuery(undefined, {
    enabled: near && ready,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const regimeQuery = trpc.systemicRegime.current.useQuery(undefined, {
    enabled: near,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const analog: AnalogInput = !ready
    ? { status: snapshot.status === "loading" ? "loading" : "unavailable" }
    : !near || analogQuery.isLoading
      ? { status: "loading" }
      : analogQuery.error || !analogQuery.data
        ? { status: "unavailable" }
        : { status: "available", canonicalStateId: analogQuery.data.canonicalStateId, timestamp: analogQuery.data.timestamp, matches: analogQuery.data.analogMatches ?? [] };

  const regime: RegimeInput = !near || regimeQuery.isLoading
    ? { status: "loading" }
    : regimeQuery.error
      ? { status: "unavailable" }
      : { status: "available", reading: regimeQuery.data };

  const model = buildWorkedExample(snapshot, analog, regime);

  return (
    <div ref={ref}>
      <WorkedExampleView model={model} />
    </div>
  );
}
