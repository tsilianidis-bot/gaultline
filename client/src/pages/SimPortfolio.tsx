/* ============================================================
   FAULTLINE — $10K → $1M Simulated Portfolio
   Live simulated portfolio following FAULTLINE signals.
   Stocks: $10,000 starting capital
   Crypto: $10,000 starting capital
   Daily AI journal documents every hold/trade decision.
   ============================================================ */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BookOpen,
  ChevronDown, ChevronUp, RefreshCw, Lock, Activity, Zap,
  AlertTriangle, CheckCircle2, Info, BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ── Types ─────────────────────────────────────────────────────
interface TradeRationale {
  pressureScore?: number;
  pressureRegime?: string;
  pressureLevel?: string;
  pressureNarrative?: string;
  domainScores?: {
    credit: number; aiBubble: number; treasury: number;
    recession: number; liquidity: number; volatility: number;
  };
  domainNarrative?: string;
  rsi?: number;
  rsiLabel?: string;
  macdSignal?: string;
  smaSignal?: string;
  trend?: string;
  technicalNarrative?: string;
  volumeSignal?: string;
  volumeNarrative?: string;
  asymmetryRatio?: number;
  upsideTarget?: number;
  downsideRisk?: number;
  upsidePct?: number;
  downsidePct?: number;
  asymmetryNarrative?: string;
  catalyst?: string;
  riskFactors?: string[];
  invalidation?: string;
  positionSizePct?: number;
  positionSizeRationale?: string;
  fullNarrative?: string;
  actionSummary?: string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt$(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}
function fmtPct(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtDate(ts: Date | string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function daysSince(ts: Date | string | null | undefined): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}
function parseRationale(raw: string | null | undefined): TradeRationale | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as TradeRationale; } catch { return null; }
}

// ── Sub-components ────────────────────────────────────────────

/** Collapsible 9-dimension rationale panel for a trade */
function RationalePanel({ raw }: { raw: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const r = parseRationale(raw);
  if (!r) return (
    <p className="text-xs" style={{ color: "#6B7280" }}>{raw ?? "No rationale recorded."}</p>
  );

  return (
    <div>
      {/* Summary always visible */}
      {r.actionSummary && (
        <p className="text-xs mb-2" style={{ color: "#94A3B8", fontStyle: "italic" }}>
          {r.actionSummary}
        </p>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs font-mono"
        style={{ color: "#00D4FF", letterSpacing: "0.08em" }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "HIDE FULL RATIONALE" : "VIEW FULL RATIONALE (9 DIMENSIONS)"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Full AI narrative */}
          {r.fullNarrative && (
            <div className="p-3 rounded" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)" }}>
              <p className="text-xs font-mono mb-1" style={{ color: "#00D4FF", letterSpacing: "0.08em" }}>◈ AI FULL NARRATIVE</p>
              <div className="text-xs" style={{ color: "#CBD5E1" }}>
                <Streamdown>{r.fullNarrative}</Streamdown>
              </div>
            </div>
          )}

          {/* Dimension grid */}
          <div className="grid grid-cols-1 gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {/* D1: Pressure */}
            {r.pressureScore !== undefined && (
              <DimCard icon={<Activity size={11} />} label="1. FAULTLINE PRESSURE" color="#FF6B35">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold" style={{ color: "#FF6B35", fontFamily: "'IBM Plex Mono', monospace" }}>{r.pressureScore}/100</span>
                  <Badge style={{ background: "rgba(255,107,53,0.15)", color: "#FF6B35", border: "1px solid rgba(255,107,53,0.3)", fontSize: "10px" }}>
                    {r.pressureRegime}
                  </Badge>
                </div>
                {r.pressureNarrative && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.pressureNarrative}</p>}
              </DimCard>
            )}

            {/* D2: Domain Scores */}
            {r.domainScores && (
              <DimCard icon={<BarChart2 size={11} />} label="2. DOMAIN SCORES" color="#A78BFA">
                <div className="grid grid-cols-3 gap-1 mb-1">
                  {Object.entries(r.domainScores).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <div className="text-xs font-mono font-bold" style={{ color: v >= 7 ? "#FF4444" : v >= 5 ? "#FF9500" : "#00FF88" }}>{v.toFixed(1)}</div>
                      <div className="text-xs" style={{ color: "#6B7280", fontSize: "9px", textTransform: "uppercase" }}>{k.replace("aiBubble", "AI").replace("treasury", "Tsy")}</div>
                    </div>
                  ))}
                </div>
                {r.domainNarrative && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.domainNarrative}</p>}
              </DimCard>
            )}

            {/* D3: Technical */}
            {r.rsi !== undefined && (
              <DimCard icon={<TrendingUp size={11} />} label="3. TECHNICAL INDICATORS" color="#00D4FF">
                <div className="flex gap-3 mb-1 flex-wrap">
                  <span className="text-xs font-mono" style={{ color: "#00D4FF" }}>RSI {r.rsi?.toFixed(1)} <span style={{ color: "#6B7280" }}>({r.rsiLabel})</span></span>
                  {r.macdSignal && <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>MACD: {r.macdSignal}</span>}
                  {r.smaSignal && <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>SMA: {r.smaSignal}</span>}
                </div>
                {r.technicalNarrative && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.technicalNarrative}</p>}
              </DimCard>
            )}

            {/* D4: Volume */}
            {r.volumeSignal && (
              <DimCard icon={<Activity size={11} />} label="4. VOLUME CONFIRMATION" color="#00FF88">
                <p className="text-xs font-mono mb-1" style={{ color: "#00FF88" }}>{r.volumeSignal}</p>
                {r.volumeNarrative && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.volumeNarrative}</p>}
              </DimCard>
            )}

            {/* D5: Asymmetry */}
            {r.asymmetryRatio !== undefined && (
              <DimCard icon={<Target size={11} />} label="5. ASYMMETRY RATIO" color="#FFD700">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-bold font-mono" style={{ color: "#FFD700" }}>{r.asymmetryRatio?.toFixed(1)}:1</span>
                  <div className="text-xs">
                    <span style={{ color: "#00FF88" }}>↑ +{r.upsidePct?.toFixed(1)}%</span>
                    <span style={{ color: "#6B7280" }}> / </span>
                    <span style={{ color: "#FF4444" }}>↓ -{r.downsidePct?.toFixed(1)}%</span>
                  </div>
                </div>
                {r.asymmetryNarrative && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.asymmetryNarrative}</p>}
              </DimCard>
            )}

            {/* D6: Catalyst */}
            {r.catalyst && (
              <DimCard icon={<Zap size={11} />} label="6. CATALYST" color="#FF9500">
                <p className="text-xs" style={{ color: "#CBD5E1" }}>{r.catalyst}</p>
              </DimCard>
            )}

            {/* D7: Risk Factors */}
            {r.riskFactors && r.riskFactors.length > 0 && (
              <DimCard icon={<AlertTriangle size={11} />} label="7. RISK FACTORS" color="#FF4444">
                <ul className="space-y-1">
                  {r.riskFactors.map((rf, i) => (
                    <li key={i} className="text-xs flex gap-1" style={{ color: "#94A3B8" }}>
                      <span style={{ color: "#FF4444" }}>•</span> {rf}
                    </li>
                  ))}
                </ul>
              </DimCard>
            )}

            {/* D8: Invalidation */}
            {r.invalidation && (
              <DimCard icon={<AlertTriangle size={11} />} label="8. INVALIDATION CONDITION" color="#FF6B35">
                <p className="text-xs" style={{ color: "#CBD5E1" }}>{r.invalidation}</p>
              </DimCard>
            )}

            {/* D9: Position Sizing */}
            {r.positionSizePct !== undefined && (
              <DimCard icon={<DollarSign size={11} />} label="9. POSITION SIZING" color="#A78BFA">
                <p className="text-xs font-mono mb-1" style={{ color: "#A78BFA" }}>{r.positionSizePct?.toFixed(1)}% of account</p>
                {r.positionSizeRationale && <p className="text-xs" style={{ color: "#94A3B8" }}>{r.positionSizeRationale}</p>}
              </DimCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DimCard({ icon, label, color, children }: { icon: React.ReactNode; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${color}22` }}>
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-mono" style={{ color, letterSpacing: "0.08em", fontSize: "9px" }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Milestone progress bar $10K → $1M */
function MilestoneBar({ current }: { current: number }) {
  const milestones = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  const labels = ["$10K", "$25K", "$50K", "$100K", "$250K", "$500K", "$1M"];
  const pct = Math.min(100, Math.max(0, ((current - 10000) / (1000000 - 10000)) * 100));
  const reachedIdx = milestones.findLastIndex(m => current >= m);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-mono" style={{ color: "#6B7280", letterSpacing: "0.08em" }}>PROGRESS TO $1M</span>
        <span className="text-xs font-mono" style={{ color: "#00D4FF" }}>{pct.toFixed(2)}%</span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)",
            boxShadow: "0 0 8px rgba(0,212,255,0.4)",
          }}
        />
        {milestones.map((m, i) => {
          const pos = ((m - 10000) / (1000000 - 10000)) * 100;
          const reached = current >= m;
          return (
            <div
              key={m}
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{
                left: `${pos}%`,
                transform: "translate(-50%, -50%)",
                background: reached ? "#00FF88" : "rgba(255,255,255,0.2)",
                border: reached ? "1px solid #00FF88" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: reached ? "0 0 6px #00FF88" : "none",
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {labels.map((l, i) => (
          <span key={l} className="text-xs" style={{
            color: current >= milestones[i] ? "#00FF88" : "#374151",
            fontSize: "9px",
            fontFamily: "'IBM Plex Mono', monospace",
          }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/** Stat card */
function StatCard({ label, value, sub, color = "#00D4FF", icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-1">
        {icon && <span style={{ color }}>{icon}</span>}
        <span className="text-xs font-mono" style={{ color: "#6B7280", letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "#6B7280" }}>{sub}</div>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SimPortfolio() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);

  const overview = trpc.simPortfolio.getOverview.useQuery(undefined, { refetchInterval: 60000 });
  const positions = trpc.simPortfolio.getPositions.useQuery(undefined, { refetchInterval: 60000 });
  const trades = trpc.simPortfolio.getTrades.useQuery({ limit: 100 });
  const journal = trpc.simPortfolio.getJournal.useQuery({ limit: 30 });

  const runUpdate = trpc.simPortfolio.runDailyUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(`Daily update complete — ${data.tradesExecuted} trade(s) executed`);
      overview.refetch();
      positions.refetch();
      trades.refetch();
      journal.refetch();
    },
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  // Build equity curve from journal entries
  const equityCurve = useMemo(() => {
    if (!journal.data) return [];
    return [...journal.data]
      .reverse()
      .map(j => ({
        date: j.date,
        total: parseFloat(j.totalValue ?? "20000"),
        stocks: parseFloat(j.stocksValue ?? "10000"),
        crypto: parseFloat(j.cryptoValue ?? "10000"),
      }));
  }, [journal.data]);

  // ── Loading ──
  if (overview.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs font-mono" style={{ color: "#6B7280", letterSpacing: "0.1em" }}>LOADING PORTFOLIO…</p>
        </div>
      </div>
    );
  }

  // ── Feature hidden ──
  if (!overview.data?.visible) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Lock size={40} style={{ color: "#374151" }} />
        <h2 className="text-xl font-bold font-mono" style={{ color: "#F0F4FF", letterSpacing: "0.08em" }}>
          $10K → $1M PORTFOLIO
        </h2>
        <p className="text-sm text-center max-w-md" style={{ color: "#6B7280" }}>
          This feature is currently being prepared. The simulated portfolio will be made public once initial positions are established and the first journal entries are generated.
        </p>
        {isAdmin && (
          <div className="mt-2 px-4 py-3 rounded-lg flex items-center gap-3 max-w-md" style={{ background: "rgba(255,170,0,0.08)", border: "1px solid rgba(255,170,0,0.3)" }}>
            <AlertTriangle size={16} style={{ color: "#FFAA00", flexShrink: 0 }} />
            <p className="text-xs font-mono" style={{ color: "#FFAA00" }}>
              ADMIN PREVIEW — This portfolio is not yet publicly visible. Enable it in Admin Portal → Feature Flags → <strong>sim_portfolio_visible</strong>.
            </p>
          </div>
        )}
      </div>
    );
  }

  const { valuation, startDate, startingCapital } = overview.data;
  const totalValue = valuation?.totalValue ?? startingCapital;
  const totalReturn = totalValue - startingCapital;
  const totalReturnPct = (totalReturn / startingCapital) * 100;
  const stocksValue = valuation?.stocksValue ?? 10000;
  const cryptoValue = valuation?.cryptoValue ?? 10000;
  const stocksReturn = stocksValue - 10000;
  const cryptoReturn = cryptoValue - 10000;
  const days = daysSince(startDate);

  const openPositions = positions.data ?? [];
  const stockPositions = openPositions.filter(p => p.assetType === "stock");
  const cryptoPositions = openPositions.filter(p => p.assetType === "crypto");
  const tradeLog = trades.data ?? [];
  const journalEntries = journal.data ?? [];

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">

      {/* ── Admin Preview Banner ── */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.25)" }}>
          <AlertTriangle size={14} style={{ color: "#FFAA00", flexShrink: 0 }} />
          <p className="text-xs font-mono" style={{ color: "#FFAA00", letterSpacing: "0.06em" }}>
            ADMIN PREVIEW — This portfolio is currently <strong>not publicly visible</strong>. To enable public access, go to Admin Portal → Feature Flags → <strong>sim_portfolio_visible</strong>.
          </p>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: "#00FF88", boxShadow: "0 0 8px #00FF88" }} />
            <span className="text-xs font-mono" style={{ color: "#00FF88", letterSpacing: "0.15em" }}>LIVE SIMULATION</span>
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Rajdhani', sans-serif", color: "#F0F4FF", letterSpacing: "0.06em" }}>
            $10K → $1M PORTFOLIO
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            Simulated portfolio following FAULTLINE signals. Started {fmtDate(startDate)} · Day {days}.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => runUpdate.mutate()}
            disabled={runUpdate.isPending}
            size="sm"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00D4FF" }}
          >
            <RefreshCw size={14} className={runUpdate.isPending ? "animate-spin" : ""} />
            {runUpdate.isPending ? "Running…" : "Run Daily Update"}
          </Button>
        )}
      </div>

      {/* ── Milestone Bar ── */}
      <div className="p-4 rounded-lg" style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}>
        <MilestoneBar current={totalValue} />
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        <StatCard
          label="TOTAL VALUE"
          value={fmt$(totalValue)}
          sub={`${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(2)}% since start`}
          color={totalReturn >= 0 ? "#00FF88" : "#FF4444"}
          icon={<DollarSign size={14} />}
        />
        <StatCard
          label="TOTAL P&L"
          value={`${totalReturn >= 0 ? "+" : ""}${fmt$(totalReturn)}`}
          sub={`${fmtPct(totalReturnPct)} return`}
          color={totalReturn >= 0 ? "#00FF88" : "#FF4444"}
          icon={totalReturn >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        />
        <StatCard
          label="STOCKS"
          value={fmt$(stocksValue)}
          sub={`${stocksReturn >= 0 ? "+" : ""}${fmt$(stocksReturn)} P&L`}
          color={stocksReturn >= 0 ? "#00D4FF" : "#FF4444"}
          icon={<BarChart2 size={14} />}
        />
        <StatCard
          label="CRYPTO"
          value={fmt$(cryptoValue)}
          sub={`${cryptoReturn >= 0 ? "+" : ""}${fmt$(cryptoReturn)} P&L`}
          color={cryptoReturn >= 0 ? "#A78BFA" : "#FF4444"}
          icon={<Activity size={14} />}
        />
        <StatCard
          label="POSITIONS"
          value={`${openPositions.length}`}
          sub={`${stockPositions.length} stocks · ${cryptoPositions.length} crypto`}
          color="#FFD700"
          icon={<Target size={14} />}
        />
        <StatCard
          label="TRADES MADE"
          value={`${tradeLog.length}`}
          sub={`${days} days running`}
          color="#FF9500"
          icon={<Zap size={14} />}
        />
      </div>

      {/* ── Equity Curve ── */}
      {equityCurve.length > 1 && (
        <div className="p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-xs font-mono mb-3" style={{ color: "#6B7280", letterSpacing: "0.1em" }}>EQUITY CURVE</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={equityCurve} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickLine={false} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0A0C10", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "6px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}
                formatter={(v: number) => [fmt$(v), ""]}
                labelStyle={{ color: "#6B7280" }}
              />
              <ReferenceLine y={startingCapital} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{ value: "START", fill: "#6B7280", fontSize: 9 }} />
              <Area type="monotone" dataKey="total" stroke="#00D4FF" strokeWidth={2} fill="url(#totalGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Main Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <TabsTrigger value="overview" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em" }}>
            POSITIONS
          </TabsTrigger>
          <TabsTrigger value="trades" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em" }}>
            TRADE LOG
          </TabsTrigger>
          <TabsTrigger value="journal" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.08em" }}>
            DAILY JOURNAL
          </TabsTrigger>
        </TabsList>

        {/* ── POSITIONS TAB ── */}
        <TabsContent value="overview" className="mt-4">
          {openPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Info size={24} style={{ color: "#374151" }} />
              <p className="text-sm" style={{ color: "#6B7280" }}>No open positions yet. The first trade decisions will be made on the next daily update.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stocks */}
              {stockPositions.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono mb-2" style={{ color: "#00D4FF", letterSpacing: "0.1em" }}>◈ STOCK POSITIONS ({stockPositions.length})</h3>
                  <div className="space-y-2">
                    {stockPositions.map(pos => <PositionCard key={pos.id} pos={pos} />)}
                  </div>
                </div>
              )}
              {/* Crypto */}
              {cryptoPositions.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono mb-2" style={{ color: "#A78BFA", letterSpacing: "0.1em" }}>◈ CRYPTO POSITIONS ({cryptoPositions.length})</h3>
                  <div className="space-y-2">
                    {cryptoPositions.map(pos => <PositionCard key={pos.id} pos={pos} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TRADE LOG TAB ── */}
        <TabsContent value="trades" className="mt-4">
          {tradeLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Info size={24} style={{ color: "#374151" }} />
              <p className="text-sm" style={{ color: "#6B7280" }}>No trades recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tradeLog.map((trade) => (
                <div
                  key={trade.id}
                  className="p-4 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <Badge style={{
                        background: trade.action === "BUY" ? "rgba(0,255,136,0.15)" : "rgba(255,68,68,0.15)",
                        color: trade.action === "BUY" ? "#00FF88" : "#FF4444",
                        border: `1px solid ${trade.action === "BUY" ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)"}`,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                      }}>
                        {trade.action}
                      </Badge>
                      <div>
                        <span className="font-bold font-mono" style={{ color: "#F0F4FF" }}>{trade.ticker}</span>
                        <span className="text-xs ml-2" style={{ color: "#6B7280" }}>
                          {parseFloat(trade.quantity).toFixed(4)} @ {fmt$(trade.price)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold" style={{ color: "#00D4FF" }}>{fmt$(trade.totalValue)}</div>
                      <div className="text-xs" style={{ color: "#6B7280" }}>
                        {fmtDate(trade.executedAt)}
                        {trade.pressureScore !== null && (
                          <span className="ml-2">· Pressure: {trade.pressureScore}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Rationale */}
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <RationalePanel raw={trade.rationale} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DAILY JOURNAL TAB ── */}
        <TabsContent value="journal" className="mt-4">
          {journalEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <BookOpen size={24} style={{ color: "#374151" }} />
              <p className="text-sm" style={{ color: "#6B7280" }}>No journal entries yet. The first entry will be generated on the next daily update.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {journalEntries.map((entry) => {
                const pnl = parseFloat(entry.dailyPnl ?? "0");
                const pnlPct = parseFloat(entry.dailyPnlPct ?? "0");
                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Journal header */}
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono" style={{ color: "#00D4FF", letterSpacing: "0.1em" }}>
                            {entry.date}
                          </span>
                          {entry.tradesMade > 0 && (
                            <Badge style={{ background: "rgba(255,149,0,0.15)", color: "#FF9500", border: "1px solid rgba(255,149,0,0.3)", fontSize: "9px" }}>
                              {entry.tradesMade} TRADE{entry.tradesMade !== 1 ? "S" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {entry.pressureScore !== null && (
                            <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
                              Pressure: <span style={{ color: "#FF6B35" }}>{entry.pressureScore}/100</span>
                            </span>
                          )}
                          {entry.regime && (
                            <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
                              Regime: <span style={{ color: "#A78BFA" }}>{entry.regime}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold" style={{ color: "#F0F4FF" }}>{fmt$(entry.totalValue ?? 20000)}</div>
                        <div className="text-xs font-mono" style={{ color: pnl >= 0 ? "#00FF88" : "#FF4444" }}>
                          {pnl >= 0 ? "+" : ""}{fmt$(pnl)} ({fmtPct(pnlPct)})
                        </div>
                      </div>
                    </div>

                    {/* Journal entry markdown */}
                    <div className="text-sm" style={{ color: "#CBD5E1", lineHeight: 1.6 }}>
                      <Streamdown>{entry.journalEntry}</Streamdown>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Disclaimer ── */}
      <div className="p-3 rounded" style={{ background: "rgba(255,149,0,0.04)", border: "1px solid rgba(255,149,0,0.1)" }}>
        <p className="text-xs" style={{ color: "#6B7280" }}>
          <span style={{ color: "#FF9500" }}>⚠ DISCLAIMER:</span> This is a simulated portfolio for educational and demonstration purposes only. All trades are paper trades — no real money is involved. Past performance of this simulation does not guarantee future results. This is not financial advice.
        </p>
      </div>
    </div>
  );
}

/** Individual position card */
function PositionCard({ pos }: { pos: {
  id: number; ticker: string; name?: string | null; assetType: string;
  quantity: string; entryPrice: string; currentPrice?: string | null;
  entrySignal?: string | null; entryRationale?: string | null; openedAt: Date;
} }) {
  const [open, setOpen] = useState(false);
  const qty = parseFloat(pos.quantity);
  const entry = parseFloat(pos.entryPrice);
  const current = pos.currentPrice ? parseFloat(pos.currentPrice) : null;
  const currentValue = current ? qty * current : qty * entry;
  const totalCost = qty * entry;
  const pnl = current ? currentValue - totalCost : 0;
  const pnlPct = current ? ((current - entry) / entry) * 100 : 0;
  const isUp = pnl >= 0;

  return (
    <div className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold font-mono"
            style={{
              background: pos.assetType === "stock" ? "rgba(0,212,255,0.1)" : "rgba(167,139,250,0.1)",
              border: `1px solid ${pos.assetType === "stock" ? "rgba(0,212,255,0.2)" : "rgba(167,139,250,0.2)"}`,
              color: pos.assetType === "stock" ? "#00D4FF" : "#A78BFA",
            }}
          >
            {pos.ticker.slice(0, 3)}
          </div>
          <div>
            <div className="font-bold font-mono" style={{ color: "#F0F4FF" }}>{pos.ticker}</div>
            <div className="text-xs" style={{ color: "#6B7280" }}>{pos.name ?? pos.ticker} · {qty.toFixed(4)} units</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold" style={{ color: "#F0F4FF" }}>{fmt$(currentValue)}</div>
          <div className="text-xs font-mono" style={{ color: isUp ? "#00FF88" : "#FF4444" }}>
            {isUp ? "+" : ""}{fmt$(pnl)} ({fmtPct(pnlPct)})
          </div>
        </div>
      </div>

      {/* Price row */}
      <div className="flex gap-4 mt-2 flex-wrap">
        <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
          Entry: <span style={{ color: "#94A3B8" }}>{fmt$(entry)}</span>
        </span>
        {current && (
          <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
            Current: <span style={{ color: "#94A3B8" }}>{fmt$(current)}</span>
          </span>
        )}
        {pos.entrySignal && (
          <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
            Signal: <span style={{ color: "#FF9500" }}>{pos.entrySignal}</span>
          </span>
        )}
        <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
          Opened: <span style={{ color: "#94A3B8" }}>{fmtDate(pos.openedAt)}</span>
        </span>
      </div>

      {/* Entry rationale */}
      {pos.entryRationale && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <RationalePanel raw={pos.entryRationale} />
        </div>
      )}
    </div>
  );
}
