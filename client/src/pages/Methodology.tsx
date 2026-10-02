/**
 * Public methodology note. Claims match the live engines.
 * Last updated 30 September 2026 — the date of this copy, not a data vintage.
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import FullInventory from "@/components/methodology/FullInventory";
import { PUBLIC_DISCLAIMER } from "@shared/publicDisclaimer";

const bands = [
  ["0–24", "Low Risk", "LOW RISK"],
  ["25–44", "Moderate", "MODERATE RISK"],
  ["45–64", "Elevated", "ELEVATED RISK"],
  ["65–79", "High", "HIGH STRESS"],
  ["80–100", "Critical", "SYSTEMIC CRISIS"],
];

export default function Methodology() {
  useSEO({
    title: "Methodology | FAULTLINE Systemic Risk",
    description: "How the Faultline Pressure Index is calculated, which series it uses, and what the score does not mean.",
    canonical: "/methodology",
  });

  // Landing-page links point at anchors in the full inventory (for example
  // /methodology#sources). The page is lazy-loaded, so scroll after mount.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#080A10] text-[#E4EAF2]">
      <nav className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <Link href="/" className="font-mono text-sm font-black tracking-[0.22em] text-[#00D4FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00D4FF]">
          FAULTLINE
        </Link>
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[12px] text-[#A8B8CC]">
          <Link href="/#methodology" className="hover:text-white">Landing note</Link>
          <Link href="/pressure-index" className="hover:text-white">Pressure Index</Link>
          <a href="#inventory" className="hover:text-white">Full inventory</a>
          <Link href="/trust" className="hover:text-white">Trust Center</Link>
          <Link href="/contact" className="hover:text-white">Contact</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="font-mono text-[11px] tracking-[0.22em] text-[#00D4FF]">METHODOLOGY</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">How the Pressure Index is calculated.</h1>
        <p className="mt-6 text-lg leading-relaxed text-[#C9D4E0]">
          This note describes the live composite. It is an analytical framework. It does not guarantee outcomes, and it does not predict a specific crash.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-white/10 p-4">
            <h2 className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">METHODOLOGY VERSION</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C9D4E0]">No single version string is published for this page. Live weights are 20%, 20%, 15%, 20%, 10%, and 15%. An audit-only module records that contract as Champion V1, label v1-observed-2026-08-18, and does not score the live index. FMOS pipeline: 1.0.0. Systemic-regime model: sre-hmm2-v1.0.0, and it does not feed the index.</p>
          </article>
          <article className="rounded-xl border border-white/10 p-4">
            <h2 className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">LAST UPDATED</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C9D4E0]">30 September 2026. This dates the copy, not the vintage of any series.</p>
          </article>
          <article className="rounded-xl border border-white/10 p-4">
            <h2 className="font-mono text-[10px] tracking-[0.16em] text-[#00D4FF]">DATA COVERAGE</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C9D4E0]">Latest valid observation per requested series, plus about thirteen months of CPI and PPI for year-over-year changes. No verified point-in-time backtest window.</p>
          </article>
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Score and bands</h2>
          <p className="mt-4 leading-relaxed text-[#C9D4E0]">
            Each vector is scored from 0 to 100. Most inputs are linearly mapped from a calm range to a stressed range and clamped. The curve vector uses inversion and flatness bands, then blends that result with the 10-year yield. The index is the rounded weighted sum. Weights: liquidity 20%, credit contagion 20%, yield curve (10Y–2Y) and 10Y level 15%, macro sensitivity 20%, labor and rates 10%, AI/speculation static baseline 15%.
          </p>
          <ul className="mt-6 grid gap-2">
            {bands.map(([range, level, regime]) => (
              <li key={range} className="grid grid-cols-[5rem_1fr_auto] gap-3 rounded-lg border border-white/10 px-4 py-3 text-sm">
                <span className="font-mono text-[#00D4FF]">{range}</span>
                <span>{level}</span>
                <span className="font-mono text-[11px] text-[#A8B8CC]">{regime}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[#A8B8CC]">Thresholds are inclusive at 25, 45, 65, and 80.</p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">What each vector actually uses</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-[#C9D4E0]">
            <li>High-yield OAS and SOFR. The engine labels this Liquidity Stress. Latest published daily data when FRED responds. Not an order-book liquidity measure.</li>
            <li>High-yield OAS, the 10-year yield (DGS10), and unemployment (UNRATE). The engine labels this Credit Contagion Risk. It is that blend, not a cross-sector contagion map.</li>
            <li>DGS10 minus DGS2, plus the level of DGS10. Shown as Yield Curve (10Y–2Y) &amp; 10Y Level (internal id volatility-regime; formerly labelled Volatility Regime). It does not read VIX or realized volatility.</li>
            <li>CPI and PPI year-over-year, and the effective federal funds rate. The engine labels this Macro Sensitivity. Monthly, with publication lag. Marked delayed when the fetch succeeds.</li>
            <li>Unemployment and DGS10. Shown as Labor &amp; Rates (internal id market-breadth; formerly labelled Market Breadth). It is not advance/decline breadth.</li>
            <li>A fixed 32.4% concentration baseline, adjusted by the 10-year yield and the high-yield spread. Shown as AI / Speculation (Static Baseline) (internal id ai-bubble). The baseline is a static reference value, not a live market-cap measurement.</li>
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Other engines, kept separate</h2>
          <p className="mt-4 leading-relaxed text-[#C9D4E0]">
            A two-state Gaussian hidden Markov model (sre-hmm2-v1.0.0) reads a FRED panel that adds investment-grade OAS, the 10-year/2-year spread series, NFCI, the St. Louis Fed Financial Stress Index, the VIX close, and the S&P 500. The code states that this model does not contribute to the Pressure Index.
          </p>
          <p className="mt-4 leading-relaxed text-[#C9D4E0]">
            Equity regimes add SPY trend from Polygon daily bars. Crypto regimes and the crypto stress score use CoinGecko plus the pressure reading. Cross-market intelligence compares the equity regime with the crypto regime. Analogs rank Euclidean distance to a fixed fingerprint library. PLATO explains the measurements and is instructed not to invent a missing regime.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Sources and timing</h2>
          <p className="mt-4 leading-relaxed text-[#C9D4E0]">
            FRED is the primary statistics path. Polygon supplies daily equity aggregates. Yahoo supplies quote-board snapshots, including indexes, VIX, FX, and commodities. CoinGecko supplies crypto market statistics. There is no direct BLS, BEA, or Treasury.gov client. CPI, unemployment, and Treasury yields are used where FRED republishes them. Daily FRED values are latest published observations. Monthly values lag. Equity regime inputs are daily bars, not a tick tape. CoinGecko reads are cached for about 90 seconds per asset and about 3 minutes for the crypto stress score.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Historical comparison</h2>
          <p className="mt-4 leading-relaxed text-[#C9D4E0]">
            The pressure analog library contains fixed, hand-set reference fingerprints labeled 1973, 1998, 2000, 2008, 2020, and 2022; they are reference profiles for historical stress episodes, not fitted or independently validated. The broader library adds 2011, 2015, 2019, and 2023. Similarity is not an outcome. An audit helper can rebuild the weighted sum from stored vector scores and explicitly refuses a raw-input backtest, because legacy months do not carry SOFR, PPI, or vintages. Research stress windows used around the regime model are validation labels. They are not used to fit that model, and they are not a live warning record.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-white">Limitations</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-[#C9D4E0]">
            <li>High pressure does not mean an immediate crash. Low pressure does not mean risk is absent.</li>
            <li>Relationships can change. Series are revised. Some series are late.</li>
            <li>The framework produces false positives and false negatives.</li>
            <li>Weights and bands are fixed. They are not re-estimated on each refresh.</li>
            <li>{PUBLIC_DISCLAIMER} It is not a solicitation to buy or sell any security.</li>
          </ul>
        </section>

        <FullInventory />
      </main>
    </div>
  );
}
