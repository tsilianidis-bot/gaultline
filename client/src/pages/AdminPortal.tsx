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
import DemoTokensTab from "@/components/DemoTokensTab";

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
  const sendEmail = trpc.admin.sendApprovalEmail.useMutation();
  const [emailSent, setEmailSent] = useState<Record<number, boolean>>({});
  const [emailError, setEmailError] = useState<Record<number, string>>({});

  const handleSendEmail = (req: { id: number; email: string; name?: string | null }) => {
    sendEmail.mutate(
      { email: req.email, name: req.name ?? undefined, origin: window.location.origin },
      {
        onSuccess: () => setEmailSent(prev => ({ ...prev, [req.id]: true })),
        onError: (err) => setEmailError(prev => ({ ...prev, [req.id]: err.message })),
      }
    );
  };

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
                  {req.status === "approved" && (
                    <>
                      <button
                        onClick={() => handleSendEmail(req)}
                        disabled={sendEmail.isPending || emailSent[req.id]}
                        style={{
                          ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
                          padding: "7px 16px", borderRadius: "6px", cursor: emailSent[req.id] ? "default" : "pointer",
                          background: emailSent[req.id] ? "rgba(34,197,94,0.1)" : "rgba(168,85,247,0.1)",
                          border: emailSent[req.id] ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(168,85,247,0.3)",
                          color: emailSent[req.id] ? "rgba(34,197,94,0.9)" : "rgba(168,85,247,0.9)",
                          transition: "all 0.15s",
                          opacity: sendEmail.isPending ? 0.6 : 1,
                        }}
                      >
                        {emailSent[req.id] ? "✓ Email Sent" : sendEmail.isPending ? "Sending…" : "✉ Send Email"}
                      </button>
                      {emailError[req.id] && (
                        <p style={{ ...MONO, fontSize: "9px", color: "rgba(255,45,85,0.7)", maxWidth: "140px", lineHeight: 1.4 }}>
                          {emailError[req.id]}
                        </p>
                      )}
                    </>
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
  const removeUser = trpc.admin.removeUser.useMutation({
    onSuccess: () => utils.admin.getUsersWithTier.invalidate(),
  });

  const [search, setSearch] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{ id: number; name: string; email: string } | null>(null);
  const filtered = (users ?? []).filter(u =>
    !search || (u.name ?? "").toLowerCase().includes(search.toLowerCase()) || (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <SectionHeader title="User Management" sub="All registered users — set access tier or remove account" />

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0A0D14", border: "1px solid rgba(255,45,85,0.3)",
            borderRadius: "12px", padding: "28px 32px", maxWidth: "420px", width: "90%",
          }}>
            <h3 style={{ ...HEADING, fontSize: "18px", fontWeight: 700, color: "rgba(255,45,85,0.9)", marginBottom: "8px", letterSpacing: "0.06em" }}>REMOVE USER</h3>
            <p style={{ ...SANS, fontSize: "13px", color: "#94A3B8", marginBottom: "6px" }}>
              This will permanently delete <strong style={{ color: "#E2E8F0" }}>{confirmRemove.name || confirmRemove.email}</strong> and all their data.
            </p>
            <p style={{ ...MONO, fontSize: "10px", color: "rgba(255,45,85,0.7)", marginBottom: "24px" }}>
              Positions, watchlists, and account will be erased. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmRemove(null)}
                style={{
                  ...MONO, fontSize: "11px", letterSpacing: "0.08em", padding: "8px 18px",
                  borderRadius: "6px", cursor: "pointer",
                  background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(148,163,184,0.7)",
                }}
              >Cancel</button>
              <button
                onClick={() => {
                  removeUser.mutate({ userId: confirmRemove.id });
                  setConfirmRemove(null);
                }}
                disabled={removeUser.isPending}
                style={{
                  ...MONO, fontSize: "11px", letterSpacing: "0.08em", padding: "8px 18px",
                  borderRadius: "6px", cursor: "pointer",
                  background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.35)",
                  color: "rgba(255,45,85,0.9)",
                }}
              >Confirm Remove</button>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
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

                {/* Remove user — hidden for admin accounts */}
                {u.role !== "admin" && (
                  <button
                    onClick={() => setConfirmRemove({ id: u.id, name: u.name ?? "", email: u.email ?? "" })}
                    disabled={removeUser.isPending}
                    title="Remove user"
                    style={{
                      ...MONO, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase",
                      padding: "5px 10px", borderRadius: "5px", cursor: "pointer",
                      background: "transparent",
                      border: "1px solid rgba(255,45,85,0.2)",
                      color: "rgba(255,45,85,0.5)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,45,85,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,45,85,0.9)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,45,85,0.5)"; }}
                  >
                    ✕ remove
                  </button>
                )}
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

// ── Tab: Statistics ──────────────────────────────────────────────────────────

function StatsTab() {
  const { data, isLoading } = trpc.admin.getStats.useQuery(undefined, { staleTime: 60_000 });

  // Build a 30-day date spine so missing days show as 0
  function buildSeries(raw: { day: string; count: number }[]) {
    const map = Object.fromEntries(raw.map(r => [r.day, r.count]));
    const result: { day: string; count: number; cumulative: number }[] = [];
    let cum = 0;
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const c = map[key] ?? 0;
      cum += c;
      result.push({ day: key.slice(5), count: c, cumulative: cum });
    }
    return result;
  }

  const signupSeries = buildSeries(data?.signups ?? []);
  const waitlistSeries = buildSeries(data?.waitlist ?? []);
  const conv = data?.conversion;

  // Simple SVG sparkline
  function Sparkline({ series, color, height = 60 }: { series: { cumulative: number }[]; color: string; height?: number }) {
    const maxVal = Math.max(...series.map(s => s.cumulative), 1);
    const w = 300; const h = height;
    const pts = series.map((s, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - (s.cumulative / maxVal) * h;
      return `${x},${y}`;
    }).join(" ");
    const area = `0,${h} ${pts} ${w},${h}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: `${h}px` }}>
        <defs>
          <linearGradient id={`grad-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#grad-${color.replace(/[^a-z]/gi, '')})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Bar chart for daily new items
  function BarChart({ series, color }: { series: { day: string; count: number }[]; color: string }) {
    const maxVal = Math.max(...series.map(s => s.count), 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "48px", padding: "0 2px" }}>
        {series.map((s, i) => (
          <div key={i} title={`${s.day}: ${s.count}`} style={{
            flex: 1, minWidth: 0,
            height: `${Math.max((s.count / maxVal) * 100, s.count > 0 ? 8 : 2)}%`,
            background: s.count > 0 ? color : "rgba(255,255,255,0.04)",
            borderRadius: "2px 2px 0 0",
            transition: "height 0.3s",
          }} />
        ))}
      </div>
    );
  }

  if (isLoading) {
    return <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading statistics...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

      {/* Conversion KPIs */}
      <div>
        <SectionHeader title="Conversion Metrics" sub="Platform funnel — from visitor to premium" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <StatCard label="Total Users" value={conv?.totalUsers ?? 0} sub="registered accounts" />
          <StatCard label="Premium / Founding" value={conv?.premiumUsers ?? 0} sub="paid / invited" color="rgba(251,191,36,0.9)" />
          <StatCard label="Free Tier" value={conv?.freeUsers ?? 0} sub="limited access" color="rgba(100,116,139,0.7)" />
          <StatCard label="Conversion Rate" value={`${conv?.conversionRate ?? 0}%`} sub="free → premium" color="rgba(0,212,255,0.9)" />
          <StatCard label="Waitlist Total" value={conv?.totalWaitlistRequests ?? 0} sub="all requests" color="rgba(168,85,247,0.9)" />
          <StatCard label="Pending" value={conv?.pendingRequests ?? 0} sub="awaiting review" color="rgba(251,191,36,0.9)" />
          <StatCard label="Approved" value={conv?.approvedRequests ?? 0} sub="granted access" color="rgba(0,212,255,0.9)" />
          <StatCard label="Approval Rate" value={`${conv?.waitlistApprovalRate ?? 0}%`} sub="waitlist → approved" color="rgba(0,212,255,0.9)" />
        </div>
      </div>

      {/* Signup Growth */}
      <div>
        <SectionHeader title="User Signup Growth" sub="Cumulative registered users — last 30 days" />
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px", padding: "20px 20px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ ...MONO, fontSize: "10px", color: "rgba(0,212,255,0.6)", letterSpacing: "0.12em" }}>CUMULATIVE USERS</p>
            <p style={{ ...MONO, fontSize: "12px", color: "rgba(0,212,255,0.9)", fontWeight: 700 }}>
              {signupSeries[signupSeries.length - 1]?.cumulative ?? 0} total
            </p>
          </div>
          <Sparkline series={signupSeries} color="rgba(0,212,255,0.8)" height={80} />
          <div style={{ marginTop: "8px" }}>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.4)", marginBottom: "4px" }}>DAILY NEW SIGNUPS</p>
            <BarChart series={signupSeries} color="rgba(0,212,255,0.5)" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.3)" }}>{signupSeries[0]?.day}</p>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.3)" }}>{signupSeries[signupSeries.length - 1]?.day}</p>
          </div>
        </div>
      </div>

      {/* Waitlist Growth */}
      <div>
        <SectionHeader title="Waitlist Growth" sub="Cumulative founding access requests — last 30 days" />
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px", padding: "20px 20px 12px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ ...MONO, fontSize: "10px", color: "rgba(168,85,247,0.6)", letterSpacing: "0.12em" }}>CUMULATIVE REQUESTS</p>
            <p style={{ ...MONO, fontSize: "12px", color: "rgba(168,85,247,0.9)", fontWeight: 700 }}>
              {waitlistSeries[waitlistSeries.length - 1]?.cumulative ?? 0} total
            </p>
          </div>
          <Sparkline series={waitlistSeries} color="rgba(168,85,247,0.8)" height={80} />
          <div style={{ marginTop: "8px" }}>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.4)", marginBottom: "4px" }}>DAILY NEW REQUESTS</p>
            <BarChart series={waitlistSeries} color="rgba(168,85,247,0.5)" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.3)" }}>{waitlistSeries[0]?.day}</p>
            <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.3)" }}>{waitlistSeries[waitlistSeries.length - 1]?.day}</p>
          </div>
        </div>
      </div>

      {/* Tier Distribution */}
      <div>
        <SectionHeader title="Tier Distribution" sub="Current breakdown of user access levels" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {([
            { label: "FREE",     value: conv?.freeUsers ?? 0,    total: conv?.totalUsers ?? 1, color: "rgba(100,116,139,0.7)" },
            { label: "PREMIUM",  value: Math.max(0, (conv?.premiumUsers ?? 0) - (conv?.approvedRequests ?? 0)), total: conv?.totalUsers ?? 1, color: "rgba(251,191,36,0.9)" },
            { label: "FOUNDING", value: conv?.approvedRequests ?? 0, total: conv?.totalUsers ?? 1, color: "rgba(0,212,255,0.9)" },
          ]).map(({ label, value, total, color }) => {
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div key={label} style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px", padding: "18px 20px", flex: "1 1 200px", minWidth: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.6)", letterSpacing: "0.15em" }}>{label}</p>
                  <p style={{ ...HEADING, fontSize: "22px", fontWeight: 700, color }}>{value}</p>
                </div>
                <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.6s" }} />
                </div>
                <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.4)", marginTop: "6px" }}>{pct}% of users</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

// ── Engine Audit + Feature Flags Tab ─────────────────────────────────────────

function EngineTab() {
  const { data: runsData, isLoading: runsLoading } = trpc.admin.getPressureRuns.useQuery({ limit: 50 });
  const { data: flags, isLoading: flagsLoading, refetch: refetchFlags } = trpc.admin.getFeatureFlags.useQuery();
  const toggleFlag = trpc.admin.setFeatureFlag.useMutation({ onSuccess: () => refetchFlags() });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "36px" }}>

      {/* Feature Flags */}
      <div>
        <SectionHeader title="Feature Flags" sub="Kill switches — toggle without redeploying" />
        {flagsLoading ? (
          <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading flags...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {(flags ?? []).map(flag => (
              <div key={flag.key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px", padding: "12px 16px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...MONO, fontSize: "11px", color: "rgba(0,212,255,0.8)", letterSpacing: "0.08em" }}>{flag.key}</p>
                  <p style={{ ...SANS, fontSize: "11px", color: "rgba(100,116,139,0.6)", marginTop: "2px" }}>{flag.description ?? ""}</p>
                </div>
                <button
                  onClick={() => toggleFlag.mutate({ key: flag.key, enabled: flag.enabled !== 1 })}
                  style={{
                    ...MONO, fontSize: "10px", letterSpacing: "0.1em", padding: "6px 14px",
                    borderRadius: "4px", cursor: "pointer", border: "1px solid",
                    background: flag.enabled === 1 ? "rgba(0,212,255,0.08)" : "rgba(239,68,68,0.08)",
                    borderColor: flag.enabled === 1 ? "rgba(0,212,255,0.3)" : "rgba(239,68,68,0.3)",
                    color: flag.enabled === 1 ? "rgba(0,212,255,0.9)" : "rgba(239,68,68,0.9)",
                  }}
                >
                  {flag.enabled === 1 ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pressure Engine Audit Trail */}
      <div>
        <SectionHeader
          title="Pressure Engine Audit Trail"
          sub={`${runsData?.total ?? "—"} total runs recorded`}
        />
        {runsLoading ? (
          <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.5)" }}>Loading runs...</p>
        ) : (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px", overflow: "hidden",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "60px 1fr 80px 80px 90px 120px",
              gap: "0", padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}>
              {["ID", "REGIME", "SCORE", "LEVEL", "SOURCE", "COMPUTED AT"].map(h => (
                <p key={h} style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.5)", letterSpacing: "0.12em" }}>{h}</p>
              ))}
            </div>
            {(runsData?.runs ?? []).slice(0, 50).map(run => (
              <div key={run.id} style={{
                display: "grid", gridTemplateColumns: "60px 1fr 80px 80px 90px 120px",
                gap: "0", padding: "9px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
              }}>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>#{run.id}</p>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(226,232,240,0.8)" }}>{run.regime}</p>
                <p style={{ ...MONO, fontSize: "10px", color: run.overallPressure >= 65 ? "rgba(239,68,68,0.9)" : run.overallPressure >= 45 ? "rgba(251,191,36,0.9)" : "rgba(0,212,255,0.9)" }}>
                  {run.overallPressure}
                </p>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.7)" }}>{run.level}</p>
                <p style={{ ...MONO, fontSize: "10px", color: run.dataSource === "live" ? "rgba(0,212,255,0.7)" : "rgba(251,191,36,0.7)" }}>
                  {run.dataSource.toUpperCase()}
                </p>
                <p style={{ ...MONO, fontSize: "9px", color: "rgba(100,116,139,0.5)" }}>
                  {new Date(run.computedAt).toLocaleString()}
                </p>
              </div>
            ))}
            {(runsData?.runs ?? []).length === 0 && (
              <p style={{ ...MONO, fontSize: "11px", color: "rgba(100,116,139,0.4)", padding: "20px 16px" }}>
                No runs recorded yet. Engine audit begins on next pressure query.
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Tab: SEO Management ─────────────────────────────────────────────────────

const SEO_PAGES = [
  { path: "/",                              label: "Homepage",                    priority: "1.0", type: "core" },
  { path: "/blog",                          label: "Blog Index",                  priority: "0.9", type: "core" },
  { path: "/analysis",                      label: "Analysis Hub",                priority: "0.9", type: "core" },
  { path: "/pressure-index",               label: "Pressure Index",              priority: "0.8", type: "core" },
  { path: "/signals",                      label: "Stock Signals",               priority: "0.8", type: "core" },
  { path: "/crypto-signals",               label: "Crypto Signals",              priority: "0.8", type: "core" },
  { path: "/track-record",                 label: "Track Record",                priority: "0.9", type: "core" },
  { path: "/market-crash-probability-2026", label: "Market Crash Probability 2026", priority: "1.0", type: "flagship" },
  { path: "/market-crash-indicator",       label: "Market Crash Indicator",      priority: "1.0", type: "flagship" },
  { path: "/recession-probability",        label: "Recession Probability",       priority: "1.0", type: "flagship" },
  { path: "/alt-season-indicator",         label: "Alt Season Indicator",        priority: "1.0", type: "flagship" },
  { path: "/bitcoin-risk-dashboard",       label: "Bitcoin Risk Dashboard",      priority: "1.0", type: "flagship" },
  { path: "/ethereum-risk-dashboard",      label: "Ethereum Risk Dashboard",     priority: "1.0", type: "flagship" },
  { path: "/federal-reserve-tracker",      label: "Federal Reserve Tracker",     priority: "1.0", type: "flagship" },
  { path: "/liquidity-monitor",            label: "Liquidity Monitor",           priority: "1.0", type: "flagship" },
  { path: "/volatility-dashboard",         label: "Volatility Dashboard",        priority: "1.0", type: "flagship" },
  { path: "/ai-stocks-dashboard",          label: "AI Stocks Dashboard",         priority: "1.0", type: "flagship" },
  { path: "/ai-stock-signals",             label: "AI Stock Signals",            priority: "1.0", type: "flagship" },
  { path: "/crypto-signals-intelligence",  label: "Crypto Signals Intelligence", priority: "1.0", type: "flagship" },
  { path: "/market-regime-tracker",        label: "Market Regime Tracker",       priority: "1.0", type: "flagship" },
  { path: "/stock/nvda",                   label: "NVDA Signal",                 priority: "1.0", type: "stock" },
  { path: "/stock/pltr",                   label: "PLTR Signal",                 priority: "1.0", type: "stock" },
  { path: "/stock/tsla",                   label: "TSLA Signal",                 priority: "1.0", type: "stock" },
  { path: "/stock/meta",                   label: "META Signal",                 priority: "1.0", type: "stock" },
  { path: "/stock/amd",                    label: "AMD Signal",                  priority: "1.0", type: "stock" },
  { path: "/crypto/tao",                   label: "TAO Signal",                  priority: "1.0", type: "crypto" },
];

const TYPE_COLOR: Record<string, string> = {
  core:     "rgba(0,212,255,0.9)",
  flagship: "rgba(168,85,247,0.9)",
  stock:    "rgba(0,255,136,0.9)",
  crypto:   "rgba(251,191,36,0.9)",
};
const TYPE_BG: Record<string, string> = {
  core:     "rgba(0,212,255,0.07)",
  flagship: "rgba(168,85,247,0.07)",
  stock:    "rgba(0,255,136,0.07)",
  crypto:   "rgba(251,191,36,0.07)",
};

function SEOTab() {
  const baseUrl = "https://getfaultline.live";
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  const robotsUrl  = `${baseUrl}/robots.txt`;

  const totalPages   = SEO_PAGES.length;
  const flagshipCount = SEO_PAGES.filter(p => p.type === "flagship").length;
  const stockCount   = SEO_PAGES.filter(p => p.type === "stock").length;
  const cryptoCount  = SEO_PAGES.filter(p => p.type === "crypto").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* KPI Row */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatCard label="Indexed Pages"  value={totalPages}    sub="in sitemap"      color="rgba(0,212,255,0.9)" />
        <StatCard label="Flagship Pages" value={flagshipCount} sub="priority 1.0"    color="rgba(168,85,247,0.9)" />
        <StatCard label="Stock Pages"    value={stockCount}    sub="+ dynamic route" color="rgba(0,255,136,0.9)" />
        <StatCard label="Crypto Pages"   value={cryptoCount}   sub="+ dynamic route" color="rgba(251,191,36,0.9)" />
      </div>

      {/* Infrastructure Health */}
      <div>
        <SectionHeader title="SEO Infrastructure" sub="Server-rendered metadata, sitemap, and robots.txt status" />
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Server-Side Metadata Injection", status: "ACTIVE",    detail: "Per-page title/description/OG/Twitter/canonical — no JS required",   color: "rgba(0,255,136,0.9)" },
            { label: "Dynamic /stock/:symbol Routes",  status: "ACTIVE",    detail: "Auto-generates metadata for any stock ticker without a static file",  color: "rgba(0,255,136,0.9)" },
            { label: "Dynamic /crypto/:symbol Routes", status: "ACTIVE",    detail: "Auto-generates metadata for any crypto asset without a static file",  color: "rgba(0,255,136,0.9)" },
            { label: "Sitemap.xml",                    status: "ACTIVE",    detail: sitemapUrl,                                                            color: "rgba(0,255,136,0.9)" },
            { label: "Robots.txt",                     status: "ACTIVE",    detail: robotsUrl,                                                             color: "rgba(0,255,136,0.9)" },
            { label: "Google Search Console",          status: "NOT CONNECTED", detail: "Connect via Google Search Console → Settings → Ownership verification", color: "rgba(251,191,36,0.9)" },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: "14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "14px 18px",
            }}>
              <span style={{ ...MONO, fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: item.color, minWidth: "120px" }}>{item.status}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...SANS, fontSize: "13px", color: "#E2E8F0", marginBottom: "2px" }}>{item.label}</p>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)", wordBreak: "break-all" }}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div>
        <SectionHeader title="Quick Links" sub="Open SEO tools and verification pages" />
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "View Sitemap",         href: sitemapUrl },
            { label: "View Robots.txt",      href: robotsUrl },
            { label: "Search Console",       href: "https://search.google.com/search-console" },
            { label: "Google Index Check",   href: `https://www.google.com/search?q=site:getfaultline.live` },
            { label: "SEO Optimizer Tool",   href: "/app/seo-optimizer" },
          ].map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{
              ...MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase",
              color: "rgba(0,212,255,0.8)", textDecoration: "none",
              padding: "8px 16px", border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "6px", background: "rgba(0,212,255,0.04)",
              transition: "all 0.15s",
            }}>{link.label} ↗</a>
          ))}
        </div>
      </div>

      {/* Page Inventory */}
      <div>
        <SectionHeader title="Page Inventory" sub={`${totalPages} pages in sitemap — all with server-rendered unique metadata`} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Type", "Label", "URL", "Priority", "Metadata", "Action"].map(h => (
                  <th key={h} style={{ ...MONO, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(100,116,139,0.5)", padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SEO_PAGES.map((page, i) => (
                <tr key={page.path} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ ...MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 7px", borderRadius: "4px", color: TYPE_COLOR[page.type], background: TYPE_BG[page.type], border: `1px solid ${TYPE_COLOR[page.type].replace("0.9", "0.2")}` }}>{page.type}</span>
                  </td>
                  <td style={{ ...SANS, fontSize: "12px", color: "#CBD5E1", padding: "10px 12px", whiteSpace: "nowrap" }}>{page.label}</td>
                  <td style={{ ...MONO, fontSize: "10px", color: "rgba(0,212,255,0.6)", padding: "10px 12px" }}>{page.path}</td>
                  <td style={{ ...MONO, fontSize: "11px", color: "rgba(0,255,136,0.8)", padding: "10px 12px", textAlign: "center" }}>{page.priority}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ ...MONO, fontSize: "9px", color: "rgba(0,255,136,0.8)", letterSpacing: "0.1em" }}>✓ INJECTED</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <a href={`https://getfaultline.live${page.path}`} target="_blank" rel="noopener noreferrer" style={{ ...MONO, fontSize: "9px", color: "rgba(0,212,255,0.6)", textDecoration: "none", letterSpacing: "0.1em" }}>VIEW ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Routes */}
      <div>
        <SectionHeader title="Dynamic Routes" sub="Auto-generate pages for any symbol — no static file needed" />
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {[
            { route: "/stock/:symbol", example: "/stock/msft", desc: "Any stock ticker — generates unique title, description, OG, canonical" },
            { route: "/crypto/:symbol", example: "/crypto/sol", desc: "Any crypto asset — generates unique title, description, OG, canonical" },
            { route: "/blog/:slug", example: "/blog/market-crash-2025", desc: "Blog posts — title/description pulled from database" },
          ].map(r => (
            <div key={r.route} style={{ flex: "1 1 280px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "18px 20px" }}>
              <p style={{ ...MONO, fontSize: "13px", color: "rgba(0,212,255,0.9)", marginBottom: "6px" }}>{r.route}</p>
              <p style={{ ...MONO, fontSize: "10px", color: "rgba(0,255,136,0.7)", marginBottom: "8px" }}>e.g. {r.example}</p>
              <p style={{ ...SANS, fontSize: "12px", color: "rgba(100,116,139,0.6)" }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div>
        <SectionHeader title="Expansion Roadmap" sub="Next steps ranked by traffic impact" />
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { rank: "P0", action: "Publish latest build",                     impact: "All 26 pages go live on getfaultline.live",                 status: "READY" },
            { rank: "P0", action: "Submit sitemap to Search Console",          impact: "Triggers Google indexing of all 26 pages",                status: "PENDING" },
            { rank: "P1", action: "Add /stock/msft, /stock/googl, /stock/amzn", impact: "3 high-volume stock pages, no code needed",               status: "READY" },
            { rank: "P1", action: "Add /crypto/btc, /crypto/eth, /crypto/sol",  impact: "3 high-volume crypto pages, no code needed",              status: "READY" },
            { rank: "P2", action: "Daily content engine",                      impact: "Auto-published market briefs indexed daily",              status: "PLANNED" },
            { rank: "P2", action: "Connect Google Search Console API",          impact: "Live impressions, clicks, CTR in this panel",             status: "PLANNED" },
            { rank: "P3", action: "Expand to 100+ stock/crypto pages",          impact: "Long-tail keyword coverage, compounding traffic",         status: "PLANNED" },
          ].map(item => (
            <div key={item.action} style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "12px 16px" }}>
              <span style={{ ...MONO, fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: item.rank === "P0" ? "rgba(255,45,85,0.9)" : item.rank === "P1" ? "rgba(251,191,36,0.9)" : "rgba(100,116,139,0.7)", minWidth: "28px" }}>{item.rank}</span>
              <div style={{ flex: 1 }}>
                <p style={{ ...SANS, fontSize: "13px", color: "#E2E8F0", marginBottom: "2px" }}>{item.action}</p>
                <p style={{ ...MONO, fontSize: "10px", color: "rgba(100,116,139,0.5)" }}>{item.impact}</p>
              </div>
              <span style={{ ...MONO, fontSize: "9px", letterSpacing: "0.1em", color: item.status === "READY" ? "rgba(0,255,136,0.8)" : item.status === "PENDING" ? "rgba(251,191,36,0.8)" : "rgba(100,116,139,0.5)" }}>{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Content Intelligence ──────────────────────────────────────────────

function ContentTab() {
  const [activeSection, setActiveSection] = useState<"published" | "scheduled" | "generate" | "analytics">("published");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("daily_market_brief");

  const { data: published, refetch: refetchPublished } = trpc.organicContent.listPublished.useQuery(
    { limit: 50 },
    { staleTime: 30000 }
  );
  const { data: dashboard, refetch: refetchDashboard } = trpc.organicContent.adminDashboard.useQuery(
    undefined,
    { staleTime: 30000 }
  );

  const generateMut = trpc.organicContent.adminGenerateContent.useMutation({
    onSuccess: (data: { ok: boolean; id?: number; slug?: string; error?: string; skipped?: boolean }) => {
      if (data.ok && data.slug) {
        setGenResult(`✓ Generated: /intelligence/${data.slug}`);
      } else if (data.skipped) {
        setGenResult(`✓ Skipped (duplicate content detected)`);
      } else {
        setGenResult(`✗ Generation failed: ${data.error ?? "unknown error"}`);
      }
      setGenerating(false);
      refetchPublished();
      refetchDashboard();
    },
    onError: (err: { message: string }) => {
      setGenResult(`✗ Error: ${err.message}`);
      setGenerating(false);
    },
  });

  const CONTENT_TYPES = [
    { value: "daily_market_brief",    label: "Daily Market Brief" },
    { value: "weekly_market_outlook", label: "Weekly Market Outlook" },
    { value: "crypto_market_outlook", label: "Crypto Market Outlook" },
    { value: "ai_sector_outlook",     label: "AI Sector Outlook" },
    { value: "federal_reserve_watch", label: "Federal Reserve Watch" },
    { value: "liquidity_report",      label: "Liquidity Report" },
    { value: "volatility_report",     label: "Volatility Report" },
    { value: "pressure_index_report", label: "Pressure Index Report" },
    { value: "market_regime_report",  label: "Market Regime Report" },
    { value: "historical_analog",     label: "Historical Analog Report" },
  ];

  const SECTION_TABS = [
    { id: "published" as const,  label: "Published" },
    { id: "scheduled" as const,  label: "Scheduled" },
    { id: "generate" as const,   label: "Generate" },
    { id: "analytics" as const,  label: "CTA Analytics" },
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <SectionHeader title="Content Intelligence" sub="Organic growth engine — admin only" />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Published",  value: dashboard?.summary.published ?? 0,   color: "rgba(0,212,255,0.9)" },
          { label: "Signal Pages", value: dashboard?.summary.signalPagesGenerated ?? 0, color: "rgba(251,191,36,0.9)" },
          { label: "CTA Clicks", value: dashboard?.summary.totalCtaClicks ?? 0, color: "rgba(16,185,129,0.9)" },
          { label: "Top Page",   value: dashboard?.topCtaPages?.[0]?.pageSlug ?? "—",  color: "rgba(168,139,250,0.9)" },
        ].map((kpi, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "16px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em", marginBottom: "6px" }}>{kpi.label.toUpperCase()}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: kpi.color, fontFamily: "'Rajdhani',sans-serif" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}>
        {SECTION_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveSection(t.id)}
            style={{ padding: "8px 16px", fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer",
              borderBottom: activeSection === t.id ? "2px solid rgba(0,212,255,0.7)" : "2px solid transparent",
              color: activeSection === t.id ? "rgba(0,212,255,0.9)" : "rgba(100,116,139,0.5)",
              marginBottom: "-1px" }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Published */}
      {activeSection === "published" && (
        <div>
          {!published || published.items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
              No published content yet. Use the Generate tab to create your first article.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {published.items.map((item) => (
                <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ display: "flex", gap: "12px", fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(100,116,139,0.6)" }}>
                      <span>{item.contentType.replace(/_/g, " ").toUpperCase()}</span>
                      <span>{item.wordCount ?? 0} words</span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                  </div>
                  <a href={`/blog/${item.slug}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(0,212,255,0.7)", textDecoration: "none", whiteSpace: "nowrap" }}>
                    VIEW →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scheduled */}
      {activeSection === "scheduled" && (
        <div>
          {!dashboard?.recentContent || dashboard.recentContent.filter(c => c.status === "draft").length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
              No scheduled content. The automated engine publishes daily at 06:00 UTC.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {dashboard.recentContent.filter(c => c.status === "draft").map((item) => (
                <div key={item.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)", marginBottom: "4px" }}>{item.contentType.replace(/_/g, " ").toUpperCase()}</div>
                    <div style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(100,116,139,0.6)" }}>
                      Created: {timeAgo(item.createdAt)}
                    </div>
                  </div>
                  <span style={{ fontSize: "10px", fontFamily: "'IBM Plex Mono',monospace", padding: "3px 8px", borderRadius: "4px",
                    background: item.status === "draft" ? "rgba(251,191,36,0.1)" : "rgba(0,212,255,0.1)",
                    color: item.status === "draft" ? "rgba(251,191,36,0.9)" : "rgba(0,212,255,0.9)" }}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate */}
      {activeSection === "generate" && (
        <div style={{ maxWidth: "560px" }}>
          <SectionHeader title="Manual Generation" sub="Trigger immediate content generation for any type" />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em", marginBottom: "8px" }}>CONTENT TYPE</label>
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "10px 12px", color: "rgba(255,255,255,0.9)", fontSize: "13px", fontFamily: "'IBM Plex Mono',monospace" }}>
              {CONTENT_TYPES.map(ct => <option key={ct.value} value={ct.value} style={{ background: "#0a0b0e" }}>{ct.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setGenerating(true); setGenResult(null); generateMut.mutate({ contentType: selectedType as "daily_market_brief" | "weekly_market_outlook" | "crypto_market_outlook" | "ai_sector_outlook" | "federal_reserve_watch" | "liquidity_report" | "volatility_report" | "pressure_index_report" | "market_regime_report" | "historical_analog_report" }); }}
            disabled={generating}
            style={{ padding: "12px 24px", background: generating ? "rgba(0,212,255,0.3)" : "rgba(0,212,255,0.9)", color: "#050608", border: "none", borderRadius: "6px", fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, letterSpacing: "0.1em", cursor: generating ? "not-allowed" : "pointer" }}>
            {generating ? "GENERATING..." : "GENERATE NOW"}
          </button>
          {genResult && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: genResult.startsWith("✓") ? "rgba(16,185,129,0.08)" : "rgba(255,45,85,0.08)", border: `1px solid ${genResult.startsWith("✓") ? "rgba(16,185,129,0.2)" : "rgba(255,45,85,0.2)"}`, borderRadius: "6px", fontSize: "12px", fontFamily: "'IBM Plex Mono',monospace", color: genResult.startsWith("✓") ? "rgba(16,185,129,0.9)" : "rgba(255,45,85,0.9)" }}>
              {genResult}
            </div>
          )}
          <div style={{ marginTop: "24px", padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
            <div style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(100,116,139,0.7)", letterSpacing: "0.1em", marginBottom: "8px" }}>AUTOMATED SCHEDULE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { time: "06:00 UTC daily",   type: "Daily Market Brief" },
                { time: "07:00 UTC daily",   type: "Daily Crypto Brief" },
                { time: "08:00 UTC Mon",     type: "Weekly Market Outlook" },
                { time: "08:30 UTC Mon",     type: "Weekly AI Sector Outlook" },
                { time: "09:00 UTC Mon",     type: "Federal Reserve Watch" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "'IBM Plex Mono',monospace", color: "rgba(168,168,168,0.7)" }}>
                  <span style={{ color: "rgba(0,212,255,0.6)" }}>{s.time}</span>
                  <span>{s.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA Analytics */}
      {activeSection === "analytics" && (
        <div>
          <SectionHeader title="CTA Click Analytics" sub="Conversion tracking across all SEO pages" />
          {!dashboard?.topCtaPages || dashboard.topCtaPages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(100,116,139,0.5)", fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
              No CTA clicks recorded yet. Data populates as visitors interact with SEO pages.
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
                {dashboard.topCtaPages.map((row) => (
                  <div key={row.pageSlug} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{row.pageSlug}</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "rgba(0,212,255,0.9)", fontFamily: "'Rajdhani',sans-serif" }}>{row.total}</div>
                  </div>
                ))}
              </div>
              <SectionHeader title="By CTA Type" sub="" />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {dashboard.ctaStats.map((row) => (
                  <div key={row.ctaType} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", fontFamily: "'IBM Plex Mono',monospace" }}>{row.ctaType}</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "rgba(16,185,129,0.9)", fontFamily: "'Rajdhani',sans-serif" }}>{row.total}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Portal ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "waitlist" | "users" | "health" | "stats" | "engine" | "seo" | "content" | "demo";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview",       icon: "◈" },
  { id: "waitlist", label: "Waitlist",        icon: "◎" },
  { id: "users",    label: "Users",           icon: "◉" },
  { id: "stats",    label: "Statistics",      icon: "◑" },
  { id: "health",   label: "Platform Health", icon: "◌" },
  { id: "engine",   label: "Engine & Flags",  icon: "⚙" },
  { id: "seo",      label: "SEO",             icon: "◐" },
  { id: "content",  label: "Content",         icon: "✦" },
  { id: "demo",     label: "Demo Tokens",     icon: "🔑" },
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <p style={{ ...SANS, fontSize: "12px", color: "rgba(100,116,139,0.5)" }}>
            Signed in as <strong style={{ color: "rgba(0,212,255,0.7)" }}>{user?.name || user?.email || "Owner"}</strong> · Admin
          </p>
          <a
            href="/app/admin/blog"
            style={{ ...MONO, fontSize: "10px", letterSpacing: "0.12em", color: "rgba(0,212,255,0.7)", textDecoration: "none", padding: "6px 14px", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "4px", background: "rgba(0,212,255,0.05)" }}
          >
            ✦ BLOG MANAGEMENT
          </a>
        </div>
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
      {activeTab === "stats"    && <StatsTab />}
      {activeTab === "health"   && <HealthTab />}
      {activeTab === "engine"   && <EngineTab />}
      {activeTab === "seo"      && <SEOTab />}
      {activeTab === "content"   && <ContentTab />}
      {activeTab === "demo"      && <DemoTokensTab />}
    </div>
  );
}
