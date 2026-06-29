/**
 * FAULTLINE — Admin Publishing Dashboard
 *
 * Provides full visibility and control over the Autonomous Intelligence Publishing Pipeline.
 * Shows today's publish status, draft queue, validation errors, history, and manual controls.
 *
 * Route: /app/admin/publishing (admin-only)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Play, Pause, RefreshCw,
  FileText, Zap, BarChart2, Calendar, Eye, Send, ChevronDown, ChevronUp,
  Rss, Globe, Bell, Activity, TrendingUp, Shield,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────

interface ScheduleStatus {
  id: number;
  cronExpression: string;
  publishType: string;
  isActive: boolean;
  confidenceThreshold: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunSlug: string | null;
  lastRunError: string | null;
  totalPublished: number;
  totalDrafts: number;
  totalSkipped: number;
  totalErrors: number;
}

interface DraftItem {
  id: number;
  title: string;
  contentType: string;
  qualityScore: number | null;
  createdAt: string;
  metaDescription: string | null;
}

interface PublishedItem {
  id: number;
  title: string;
  contentType: string;
  slug: string;
  qualityScore: number | null;
  publishedAt: string | null;
  wordCount: number | null;
  regime: string | null;
  pressureScore: number | null;
}

// ── Helpers ───────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-500">—</span>;
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    success: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle className="w-3 h-3" /> },
    draft: { color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <Clock className="w-3 h-3" /> },
    skipped: { color: "text-gray-400 bg-gray-400/10 border-gray-400/20", icon: <Pause className="w-3 h-3" /> },
    error: { color: "text-red-400 bg-red-400/10 border-red-400/20", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? map.error;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${s.color}`}>
      {s.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ContentTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    daily_market_brief: "Daily Brief",
    weekly_market_outlook: "Weekly Review",
    market_regime_report: "Monthly Report",
    historical_analog_report: "Analog Report",
    volatility_report: "Volatility",
    liquidity_report: "Liquidity",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-medium">
      {map[type] ?? type}
    </span>
  );
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Main Component ────────────────────────────────────────────

export default function AdminPublishing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [expandedDraft, setExpandedDraft] = useState<number | null>(null);
  const [runningManual, setRunningManual] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [publishingDraftId, setPublishingDraftId] = useState<number | null>(null);

  // Redirect non-admins
  if (user && user.role !== "admin") {
    navigate("/app");
    return null;
  }

  // ── Data ──────────────────────────────────────────────────
  const statusQuery = trpc.organicContent.adminDashboard.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const utils = trpc.useUtils();

  const manualPublishMutation = trpc.organicContent.adminGenerateContent.useMutation({
    onSuccess: () => {
      toast.success("Manual publish triggered — check back in ~60 seconds");
      utils.organicContent.adminDashboard.invalidate();
    },
    onError: (err: { message: string }) => toast.error(`Failed: ${err.message}`),
    onSettled: () => setRunningManual(false),
  });

  const publishDraftMutation = trpc.organicContent.adminGenerateContent.useMutation({
    onSuccess: () => {
      toast.success("Content generation triggered");
      utils.organicContent.adminDashboard.invalidate();
    },
    onError: (err: { message: string }) => toast.error(`Failed: ${err.message}`),
    onSettled: () => setPublishingDraftId(null),
  });

  const data = statusQuery.data as {
    totalPublished: number;
    totalDrafts: number;
    totalPending: number;
    recentContent: PublishedItem[];
    draftContent?: DraftItem[];
    scheduleStatus?: ScheduleStatus[];
  } | undefined;

  const schedules: ScheduleStatus[] = (data as any)?.scheduleStatus ?? [];
  const drafts: DraftItem[] = (data as any)?.draftContent ?? [];
  const published: PublishedItem[] = data?.recentContent ?? [];

  // ── Stats row ─────────────────────────────────────────────
  const stats = [
    { label: "Published", value: data?.totalPublished ?? 0, icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
    { label: "Drafts", value: data?.totalDrafts ?? 0, icon: <Clock className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
    { label: "Pending Review", value: data?.totalPending ?? 0, icon: <Eye className="w-4 h-4 text-cyan-400" />, color: "text-cyan-400" },
    { label: "Total Schedules", value: schedules.length, icon: <Calendar className="w-4 h-4 text-purple-400" />, color: "text-purple-400" },
  ];

  return (
    <div className="min-h-screen bg-[#080a0e] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0d12] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Publishing Dashboard</h1>
              <p className="text-xs text-gray-500">Autonomous Intelligence Pipeline Control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/api/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-orange-400/30 bg-orange-400/10 text-orange-400 text-xs font-medium hover:bg-orange-400/20 transition-colors"
            >
              <Rss className="w-3.5 h-3.5" />
              RSS Feed
            </a>
            <button
              onClick={() => {
                setRunningManual(true);
                manualPublishMutation.mutate({ contentType: "daily_market_brief" });
              }}
              disabled={runningManual}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/10 text-cyan-400 text-xs font-medium hover:bg-cyan-400/20 transition-colors disabled:opacity-50"
            >
              {runningManual ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {runningManual ? "Running…" : "Run Now"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="rounded-lg border border-white/5 bg-[#0d1117] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</span>
                {s.icon}
              </div>
              <div className={`text-2xl font-bold ${s.color}`}>
                {statusQuery.isLoading ? "—" : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Schedule Status */}
        {schedules.length > 0 && (
          <div className="rounded-lg border border-white/5 bg-[#0d1117] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Scheduled Pipelines</h2>
            </div>
            <div className="divide-y divide-white/5">
              {schedules.map(s => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {s.publishType === "daily_brief" ? "Daily Brief" : s.publishType === "weekly_review" ? "Weekly Review" : "Monthly Report"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.cronExpression} · Threshold: {s.confidenceThreshold}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-gray-400">Last run: {formatDate(s.lastRunAt)}</div>
                      <div className="text-xs text-gray-500">
                        ✓ {s.totalPublished} published · {s.totalDrafts} drafts · {s.totalErrors} errors
                      </div>
                    </div>
                    <StatusBadge status={s.lastRunStatus} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draft Queue */}
        {drafts.length > 0 && (
          <div className="rounded-lg border border-amber-400/20 bg-[#0d1117] overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-400/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-amber-400">Draft Queue — Requires Review</h2>
              <span className="ml-auto text-xs text-amber-400/70 bg-amber-400/10 px-2 py-0.5 rounded">
                {drafts.length} pending
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {drafts.map(draft => (
                <div key={draft.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <ContentTypeBadge type={draft.contentType} />
                        {draft.qualityScore !== null && (
                          <span className="text-xs text-gray-500">
                            Quality: <span className={draft.qualityScore >= 70 ? "text-emerald-400" : "text-amber-400"}>{draft.qualityScore}/100</span>
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-white truncate">{draft.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{formatDate(draft.createdAt)}</div>
                      {expandedDraft === draft.id && draft.metaDescription && (
                        <div className="mt-2 text-xs text-gray-400 bg-white/5 rounded p-2">
                          {draft.metaDescription}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
                        className="p-1.5 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                        title="Preview"
                      >
                        {expandedDraft === draft.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => {
                          setPublishingDraftId(draft.id);
                          publishDraftMutation.mutate({ contentType: "daily_market_brief" });
                        }}
                        disabled={publishingDraftId === draft.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 text-xs font-medium hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                      >
                        {publishingDraftId === draft.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Send className="w-3.5 h-3.5" />
                        }
                        Publish
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Published Content */}
        <div className="rounded-lg border border-white/5 bg-[#0d1117] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Recent Published Content</h2>
          </div>
          {statusQuery.isLoading ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">Loading…</div>
          ) : published.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No published content yet.</p>
              <p className="text-xs text-gray-600 mt-1">Trigger the first run using the "Run Now" button above.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {published.slice(0, 20).map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <ContentTypeBadge type={item.contentType} />
                      {item.regime && (
                        <span className="text-xs text-gray-500">{item.regime}</span>
                      )}
                      {item.pressureScore !== null && (
                        <span className="text-xs text-gray-500">P:{item.pressureScore}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white truncate">{item.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDate(item.publishedAt)} · {item.wordCount ?? 0} words
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.qualityScore !== null && (
                      <span className={`text-xs font-medium ${item.qualityScore >= 80 ? "text-emerald-400" : item.qualityScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                        {item.qualityScore}/100
                      </span>
                    )}
                    <a
                      href={`/intelligence/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded border border-white/10 text-gray-400 hover:text-cyan-400 hover:border-cyan-400/30 transition-colors"
                      title="View article"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Info */}
        <div className="rounded-lg border border-white/5 bg-[#0d1117] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Pipeline Configuration</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
            <div className="space-y-1">
              <div className="text-gray-300 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                Daily Brief
              </div>
              <div>Schedule: 7:00 AM UTC daily</div>
              <div>Confidence threshold: 60%</div>
              <div>Sections: 18 institutional sections</div>
              <div>Auto-publishes above threshold</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-300 font-medium flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                Weekly Review
              </div>
              <div>Schedule: Sunday 8:00 AM UTC</div>
              <div>Confidence threshold: 65%</div>
              <div>Covers 7-day market analysis</div>
              <div>Includes regime shift analysis</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-300 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                Safety Guards
              </div>
              <div>Never fabricates market data</div>
              <div>Postpones if data unavailable</div>
              <div>Duplicate detection: 24h window</div>
              <div>Quality score minimum: 50/100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
