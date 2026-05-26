// FAULTLINE — X Post Queue Admin Page (client/src/pages/XPostQueue.tsx)
// Shows the history of auto-posted and failed X posts, with stats summary.

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  posted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  skipped: "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  premarket: "PRE-MARKET",
  midday: "MIDDAY",
  closing: "CLOSING",
  breaking: "BREAKING",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-0.5 rounded border border-zinc-700 hover:border-zinc-500"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function XPostQueue() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [postTypeFilter, setPostTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: stats } = trpc.xPostQueue.stats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: posts, isLoading } = trpc.xPostQueue.list.useQuery(
    {
      limit: 50,
      postType: postTypeFilter !== "all" ? (postTypeFilter as "premarket" | "midday" | "closing" | "breaking") : undefined,
      status: statusFilter !== "all" ? (statusFilter as "posted" | "failed" | "skipped" | "pending") : undefined,
    },
    { enabled: !!user && user.role === "admin" }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 text-sm tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-sm tracking-widest mb-2">ACCESS DENIED</div>
          <button onClick={() => navigate("/app")} className="text-zinc-500 text-xs hover:text-zinc-300">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-500 tracking-widest mb-1">FAULTLINE / ADMIN</div>
            <h1 className="text-lg font-bold tracking-wide">X POST QUEUE</h1>
          </div>
          <button
            onClick={() => navigate("/app/x-posts")}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded transition-colors"
          >
            ← X POST GENERATOR
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "TOTAL POSTS", value: stats.total, color: "text-white" },
              { label: "POSTED", value: stats.posted, color: "text-emerald-400" },
              { label: "FAILED", value: stats.failed, color: "text-red-400" },
              { label: "SKIPPED", value: stats.skipped, color: "text-zinc-400" },
            ].map((s) => (
              <Card key={s.label} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="text-xs text-zinc-500 tracking-widest mb-1">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={postTypeFilter} onValueChange={setPostTypeFilter}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-sm">
              <SelectValue placeholder="Post Type" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="premarket">Pre-Market</SelectItem>
              <SelectItem value="midday">Midday</SelectItem>
              <SelectItem value="closing">Closing</SelectItem>
              <SelectItem value="breaking">Breaking</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Post list */}
        {isLoading ? (
          <div className="text-zinc-500 text-sm py-8 text-center tracking-widest">LOADING QUEUE...</div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-sm tracking-widest">NO POSTS YET</div>
            <div className="text-xs text-zinc-700 mt-2">Posts will appear here once the automation starts running.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                      {TYPE_LABELS[post.postType] ?? post.postType.toUpperCase()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[post.status] ?? ""}`}>
                      {post.status.toUpperCase()}
                    </span>
                    {post.pressureScore !== null && (
                      <span className="text-xs text-zinc-500">
                        Pressure: <span className="text-zinc-300">{post.pressureScore}</span>
                      </span>
                    )}
                    {post.pressureRegime && (
                      <span className="text-xs text-zinc-600">{post.pressureRegime}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-600 whitespace-nowrap">
                    {post.createdAt ? new Date(post.createdAt).toLocaleString() : "—"}
                  </div>
                </div>

                {post.headline && (
                  <div className="text-xs text-amber-400/80 mb-2 italic">
                    Headline: {post.headline}
                  </div>
                )}

                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-950/50 rounded p-3 border border-zinc-800/50">
                  {post.content}
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-3">
                    <CopyButton text={post.content} />
                    {post.xPostId && (
                      <a
                        href={`https://x.com/i/web/status/${post.xPostId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-500 hover:text-sky-400 transition-colors"
                      >
                        View on X →
                      </a>
                    )}
                  </div>
                  {post.errorMsg && (
                    <div className="text-xs text-red-400/70 max-w-xs truncate" title={post.errorMsg}>
                      Error: {post.errorMsg}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
