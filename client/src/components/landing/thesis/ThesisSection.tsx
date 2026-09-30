/**
 * The Pentagonal Thesis™ section: the central product story of the landing
 * page. Pure presentation (no data fetching), so it renders on the server and
 * composes with the marketing page's background work without side effects.
 *
 * Every heading, tagline, body paragraph, "what FAULTLINE shows" list, option
 * and note is always-visible text. There are no tooltips, accordions,
 * disclosure widgets or hover-only states on the copy. The layout does not rely
 * on position: sticky (the page root clips horizontal overflow, which disables
 * sticky), so the pentagon sits beside the intro.
 */
import React from "react";
import { THESIS_CLOSING, THESIS_INTRO, THESIS_QUESTIONS, THESIS_SUPPORTING_NOTE, type ThesisQuestion } from "./thesisContent";

type ThesisId = ThesisQuestion["id"];

const CX = 360;
const CY = 262;
const R = 168;

function vertex(index: number, radius = R) {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function ring(scale: number) {
  return THESIS_QUESTIONS.map((_, i) => {
    const p = vertex(i, R * scale);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

export function PentagonGraphic({ active, withLabels, idSuffix }: { active: ThesisId | null; withLabels: boolean; idSuffix: string }) {
  const viewBox = withLabels ? "30 18 640 460" : "150 52 420 420";
  const titleId = `pentagon-title-${idSuffix}`;
  const descId = `pentagon-desc-${idSuffix}`;
  return (
    <svg viewBox={viewBox} role="img" aria-labelledby={`${titleId} ${descId}`} className="h-auto w-full" data-pentagon={idSuffix}>
      <title id={titleId}>The Pentagonal Thesis™</title>
      <desc id={descId}>
        A pentagon with five vertices: 1 What&apos;s happening? 2 Why? 3 What&apos;s next? 4 What should I watch? 5 What should I do? All five read the same shared market state.
      </desc>
      <defs>
        <linearGradient id={`pent-stroke-${idSuffix}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#65D6E5" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2A8FA0" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id={`pent-fill-${idSuffix}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#65D6E5" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#65D6E5" stopOpacity="0.02" />
        </radialGradient>
      </defs>

      <polygon points={ring(1)} fill={`url(#pent-fill-${idSuffix})`} stroke={`url(#pent-stroke-${idSuffix})`} strokeWidth="1.6" />
      {[0.66, 0.33].map((scale) => (
        <polygon key={scale} points={ring(scale)} fill="none" stroke="#65D6E5" strokeOpacity="0.16" strokeWidth="1" strokeDasharray="3 5" />
      ))}
      {THESIS_QUESTIONS.map((item, i) => {
        const p = vertex(i);
        const on = active === item.id;
        return <line key={item.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#65D6E5" strokeOpacity={on ? 0.75 : 0.18} strokeWidth={on ? 1.6 : 1} />;
      })}

      <circle cx={CX} cy={CY} r="46" fill="#0A0D12" stroke="#65D6E5" strokeOpacity="0.35" />
      <text x={CX} y={CY - 4} textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="600" letterSpacing="1">SHARED</text>
      <text x={CX} y={CY + 13} textAnchor="middle" fill="#B7C1CD" fontSize="11" letterSpacing="1">STATE</text>

      {THESIS_QUESTIONS.map((item, i) => {
        const p = vertex(i);
        const on = active === item.id;
        return (
          <g key={item.id}>
            <circle cx={p.x} cy={p.y} r={on ? 23 : 20} fill={on ? "#65D6E5" : "#0A0D12"} stroke="#65D6E5" strokeWidth="1.6" />
            <text x={p.x} y={p.y + 6} textAnchor="middle" fill={on ? "#050608" : "#FFFFFF"} fontSize="17" fontWeight="600">{i + 1}</text>
          </g>
        );
      })}

      {withLabels &&
        THESIS_QUESTIONS.map((item, i) => {
          const p = vertex(i, R + 40);
          const anchor = Math.abs(p.x - CX) < 4 ? "middle" : p.x > CX ? "start" : "end";
          const dy = i === 0 ? -6 : i === 2 || i === 3 ? 14 : 5;
          return (
            <text key={item.id} x={p.x} y={p.y + dy} textAnchor={anchor} fill={active === item.id ? "#8BE6F0" : "#E3E5E8"} fontSize="15" fontWeight="600" letterSpacing="0.8">
              {item.short}
            </text>
          );
        })}
    </svg>
  );
}

const LABEL = "text-[11px] font-semibold tracking-[0.08em] text-[#A8B4C2]";

function QuestionArticle({ item, index }: { item: ThesisQuestion; index: number }) {
  return (
    <article
      id={`thesis-${item.id}`}
      aria-labelledby={`thesis-${item.id}-title`}
      data-thesis-question={item.id}
      className="grid scroll-mt-24 gap-6 border-t border-white/[0.08] py-12 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
    >
      <div>
        <p className="text-[13px] font-semibold tracking-[0.08em] text-[#65D6E5]" aria-hidden="true">0{index + 1} / 05</p>
        <h3 id={`thesis-${item.id}-title`} className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.75rem]">
          {item.question}
        </h3>
        <p data-thesis-tagline className="mt-4 text-xl font-medium leading-[1.4] tracking-[-0.01em] text-[#8BE6F0] sm:text-2xl">{item.tagline}</p>
      </div>

      <div>
        <p data-thesis-body className="max-w-[44rem] text-[17px] leading-[1.8] text-[#D5DCE4] sm:text-lg">{item.body}</p>

        {item.options && (
          <div className="mt-7">
            <p className={LABEL}>THE OPTIONS AND THEIR TRADEOFFS</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {item.options.map((option) => (
                <li key={option.name} className="rounded-xl border border-white/[0.08] bg-[#0A1018] p-4">
                  <p className="text-[15px] font-semibold text-white">{option.name}</p>
                  <p className="mt-1.5 text-[15px] leading-[1.65] text-[#C9D4E0]">{option.tradeoff}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0A1018]/80 p-5 sm:p-6">
          <p className={LABEL}>WHAT FAULTLINE SHOWS</p>
          <ul className="mt-3 grid gap-2.5">
            {item.shows.map((line) => (
              <li key={line} className="relative pl-4 text-[15px] leading-[1.7] text-[#D5DCE4]">
                <span className="absolute left-0 top-[0.72em] h-1 w-1 rounded-full bg-[#65D6E5]" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {item.note && (
          <p className={`mt-4 rounded-lg border px-4 py-3 text-[14px] leading-[1.65] ${item.id === "do" ? "border-[#F5C16C]/30 bg-[#F5C16C]/[0.05] text-[#EBD9B4]" : "border-white/[0.1] bg-white/[0.02] text-[#C9D4E0]"}`}>
            {item.note}
          </p>
        )}
      </div>
    </article>
  );
}

export default function ThesisSection() {
  return (
    <section id="thesis" aria-labelledby="thesis-title" data-thesis-section className="relative scroll-mt-24 border-b border-white/[0.06] bg-[#070A0F] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <p className="mb-5 text-[12px] font-semibold tracking-[0.08em] text-[#65D6E5]">{THESIS_INTRO.eyebrow}</p>
            <h2 id="thesis-title" className="text-[2.35rem] font-semibold leading-[1.06] tracking-[-0.04em] text-white sm:text-6xl lg:text-[4.25rem]">
              {THESIS_INTRO.heading}
            </h2>
            <p className="mt-7 max-w-3xl text-lg leading-[1.75] text-[#C9D4E0] sm:text-xl">{THESIS_INTRO.body}</p>
            <p className="mt-7 max-w-3xl rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-[1.7] text-[#B7C1CD]">
              <span className="font-semibold text-white">Supporting every question:</span> {THESIS_SUPPORTING_NOTE}
            </p>
          </div>
          <div>
            <div className="mx-auto max-w-[300px] sm:hidden">
              <PentagonGraphic active={null} withLabels={false} idSuffix="compact" />
            </div>
            <div className="hidden sm:mx-auto sm:block sm:max-w-[560px]">
              <PentagonGraphic active={null} withLabels idSuffix="full" />
            </div>
          </div>
        </div>

        <div role="group" aria-label="The five questions of the Pentagonal Thesis" className="mt-16 sm:mt-20">
          {THESIS_QUESTIONS.map((item, index) => (
            <QuestionArticle key={item.id} item={item} index={index} />
          ))}
        </div>

        <p data-thesis-closing className="mx-auto max-w-4xl border-t border-white/[0.08] pt-14 text-center text-2xl font-semibold leading-[1.4] tracking-[-0.02em] text-white sm:pt-16 sm:text-[2rem]">
          {THESIS_CLOSING}
        </p>
      </div>
    </section>
  );
}
