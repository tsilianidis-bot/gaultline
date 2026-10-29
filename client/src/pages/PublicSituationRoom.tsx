import PublicLandingPage from "./PublicLandingPage";
import { PAGE_SEO } from "@/hooks/useSEO";

export default function PublicSituationRoom() {
  return (
    <PublicLandingPage
      seo={PAGE_SEO.publicSituationRoom}
      badge="SITUATION ROOM · MEMBER ROUTE"
      headline={"Frame a Position\nAgainst Market Conditions"}
      subheadline="The member product route assembles FAULTLINE context into a decision-support brief. It is not investment advice, does not guarantee an outcome, and does not publish a calibrated crash probability."
      ctaLabel="OPEN SITUATION ROOM"
      ctaHref="/app/situation-room"
      accentColor="#FFD700"
      features={[
        { icon: "◈", title: "Decision Support", desc: "The product organizes its available market context for review; it does not replace a user's judgment or provide a personal recommendation." },
        { icon: "◎", title: "Pressure Context", desc: "The Pressure Index measures pressure inside its six-vector framework. It is not a crash forecast or event percentage." },
        { icon: "⬡", title: "Evidence Boundaries", desc: "Use the disclosures and availability state displayed with a product reading. Unavailable inputs should remain unavailable rather than be inferred." },
        { icon: "◈", title: "Historical Context", desc: "Reference analogs are fixed, hand-set profiles used for resemblance context, not forward-return distributions." },
        { icon: "◎", title: "Membership Boundary", desc: "The Situation Room route is subject to existing membership and access controls; this page does not bypass them." },
        { icon: "⬡", title: "No Performance Promise", desc: "FAULTLINE does not guarantee returns, timing, or a particular market outcome." },
      ]}
    />
  );
}
