import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicSignals() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicSignals}
      badge="STOCK INTELLIGENCE · MEMBER ROUTE"
      headline={"Stock Signals\nIn Market Context"}
      subheadline="Explore FAULTLINE's public methodology and Pressure Index, then use an eligible existing membership to access the product signal route. Source availability and as-of context belong with each product reading; this page does not publish a trade instruction."
      ctaLabel="OPEN SIGNALS ROUTE"
      ctaHref="/app/signals"
      accentColor="#00D4FF"
      features={[
        { icon: "◈", title: "Market Context", desc: "The product places asset research alongside macro-regime and systemic-pressure context. It is not a personal recommendation." },
        { icon: "◎", title: "Evidence-Aware Readings", desc: "Use the source, timestamp, availability, and methodology disclosures attached to a product reading before drawing a conclusion." },
        { icon: "⬡", title: "AI-Concentration Context", desc: "The Pressure Index's AI / speculation input is a static reference baseline, not a live AI-capex or market-cap feed." },
        { icon: "◈", title: "Liquidity Context", desc: "Liquidity and funding conditions are part of the published systemic-pressure framework; a missing product reading is shown as unavailable rather than substituted." },
        { icon: "◎", title: "Access Boundaries", desc: "The signals product route is subject to existing membership and access controls. This public page does not bypass them." },
        { icon: "⬡", title: "No Performance Promise", desc: "FAULTLINE does not guarantee returns, timing, or a particular market outcome." },
      ]}
    />
  );
}
