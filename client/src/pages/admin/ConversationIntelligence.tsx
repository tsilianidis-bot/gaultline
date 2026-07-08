/**
 * Conversation Intelligence — Admin Dashboard
 * Full analytics suite: Executive Dashboard, Conversation Log, Question Analytics,
 * Gap Analysis, Business Intelligence, Privacy Controls.
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  MessageSquare, TrendingUp, Users, Zap, AlertTriangle, Download, RefreshCw,
  Search, Filter, ChevronDown, ChevronUp, Eye, Trash2, Settings, BarChart2,
  Brain, Target, ShieldCheck, FileText, Clock, Star, CheckCircle, XCircle,
} from "lucide-react";

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = "text-amber-400" }: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wider">
        <Icon size={14} className={color} />
        {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: "bg-zinc-700 text-zinc-300",
    under_review: "bg-blue-900 text-blue-300",
    planned: "bg-purple-900 text-purple-300",
    in_progress: "bg-amber-900 text-amber-300",
    shipped: "bg-green-900 text-green-300",
    wont_do: "bg-red-900 text-red-400",
  };
  return map[status] ?? "bg-zinc-700 text-zinc-300";
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "conversations" | "topics" | "gaps" | "business" | "privacy";

// ── Main Component ────────────────────────────────────────────────────────────

export default function ConversationIntelligence() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [convPage, setConvPage] = useState(1);
  const [convSearch, setConvSearch] = useState("");
  const [convTier, setConvTier] = useState<string>("all");
  const [expandedConv, setExpandedConv] = useState<number | null>(null);
  const [featureStatus, setFeatureStatus] = useState<string>("all");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } =
    trpc.conversationIntelligence.getExecutiveSummary.useQuery(undefined, { staleTime: 60_000 });

  const { data: weeklyTrend } =
    trpc.conversationIntelligence.getWeeklyTrend.useQuery(undefined, { staleTime: 120_000 });

  const { data: convLogs, isLoading: logsLoading } =
    trpc.conversationIntelligence.getConversationLogs.useQuery({
      page: convPage,
      pageSize: 25,
      search: convSearch || undefined,
      userTier: convTier as any,
    }, { staleTime: 30_000, enabled: activeTab === "conversations" });

  const { data: convDetail } =
    trpc.conversationIntelligence.getConversationDetail.useQuery(
      { conversationId: expandedConv! },
      { enabled: expandedConv !== null, staleTime: 60_000 }
    );

  const { data: topics, isLoading: topicsLoading } =
    trpc.conversationIntelligence.getTopTopics.useQuery({ limit: 30 }, { staleTime: 60_000, enabled: activeTab === "topics" });

  const { data: questionStats } =
    trpc.conversationIntelligence.getQuestionStats.useQuery(undefined, { staleTime: 60_000, enabled: activeTab === "topics" });

  const { data: gaps, isLoading: gapsLoading } =
    trpc.conversationIntelligence.getGapAnalysis.useQuery(undefined, { staleTime: 60_000, enabled: activeTab === "gaps" });

  const { data: bizIntel, isLoading: bizLoading } =
    trpc.conversationIntelligence.getBusinessIntelligence.useQuery(undefined, { staleTime: 60_000, enabled: activeTab === "business" });

  const { data: featureReqs, isLoading: featureLoading } =
    trpc.conversationIntelligence.getFeatureRequests.useQuery({ limit: 50, status: featureStatus as any }, { staleTime: 60_000, enabled: activeTab === "business" });

  const { data: retentionPolicy } =
    trpc.conversationIntelligence.getRetentionPolicy.useQuery(undefined, { staleTime: 60_000, enabled: activeTab === "privacy" });

  // ── Export query ───────────────────────────────────────────────────────────

  const { refetch: fetchExport } =
    trpc.conversationIntelligence.exportConversations.useQuery(
      { format: "csv", limit: 1000 },
      { enabled: false }
    );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const utils = trpc.useUtils();

  const deleteConv = trpc.conversationIntelligence.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversation deleted");
      utils.conversationIntelligence.getConversationLogs.invalidate();
      setExpandedConv(null);
    },
  });

  const updateFeature = trpc.conversationIntelligence.updateFeatureRequestStatus.useMutation({
    onSuccess: () => {
      toast.success("Feature request updated");
      utils.conversationIntelligence.getFeatureRequests.invalidate();
    },
  });

  const updateRetention = trpc.conversationIntelligence.updateRetentionPolicy.useMutation({
    onSuccess: () => toast.success("Retention policy saved"),
  });

  const runCleanup = trpc.conversationIntelligence.runRetentionCleanup.useMutation({
    onSuccess: (data) => toast.success(`Cleanup complete — ${data.deleted} conversations deleted`),
  });

  // ── Retention form state ───────────────────────────────────────────────────

  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(true);
  const [anonymizeOnExpiry, setAnonymizeOnExpiry] = useState<boolean>(true);

  // Sync form with loaded policy
  useMemo(() => {
    if (retentionPolicy) {
      setRetentionDays(retentionPolicy.retentionDays);
      setLoggingEnabled(retentionPolicy.loggingEnabled);
      setAnonymizeOnExpiry(retentionPolicy.anonymizeOnExpiry);
    }
  }, [retentionPolicy]);

  // ── Export handler ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    const result = await fetchExport();
    if (!result.data?.data) return;
    const blob = new Blob([result.data.data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${result.data.count} conversations`);
  }, [fetchExport, toast]);

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Executive Dashboard", icon: BarChart2 },
    { id: "conversations", label: "Conversation Log", icon: MessageSquare },
    { id: "topics", label: "Question Analytics", icon: Brain },
    { id: "gaps", label: "Gap Analysis", icon: AlertTriangle },
    { id: "business", label: "Business Intelligence", icon: TrendingUp },
    { id: "privacy", label: "Privacy & Retention", icon: ShieldCheck },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain size={22} className="text-amber-400" />
            Conversation Intelligence
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Turn every user question into actionable product intelligence</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => refetchSummary()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Executive Dashboard ─────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {summaryLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Conversations" value={summary?.totalConversations ?? 0} icon={MessageSquare} />
                <KpiCard label="Today" value={summary?.todayConversations ?? 0} sub="conversations today" icon={Clock} color="text-blue-400" />
                <KpiCard label="Active Users" value={summary?.activeUsers ?? 0} sub="unique users" icon={Users} color="text-green-400" />
                <KpiCard
                  label="Avg Response Time"
                  value={summary?.avgResponseTimeMs ? `${(summary.avgResponseTimeMs / 1000).toFixed(1)}s` : "—"}
                  sub="AI response latency"
                  icon={Zap}
                  color="text-purple-400"
                />
                <KpiCard
                  label="Avg Confidence"
                  value={summary?.avgConfidenceScore ? `${Math.round(summary.avgConfidenceScore)}%` : "—"}
                  sub="AI answer quality"
                  icon={Target}
                  color="text-amber-400"
                />
                <KpiCard
                  label="Quality Flag Rate"
                  value={summary?.qualityFlagRate ? `${(summary.qualityFlagRate * 100).toFixed(1)}%` : "0%"}
                  sub="low confidence answers"
                  icon={AlertTriangle}
                  color="text-red-400"
                />
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 col-span-2">
                  <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Star size={12} className="text-amber-400" />
                    Trending Topic
                  </div>
                  <div className="text-lg font-semibold text-white">{summary?.trendingTopic ?? "No data yet"}</div>
                  {summary?.topQuestion && (
                    <div className="text-xs text-zinc-500 mt-1 italic truncate">"{summary.topQuestion}"</div>
                  )}
                </div>
              </div>

              {/* Weekly Trend Chart */}
              {weeklyTrend && weeklyTrend.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <SectionHeader title="14-Day Conversation Trend" subtitle="Daily conversation volume and average quality score" />
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fill: "#71717a", fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#71717a", fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                        labelStyle={{ color: "#e4e4e7" }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="conversations" stroke="#f59e0b" strokeWidth={2} dot={false} name="Conversations" />
                      <Line yAxisId="right" type="monotone" dataKey="avgQuality" stroke="#22d3ee" strokeWidth={2} dot={false} name="Avg Quality %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {weeklyTrend?.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                  <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No conversation data yet. Data will appear here once users start asking questions.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Conversation Log ───────────────────────────────────────────────── */}
      {activeTab === "conversations" && (
        <div className="space-y-4">
          <SectionHeader title="Conversation Log" subtitle="All Ask Intelligence sessions with search and filtering" />

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search topics, sessions..."
                value={convSearch}
                onChange={e => { setConvSearch(e.target.value); setConvPage(1); }}
                className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <select
              value={convTier}
              onChange={e => { setConvTier(e.target.value); setConvPage(1); }}
              className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Tiers</option>
              <option value="anonymous">Anonymous</option>
              <option value="free">Free</option>
              <option value="core">Core</option>
              <option value="premium">Premium</option>
              <option value="founding">Founding</option>
            </select>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg h-16 animate-pulse" />
              ))}
            </div>
          ) : convLogs?.rows.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No conversations found.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {convLogs?.rows.map((row: any) => (
                  <div key={row.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                      onClick={() => setExpandedConv(expandedConv === row.id ? null : row.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <MessageSquare size={14} className="text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">
                            {row.topics ? row.topics.split(",").slice(0, 3).join(" · ") : "No topics extracted"}
                          </div>
                          <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span>{row.messageCount} messages</span>
                            <span>·</span>
                            <span className="capitalize">{row.userTier}</span>
                            {row.module && <><span>·</span><span>{row.module}</span></>}
                            <span>·</span>
                            <span>{new Date(row.startedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {row.avgConfidenceScore && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            row.avgConfidenceScore >= 70 ? "bg-green-900/50 text-green-400" :
                            row.avgConfidenceScore >= 45 ? "bg-amber-900/50 text-amber-400" :
                            "bg-red-900/50 text-red-400"
                          }`}>
                            {Math.round(row.avgConfidenceScore)}%
                          </span>
                        )}
                        {expandedConv === row.id ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expandedConv === row.id && (
                      <div className="border-t border-zinc-800 p-4 space-y-3">
                        {convDetail ? (
                          <>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {convDetail.messages.map((msg: any) => (
                                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                    msg.role === "user"
                                      ? "bg-amber-500/20 text-amber-100"
                                      : "bg-zinc-800 text-zinc-200"
                                  }`}>
                                    <div className="text-xs font-medium mb-1 opacity-60">{msg.role}</div>
                                    <div className="text-sm leading-relaxed">{msg.content.slice(0, 500)}{msg.content.length > 500 ? "…" : ""}</div>
                                    {msg.confidenceScore && (
                                      <div className="text-xs opacity-50 mt-1">confidence: {Math.round(msg.confidenceScore)}%</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => deleteConv.mutate({ conversationId: row.id })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-lg text-xs text-red-400 transition-colors"
                              >
                                <Trash2 size={12} />
                                Delete Conversation
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-zinc-500 text-center py-4">Loading messages…</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {convLogs && convLogs.total > convLogs.pageSize && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-zinc-500">
                    Showing {(convPage - 1) * 25 + 1}–{Math.min(convPage * 25, convLogs.total)} of {convLogs.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConvPage(p => Math.max(1, p - 1))}
                      disabled={convPage === 1}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setConvPage(p => p + 1)}
                      disabled={convPage * 25 >= convLogs.total}
                      className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 disabled:opacity-40 hover:bg-zinc-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Question Analytics ─────────────────────────────────────────────── */}
      {activeTab === "topics" && (
        <div className="space-y-6">
          <SectionHeader title="Question Analytics" subtitle="What users are asking — topic clusters ranked by frequency" />

          {questionStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KpiCard label="Total Questions" value={questionStats.totalQuestions} icon={MessageSquare} />
              <KpiCard label="Unique Topics" value={questionStats.uniqueTopics} icon={Brain} color="text-blue-400" />
              <KpiCard label="Avg Confidence" value={`${Math.round(questionStats.avgConfidence)}%`} icon={Target} color="text-green-400" />
              <KpiCard label="Unanswered Topics" value={questionStats.unansweredCount} icon={AlertTriangle} color="text-red-400" />
              <KpiCard label="Feature Requests" value={questionStats.featureRequestCount} icon={Star} color="text-purple-400" />
            </div>
          )}

          {topicsLoading ? (
            <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg h-12 animate-pulse" />)}</div>
          ) : topics && topics.length > 0 ? (
            <>
              {/* Bar chart of top 10 topics */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">Top 10 Topics by Volume</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topics.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={130} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      labelStyle={{ color: "#e4e4e7" }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Questions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Topic table */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-4 py-3 text-xs text-zinc-500 uppercase tracking-wider">Topic</th>
                      <th className="text-right px-4 py-3 text-xs text-zinc-500 uppercase tracking-wider">Count</th>
                      <th className="text-right px-4 py-3 text-xs text-zinc-500 uppercase tracking-wider">Avg Confidence</th>
                      <th className="text-right px-4 py-3 text-xs text-zinc-500 uppercase tracking-wider">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((topic, i) => (
                      <tr key={topic.clusterKey} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-900/50"}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{topic.label}</div>
                          <div className="text-xs text-zinc-500 font-mono">{topic.clusterKey}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">{topic.count}</td>
                        <td className="px-4 py-3 text-right">
                          {topic.avgConfidence != null ? (
                            <span className={`text-xs font-medium ${
                              topic.avgConfidence >= 70 ? "text-green-400" :
                              topic.avgConfidence >= 45 ? "text-amber-400" : "text-red-400"
                            }`}>
                              {Math.round(topic.avgConfidence)}%
                            </span>
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {topic.isUnanswered && <Badge label="Unanswered" color="bg-red-900/50 text-red-400" />}
                            {topic.hasHighFollowUp && <Badge label="High Follow-up" color="bg-blue-900/50 text-blue-400" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              <Brain size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No topic data yet. Topics are extracted automatically from user questions.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Gap Analysis ──────────────────────────────────────────────────── */}
      {activeTab === "gaps" && (
        <div className="space-y-4">
          <SectionHeader title="Gap Analysis" subtitle="Where the AI falls short — low confidence, unanswered topics, and feature requests" />

          {gapsLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg h-16 animate-pulse" />)}</div>
          ) : gaps && gaps.length > 0 ? (
            <div className="space-y-3">
              {gaps.map((gap, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        gap.type === "low_confidence" ? "bg-red-900/30" :
                        gap.type === "unanswered" ? "bg-amber-900/30" : "bg-blue-900/30"
                      }`}>
                        {gap.type === "low_confidence" && <AlertTriangle size={14} className="text-red-400" />}
                        {gap.type === "unanswered" && <XCircle size={14} className="text-amber-400" />}
                        {gap.type === "feature_request" && <Star size={14} className="text-blue-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{gap.description}</div>
                        {gap.examples.length > 0 && (
                          <div className="text-xs text-zinc-500 mt-1 italic">"{gap.examples[0]}"</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        label={gap.type === "low_confidence" ? "Low Confidence" : gap.type === "unanswered" ? "Unanswered" : "Feature Request"}
                        color={gap.type === "low_confidence" ? "bg-red-900/50 text-red-400" : gap.type === "unanswered" ? "bg-amber-900/50 text-amber-400" : "bg-blue-900/50 text-blue-400"}
                      />
                      <span className="text-xs text-zinc-500 font-medium">{gap.count}×</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              <CheckCircle size={32} className="mx-auto mb-3 opacity-40 text-green-400" />
              <p className="text-sm">No gaps detected yet. Keep building conversations to surface improvement opportunities.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Business Intelligence ─────────────────────────────────────────── */}
      {activeTab === "business" && (
        <div className="space-y-6">
          <SectionHeader title="Business Intelligence" subtitle="Most-discussed assets, feature requests, and upgrade conversion by topic" />

          {bizLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl h-48 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Symbols */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-amber-400" />
                  Most Discussed Assets
                </h3>
                {bizIntel?.topSymbols.length ? (
                  <div className="space-y-2">
                    {bizIntel.topSymbols.slice(0, 10).map((sym, i) => (
                      <div key={sym.symbol} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-600 w-5">{i + 1}</span>
                        <span className="font-mono text-sm font-bold text-amber-400 w-14">{sym.symbol}</span>
                        <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (sym.count / (bizIntel.topSymbols[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 w-8 text-right">{sym.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No symbol data yet.</p>
                )}
              </div>

              {/* Conversion by Topic */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-green-400" />
                  Upgrade Conversion by Topic
                </h3>
                {bizIntel?.conversionByTopic.length ? (
                  <div className="space-y-2">
                    {bizIntel.conversionByTopic.slice(0, 8).map((item) => (
                      <div key={item.topic} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-300 flex-1 truncate">{item.topic}</span>
                        <span className="text-xs text-zinc-500">{item.conversationCount} convs</span>
                        <span className={`text-xs font-medium ${item.conversionRate > 0.1 ? "text-green-400" : "text-zinc-500"}`}>
                          {(item.conversionRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No conversion data yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Feature Requests */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Star size={14} className="text-purple-400" />
                Feature Requests
              </h3>
              <select
                value={featureStatus}
                onChange={e => setFeatureStatus(e.target.value)}
                className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="under_review">Under Review</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="shipped">Shipped</option>
                <option value="wont_do">Won't Do</option>
              </select>
            </div>

            {featureLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />)}</div>
            ) : featureReqs && featureReqs.length > 0 ? (
              <div className="space-y-2">
                {featureReqs.map((req: any) => (
                  <div key={req.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{req.normalizedText}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{req.count} requests · priority {req.priorityScore.toFixed(1)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge label={req.status.replace(/_/g, " ")} color={statusBadge(req.status)} />
                      <select
                        value={req.status}
                        onChange={e => updateFeature.mutate({ id: req.id, status: e.target.value as any })}
                        className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-400 focus:outline-none"
                      >
                        <option value="new">New</option>
                        <option value="under_review">Under Review</option>
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="shipped">Shipped</option>
                        <option value="wont_do">Won't Do</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No feature requests yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Privacy & Retention ───────────────────────────────────────────── */}
      {activeTab === "privacy" && (
        <div className="space-y-6 max-w-2xl">
          <SectionHeader title="Privacy & Retention Controls" subtitle="Configure how long conversation data is retained and whether logging is active" />

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Conversation Logging</div>
                <div className="text-xs text-zinc-500 mt-0.5">When disabled, no new conversations will be recorded</div>
              </div>
              <button
                onClick={() => setLoggingEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${loggingEnabled ? "bg-amber-500" : "bg-zinc-700"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${loggingEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-white block mb-1.5">Retention Period</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={3650}
                  value={retentionDays}
                  onChange={e => setRetentionDays(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
                <span className="text-sm text-zinc-400">days (0 = keep forever)</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">Conversations older than this will be automatically deleted</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Anonymize on Expiry</div>
                <div className="text-xs text-zinc-500 mt-0.5">Remove user IDs instead of deleting entire conversations</div>
              </div>
              <button
                onClick={() => setAnonymizeOnExpiry(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${anonymizeOnExpiry ? "bg-amber-500" : "bg-zinc-700"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${anonymizeOnExpiry ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => updateRetention.mutate({ retentionDays, loggingEnabled, anonymizeOnExpiry })}
                disabled={updateRetention.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <Settings size={14} />
                {updateRetention.isPending ? "Saving…" : "Save Policy"}
              </button>
              <button
                onClick={() => runCleanup.mutate()}
                disabled={runCleanup.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {runCleanup.isPending ? "Running…" : "Run Cleanup Now"}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <Download size={14} className="text-amber-400" />
              Data Export
            </h3>
            <p className="text-xs text-zinc-500 mb-4">Export all conversation data for compliance or analysis. User IDs are included — handle with care.</p>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
            >
              <Download size={14} />
              Export All Conversations (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
