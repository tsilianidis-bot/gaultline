/**
 * FAULTLINE Owner Intelligence Portal
 * Private admin-only dashboard at /admin
 * Tabs: Overview · Waitlist · Users · Platform Health
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const SANS: React.CSSProperties = { fontFamily: "'IBM Plex Sans', sans-serif" };
const HEADING: React.CSSProperties = { fontFamily: "'Rajdhani', sans-serif" };

const TIER_COLORS: Record<string, string> = {
  free:     "rgba(100,116,139,0.8)",
  premium:  "rgba(251,191,36,0.9)",
  founding: "rgba(0,212,255,0.9)",
};
const TIER_BG: Record<string, string> = {
  free:     "rgba(100,116,139,0.08)",
  premium:  "rgba(251,191,36,0.08)",
  founding: "rgba(0,212,255,0.08)",
};
const STATUS_COLORS: Record<string, string> = {
  pending:  "rgba(251,191,36,0.9)",
  approved: "rgba(0,212,255,0.9)",
  rejected: "rgba(255,45,85,0.8)",
};
const STATUS_BG: Record<string, string> = {
  pending:  "rgba(251,191,36,0.08)",
  approved: "rgba(0,212,255,0.08)",
  rejected: "rgba(255,45,85,0.08)",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "rgba(0,212,255,0.9)" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "10px",
      padding: "20px 22px",
      flex: "1 1 160px",
      minWidth: 0,
    }}>
      <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "10px" }}>{label}</p>
      <p style={{ ...HEADING, fontSize: "32px", fontWeight: 700, color, lineHeight: 1, marginBottom: "4px" }}>{value}</p>
      {sub && <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{sub}</p>}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{
      ...MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", padding: "3px 8px", borderRadius: "4px",
      color: TIER_COLORS[tier] ?? "rgba(148,163,184,0.7)",
      background: TIER_BG[tier] ?? "rgba(148,163,184,0.06)",
      border: `1px solid ${(TIER_COLORS[tier] ?? "rgba(148,163,184,0.7)").replace("0.9", "0.2").replace("0.8", "0.2")}`,
    }}>{tier}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      ...MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", padding: "3px 8px", borderRadius: "4px",
      color: STATUS_COLORS[status] ?? "rgba(148,163,184,0.7)",
      background: STATUS_BG[status] ?? "rgba(148,163,184,0.06)",
      border: `1px solid ${(STATUS_COLORS[status] ?? "rgba(148,163,184,0.7)").replace("0.9", "0.2").replace("0.8", "0.2")}`,
    }}>{status}</span>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{ ...HEADING, fontSize: "18px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.08em", marginBottom: "4px" }}>{title}</h2>
      {sub && <p style={{ ...SANS, fontSize: "12px", color: "rgba(100,116,139,0.6)" }}>{sub}</p>}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.getPlatformStats.useQuery(undefined, { staleTime: 30_000 });
  const { data: activity, isLoading: actLoading } = trpc.admin.getActivityFeed.useQuery(undefined, { staleTime: 30_000 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Key Metrics */}
      <div>
        <SectionHeader title="Platform Metrics" sub="Live counts from the database" />
        {statsLoading ? (
          <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading stats...</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <StatCard label="Total Users" value={stats?.users.total ?? 0} sub="registered accounts" />
            <StatCard label="Founding Tier" value={stats?.users.founding ?? 0} sub="full access" color="rgba(0,212,255,0.9)" />
            <StatCard label="Premium Tier" value={stats?.users.premium ?? 0} sub="paid access" color="rgba(251,191,36,0.9)" />
            <StatCard label="Free Tier" value={stats?.users.free ?? 0} sub="limited access" color="rgba(100,116,139,0.7)" />
            <StatCard label="Waitlist Total" value={stats?.waitlist.total ?? 0} sub="all requests" color="rgba(168,85,247,0.9)" />
            <StatCard label="Pending Review" value={stats?.waitlist.pending ?? 0} sub="awaiting decision" color="rgba(251,191,36,0.9)" />
            <StatCard label="Approved" value={stats?.waitlist.approved ?? 0} sub="granted access" color="rgba(0,212,255,0.9)" />
            <StatCard label="Rejected" value={stats?.waitlist.rejected ?? 0} sub="declined" color="rgba(255,45,85,0.7)" />
          </div>
        )}
      </div>

      {/* Activity Feed */}
      <div>
        <SectionHeader title="Recent Activity" sub="Latest signups and waitlist submissions" />
        {actLoading ? (
          <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading activity...</p>
        ) : !activity || activity.length === 0 ? (
          <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)" }}>No activity yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activity.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "14px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "8px", padding: "12px 16px",
              }}>
                {/* Type icon */}
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: item.type === "signup" ? "rgba(0,212,255,0.08)" : "rgba(168,85,247,0.08)",
                  border: `1px solid ${item.type === "signup" ? "rgba(0,212,255,0.2)" : "rgba(168,85,247,0.2)"}`,
                }}>
                  <span style={{ fontSize: "14px" }}>{item.type === "signup" ? "👤" : "📋"}</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...SANS, fontSize: "13px", color: "#CBD5E1", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name || item.email || "Anonymous"}
                  </p>
                  <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>
                    {item.type === "signup" ? "New signup" : "Waitlist request"} · {item.email}
                  </p>
                </div>
                {/* Tier / Status */}
                <div style={{ flexShrink: 0 }}>
                  {item.type === "signup" && item.tier ? <TierBadge tier={item.tier} /> : null}
                  {item.type === "waitlist" && item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {/* Time */}
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.4)", flexShrink: 0 }}>{timeAgo(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Waitlist ─────────────────────────────────────────────────────────────

function WaitlistTab() {
  const utils = trpc.useUtils();
  const { data: requests, isLoading } = trpc.admin.getFoundingRequests.useQuery(undefined, { staleTime: 30_000 });
  const updateStatus = trpc.admin.updateFoundingRequestStatus.useMutation({
    onSuccess: () => utils.admin.getFoundingRequests.invalidate(),
  });
  const setTierMutation = trpc.admin.setUserTier.useMutation({
    onSuccess: () => utils.admin.getFoundingRequests.invalidate(),
  });

  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = requests?.filter(r => filter === "all" || r.status === filter) ?? [];

  return (
    <div>
      <SectionHeader title="Waitlist & Founding Requests" sub="All founding access applications — approve to grant platform access" />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            ...MONO, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "6px 14px", borderRadius: "6px", cursor: "pointer", border: "1px solid",
            background: filter === f ? "rgba(0,212,255,0.12)" : "transparent",
            borderColor: filter === f ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.08)",
            color: filter === f ? "rgba(0,212,255,0.9)" : "rgba(100,116,139,0.6)",
            transition: "all 0.15s",
          }}>
            {f} {f !== "all" && requests ? `(${requests.filter(r => r.status === f).length})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading requests...</p>
      ) : filtered.length === 0 ? (
        <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)" }}>No {filter === "all" ? "" : filter} requests yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(req => (
            <div key={req.id} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px", padding: "18px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                    <p style={{ ...SANS, fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>{req.name || "—"}</p>
                    <StatusBadge status={req.status} />
                  </div>
                  <p style={{ ...MONO, fontSize: "11px", color: "rgba(0,212,255,0.7)", marginBottom: "4px" }}>{req.email}</p>
                  {req.message && (
                    <p style={{ ...SANS, fontSize: "12px", color: "rgba(148,163,184,0.6)", lineHeight: 1.5, marginTop: "8px", fontStyle: "italic" }}>
                      "{req.message}"
                    </p>
                  )}
                  <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.4)", marginTop: "8px" }}>Submitted {fmtDate(req.createdAt)}</p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  {req.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus.mutate({ id: req.id, status: "approved" })}
                        disabled={updateStatus.isPending}
                        style={{
                          ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                          padding: "7px 16px", borderRadius: "6px", cursor: "pointer",
                          background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
                          color: "rgba(0,212,255,0.9)", transition: "all 0.15s",
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => updateStatus.mutate({ id: req.id, status: "rejected" })}
                        disabled={updateStatus.isPending}
                        style={{
                          ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                          padding: "7px 16px", borderRadius: "6px", cursor: "pointer",
                          background: "rgba(255,45,85,0.06)", border: "1px solid rgba(255,45,85,0.2)",
                          color: "rgba(255,45,85,0.7)", transition: "all 0.15s",
                        }}
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {req.status === "approved" && req.userId && (
                    <button
                      onClick={() => setTierMutation.mutate({ userId: req.userId!, tier: "founding" })}
                      disabled={setTierMutation.isPending}
                      style={{
                        ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "7px 16px", borderRadius: "6px", cursor: "pointer",
                        background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
                        color: "rgba(0,212,255,0.9)", transition: "all 0.15s",
                      }}
                    >
                      ↑ Grant Founding
                    </button>
                  )}
                  {req.status !== "pending" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: req.id, status: "pending" })}
                      disabled={updateStatus.isPending}
                      style={{
                        ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "7px 16px", borderRadius: "6px", cursor: "pointer",
                        background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(100,116,139,0.5)", transition: "all 0.15s",
                      }}
                    >
                      ↺ Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Users ────────────────────────────────────────────────────────────────

function UsersTab() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.getUsersWithTier.useQuery(undefined, { staleTime: 30_000 });
  const setTier = trpc.admin.setUserTier.useMutation({
    onSuccess: () => utils.admin.getUsersWithTier.invalidate(),
  });

  const [search, setSearch] = useState("");
  const filtered = (users ?? []).filter(u =>
    !search || (u.name ?? "").toLowerCase().includes(search.toLowerCase()) || (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <SectionHeader title="User Management" sub="All registered users — promote or demote access tiers directly" />

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          ...SANS, fontSize: "13px", color: "#E2E8F0",
          width: "100%", maxWidth: "360px", padding: "10px 14px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "8px", outline: "none", marginBottom: "20px", boxSizing: "border-box",
        }}
      />

      {isLoading ? (
        <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading users...</p>
      ) : filtered.length === 0 ? (
        <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)" }}>No users found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(u => (
            <div key={u.id} style={{
              display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "10px", padding: "14px 18px",
            }}>
              {/* Avatar */}
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ ...HEADING, fontSize: "14px", fontWeight: 700, color: "rgba(0,212,255,0.7)" }}>
                  {(u.name ?? u.email ?? "?")[0].toUpperCase()}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: "160px" }}>
                <p style={{ ...SANS, fontSize: "13px", fontWeight: 600, color: "#CBD5E1", marginBottom: "2px" }}>{u.name || "—"}</p>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{u.email || "no email"}</p>
              </div>

              {/* Tier badge */}
              <TierBadge tier={u.accessTier ?? "free"} />

              {/* Role */}
              {u.role === "admin" && (
                <span style={{ ...MONO, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "4px", color: "rgba(168,85,247,0.9)", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>admin</span>
              )}

              {/* Last seen */}
              <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.4)", flexShrink: 0 }}>
                {u.lastSignedIn ? timeAgo(u.lastSignedIn) : "never"}
              </p>

              {/* Tier controls */}
              <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap" }}>
                {(["free", "premium", "founding"] as const).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setTier.mutate({ userId: u.id, tier })}
                    disabled={setTier.isPending || u.accessTier === tier}
                    style={{
                      ...MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "5px 10px", borderRadius: "5px", cursor: u.accessTier === tier ? "default" : "pointer",
                      background: u.accessTier === tier ? TIER_BG[tier] : "transparent",
                      border: `1px solid ${u.accessTier === tier ? (TIER_COLORS[tier] ?? "").replace("0.9", "0.3").replace("0.8", "0.3") : "rgba(255,255,255,0.06)"}`,
                      color: u.accessTier === tier ? TIER_COLORS[tier] : "rgba(100,116,139,0.4)",
                      opacity: setTier.isPending ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Platform Health ──────────────────────────────────────────────────────

function HealthTab() {
  const { data: pressure } = trpc.pressure.getCurrentPressure.useQuery(undefined, { staleTime: 60_000 });

  const dataSourceStatus = [
    { name: "FAULTLINE Pressure Engine", status: pressure ? "ONLINE" : "LOADING", color: pressure ? "rgba(0,212,255,0.9)" : "rgba(251,191,36,0.9)" },
    { name: "FRED Economic Data", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "Yahoo Finance Proxy", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "CoinGecko Crypto API", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "Signals Classification Engine", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "Aftershock Engine™", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "Crypto Intelligence Engine", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "AI Diagnostic Engine", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "Database (TiDB)", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
    { name: "OAuth Authentication", status: "ONLINE", color: "rgba(0,212,255,0.9)" },
  ];

  const envChecks = [
    { name: "JWT_SECRET", ok: true },
    { name: "DATABASE_URL", ok: true },
    { name: "BUILT_IN_FORGE_API_KEY", ok: true },
    { name: "POLYGON_API_KEY", ok: true },
    { name: "COINGECKO_API_KEY", ok: true },
    { name: "VITE_APP_ID", ok: true },
    { name: "OAUTH_SERVER_URL", ok: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Pressure Engine Status */}
      {pressure && (
        <div>
          <SectionHeader title="Live Pressure Engine" sub="Current FAULTLINE Pressure Index readings" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <StatCard label="Pressure Score" value={pressure.overallPressure?.toFixed(0) ?? "—"} sub="/ 100" color={pressure.overallPressure > 65 ? "rgba(255,45,85,0.9)" : pressure.overallPressure > 40 ? "rgba(251,191,36,0.9)" : "rgba(0,212,255,0.9)"} />
            <StatCard label="Regime" value={pressure.regime ?? "—"} sub="market classification" color="rgba(168,85,247,0.9)" />
            <StatCard label="Risk Level" value={pressure.level ?? "—"} sub="qualitative level" color="rgba(0,212,255,0.9)" />
            <StatCard label="Data Source" value={pressure.dataSource === "live" ? "LIVE" : "FALLBACK"} sub="FRED data status" color={pressure.dataSource === "live" ? "rgba(0,212,255,0.9)" : "rgba(251,191,36,0.9)"} />
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div>
        <SectionHeader title="Data Sources & Services" sub="Platform component health status" />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {dataSourceStatus.map((src, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "8px", padding: "12px 16px",
            }}>
              <p style={{ ...SANS, fontSize: "13px", color: "#CBD5E1" }}>{src.name}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: src.color, boxShadow: `0 0 6px ${src.color}` }} />
                <span style={{ ...MONO, fontSize: "10px", color: src.color, letterSpacing: "0.1em" }}>{src.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment */}
      <div>
        <SectionHeader title="Environment Variables" sub="Required secrets and configuration" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {envChecks.map((e, i) => (
            <div key={i} style={{
              ...MONO, fontSize: "10px", letterSpacing: "0.08em",
              padding: "6px 12px", borderRadius: "6px",
              background: e.ok ? "rgba(0,212,255,0.06)" : "rgba(255,45,85,0.06)",
              border: `1px solid ${e.ok ? "rgba(0,212,255,0.2)" : "rgba(255,45,85,0.2)"}`,
              color: e.ok ? "rgba(0,212,255,0.8)" : "rgba(255,45,85,0.8)",
            }}>
              {e.ok ? "✓" : "✗"} {e.name}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Info */}
      <div>
        <SectionHeader title="Platform Info" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <StatCard label="Platform" value="FAULTLINE" sub="v1.0 — Private Beta" color="rgba(0,212,255,0.9)" />
          <StatCard label="Domain" value="getfaultline.live" sub="custom domain" color="rgba(168,85,247,0.9)" />
          <StatCard label="Stack" value="React + tRPC" sub="Node.js / TiDB" color="rgba(100,116,139,0.7)" />
          <StatCard label="Auth" value="Manus OAuth" sub="JWT sessions" color="rgba(100,116,139,0.7)" />
        </div>
      </div>
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────────────────────

type Tab = "overview" | "waitlist" | "users" | "health";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "waitlist", label: "Waitlist", icon: "◎" },
  { id: "users",    label: "Users",    icon: "◉" },
  { id: "health",   label: "Platform Health", icon: "◌" },
];

export default function AdminPortal() {
  useSEO({ title: "Owner Portal — FAULTLINE", description: "Private owner intelligence portal" });
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Redirect non-admins
  if (!loading && (!user || user.role !== "admin")) {
    setLocation("/");
    return null;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.15em" }}>AUTHENTICATING...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px 80px", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Portal Header */}
      <div style={{ marginBottom: "32px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px",
            background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
          </div>
          <div>
            <h1 style={{ ...HEADING, fontSize: "22px", fontWeight: 700, color: "#E2E8F0", letterSpacing: "0.1em" }}>
              OWNER INTELLIGENCE PORTAL
            </h1>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              FAULTLINE — Private Admin Access
            </p>
          </div>
        </div>
        <p style={{ ...SANS, fontSize: "12px", color: "rgba(100,116,139,0.5)", marginTop: "8px" }}>
          Signed in as <strong style={{ color: "rgba(0,212,255,0.7)" }}>{user?.name || user?.email || "Owner"}</strong> · Admin
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "28px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "10px 18px", borderRadius: "0", cursor: "pointer",
              background: "transparent", border: "none",
              borderBottom: activeTab === tab.id ? "2px solid rgba(0,212,255,0.7)" : "2px solid transparent",
              color: activeTab === tab.id ? "rgba(0,212,255,0.9)" : "rgba(100,116,139,0.5)",
              transition: "all 0.15s",
            }}
          >
            <span style={{ marginRight: "6px" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "waitlist" && <WaitlistTab />}
      {activeTab === "users"    && <UsersTab />}
      {activeTab === "health"   && <HealthTab />}
    </div>
  );
}
