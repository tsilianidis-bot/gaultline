/* ============================================================
   FAULTLINE — Public Shared Report Page
   Route: /r/:publicShareId
   No auth required. Clean branded read-only view with CTA.
   ============================================================ */
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Clock, Eye, ExternalLink, TrendingUp,
  Zap, BarChart3, Shield, Activity, Lock, ArrowRight,
  Share2, Calendar
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────
const REPORT_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  stock_intelligence: { label: "Stock Intelligence", icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-400" },
  crypto_intelligence: { label: "Crypto Intelligence", icon: <Zap className="w-4 h-4" />, color: "text-purple-400" },
  market_preflight: { label: "Market Preflight", icon: <Shield className="w-4 h-4" />, color: "text-amber-400" },
  diagnostic_ai: { label: "Diagnostic AI", icon: <Activity className="w-4 h-4" />, color: "text-cyan-400" },
  daily_report: { label: "Daily Report", icon: <BarChart3 className="w-4 h-4" />, color: "text-blue-400" },
};

function formatDate(ts: number | string | null | undefined) {
  if (!ts) return "—";
  return new Date(typeof ts === "string" ? ts : ts).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Snapshot renderer — renders the JSON snapshot safely ───────
function SnapshotRenderer({ snapshotJson, reportType }: { snapshotJson: string; reportType: string }) {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(snapshotJson); } catch { return <p className="text-zinc-500 text-sm">Unable to render report data.</p>; }

  // Generic key-value renderer for any report type
  const renderValue = (val: unknown, depth = 0): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-zinc-600">—</span>;
    if (typeof val === "boolean") return <span className={val ? "text-emerald-400" : "text-red-400"}>{val ? "Yes" : "No"}</span>;
    if (typeof val === "number") return <span className="text-cyan-300 font-mono">{val.toLocaleString()}</span>;
    if (typeof val === "string") {
      // Detect action labels
      if (["BUY", "SELL", "HOLD", "WATCH", "Accumulation Zone", "Reduce Exposure", "Avoid New Entry", "Momentum Confirmed", "Momentum Weakening"].includes(val)) {
        const colorMap: Record<string, string> = {
          "BUY": "text-emerald-400", "Accumulation Zone": "text-emerald-400", "Momentum Confirmed": "text-emerald-300",
          "SELL": "text-red-400", "Reduce Exposure": "text-red-400", "Avoid New Entry": "text-red-300",
          "HOLD": "text-amber-400", "WATCH": "text-amber-300", "Momentum Weakening": "text-amber-300",
        };
        return <span className={`font-semibold ${colorMap[val] ?? "text-zinc-200"}`}>{val}</span>;
      }
      return <span className="text-zinc-200">{val}</span>;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-zinc-600">[]</span>;
      if (typeof val[0] !== "object") {
        return <span className="text-zinc-300">{val.join(", ")}</span>;
      }
      return (
        <div className="space-y-2 mt-1">
          {val.slice(0, 10).map((item, i) => (
            <div key={i} className="bg-zinc-900/60 rounded p-2 border border-zinc-800">
              {renderValue(item, depth + 1)}
            </div>
          ))}
          {val.length > 10 && <p className="text-zinc-500 text-xs">+{val.length - 10} more items</p>}
        </div>
      );
    }
    if (typeof val === "object") {
      const entries = Object.entries(val as Record<string, unknown>);
      if (depth > 2) return <span className="text-zinc-500 text-xs">[object]</span>;
      return (
        <div className={`space-y-1 ${depth > 0 ? "pl-2 border-l border-zinc-800" : ""}`}>
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-2 items-start text-sm">
              <span className="text-zinc-500 font-mono text-xs min-w-[120px] pt-0.5">{k}</span>
              <span className="flex-1">{renderValue(v, depth + 1)}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span className="text-zinc-400">{String(val)}</span>;
  };

  const topLevelEntries = Object.entries(data);

  return (
    <div className="space-y-4">
      {topLevelEntries.map(([key, value]) => (
        <div key={key} className="bg-zinc-900/40 rounded-lg border border-zinc-800 p-4">
          <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-1 h-3 bg-cyan-500 rounded-full inline-block" />
            {key.replace(/_/g, " ")}
          </h4>
          <div className="text-sm">{renderValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function PublicSharedReport() {
  const params = useParams<{ publicShareId: string }>();
  const [, navigate] = useLocation();
  const publicShareId = params.publicShareId ?? "";

  const { data, isLoading, error } = trpc.sharedReports.getPublic.useQuery(
    { publicShareId },
    { enabled: !!publicShareId, retry: false }
  );

  // Update document title
  useEffect(() => {
    if (data) {
      document.title = `${data.subject} — FAULTLINE Intelligence`;
    }
    return () => { document.title = "FAULTLINE"; };
  }, [data]);

  const typeInfo = data ? (REPORT_TYPE_LABELS[data.reportType] ?? { label: data.reportType, icon: <BarChart3 className="w-4 h-4" />, color: "text-zinc-400" }) : null;

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-500 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm font-mono tracking-widest">LOADING REPORT…</p>
        </div>
      </div>
    );
  }

  // ── Error states ──
  if (error || !data) {
    const isRevoked = error?.message?.includes("revoked");
    const isExpired = error?.message?.includes("expired");
    const isNotFound = error?.message?.includes("not found") || error?.data?.code === "NOT_FOUND";

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        {/* FAULTLINE wordmark */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-black tracking-[0.3em] text-white font-mono">FAULTLINE</div>
          <div className="text-xs text-zinc-600 tracking-widest mt-1">INTELLIGENCE TERMINAL</div>
        </div>

        <Card className="max-w-md w-full bg-zinc-900 border-zinc-800">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              {isRevoked ? <Lock className="w-6 h-6 text-red-400" /> :
               isExpired ? <Clock className="w-6 h-6 text-amber-400" /> :
               <AlertTriangle className="w-6 h-6 text-zinc-400" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isRevoked ? "Link Revoked" : isExpired ? "Link Expired" : isNotFound ? "Report Not Found" : "Unable to Load Report"}
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                {isRevoked ? "The owner has revoked access to this report." :
                 isExpired ? "This shared link has passed its expiration date." :
                 isNotFound ? "This report link doesn't exist or has been removed." :
                 "Something went wrong loading this report."}
              </p>
            </div>
            <Button
              onClick={() => navigate("/")}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
            >
              Visit FAULTLINE <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Report view ──
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black tracking-[0.25em] text-white font-mono">FAULTLINE</span>
            <span className="text-zinc-700">|</span>
            <div className={`flex items-center gap-1.5 ${typeInfo?.color}`}>
              {typeInfo?.icon}
              <span className="text-xs font-mono tracking-wider">{typeInfo?.label?.toUpperCase()}</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/")}
            className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold h-7 px-3"
          >
            Get Access <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Report header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`border-zinc-700 ${typeInfo?.color} text-xs font-mono`}>
              {typeInfo?.icon}
              <span className="ml-1">{typeInfo?.label}</span>
            </Badge>
            <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-xs">
              <Share2 className="w-3 h-3 mr-1" />
              Shared Report
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-white">{data.subject}</h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Generated {formatDate(data.createdAt instanceof Date ? data.createdAt.getTime() : data.createdAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              {(data.viewCount ?? 0).toLocaleString()} views
            </span>
            {data.expiresAt && (
              <span className="flex items-center gap-1.5 text-amber-500">
                <Clock className="w-3 h-3" />
                Expires {formatDate(data.expiresAt instanceof Date ? data.expiresAt.getTime() : data.expiresAt)}
              </span>
            )}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Disclaimer */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-200/70 leading-relaxed">
            <strong className="text-amber-300">Not financial advice.</strong> This is a read-only snapshot shared by a FAULTLINE subscriber for informational and educational purposes only. Always conduct your own research before making investment decisions.
          </p>
        </div>

        {/* Snapshot data */}
        <div>
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Report Data</h3>
          <SnapshotRenderer snapshotJson={data.snapshotJson} reportType={data.reportType} />
        </div>

        <Separator className="bg-zinc-800" />

        {/* CTA */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Get Full FAULTLINE Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-400 leading-relaxed">
              This is a snapshot shared by a subscriber. The live FAULTLINE platform gives you real-time market pressure readings, AI-powered signal intelligence, crypto regime analysis, and shareable reports — updated continuously.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
              {[
                "Real-time FAULTLINE Pressure Index",
                "Stock & Crypto Signal Intelligence",
                "AI Diagnostic Reports",
                "Market Preflight Checklist",
                "Asymmetric Opportunity Scanner",
                "Shareable Report Links",
              ].map(f => (
                <div key={f} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-cyan-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
            >
              Access FAULTLINE Intelligence <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-700 font-mono pb-4">
          FAULTLINE INTELLIGENCE TERMINAL · NOT FINANCIAL ADVICE · EDUCATIONAL USE ONLY
        </div>
      </div>
    </div>
  );
}
