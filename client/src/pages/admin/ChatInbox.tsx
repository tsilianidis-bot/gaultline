/**
 * FAULTLINE Admin — Chat Inbox
 * Route: /app/admin/chat-inbox
 * Shows all chatbot conversations with filters, lead scoring, notes, and CSV export.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MessageCircle, Bot, User, Mail, Clock, Globe, Star,
  CheckCircle2, RefreshCw, ChevronDown, ChevronRight,
  Download, Copy, StickyNote, Eye, Filter, TrendingUp,
  AlertCircle, Zap, DollarSign, Search,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
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

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function leadScoreColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 50) return "text-amber-400";
  if (score >= 30) return "text-yellow-400";
  return "text-slate-500";
}

function leadScoreBg(score: number): string {
  if (score >= 70) return "bg-red-500/10 border-red-500/20";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
  if (score >= 30) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-slate-800/50 border-white/5";
}

function conversionBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    none:   { label: "None",     cls: "bg-slate-800 text-slate-400" },
    lead:   { label: "Lead",     cls: "bg-cyan-500/20 text-cyan-300" },
    signup: { label: "Signed Up", cls: "bg-emerald-500/20 text-emerald-300" },
    paid:   { label: "Paid",     cls: "bg-violet-500/20 text-violet-300" },
  };
  const m = map[status] ?? map.none;
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${m.cls}`}>{m.label}</span>;
}

// ── Filter Tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "all",          label: "All",          icon: MessageCircle },
  { id: "new_leads",    label: "New Leads",    icon: Star },
  { id: "high_intent",  label: "High Intent",  icon: Zap },
  { id: "pricing",      label: "Pricing",      icon: DollarSign },
  { id: "security",     label: "Stock/Crypto", icon: TrendingUp },
  { id: "converted",    label: "Converted",    icon: CheckCircle2 },
  { id: "needs_review", label: "Needs Review", icon: AlertCircle },
] as const;

type FilterId = typeof FILTERS[number]["id"];

// ── Session Row ───────────────────────────────────────────────────────────────
function SessionRow({
  session,
  onRefetch,
}: {
  session: {
    id: number;
    visitorId: string;
    email: string | null;
    pageUrl: string | null;
    leadScore: number;
    signupIntent: number;
    pricingIntent: number;
    securitiesMentioned: string | null;
    planInterest: string | null;
    conversionStatus: "none" | "lead" | "signup" | "paid";
    reviewed: number;
    adminNote: string | null;
    messageCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    userId: number | null;
  };
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState(session.adminNote ?? "");
  const [editingNote, setEditingNote] = useState(false);

  const { data: detail, refetch: refetchDetail } = trpc.chatbot.admin.getSession.useQuery(
    { sessionId: session.id },
    { enabled: expanded, staleTime: 30_000 },
  );

  const markReviewed = trpc.chatbot.admin.markReviewed.useMutation({
    onSuccess: () => { toast.success("Marked as reviewed"); onRefetch(); },
  });

  const addNote = trpc.chatbot.admin.addNote.useMutation({
    onSuccess: () => { toast.success("Note saved"); setEditingNote(false); onRefetch(); },
  });

  const copyEmail = () => {
    if (session.email) {
      navigator.clipboard.writeText(session.email);
      toast.success("Email copied");
    }
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${leadScoreBg(session.leadScore)}`}>
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Lead score */}
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${leadScoreBg(session.leadScore)}`}>
          <span className={`text-sm font-bold font-mono ${leadScoreColor(session.leadScore)}`}>
            {session.leadScore}
          </span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-300 truncate max-w-[120px]">
              {session.visitorId.slice(0, 16)}…
            </span>
            {session.email && (
              <span className="text-xs font-mono text-cyan-400 truncate">{session.email}</span>
            )}
            {conversionBadge(session.conversionStatus)}
            {session.reviewed === 1 && (
              <span className="text-[10px] font-mono text-emerald-400/70">✓ reviewed</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {session.pageUrl && (
              <span className="text-[10px] text-slate-600 font-mono truncate max-w-[200px]">
                {session.pageUrl.replace(/^https?:\/\/[^/]+/, "")}
              </span>
            )}
            <span className="text-[10px] text-slate-600 font-mono">{session.messageCount} msgs</span>
            <span className="text-[10px] text-slate-600 font-mono">{timeAgo(session.createdAt)}</span>
            {session.signupIntent === 1 && (
              <span className="text-[10px] font-mono text-violet-400">signup intent</span>
            )}
            {session.pricingIntent === 1 && (
              <span className="text-[10px] font-mono text-amber-400">pricing intent</span>
            )}
            {session.securitiesMentioned && (
              <span className="text-[10px] font-mono text-emerald-400">{session.securitiesMentioned}</span>
            )}
            {session.planInterest && (
              <span className="text-[10px] font-mono text-cyan-400">{session.planInterest} plan</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {session.email && (
            <button
              onClick={copyEmail}
              className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-cyan-400 transition-colors"
              title="Copy email"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => markReviewed.mutate({ sessionId: session.id, reviewed: session.reviewed !== 1 })}
            className={`p-1.5 rounded hover:bg-white/5 transition-colors ${session.reviewed === 1 ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400"}`}
            title={session.reviewed === 1 ? "Mark unreviewed" : "Mark reviewed"}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </div>

      {/* Expanded transcript */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          {/* Transcript */}
          {detail?.messages && detail.messages.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detail.messages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "bot" ? "bg-cyan-400/20" : "bg-slate-700"}`}>
                    {msg.role === "bot" ? (
                      <Bot className="w-2.5 h-2.5 text-cyan-400" />
                    ) : (
                      <User className="w-2.5 h-2.5 text-slate-400" />
                    )}
                  </div>
                  <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-[11px] font-mono leading-relaxed ${msg.role === "bot" ? "bg-[#0A1520] border border-white/5 text-slate-300" : "bg-slate-800 text-slate-200"}`}>
                    <p>{msg.content}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{formatDate(msg.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 font-mono">No messages yet.</p>
          )}

          {/* Admin note */}
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <StickyNote className="w-3 h-3 text-amber-400/70" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Admin Note</span>
              {!editingNote && (
                <button
                  onClick={() => setEditingNote(true)}
                  className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-400 ml-auto"
                >
                  {session.adminNote ? "Edit" : "Add note"}
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full bg-[#050A10] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400/40 resize-none"
                  placeholder="Add a note about this lead..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addNote.mutate({ sessionId: session.id, note: noteText })}
                    disabled={addNote.isPending}
                    className="px-2 py-1 bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/30 rounded text-xs text-cyan-400 font-mono transition-colors"
                  >
                    {addNote.isPending ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingNote(false); setNoteText(session.adminNote ?? ""); }}
                    className="px-2 py-1 text-xs text-slate-500 font-mono hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-slate-400 leading-relaxed">
                {session.adminNote || <span className="text-slate-600 italic">No note</span>}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ChatInbox() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  const { data: statsData } = trpc.chatbot.admin.getStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    staleTime: 60_000,
  });

  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = trpc.chatbot.admin.getSessions.useQuery(
    { filter: activeFilter, limit: 100, offset: 0 },
    { enabled: !!user && user.role === "admin", staleTime: 30_000 },
  );

  const { data: leadsData } = trpc.chatbot.admin.getLeads.useQuery(
    { limit: 500 },
    { enabled: !!user && user.role === "admin", staleTime: 60_000 },
  );

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-cyan-400 font-mono text-sm animate-pulse">AUTHENTICATING…</div>
      </div>
    );
  }
  if (user.role !== "admin") return null;

  // Filter by search query (email or visitorId)
  const sessions = (data?.sessions ?? []).filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.visitorId.toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.securitiesMentioned ?? "").toLowerCase().includes(q) ||
      (s.planInterest ?? "").toLowerCase().includes(q)
    );
  });

  // CSV Export
  const handleExportCSV = () => {
    const leads = leadsData ?? [];
    if (leads.length === 0) { toast.error("No leads to export"); return; }
    const header = ["id", "sessionId", "visitorId", "email", "interest", "leadScore", "planInterest", "createdAt"];
    const rows = leads.map(l => [
      l.id, l.sessionId, l.visitorId, l.email ?? "",
      (l.interest ?? "").replace(/,/g, ";"),
      l.leadScore, l.planInterest ?? "", new Date(l.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faultline_chatbot_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${leads.length} leads`);
  };

  return (
    <div className="min-h-screen bg-[#050A10] text-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-widest text-slate-100">
            CHAT INBOX
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            AI Concierge conversations · lead intelligence · conversion tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/20 rounded-lg text-xs font-mono text-cyan-400 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats row */}
      {statsData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total Sessions", value: statsData.total, icon: MessageCircle, color: "text-slate-300" },
            { label: "Leads Captured", value: statsData.leads, icon: Mail, color: "text-cyan-400" },
            { label: "High Intent",    value: statsData.highIntent, icon: Zap, color: "text-amber-400" },
            { label: "Converted",      value: statsData.converted, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Avg Lead Score", value: statsData.avgLeadScore, icon: Star, color: "text-violet-400" },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0A1520] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                activeFilter === f.id
                  ? "bg-cyan-400/15 border-cyan-400/30 text-cyan-300"
                  : "bg-white/3 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
              }`}
            >
              <f.icon className="w-3 h-3" />
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search email, visitor ID, ticker…"
            className="pl-8 pr-3 py-1.5 bg-[#0A1520] border border-white/10 rounded-lg text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/40 w-64"
          />
        </div>
      </div>

      {/* Session list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-cyan-400 font-mono text-xs animate-pulse">LOADING SESSIONS…</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 font-mono text-sm">No conversations yet</p>
          <p className="text-slate-600 font-mono text-xs mt-1">
            Chatbot sessions will appear here once visitors start chatting.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-slate-600">
            Showing {sessions.length} of {data?.total ?? 0} sessions
          </p>
          {sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session as any}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
