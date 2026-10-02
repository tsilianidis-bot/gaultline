import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicAnalogs() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicAnalogs}
      badge="HISTORICAL ANALOG ENGINE"
      headline={"Which Crash Does Today\nMost Resemble?"}
      subheadline="Compare today's pressure-vector profile — liquidity, credit, AI concentration, and macro sensitivity — with fixed reference profiles of six past stress episodes: 1973, 1998, 2000, 2008, 2020, and 2022. See which historical fracture today most resembles. Resemblance, not a forecast of what follows."
      ctaLabel="VIEW CRASH ANALOGS"
      ctaHref="/app/analogs"
      accentColor="#A855F7"
      features={[
        { icon: "◈", title: "2000 Dot-Com Analog", desc: "Compare today's AI-concentration and macro profile with the 2000 dot-com reference profile and see how closely they resemble each other." },
        { icon: "◎", title: "2008 GFC Analog", desc: "Compare current credit and liquidity stress with the 2008 Global Financial Crisis reference profile." },
        { icon: "⬡", title: "2020 COVID Analog", desc: "Compare current liquidity and credit stress with the 2020 COVID shock reference profile." },
        { icon: "◈", title: "2022 Rate Shock Analog", desc: "Compare today's macro-sensitivity profile — inflation and policy rates — with the 2022 rate shock reference profile." },
        { icon: "◎", title: "Regime Similarity Score", desc: "A similarity score from the distance between today's vector profile and each reference profile. Know which fracture today most resembles." },
        { icon: "⬡", title: "Episode Context", desc: "A short description of each reference episode — what drove it and how stress built. Reference profiles are fixed and hand-set; they are not forward-return distributions." },
      ]}
    />
  );
}
