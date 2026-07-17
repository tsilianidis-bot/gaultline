/* ============================================================
   FAULTLINE — Market Movers
   Top gainers, losers, and most active stocks in real time.
   ============================================================ */
import { useSEO } from "@/hooks/useSEO";
import MarketOverview from "@/components/MarketOverview";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageHeader from "@/components/PageHeader";
export default function MarketMovers() {
  useSEO({
    title: "FAULTLINE — Market Movers",
    description: "Real-time top gainers, losers, and most active stocks. Live market intelligence powered by FAULTLINE.",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#050608" }}>
      <DisclaimerBanner />
      <PageHeader
        title="MARKET MOVERS"
        subtitle="Top gainers, losers & most active — live"
        badge="LIVE"
        badgeColor="green"
      />
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 16px 48px" }}>
        <MarketOverview />
      </div>
    </div>
  );
}
