/**
 * Full technical inventory rendered on /methodology.
 * Moved from the landing page so every disclosure stays public while the
 * landing page carries concise summaries. Content lives in
 * client/src/content/methodologyInventory.ts.
 */
import {
  NOT_LIVE_WARNINGS_LABEL,
  analogMethod,
  analogs,
  crossMarket,
  experiences,
  faqs,
  futureItems,
  limitations,
  methodologyNotes,
  pipeline,
  researchWindows,
  sources,
  sourcesIntro,
  stack,
  validationClosing,
  validationParagraphs,
  weights,
} from "@/content/methodologyInventory";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]";

function Heading({ id, eyebrow, children }: { id: string; eyebrow: string; children: string }) {
  return (
    <>
      <p className="font-mono text-[11px] tracking-[0.18em] text-[#65D6E5]">{eyebrow}</p>
      <h2 id={`${id}-title`} className="mt-2 text-2xl font-semibold text-white">{children}</h2>
    </>
  );
}

export const INVENTORY_SECTIONS = [
  ["pipeline", "From raw data to intelligence"],
  ["stack", "Intelligence stack"],
  ["future", "Future intelligence"],
  ["experiences", "Product experiences"],
  ["weights", "Vector weights"],
  ["cross-market", "Cross-market intelligence"],
  ["sources", "Data sources"],
  ["analogs", "Historical analog library"],
  ["validation", "Historical record"],
  ["limitations", "Limitations"],
  ["faq", "Common questions"],
] as const;

export default function FullInventory() {
  return (
    <div id="inventory" className="mt-20 scroll-mt-8 border-t border-white/10 pt-14">
      <p className="font-mono text-[11px] tracking-[0.22em] text-[#00D4FF]">FULL TECHNICAL INVENTORY</p>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-white">Everything the landing page summarises.</h2>
      <p className="mt-4 leading-relaxed text-[#C9D4E0]">
        The landing page keeps short summaries. The complete inventory, source list, and limitations live here so nothing is hidden.
      </p>
      <nav aria-label="Inventory sections" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        {INVENTORY_SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={`text-[#65D6E5] underline-offset-4 hover:underline ${focusRing}`}>{label}</a>
        ))}
      </nav>

      <section id="methodology-notes" className="mt-12 scroll-mt-8" aria-labelledby="methodology-notes-title">
        <Heading id="methodology-notes" eyebrow="VERSIONING AND COVERAGE">Methodology version and data coverage</Heading>
        <div className="mt-4 space-y-3 leading-relaxed text-[#C9D4E0]">
          <p>{methodologyNotes.version}</p>
          <p>{methodologyNotes.coverage}</p>
          {methodologyNotes.normalization.map((text) => <p key={text}>{text}</p>)}
          <p>{methodologyNotes.regimes}</p>
          <p>{methodologyNotes.historicalAnalysis}</p>
          <p>{methodologyNotes.inventory}</p>
        </div>
      </section>

      <section id="pipeline" className="mt-14 scroll-mt-8" aria-labelledby="pipeline-title">
        <Heading id="pipeline" eyebrow="WHAT FAULTLINE DOES">From raw data to intelligence</Heading>
        <p className="mt-3 leading-relaxed text-[#C9D4E0]">Each stage below is a system that exists in the product.</p>
        <ol className="mt-5 grid gap-3">
          {pipeline.map(([title, body], index) => (
            <li key={title} className="rounded-lg border border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-white"><span className="mr-2 font-mono text-[#65D6E5]">0{index + 1}</span>{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#C9D4E0]">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="stack" className="mt-14 scroll-mt-8" aria-labelledby="stack-title">
        <Heading id="stack" eyebrow="INTELLIGENCE STACK">What is actually implemented</Heading>
        <p className="mt-3 leading-relaxed text-[#C9D4E0]">Only tools present in the engines are listed here. Anything else is in Future Intelligence.</p>
        <div className="mt-5 grid gap-4">
          {stack.map((group) => (
            <article key={group.label} className="rounded-xl border border-white/10 p-4">
              <h3 className="font-mono text-[11px] tracking-[0.16em] text-[#65D6E5]">{group.label.toUpperCase()}</h3>
              <ul className="mt-3 grid gap-3">
                {group.items.map(([name, detail]) => (
                  <li key={name}>
                    <p className="text-sm font-semibold text-white">{name}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[#C9D4E0]">{detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="future" className="mt-14 scroll-mt-8 rounded-xl border border-[#F5C16C]/30 bg-[#F5C16C]/[0.05] p-5" aria-labelledby="future-title">
        <p className="font-mono text-[11px] tracking-[0.18em] text-[#F5C16C]">FUTURE INTELLIGENCE</p>
        <h2 id="future-title" className="mt-2 text-2xl font-semibold text-white">Not current product behavior</h2>
        <p className="mt-3 leading-relaxed text-[#E7D7B4]">These ideas are not current product behavior. They are listed so they are not mistaken for live tools.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#E4D3AE]">
          {futureItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section id="experiences" className="mt-14 scroll-mt-8" aria-labelledby="experiences-title">
        <Heading id="experiences" eyebrow="PRODUCT EXPERIENCES">The readings, and what each one is for</Heading>
        <div className="mt-5 grid gap-4">
          {experiences.map((item) => (
            <article key={item.name} className="rounded-xl border border-white/10 p-4">
              <h3 className="text-base font-semibold text-white">{item.name}</h3>
              <dl className="mt-3 grid gap-2 text-sm leading-relaxed">
                <div><dt className="font-mono text-[11px] tracking-[0.12em] text-[#65D6E5]">WHAT IT IS</dt><dd className="text-[#E3E5E8]">{item.what}</dd></div>
                <div><dt className="font-mono text-[11px] tracking-[0.12em] text-[#65D6E5]">WHAT IT ANALYZES</dt><dd className="text-[#C9D4E0]">{item.analyzes}</dd></div>
                <div><dt className="font-mono text-[11px] tracking-[0.12em] text-[#65D6E5]">WHY IT MATTERS</dt><dd className="text-[#C9D4E0]">{item.matters}</dd></div>
              </dl>
              {item.href && (
                <a href={item.href} className={`mt-3 inline-block font-mono text-[11px] tracking-[0.12em] text-[#65D6E5] hover:text-white ${focusRing}`}>OPEN →</a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="weights" className="mt-14 scroll-mt-8" aria-labelledby="weights-title">
        <Heading id="weights" eyebrow="PRESSURE INDEX VECTORS">What enters the score, and its weight</Heading>
        <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Pressure Index vector weights</caption>
            <thead className="bg-white/[0.03] font-mono text-[11px] tracking-[0.1em] text-[#A8B8CC]">
              <tr><th className="px-3 py-2 font-medium">Vector</th><th className="px-3 py-2 font-medium">Weight</th><th className="px-3 py-2 font-medium">What enters the score</th></tr>
            </thead>
            <tbody>
              {weights.map(([name, weight, detail]) => (
                <tr key={name} className="border-t border-white/[0.06]">
                  <th className="px-3 py-2 font-medium text-white">{name}</th>
                  <td className="px-3 py-2 font-mono text-[#65D6E5]">{weight}</td>
                  <td className="px-3 py-2 text-[#C9D4E0]">{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="cross-market" className="mt-14 scroll-mt-8" aria-labelledby="cross-market-title">
        <Heading id="cross-market" eyebrow="CROSS-MARKET INTELLIGENCE">Equity regime, crypto regime, and what is only quoted</Heading>
        <div className="mt-4 space-y-3 leading-relaxed text-[#C9D4E0]">
          <p>{crossMarket.intro}</p>
          <p>{crossMarket.regimes}</p>
          <p>{crossMarket.quotedVsScored}</p>
        </div>
      </section>

      <section id="sources" className="mt-14 scroll-mt-8" aria-labelledby="sources-title">
        <Heading id="sources" eyebrow="DATA SOURCES">Where the inputs come from, and how current they are</Heading>
        <p className="mt-3 leading-relaxed text-[#C9D4E0]">{sourcesIntro}</p>
        <div className="mt-5 grid gap-3">
          {sources.map(([name, kind, contributes, timing]) => (
            <article key={name} className="rounded-lg border border-white/10 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{name}</h3>
                <p className="font-mono text-[11px] tracking-[0.12em] text-[#65D6E5]">{kind.toUpperCase()}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#E3E5E8]">{contributes}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#C9D4E0]">{timing}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="analogs" className="mt-14 scroll-mt-8" aria-labelledby="analogs-title">
        <Heading id="analogs" eyebrow="HISTORICAL ANALOG ENGINE">Periods present in the analog libraries</Heading>
        <p className="mt-3 leading-relaxed text-[#C9D4E0]">{analogMethod}</p>
        <p className="mt-3 font-mono text-[11px] tracking-[0.12em] text-[#F5C16C]">{NOT_LIVE_WARNINGS_LABEL}</p>
        <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <caption className="sr-only">Historical analog periods present in code</caption>
            <thead className="bg-white/[0.03] font-mono text-[11px] tracking-[0.1em] text-[#A8B8CC]">
              <tr><th className="px-3 py-2 font-medium">Year</th><th className="px-3 py-2 font-medium">Library label</th><th className="px-3 py-2 font-medium">Where it is used</th></tr>
            </thead>
            <tbody>
              {analogs.map(([year, label, where]) => (
                <tr key={year + label} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2 font-mono text-[#65D6E5]">{year}</td>
                  <td className="px-3 py-2 text-white">{label}</td>
                  <td className="px-3 py-2 text-[#C9D4E0]">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="validation" className="mt-14 scroll-mt-8" aria-labelledby="validation-title">
        <Heading id="validation" eyebrow="HISTORICAL CONTEXT">What the historical record in this codebase actually is</Heading>
        <div className="mt-4 space-y-3 leading-relaxed text-[#C9D4E0]">
          {validationParagraphs.map((text) => <p key={text}>{text}</p>)}
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {researchWindows.map(([span, label]) => (
            <li key={span} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#E3E5E8]">
              <span className="font-mono text-[11px] text-[#65D6E5]">{span}</span>
              <span className="mt-0.5 block">{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-[#C9D4E0]">{validationClosing}</p>
      </section>

      <section id="limitations" className="mt-14 scroll-mt-8" aria-labelledby="limitations-title">
        <Heading id="limitations" eyebrow="TRANSPARENCY">What FAULTLINE does not guarantee</Heading>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-[#C9D4E0]">
          {limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section id="faq" className="mt-14 scroll-mt-8" aria-labelledby="faq-title">
        <Heading id="faq" eyebrow="COMMON QUESTIONS">Limits, stated plainly</Heading>
        <dl className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
          {faqs.map(([question, answer]) => (
            <div key={question} className="p-4">
              <dt className="font-semibold text-white">{question}</dt>
              <dd className="mt-2 leading-relaxed text-[#C9D4E0]">{answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
