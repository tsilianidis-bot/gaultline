/**
 * AdminPromoDashboard — /admin/promo
 *
 * Private admin-only dashboard for FACEBOOK30 campaign analytics.
 * Shows: campaign stats, milestone log, full redemption table.
 * Never accessible to non-admin users.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl p-5">
      <p className="text-xs text-[#8899aa] font-mono tracking-widest uppercase mb-2">{label}</p>
      <p className={`text-3xl font-light ${accent ? "text-cyan-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-[#556677] mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminPromoDashboard() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [campaignCode] = useState("FACEBOOK30");

  const { data, isLoading, error, refetch } = trpc.promo.adminGetCampaign.useQuery(
    { code: campaignCode },
    { enabled: !!user && user.role === "admin" }
  );

  // Auth guard
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">Access Denied</p>
          <Button onClick={() => navigate("/")} variant="outline" className="border-[#1e3a5f] text-[#8899aa]">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error.message}</p>
          <Button onClick={() => refetch()} variant="outline" className="border-[#1e3a5f] text-cyan-400">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { campaign, stats, redemptions } = data;

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatDateTime = (d: Date | string) =>
    new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      {/* Header */}
      <div className="border-b border-[#1e3a5f]/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="text-[#8899aa] hover:text-white transition-colors text-sm">
            ← Admin
          </button>
          <div>
            <h1 className="text-lg font-light tracking-wide">Campaign Analytics</h1>
            <p className="text-xs text-[#8899aa] font-mono">{campaign.code} · {campaign.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={campaign.active
            ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
            : "bg-red-400/10 text-red-400 border-red-400/20"
          }>
            {campaign.active ? "ACTIVE" : "DEACTIVATED"}
          </Badge>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="border-[#1e3a5f] text-[#8899aa] hover:text-white text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Campaign info bar */}
        <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl px-6 py-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[#8899aa]">Trial Duration: </span>
            <span className="text-white">{campaign.trialDays} days</span>
          </div>
          <div>
            <span className="text-[#8899aa]">Access Tier: </span>
            <span className="text-cyan-400 capitalize">{campaign.trialTier}</span>
          </div>
          <div>
            <span className="text-[#8899aa]">Max Redemptions: </span>
            <span className="text-white">{campaign.maxRedemptions}</span>
          </div>
          <div>
            <span className="text-[#8899aa]">Created: </span>
            <span className="text-white">{formatDate(campaign.createdAt)}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Total Redemptions" value={stats.totalRedemptions} sub={`of ${campaign.maxRedemptions} max`} accent />
          <StatCard label="Remaining" value={stats.remaining} sub="slots available" />
          <StatCard label="Active Trials" value={stats.activeTrials} sub="currently live" />
          <StatCard label="Expired Trials" value={stats.expiredTrials} sub="trial ended" />
          <StatCard label="Engaged" value={stats.engaged} sub="logged in after activation" />
          <StatCard label="Converted" value={stats.converted} sub="paid subscribers" />
          <StatCard label="Conv. Rate" value={`${stats.conversionRate}%`} sub="trial → paid" accent />
        </div>

        {/* Progress bar */}
        <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl p-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-[#8899aa] font-mono tracking-widest uppercase">Redemption Progress</p>
            <p className="text-sm text-white">
              <span className="text-cyan-400 font-semibold">{stats.totalRedemptions}</span>
              <span className="text-[#8899aa]"> / {campaign.maxRedemptions}</span>
            </p>
          </div>
          <div className="h-2 bg-[#1e3a5f]/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (stats.totalRedemptions / campaign.maxRedemptions) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-[#556677]">0</span>
            <span className="text-xs text-[#556677]">75 milestone</span>
            <span className="text-xs text-[#556677]">90 milestone</span>
            <span className="text-xs text-[#556677]">{campaign.maxRedemptions}</span>
          </div>
        </div>

        {/* Redemption table */}
        <div className="bg-[#0d1520] border border-[#1e3a5f]/50 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e3a5f]/40 flex items-center justify-between">
            <p className="text-sm font-medium text-white">All Redemptions</p>
            <p className="text-xs text-[#8899aa]">{redemptions.length} total</p>
          </div>

          {redemptions.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#8899aa] text-sm">
              No redemptions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]/30">
                    {["#", "Name", "Email", "Activated", "Trial Expires", "Status", "Engaged", "Converted"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-[#8899aa] font-mono tracking-wider uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#1e3a5f]/20 hover:bg-[#1e3a5f]/10 transition-colors ${i % 2 === 0 ? "" : "bg-[#0a1018]"}`}
                    >
                      <td className="px-4 py-3 text-cyan-400 font-mono text-xs">{r.redemptionNumber}</td>
                      <td className="px-4 py-3 text-white">{r.name || "—"}</td>
                      <td className="px-4 py-3 text-[#8899aa] font-mono text-xs">{r.email}</td>
                      <td className="px-4 py-3 text-[#8899aa] text-xs">{formatDateTime(r.activatedAt)}</td>
                      <td className="px-4 py-3 text-[#8899aa] text-xs">{formatDate(r.trialExpiresAt)}</td>
                      <td className="px-4 py-3">
                        <Badge className={r.trialActive
                          ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-xs"
                          : "bg-[#1e3a5f]/40 text-[#8899aa] border-[#1e3a5f]/40 text-xs"
                        }>
                          {r.trialActive ? "Active" : "Expired"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {r.engaged ? (
                          <span className="text-emerald-400 text-xs">✓</span>
                        ) : (
                          <span className="text-[#556677] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.converted ? (
                          <span className="text-cyan-400 text-xs font-semibold">✓ Paid</span>
                        ) : (
                          <span className="text-[#556677] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-[#334455] text-center pb-4">
          This dashboard is private and never visible to users. Admin access only.
        </p>
      </div>
    </div>
  );
}
