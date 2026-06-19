import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicAnalogs() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicAnalogs}
      badge="HISTORICAL ANALOG ENGINE"
      headline={"Which Crash Does Today\nMost Resemble?"}
      subheadline="Pattern-match today's macro conditions against 2000, 2008, 2020, and 2022. See which historical fracture your regime most resembles, the timeline of what followed, and how top funds were positioned at each stage."
      ctaLabel="VIEW CRASH ANALOGS"
      ctaHref="/app/analogs"
      accentColor="#A855F7"
      features={[
        { icon: "◈", title: "2000 Dot-Com Analog", desc: "Match today's AI concentration and valuation regime against the 2000 dot-com collapse. See the timeline of what followed and where we are in the cycle." },
        { icon: "◎", title: "2008 GFC Analog", desc: "Compare current credit spread dynamics and liquidity conditions against the 2008 Global Financial Crisis. Know which stage of the analog you're in." },
        { icon: "⬡", title: "2020 COVID Analog", desc: "Identify regime similarities with the 2020 COVID shock: velocity of decline, liquidity response, and recovery pathway." },
        { icon: "◈", title: "2022 Rate Shock Analog", desc: "Pattern-match today's rate sensitivity and duration risk against the 2022 rate shock regime. Know which assets were most vulnerable at each stage." },
        { icon: "◎", title: "Regime Similarity Score", desc: "A quantified similarity score between current conditions and each historical analog. Know which fracture your regime most resembles." },
        { icon: "⬡", title: "Outcome Analysis", desc: "See what happened next in each analog: drawdown depth, recovery timeline, and which asset classes led the recovery." },
      ]}
    />
  );
}
