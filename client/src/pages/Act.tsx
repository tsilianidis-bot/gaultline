import { useEffect } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Crosshair,
  Eye,
  Gauge,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEngine } from "@/contexts/EngineContext";
import {
  CANONICAL_DESTINATION_BY_ID,
  EXPERT_WORKSPACE_BY_ID,
  PERSISTENT_UTILITY_BY_ID,
} from "@shared/routeRegistry";
import {
  formatCanonicalPercent,
  formatCanonicalScore,
} from "@shared/marketMetrics";

const ACT_DEEP_PATH = "/app/act/deep";

type MarketPosture = "defensive" | "balanced" | "opportunistic";

type DecisionScenario = {
  label: string;
  probability: number;
  response: string;
  boundary: string;
};

const posturePresentation: Record<MarketPosture, { label: string; className: string; description: string }> = {
  defensive: {
    label: "DEFENSIVE",
    className: "border-rose-400/25 bg-rose-400/[0.05] text-rose-300",
    description: "Protect optionality, demand stronger confirmation, and make downside controls explicit before increasing risk.",
  },
  balanced: {
    label: "BALANCED",
    className: "border-amber-400/25 bg-amber-400/[0.05] text-amber-300",
    description: "Keep participation conditional, preserve flexibility, and pair every decision with a visible invalidation state.",
  },
  opportunistic: {
    label: "OPPORTUNISTIC",
    className: "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-300",
    description: "Explore opportunity through specialist workflows while keeping evidence quality and downside boundaries visible.",
  },
};

function fallbackPosture(score: number): MarketPosture {
  if (score >= 70) return "defensive";
  if (score <= 35) return "opportunistic";
  return "balanced";
}

function Section({
  id,
  index,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-white/[0.07] py-9 sm:py-12">
      <div className="grid gap-7 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-emerald-300/80">{index}</div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">{eyebrow}</div>
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-[-0.02em] text-slate-100 sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ActLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="border border-white/10 bg-[#090b0f] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">
          ACT · Loading canonical decision state
        </div>
        <div className="mt-8 h-12 max-w-3xl animate-pulse bg-white/10" />
        <div className="mt-5 h-4 max-w-5xl animate-pulse bg-white/[0.06]" />
      </div>
    </div>
  );
}

export default function Act() {
  const {
    marketState,
    marketMode,
    output,
    sourceHealth,
    isLoading,
    isRefreshing,
    lastUpdated,
    dataError,
    refresh,
  } = useEngine();

  useEffect(() => {
    document.title = "ACT — FAULTLINE";
  }, []);

  if (isLoading && !marketState) return <ActLoading />;

  const isCanonical = marketMode === "canonical" && Boolean(marketState);
  const pressure = marketState?.now.pressureScore ?? output.overall.score * 10;
  const posture = marketState?.act.marketPosture ?? fallbackPosture(pressure);
  const postureView = posturePresentation[posture];
  const confidence = marketState?.outlook.probabilities.confidence ?? 0;
  const decisionSummary = marketState?.act.decisionSummary
    ?? `Canonical decision guidance is unavailable. The deterministic ${output.regime.label.toLowerCase()} state supports a ${posture} posture without creating a trade-level instruction.`;
  const riskControls = marketState?.act.riskControls ?? [];
  const invalidation = marketState?.act.whatWouldInvalidate
    ?? "Canonical decision invalidation is unavailable. ACT will not manufacture a threshold from deterministic fallback data.";
  const evidence = marketState?.now.topDrivers
    ?? output.domains.slice(0, 5).map(domain => `${domain.label}: ${domain.drivers[0] ?? domain.description}`);
  const monitoredTriggers = marketState?.watch.whatToWatch
    ?? output.domains.slice(0, 5).map(domain => `${domain.label}: ${domain.description}`);
  const developingConditions = marketState?.watch.developingConditions ?? [];
  const modeLabel = isCanonical ? "Canonical state" : "Deterministic fallback";

  const scenarios: DecisionScenario[] = marketState ? [
    {
      label: "Bull path",
      probability: marketState.outlook.probabilities.bull,
      response: "If bullish evidence strengthens, test opportunity through the specialist decision workflow rather than converting the probability directly into exposure.",
      boundary: marketState.outlook.probabilities.evidenceBasis,
    },
    {
      label: "Neutral path",
      probability: marketState.outlook.probabilities.neutral,
      response: "If the neutral path persists, avoid forcing conviction and keep the review cadence, controls, and invalidation criteria explicit.",
      boundary: marketState.outlook.highestProbabilityPath,
    },
    {
      label: "Bear path",
      probability: marketState.outlook.probabilities.bear,
      response: "If bearish evidence strengthens, prioritize the canonical risk controls and reassess the decision before introducing new risk.",
      boundary: marketState.outlook.probabilities.historicalBasis,
    },
  ] : [
    {
      label: "Bull indicator",
      probability: output.probability.bullProbability,
      response: "Deterministic upside probability is visible for context only; canonical decision guidance is unavailable.",
      boundary: "Fallback probabilities may not form a mutually exclusive distribution.",
    },
    {
      label: "Soft-landing indicator",
      probability: output.probability.softLandingProbability,
      response: "The deterministic soft-landing reading is not a position recommendation or an individualized instruction.",
      boundary: "Canonical scenario evidence and transition history are unavailable.",
    },
    {
      label: "Crash-risk indicator",
      probability: output.probability.crashProbability,
      response: "The deterministic crash-risk reading is a system-state signal, not a directive to buy, sell, or hedge.",
      boundary: "Use a specialist workflow before making any instrument-level decision.",
    },
  ];

  return (
    <main className="min-h-screen bg-[#05070a] text-slate-200" data-act-destination="canonical">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_5%,rgba(0,255,136,0.08),transparent_27%),radial-gradient(circle_at_12%_28%,rgba(0,229,255,0.045),transparent_24%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">{modeLabel}</span>
            <span className="border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">
              {marketState?.cache.status ?? "local baseline"}
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400 transition hover:border-emerald-300/30 hover:text-emerald-200 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {dataError ? (
          <div className="mt-5 flex gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-xs leading-5 text-amber-100/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>Canonical refresh is degraded. ACT is showing the last defensible state or deterministic fallback. {dataError}</span>
          </div>
        ) : null}

        <header className="py-12 sm:py-16" data-act-section="posture">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300">
                <Crosshair className="h-4 w-4" />
                ACT · How should I respond?
              </div>
              <div className={`mt-6 inline-flex border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] ${postureView.className}`}>
                {postureView.label} POSTURE
              </div>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-semibold uppercase leading-[0.94] tracking-[-0.045em] text-slate-50 sm:text-6xl lg:text-7xl">
                Maintain a {postureView.label.toLowerCase()} market posture.
              </h1>
              <p className="mt-5 max-w-4xl text-sm leading-6 text-slate-300">
                {decisionSummary}
              </p>
              <p className="mt-4 max-w-3xl text-xs leading-5 text-slate-500">
                ACT turns the shared market state into a bounded decision posture. It does not create individualized investment advice, trade instructions, position sizing, or instrument-level recommendations.
              </p>
            </div>
            <div className="grid gap-3 border-l border-emerald-300/20 pl-5">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Posture</div>
                <div className="mt-2 text-lg font-semibold uppercase text-slate-100">{postureView.label}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Pressure</div>
                  <div className="mt-1 font-mono text-sm text-emerald-200">{formatCanonicalScore(pressure)}</div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-600">Confidence</div>
                  <div className="mt-1 font-mono text-sm text-slate-200">{formatCanonicalPercent(confidence)}</div>
                </div>
              </div>
              <div className="border-t border-white/[0.07] pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
                Updated {lastUpdated?.toLocaleString() ?? "not available"}
              </div>
            </div>
          </div>
        </header>

        <Section
          id="evidence-boundary"
          index="01"
          eyebrow="Evidence boundary"
          title="What the posture can and cannot infer"
          description="The posture is a system-level response to canonical market conditions. Evidence is separated from any instrument-level decision so confidence cannot outrun provenance."
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {evidence.map(item => (
                <div key={item} className="flex gap-3 border border-white/[0.08] bg-[#090c11] p-4 text-sm leading-6 text-slate-300">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
            <div className="border border-amber-400/20 bg-amber-400/[0.04] p-5">
              <Scale className="h-5 w-5 text-amber-300" />
              <div className="mt-4 text-sm font-semibold uppercase text-slate-100">Decision boundary</div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                ACT describes posture, controls, and conditions. It does not know a user&apos;s objectives, risk tolerance, liquidity needs, tax position, portfolio constraints, or suitability.
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="scenario-responses"
          index="02"
          eyebrow="Scenario responses"
          title="How the posture changes across the probability field"
          description="Each scenario remains conditional. A probability is context for a decision process, not a direct instruction to increase or reduce exposure."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {scenarios.map(scenario => (
              <article key={scenario.label} className="border border-white/[0.08] bg-[#090c11] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{scenario.label}</div>
                  <div className="font-mono text-lg text-emerald-200">{formatCanonicalPercent(scenario.probability)}</div>
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-300">{scenario.response}</p>
                <p className="mt-4 border-t border-white/[0.07] pt-4 text-xs leading-5 text-slate-600">{scenario.boundary}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          id="risk-controls"
          index="03"
          eyebrow="Risk controls"
          title="Controls attached to the current posture"
          description="Controls come directly from the canonical decision contract. Missing controls remain visibly unavailable rather than being improvised from a score."
        >
          {riskControls.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {riskControls.map(control => (
                <div key={control} className="flex gap-3 border border-emerald-400/15 bg-emerald-400/[0.035] p-4 text-sm leading-6 text-slate-300">
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {control}
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-white/[0.08] bg-white/[0.02] p-5 text-sm leading-6 text-slate-400">
              Canonical risk controls are unavailable. ACT will not invent position limits, stops, sizing, or hedges in deterministic fallback mode.
            </div>
          )}
        </Section>

        <Section
          id="invalidation"
          index="04"
          eyebrow="Invalidation"
          title="What would force the current posture to be reconsidered"
          description="A decision posture remains provisional until its invalidation state is explicit and reviewable."
        >
          <div className="flex gap-4 border border-rose-400/20 bg-rose-400/[0.04] p-5 text-sm leading-6 text-slate-300">
            <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-rose-300">Canonical invalidation</div>
              <p className="mt-3">{invalidation}</p>
            </div>
          </div>
        </Section>

        <Section
          id="monitored-triggers"
          index="05"
          eyebrow="Monitored triggers"
          title="What must be reviewed before the posture changes"
          description="ACT inherits monitored conditions from WATCH. It does not create a second alert system or detach a decision from the evidence that should change it."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Review next</div>
              <div className="mt-4 grid gap-3">
                {monitoredTriggers.map(trigger => (
                  <div key={trigger} className="flex gap-3 text-sm leading-6 text-slate-300">
                    <Eye className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">Developing conditions</div>
              <div className="mt-4 grid gap-3">
                {developingConditions.length > 0 ? developingConditions.slice(0, 5).map(condition => (
                  <div key={condition.title} className="border-t border-white/[0.07] pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold uppercase text-slate-200">{condition.title}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">{condition.trend}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{condition.durationDescription}</p>
                  </div>
                )) : (
                  <p className="text-sm leading-6 text-slate-400">Canonical developing conditions are unavailable. Continue to WATCH for the explicit monitoring boundary.</p>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="confidence"
          index="06"
          eyebrow="Confidence and provenance"
          title="What this decision posture rests on"
          description="Confidence, freshness, warnings, source health, and historical depth remain visible so a posture can be judged against evidence quality."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Forecast confidence</div>
              <div className="mt-3 font-mono text-2xl text-slate-100">{formatCanonicalPercent(confidence)}</div>
            </div>
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Historical observations</div>
              <div className="mt-3 font-mono text-2xl text-slate-100">{marketState?.history.observationCount ?? 0}</div>
              <div className="mt-2 text-xs text-slate-500">{marketState?.history.datasetSpan ?? "Canonical history unavailable"}</div>
            </div>
            <div className="border border-white/[0.08] bg-[#090c11] p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Freshness</div>
              <div className="mt-3 text-sm font-semibold uppercase text-slate-100">{marketState?.freshness ?? "Fallback"}</div>
              <div className="mt-2 text-xs text-slate-500">
                {marketState ? `Canonical source state is ${marketState.freshness}.` : "Live canonical freshness unavailable."}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceHealth.map(source => (
              <div key={source.id} className="border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase text-slate-200">{source.label}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${source.status === "healthy" ? "text-emerald-300" : source.status === "degraded" ? "text-amber-300" : "text-rose-300"}`}>
                    {source.status}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{source.detail}</p>
              </div>
            ))}
          </div>
          {marketState?.warnings.length ? (
            <div className="mt-4 border border-amber-400/20 bg-amber-400/[0.04] p-4">
              {marketState.warnings.map(warning => (
                <div key={warning} className="text-xs leading-5 text-amber-100/75">{warning}</div>
              ))}
            </div>
          ) : null}
        </Section>

        <Section
          id="asha"
          index="07"
          eyebrow="ASHA continuity"
          title="Interrogate the decision posture without losing context"
          description="Carry the current regime, scenarios, controls, invalidation, monitored triggers, and source quality into the shared advisor workspace."
        >
          <div className="flex flex-col gap-5 border border-cyan-300/15 bg-cyan-300/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <BrainCircuit className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
              <div>
                <div className="text-sm font-semibold uppercase text-slate-100">Ask what evidence should change this posture</div>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
                  ASHA receives the canonical market context through the shared gateway; no parallel decision state is created here.
                </p>
              </div>
            </div>
            <Link
              href={PERSISTENT_UTILITY_BY_ID.asha.path ?? "/app/asha"}
              className="inline-flex shrink-0 items-center justify-center gap-2 border border-cyan-300/25 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-300/10"
            >
              Open ASHA <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>

        <Section
          id="expert-handoffs"
          index="08"
          eyebrow="Expert handoffs"
          title="Open specialist tools without crowding the decision brief"
          description="The canonical destination stays focused on posture and boundaries. Existing analytical and execution-planning workflows remain available through explicit, registry-owned handoffs."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link href={ACT_DEEP_PATH} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-emerald-300/30">
              <Target className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Preserved deep view</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Smart Discovery</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Open the existing question-to-intelligence workflow with its full specialist depth.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["decision-engine"].path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-emerald-300/30">
              <Crosshair className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Decision workspace</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Decision Engine</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Run the preserved pre-flight and scenario decision workflow.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["symbol-intelligence"].path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-emerald-300/30">
              <Gauge className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Analysis workspace</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Symbol Intelligence</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Inspect instrument-level evidence only after the market posture is understood.</p>
            </Link>
            <Link href={EXPERT_WORKSPACE_BY_ID["day-trade-intelligence"].path} className="group border border-white/[0.08] bg-[#090c11] p-5 transition hover:border-emerald-300/30">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">Intraday workspace</div>
              <div className="mt-2 text-sm font-semibold uppercase text-slate-100">Day Trade Intelligence</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Continue into the preserved intraday planning workflow with explicit controls.</p>
            </Link>
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-6 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-700">
          <span>Regime {marketState?.now.regime ?? output.regime.label}</span>
          <Link href={CANONICAL_DESTINATION_BY_ID.watch.path} className="text-emerald-300/80 transition hover:text-emerald-200">
            Return to WATCH
          </Link>
        </div>
      </div>
    </main>
  );
}
