/**
 * The Pentagonal Thesis™: five questions every risk decision has to answer.
 * Each vertex is tied to capabilities that exist in code (see the PR body for
 * file references). "What's next" is scenario context, never a forecast or a
 * probability. "What should I do" is a decision framework, not advice.
 *
 * The SVG is supplementary: every label is also real text in the list, and the
 * graphic carries its own title and description for assistive technology.
 */
import { useState } from "react";

export const THESIS_QUESTIONS = [
  {
    id: "happening",
    question: "What's happening?",
    short: "WHAT'S HAPPENING?",
    capabilities: [
      "Faultline Pressure Index™: a 0–100 composite of six weighted vectors.",
      "Systemic regime: a separate two-state model (sre-hmm2) on a broader FRED panel. It does not feed the index.",
    ],
    decision: "Establish the current state before forming a view.",
  },
  {
    id: "why",
    question: "Why is it happening?",
    short: "WHY?",
    capabilities: [
      "Vector drivers: which inputs carry the reading, and in which direction each is moving.",
      "PLATO interpretation: a plain-language read of what those measurements mean together.",
    ],
    decision: "Understand the cause, not only the level.",
  },
  {
    id: "next",
    question: "What's next?",
    short: "WHAT'S NEXT?",
    capabilities: [
      "Regime transitions recorded in the seismograph history.",
      "Aftershock and contagion map: a fixed contagion graph between assets, rescored with price, volume, volatility, and pressure context.",
      "Development timelines: whether a condition is emerging, developing, or fading.",
    ],
    decision: "Consider how conditions could develop. This is scenario context, not a forecast or a probability.",
  },
  {
    id: "watch",
    question: "What should I watch?",
    short: "WHAT TO WATCH?",
    capabilities: [
      "The six pressure vectors and how close each sits to a stressed range.",
      "Cross-market alignment: equity regime versus crypto regime.",
      "Your watchlist and the daily intelligence brief.",
    ],
    decision: "Know which evidence would confirm or weaken the current read.",
  },
  {
    id: "do",
    question: "What should I do?",
    short: "WHAT TO DO?",
    capabilities: [
      "A decision framework: the shared state read into a bounded posture, with supporting and cautionary signals and what would force a rethink.",
      "PLATO read: PLATO can walk through that posture and the evidence behind it.",
    ],
    decision: "Frame your own decision with the evidence in view.",
    note: "Not investment advice. FAULTLINE does not know your circumstances and does not give personalised recommendations, trade instructions, or position sizes.",
  },
] as const;

type ThesisId = (typeof THESIS_QUESTIONS)[number]["id"];

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

function PentagonGraphic({ active, withLabels, idSuffix }: { active: ThesisId | null; withLabels: boolean; idSuffix: string }) {
  const viewBox = withLabels ? "30 18 640 460" : "150 52 420 420";
  const titleId = `pentagon-title-${idSuffix}`;
  const descId = `pentagon-desc-${idSuffix}`;
  return (
    <svg viewBox={viewBox} role="img" aria-labelledby={`${titleId} ${descId}`} className="h-auto w-full" data-pentagon={idSuffix}>
      <title id={titleId}>The Pentagonal Thesis™</title>
      <desc id={descId}>
        A pentagon with five vertices: 1 What&apos;s happening? 2 Why is it happening? 3 What&apos;s next? 4 What should I watch? 5 What should I do? All five read the same shared market state.
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
        return (
          <line key={item.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#65D6E5" strokeOpacity={on ? 0.75 : 0.18} strokeWidth={on ? 1.6 : 1} />
        );
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

export default function PentagonalThesis() {
  const [active, setActive] = useState<ThesisId | null>(null);

  return (
    <section id="thesis" aria-labelledby="thesis-title" className="scroll-mt-24 border-b border-white/[0.06] bg-[#070A0F] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="mb-4 text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]">THE PENTAGONAL THESIS™</p>
        <h2 id="thesis-title" className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">
          Five questions every risk decision has to answer.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-[1.75] text-[#C9D4E0]">
          FAULTLINE is organised around one sequence: what is happening, why, what could come next, what to watch, and how to frame a decision. All five answers read the same shared market state, so the story does not change between screens.
        </p>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <div className="mx-auto max-w-[340px] sm:hidden">
              <PentagonGraphic active={active} withLabels={false} idSuffix="compact" />
            </div>
            <div className="hidden sm:block">
              <PentagonGraphic active={active} withLabels idSuffix="full" />
            </div>
            <p className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm leading-[1.7] text-[#B7C1CD]">
              <span className="font-semibold text-white">Supporting every question:</span> development timelines show how long a condition has been building, and historical comparisons test resemblance to hand-set reference profiles. Neither is a forecast.
            </p>
          </div>

          <ol className="grid gap-3" aria-label="The five questions of the Pentagonal Thesis">
            {THESIS_QUESTIONS.map((item, index) => {
              const on = active === item.id;
              return (
                <li
                  key={item.id}
                  id={`thesis-${item.id}`}
                  tabIndex={0}
                  onMouseEnter={() => setActive(item.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(item.id)}
                  onBlur={() => setActive(null)}
                  className={`rounded-2xl border p-5 outline-none transition-colors sm:p-6 ${
                    on ? "border-[#65D6E5]/55 bg-[#65D6E5]/[0.06]" : "border-white/[0.08] bg-[#0A1018]"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]`}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-[12px] font-semibold tracking-[0.06em] text-[#65D6E5]" aria-hidden="true">0{index + 1}</span>
                    <h3 className="text-xl font-semibold text-white">{item.question}</h3>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-[#A8B4C2]">WHAT FAULTLINE SHOWS</p>
                  <ul className="mt-1.5 grid gap-1.5">
                    {item.capabilities.map((capability) => (
                      <li key={capability} className="relative pl-4 text-[15px] leading-[1.65] text-[#D5DCE4]">
                        <span className="absolute left-0 top-[0.7em] h-1 w-1 rounded-full bg-[#65D6E5]" aria-hidden="true" />
                        {capability}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] font-semibold tracking-[0.06em] text-[#A8B4C2]">IN YOUR DECISION</p>
                  <p className="mt-1 text-[15px] leading-[1.65] text-white">{item.decision}</p>
                  {"note" in item && (
                    <p className="mt-3 rounded-lg border border-[#F5C16C]/30 bg-[#F5C16C]/[0.05] px-3 py-2 text-[13px] leading-[1.6] text-[#EBD9B4]">{item.note}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
