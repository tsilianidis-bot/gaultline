import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicSituationRoom() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicSituationRoom}
      badge="SITUATION ROOM — PRE-TRADE BRIEF"
      headline={"Stress-Test Your Next Move\nBefore You Risk Capital"}
      subheadline="Run your next trade through the pressure engine before you risk capital. Get a probability-weighted favorability score, threat board, green lights, and action bias — the pre-trade brief that institutional desks do internally."
      ctaLabel="ENTER SITUATION ROOM"
      ctaHref="/app/situation-room"
      accentColor="#FFD700"
      features={[
        { icon: "◈", title: "Favorability Score", desc: "A probability-weighted score for your next move. Know the odds before you risk capital — not after." },
        { icon: "◎", title: "Threat Board", desc: "Eight risk dimensions assessed against your specific trade: regime pressure, crash risk, liquidity, credit, volatility, AI speculation, and sector signals." },
        { icon: "⬡", title: "Regime Pressure Check", desc: "Is the current macro regime aligned with your trade? Know before you pull the trigger." },
        { icon: "◈", title: "Crash Risk Assessment", desc: "Quantified crash probability for your specific asset and timeframe. Know your tail risk before it materializes." },
        { icon: "◎", title: "Action Bias", desc: "Clear action bias output: favorable, neutral, or unfavorable. The same pre-trade brief institutional desks run internally." },
        { icon: "⬡", title: "Green Light / Red Flag", desc: "Explicit green lights and red flags for your trade. No ambiguity. No noise. Just the signal that matters." },
      ]}
    />
  );
}
