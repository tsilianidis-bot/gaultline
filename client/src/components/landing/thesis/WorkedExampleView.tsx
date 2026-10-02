/**
 * Presentation for the worked example (pure; props only).
 * LIVE blocks show values from the model or an explicit unavailable/loading
 * state; they never show a placeholder number. ILLUSTRATIVE blocks carry the
 * label "Illustrative example — not live output" and contain no numbers.
 */
import React, { type ReactNode } from "react";
import { INTEGRITY_COPY } from "../landingPressure";
import { ILLUSTRATIVE, ILLUSTRATIVE_LABEL, LIVE_SOURCE, MODEL_LIMITS, MODEL_SOURCE, type LiveStatus, type WorkedExampleModel } from "./workedExample";

const LABEL = "text-[11px] font-semibold tracking-[0.08em] text-[#A8B4C2]";
const pct = (value: number) => `${Math.round(value * 100)}%`;
const pts = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function LiveBlock({ step, status, source, children, unavailable }: { step: string; status: LiveStatus; source?: string; children?: ReactNode; unavailable: string }) {
  return (
    <div data-example-live={step} data-live-status={status} className="rounded-2xl border border-[#65D6E5]/25 bg-[#081118] p-5 sm:p-6">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#8BE6F0]">LIVE · {source ?? "FROM THE PUBLIC READING"}</p>
      <div className="mt-3">
        {status === "ready" ? children : (
          <div role="status">
            <p className="text-[15px] font-semibold text-white">{status === "loading" ? "Loading the live reading…" : "Live output unavailable"}</p>
            <p className="mt-1.5 text-[14px] leading-[1.65] text-[#B7C1CD]">{status === "loading" ? "Nothing is shown until the public endpoint answers." : unavailable}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function IllustrativeBlock({ step, heading, children }: { step: string; heading: string; children: ReactNode }) {
  return (
    <div data-example-illustrative={step} className="rounded-2xl border border-dashed border-[#F5C16C]/40 bg-[#F5C16C]/[0.03] p-5 sm:p-6">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#F5C16C]">{ILLUSTRATIVE_LABEL.toUpperCase()}</p>
      <p className="mt-3 text-[15px] font-semibold text-white">{heading}</p>
      <div className="mt-2 text-[15px] leading-[1.7] text-[#DCCFB4]">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="mt-1 text-[15px] font-semibold text-white">{value}</p>
    </div>
  );
}

function Step({ index, question, children }: { index: number; question: string; children: ReactNode }) {
  return (
    <li className="grid gap-4 border-t border-white/[0.08] py-8 first:border-t-0 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10 lg:py-10">
      <div>
        <p className="text-[13px] font-semibold tracking-[0.08em] text-[#65D6E5]" aria-hidden="true">0{index}</p>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">{question}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </li>
  );
}

const NO_READING = "No public reading is available, so this step has nothing live to show.";

export default function WorkedExampleView({ model }: { model: WorkedExampleModel }) {
  const { happening, why, next, watch, source } = model;
  return (
    <section id="thesis-example" aria-labelledby="thesis-example-title" data-example-status={model.status} className="scroll-mt-24 border-b border-white/[0.06] bg-[#05080C] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="mb-4 text-[12px] font-semibold tracking-[0.08em] text-[#65D6E5]">WORKED EXAMPLE</p>
        <h2 id="thesis-example-title" className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">One market reading, five answers.</h2>
        <p className="mt-6 max-w-3xl text-lg leading-[1.75] text-[#C9D4E0]">
          Live values below come from one public Pressure Index reading. The systemic-regime model is the one exception, and it is labelled with its own source and date. Parts that FAULTLINE does not publish publicly are marked {ILLUSTRATIVE_LABEL} and contain no numbers.
        </p>

        <div className="mt-8 flex flex-wrap gap-2 text-[11px] font-semibold tracking-[0.08em]">
          <span className="rounded-full border border-[#65D6E5]/40 px-3 py-1 text-[#8BE6F0]">LIVE · PUBLIC DATA</span>
          <span className="rounded-full border border-dashed border-[#F5C16C]/50 px-3 py-1 text-[#F5C16C]">{ILLUSTRATIVE_LABEL.toUpperCase()}</span>
        </div>

        <div data-example-source className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[13px] leading-[1.7] text-[#C9D4E0]">
          <span className="font-semibold text-white">Source:</span> {LIVE_SOURCE}
          {source ? (
            <>
              {" · "}<span className="font-semibold text-white">As of</span> <time dateTime={source.asOf}>{source.asOfLabel}</time>
              {" · "}{source.integrity} · {INTEGRITY_COPY[source.integrity]}
            </>
          ) : (
            <> · {model.status === "loading" ? "loading…" : model.unavailableReason ?? "unavailable"} The live parts show unavailable states instead of placeholder values.</>
          )}
        </div>

        <ol className="mt-6" aria-label="The worked example, one step per question">
          <Step index={1} question="What's happening?">
            <LiveBlock step="happening" status={model.status} unavailable={NO_READING}>
              {happening && (
                <>
                  <p className="text-4xl font-semibold tabular-nums text-white">
                    {happening.score}<span className="ml-1 text-base font-medium text-[#B7C1CD]">/ 100</span>
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Stat label="BAND" value={`${happening.band} · ${happening.bandRange}`} />
                    <Stat label="REGIME" value={happening.regime} />
                  </div>
                  {!happening.regimeMatchesBand && (
                    <p className="mt-3 text-[13px] leading-[1.6] text-[#F5C16C]">The published regime label differs from the band for this score. Both are shown as published.</p>
                  )}
                </>
              )}
            </LiveBlock>
            <div className="rounded-2xl border border-white/[0.08] p-5 text-[15px] leading-[1.7] text-[#C9D4E0] sm:p-6">
              <p className={LABEL}>HOW TO READ IT</p>
              <p className="mt-3">Everything in this step is live: the score, its band on the engine&apos;s scale, and the regime, all from the same reading. The Pressure Index measures pressure inside this framework. It is not a crash forecast.</p>
            </div>
          </Step>

          <Step index={2} question="Why?">
            <LiveBlock step="why" status={model.status} unavailable={NO_READING}>
              {why && (
                <>
                  <p className={LABEL}>{why.reconciles ? "WHAT CARRIES THE READING · VALUE × FIXED WEIGHT" : "VECTOR VALUES"}</p>
                  <ol className="mt-2 grid gap-1.5">
                    {why.contributors.map((item) => (
                      <li key={item.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                        <span className="min-w-0 text-[#E3E5E8]">
                          {item.label} <span className="text-[12px] text-[#A8B4C2]">{item.weightPct}%{item.staticBaseline ? " · static baseline" : ""}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-white">
                          {item.value}
                          {item.points != null && <span className="ml-2 text-[12px] text-[#8BE6F0]">{pts(item.points)} pts</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {!why.reconciles && <p className="mt-2 text-[12px] leading-[1.6] text-[#A8B4C2]">The vector values do not reconcile with the published score, so no contribution breakdown is shown.</p>}
                  <p className={`${LABEL} mt-4`}>WHERE IT IS UNCERTAIN</p>
                  <p className="mt-1.5 text-[14px] leading-[1.65] text-[#D5DCE4]">
                    Evidence quality {why.evidenceQuality} · coherence {why.coherence} · {why.staleInputs} stale, {why.delayedInputs} delayed, {why.fallbackInputs} on fallback, {why.unavailableInputs} unavailable inputs · {why.unresolvedConflicts} unresolved conflicts.
                  </p>
                </>
              )}
            </LiveBlock>
            <IllustrativeBlock step="why" heading={ILLUSTRATIVE.why.title}>
              <p>{ILLUSTRATIVE.why.text}</p>
            </IllustrativeBlock>
          </Step>

          <Step index={3} question="What's next?">
            <div className="grid gap-4">
              <LiveBlock step="next-analog" status={next.analog.status} source="HISTORICAL RESEMBLANCE, SAME READING" unavailable="No resemblance ranking is published for this reading. Nothing is shown in its place.">
                {next.analog.match && (
                  <>
                    <p className="text-[15px] font-semibold text-white">
                      <span className="mr-2 text-[#65D6E5]">{next.analog.match.period}</span>{next.analog.match.label}
                      <span className="ml-2 tabular-nums text-[#E3E5E8]">{next.analog.match.similarity}% similar</span>
                    </p>
                    <p className="mt-2 text-[13px] leading-[1.6] text-[#A8B4C2]">Closest hand-set reference profile{next.analog.asOfLabel ? `, reading of ${next.analog.asOfLabel}` : ""}. Resemblance, not an outcome and not a probability.</p>
                  </>
                )}
              </LiveBlock>
              <LiveBlock step="next-model" status={next.model.status} source={`SEPARATE MODEL · ${MODEL_SOURCE}`} unavailable="The systemic-regime model has no current reading to publish. No probability is shown.">
                {next.model.status === "ready" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Stat label="MODEL STATE" value={next.model.regime} />
                    <Stat label="DATA THROUGH" value={next.model.dataAsOf ?? "unpublished"} />
                    <Stat label="PROBABILITY OF THAT STATE" value={next.model.stateProbability != null ? pct(next.model.stateProbability) : "—"} />
                    <Stat label="CHANCE OF LEAVING IT" value={next.model.leaveProbability != null ? pct(next.model.leaveProbability) : "unpublished"} />
                  </div>
                )}
                <p className="mt-3 text-[12px] leading-[1.6] text-[#A8B4C2]">{MODEL_LIMITS}</p>
              </LiveBlock>
            </div>
            <IllustrativeBlock step="next" heading={ILLUSTRATIVE.next.title}>
              <ul className="grid gap-3">
                {ILLUSTRATIVE.next.paths.map((path) => (
                  <li key={path.name}>
                    <span className="font-semibold text-white">{path.name}.</span> {path.text}
                  </li>
                ))}
              </ul>
            </IllustrativeBlock>
          </Step>

          <Step index={4} question="What should I watch?">
            <LiveBlock step="watch" status={model.status} unavailable={NO_READING}>
              {watch && (
                <>
                  <p className={LABEL}>WHAT WOULD CHANGE THE LABEL</p>
                  <ul className="mt-2 grid gap-2 text-[14px] leading-[1.6] text-[#E3E5E8]">
                    {watch.up && <li><span className="tabular-nums text-white">{pts(watch.up.distance)}</span> points up to {watch.up.threshold}: the reading becomes {watch.up.regime}.</li>}
                    {watch.down && <li>A fall of more than <span className="tabular-nums text-white">{pts(watch.down.distance)}</span> points, below {watch.down.threshold}: the reading becomes {watch.down.regime}.</li>}
                  </ul>
                  {watch.topContributors.length > 0 && (
                    <p className="mt-3 text-[14px] leading-[1.6] text-[#D5DCE4]">Largest weighted inputs right now: {watch.topContributors.join(" and ")}.</p>
                  )}
                  <p className="mt-2 text-[12px] leading-[1.6] text-[#A8B4C2]">Arithmetic on the published score and the engine thresholds (25, 45, 65, 80). Not a forecast.</p>
                </>
              )}
            </LiveBlock>
            <IllustrativeBlock step="watch" heading={ILLUSTRATIVE.watch.title}>
              <p>{ILLUSTRATIVE.watch.text}</p>
            </IllustrativeBlock>
          </Step>

          <Step index={5} question="What should I do?">
            <IllustrativeBlock step="do" heading={ILLUSTRATIVE.do.title}>
              <p>{ILLUSTRATIVE.do.text}</p>
            </IllustrativeBlock>
            <div className="rounded-2xl border border-[#F5C16C]/30 bg-[#F5C16C]/[0.05] p-5 text-[14px] leading-[1.65] text-[#EBD9B4] sm:p-6">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[#F5C16C]">NOT INVESTMENT ADVICE</p>
              <p className="mt-3">No posture or trade is chosen here. FAULTLINE does not know your circumstances and does not give personalised recommendations, trade instructions, or position sizes. The posture itself is not published on this public page.</p>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}
