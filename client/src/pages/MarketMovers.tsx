/* ============================================================
   FAULTLINE — Market Movers
   Top gainers, losers, and most active stocks as new data is published.
   ============================================================ */
import { useSEO } from "@/hooks/useSEO";
import MarketOverview from "@/components/MarketOverview";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageHeader from "@/components/PageHeader";
import { useEngine } from "@/contexts/EngineContext";
import { evidenceStatusBadgeColor, evidenceStatusFromIntegrity } from "../../../shared/evidenceStatus";
export default function MarketMovers() {
  const { integrityLabel } = useEngine();
  const moverStatus = evidenceStatusFromIntegrity(integrityLabel);
  useSEO({
    title: "FAULTLINE — Market Movers",
    description: "Top gainers, losers, and most active stocks. Market intelligence powered by FAULTLINE.",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#050608" }}>
      <DisclaimerBanner />
      <PageHeader
        title="MARKET MOVERS"
        subtitle="Top gainers, losers & most active"
        badge={moverStatus}
        badgeColor={evidenceStatusBadgeColor(moverStatus)}
      />
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 16px 48px" }}>
        <MarketOverview />
      </div>
    </div>
  );
}
