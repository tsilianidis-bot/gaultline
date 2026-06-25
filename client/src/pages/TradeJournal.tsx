import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  Target, BookOpen, BarChart2, Award, Filter, X,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type JournalEntry = {
  id: number;
  symbol: string;
  assetType: "stock" | "crypto";
  direction: "long" | "short";
  entryPrice: string;
  exitPrice: string | null;
  quantity: string;
  stopLoss: string | null;
  target: string | null;
  realizedPnl: string | null;
  pnlPercent: string | null;
  outcome: "win" | "loss" | "breakeven" | "open";
  setupGrade: string | null;
  executionScore: number | null;
  notes: string | null;
  tags: string | null;
  followedSetup: number;
  enteredAt: Date | string;
  exitedAt: Date | string | null;
  createdAt: Date | string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v: number) =>
  v >= 0
    ? `+$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

const fmtDate = (d: Date | string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const OUTCOME_COLORS: Record<string, string> = {
  win: "#00FF88",
  loss: "#FF2D55",
  breakeven: "#F59E0B",
  open: "#00D4FF",
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "#00FF88", A: "#00D4FF", B: "#F59E0B", C: "#FF8C00", D: "#FF2D55", F: "#8B0000",
};

// ── Empty form state ───────────────────────────────────────────────────────────
const emptyForm = () => ({
  symbol: "",
  assetType: "stock" as "stock" | "crypto",
  direction: "long" as "long" | "short",
  entryPrice: "",
  exitPrice: "",
  quantity: "",
  stopLoss: "",
  target: "",
  realizedPnl: "",
  pnlPercent: "",
  outcome: "open" as "win" | "loss" | "breakeven" | "open",
  setupGrade: "",
  executionScore: "",
  notes: "",
  tags: "",
  followedSetup: false,
  enteredAt: new Date().toISOString().slice(0, 16),
  exitedAt: "",
});

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "8px",
      padding: "16px 20px",
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "22px", fontWeight: 700, color: color ?? "#E5E7EB" }}>{value}</div>
      {sub && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#4B5563", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

// ── Trade Row ─────────────────────────────────────────────────────────────────
function TradeRow({ entry, onEdit, onDelete }: {
  entry: JournalEntry;
  onEdit: (e: JournalEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pnl = parseFloat(entry.realizedPnl ?? "0");
  const pnlPct = parseFloat(entry.pnlPercent ?? "0");
  const outcomeColor = OUTCOME_COLORS[entry.outcome] ?? "#6B7280";

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid rgba(255,255,255,0.05)`,
      borderLeft: `3px solid ${outcomeColor}`,
      borderRadius: "6px",
      marginBottom: "6px",
      overflow: "hidden",
      transition: "all 0.15s ease",
    }}>
      {/* Main row */}
      <div
        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Direction icon */}
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: entry.direction === "long" ? "rgba(0,255,136,0.1)" : "rgba(255,45,85,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {entry.direction === "long"
            ? <TrendingUp size={14} style={{ color: "#00FF88" }} />
            : <TrendingDown size={14} style={{ color: "#FF2D55" }} />}
        </div>

        {/* Symbol + date */}
        <div style={{ flex: "0 0 90px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: "#E5E7EB" }}>{entry.symbol}</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280" }}>{fmtDate(entry.enteredAt)}</div>
        </div>

        {/* Entry / Exit */}
        <div style={{ flex: "0 0 120px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF" }}>
            <span style={{ color: "#6B7280" }}>IN </span>${parseFloat(entry.entryPrice).toFixed(2)}
          </div>
          {entry.exitPrice && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9CA3AF" }}>
              <span style={{ color: "#6B7280" }}>OUT </span>${parseFloat(entry.exitPrice).toFixed(2)}
            </div>
          )}
        </div>

        {/* P&L */}
        <div style={{ flex: "0 0 100px" }}>
          {entry.outcome !== "open" && entry.realizedPnl ? (
            <>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 700, color: pnl >= 0 ? "#00FF88" : "#FF2D55" }}>
                {fmt$(pnl)}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: pnl >= 0 ? "#00FF88" : "#FF2D55", opacity: 0.7 }}>
                {fmtPct(pnlPct)}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#4B5563" }}>OPEN</div>
          )}
        </div>

        {/* Outcome badge */}
        <div style={{ flex: "0 0 80px" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", fontWeight: 700,
            color: outcomeColor, background: `${outcomeColor}18`,
            border: `1px solid ${outcomeColor}30`,
            borderRadius: "3px", padding: "2px 6px", textTransform: "uppercase",
          }}>
            {entry.outcome}
          </span>
        </div>

        {/* Grade + Score */}
        <div style={{ flex: "0 0 70px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {entry.setupGrade && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: GRADE_COLORS[entry.setupGrade] ?? "#9CA3AF" }}>
              {entry.setupGrade}
            </span>
          )}
          {entry.executionScore != null && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#6B7280" }}>
              {entry.executionScore}/100
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            onClick={e => { e.stopPropagation(); onEdit(entry); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4B5563", padding: "4px", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#00D4FF")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4B5563")}
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(entry.id); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4B5563", padding: "4px", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#FF2D55")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4B5563")}
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={13} style={{ color: "#4B5563" }} /> : <ChevronDown size={13} style={{ color: "#4B5563" }} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 14px 14px 14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px", marginTop: "12px" }}>
            {entry.stopLoss && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Stop Loss</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#FF2D55" }}>${parseFloat(entry.stopLoss).toFixed(2)}</div>
              </div>
            )}
            {entry.target && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Target</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#00FF88" }}>${parseFloat(entry.target).toFixed(2)}</div>
              </div>
            )}
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Qty</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#9CA3AF" }}>{parseFloat(entry.quantity).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Followed Setup</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: entry.followedSetup ? "#00FF88" : "#6B7280" }}>
                {entry.followedSetup ? "YES" : "NO"}
              </div>
            </div>
            {entry.exitedAt && (
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.1em" }}>Exited</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#9CA3AF" }}>{fmtDate(entry.exitedAt)}</div>
              </div>
            )}
          </div>
          {entry.tags && (
            <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {entry.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: "#6B7280", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "2px", padding: "2px 6px" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {entry.notes && (
            <div style={{ marginTop: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#6B7280", lineHeight: 1.6, background: "rgba(255,255,255,0.02)", borderRadius: "4px", padding: "8px 10px" }}>
              {entry.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TradeJournal() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: entries = [], isLoading } = trpc.tradeJournal.list.useQuery(undefined, { enabled: !!user });
  const { data: stats } = trpc.tradeJournal.stats.useQuery(undefined, { enabled: !!user });

  const addMutation = trpc.tradeJournal.add.useMutation({
    onSuccess: () => { utils.tradeJournal.list.invalidate(); utils.tradeJournal.stats.invalidate(); toast.success("Trade logged"); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.tradeJournal.update.useMutation({
    onSuccess: () => { utils.tradeJournal.list.invalidate(); utils.tradeJournal.stats.invalidate(); toast.success("Trade updated"); setDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.tradeJournal.delete.useMutation({
    onSuccess: () => { utils.tradeJournal.list.invalidate(); utils.tradeJournal.stats.invalidate(); toast.success("Trade deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [search, setSearch] = useState("");

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (e: JournalEntry) => {
    setEditingId(e.id);
    setForm({
      symbol: e.symbol,
      assetType: e.assetType,
      direction: e.direction,
      entryPrice: String(parseFloat(e.entryPrice)),
      exitPrice: e.exitPrice ? String(parseFloat(e.exitPrice)) : "",
      quantity: String(parseFloat(e.quantity)),
      stopLoss: e.stopLoss ? String(parseFloat(e.stopLoss)) : "",
      target: e.target ? String(parseFloat(e.target)) : "",
      realizedPnl: e.realizedPnl ? String(parseFloat(e.realizedPnl)) : "",
      pnlPercent: e.pnlPercent ? String(parseFloat(e.pnlPercent)) : "",
      outcome: e.outcome,
      setupGrade: e.setupGrade ?? "",
      executionScore: e.executionScore != null ? String(e.executionScore) : "",
      notes: e.notes ?? "",
      tags: e.tags ?? "",
      followedSetup: e.followedSetup === 1,
      enteredAt: new Date(e.enteredAt).toISOString().slice(0, 16),
      exitedAt: e.exitedAt ? new Date(e.exitedAt).toISOString().slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      symbol: form.symbol.toUpperCase(),
      assetType: form.assetType,
      direction: form.direction,
      entryPrice: parseFloat(form.entryPrice),
      exitPrice: form.exitPrice ? parseFloat(form.exitPrice) : undefined,
      quantity: parseFloat(form.quantity),
      stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : undefined,
      target: form.target ? parseFloat(form.target) : undefined,
      realizedPnl: form.realizedPnl ? parseFloat(form.realizedPnl) : undefined,
      pnlPercent: form.pnlPercent ? parseFloat(form.pnlPercent) : undefined,
      outcome: form.outcome,
      setupGrade: form.setupGrade || undefined,
      executionScore: form.executionScore ? parseInt(form.executionScore) : undefined,
      notes: form.notes || undefined,
      tags: form.tags || undefined,
      followedSetup: form.followedSetup,
      enteredAt: new Date(form.enteredAt).toISOString(),
      exitedAt: form.exitedAt ? new Date(form.exitedAt).toISOString() : undefined,
    };
    if (!payload.symbol || !payload.entryPrice || !payload.quantity) {
      toast.error("Symbol, entry price, and quantity are required");
      return;
    }
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => {
    return (entries as JournalEntry[]).filter(e => {
      if (filterOutcome !== "all" && e.outcome !== filterOutcome) return false;
      if (filterAsset !== "all" && e.assetType !== filterAsset) return false;
      if (search && !e.symbol.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterOutcome, filterAsset, search]);

  if (authLoading) return null;
  if (!user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
        <BookOpen size={40} style={{ color: "#374151" }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px", color: "#6B7280" }}>Sign in to access your Trade Journal</div>
        <Button onClick={() => window.location.href = getLoginUrl()}>Sign In</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <BookOpen size={18} style={{ color: "#00D4FF" }} />
            <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "18px", fontWeight: 700, color: "#E5E7EB", margin: 0 }}>
              TRADE JOURNAL
            </h1>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#4B5563", margin: 0 }}>
            Log trades, track performance, measure execution quality
          </p>
        </div>
        <Button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={14} /> Log Trade
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "24px" }}>
          <StatCard label="Total Trades" value={String(stats.total)} />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate}%`}
            sub={`${stats.wins}W / ${stats.losses}L`}
            color={stats.winRate >= 50 ? "#00FF88" : "#FF2D55"}
          />
          <StatCard
            label="Total P&L"
            value={fmt$(stats.totalPnl)}
            color={stats.totalPnl >= 0 ? "#00FF88" : "#FF2D55"}
          />
          <StatCard
            label="Avg P&L %"
            value={fmtPct(stats.avgPnlPct)}
            color={stats.avgPnlPct >= 0 ? "#00FF88" : "#FF2D55"}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 160px" }}>
          <Input
            placeholder="Search symbol…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", paddingLeft: "32px" }}
          />
          <Filter size={12} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#4B5563" }} />
        </div>
        <Select value={filterOutcome} onValueChange={setFilterOutcome}>
          <SelectTrigger style={{ width: "130px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="win">Win</SelectItem>
            <SelectItem value="loss">Loss</SelectItem>
            <SelectItem value="breakeven">Breakeven</SelectItem>
            <SelectItem value="open">Open</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAsset} onValueChange={setFilterAsset}>
          <SelectTrigger style={{ width: "120px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
            <SelectValue placeholder="Asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assets</SelectItem>
            <SelectItem value="stock">Stocks</SelectItem>
            <SelectItem value="crypto">Crypto</SelectItem>
          </SelectContent>
        </Select>
        {(filterOutcome !== "all" || filterAsset !== "all" || search) && (
          <button
            onClick={() => { setFilterOutcome("all"); setFilterAsset("all"); setSearch(""); }}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", display: "flex", alignItems: "center", gap: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Trade list */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#4B5563" }}>
          Loading journal…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <BarChart2 size={36} style={{ color: "#1F2937", margin: "0 auto 12px" }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#4B5563" }}>
            {(entries as JournalEntry[]).length === 0 ? "No trades logged yet. Click \"Log Trade\" to start tracking." : "No trades match your filters."}
          </div>
        </div>
      ) : (
        <div>
          {filtered.map(entry => (
            <TradeRow
              key={entry.id}
              entry={entry}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate({ id })}
            />
          ))}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#374151", textAlign: "right", marginTop: "8px" }}>
            {filtered.length} of {(entries as JournalEntry[]).length} trades
          </div>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "14px" }}>
              {editingId != null ? "Edit Trade" : "Log New Trade"}
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
            {/* Symbol */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Symbol *</Label>
              <Input
                value={form.symbol}
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                placeholder="NVDA"
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "4px" }}
              />
            </div>

            {/* Asset type */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Asset Type</Label>
              <Select value={form.assetType} onValueChange={v => setForm(f => ({ ...f, assetType: v as "stock" | "crypto" }))}>
                <SelectTrigger style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v as "long" | "short" }))}>
                <SelectTrigger style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entry price */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Entry Price *</Label>
              <Input type="number" value={form.entryPrice} onChange={e => setForm(f => ({ ...f, entryPrice: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Exit price */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Exit Price</Label>
              <Input type="number" value={form.exitPrice} onChange={e => setForm(f => ({ ...f, exitPrice: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Quantity */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Quantity *</Label>
              <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="100" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Outcome */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Outcome</Label>
              <Select value={form.outcome} onValueChange={v => setForm(f => ({ ...f, outcome: v as "win" | "loss" | "breakeven" | "open" }))}>
                <SelectTrigger style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="breakeven">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stop loss */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Stop Loss</Label>
              <Input type="number" value={form.stopLoss} onChange={e => setForm(f => ({ ...f, stopLoss: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Target */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Target</Label>
              <Input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Realized P&L */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Realized P&L ($)</Label>
              <Input type="number" value={form.realizedPnl} onChange={e => setForm(f => ({ ...f, realizedPnl: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* P&L % */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>P&L (%)</Label>
              <Input type="number" value={form.pnlPercent} onChange={e => setForm(f => ({ ...f, pnlPercent: e.target.value }))} placeholder="0.00" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Setup grade */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Setup Grade (DTI)</Label>
              <Select value={form.setupGrade || "none"} onValueChange={v => setForm(f => ({ ...f, setupGrade: v === "none" ? "" : v }))}>
                <SelectTrigger style={{ marginTop: "4px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Execution score */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Execution Score (0–100)</Label>
              <Input type="number" min={0} max={100} value={form.executionScore} onChange={e => setForm(f => ({ ...f, executionScore: e.target.value }))} placeholder="—" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Entered at */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Entry Date/Time</Label>
              <Input type="datetime-local" value={form.enteredAt} onChange={e => setForm(f => ({ ...f, enteredAt: e.target.value }))} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Exited at */}
            <div>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Exit Date/Time</Label>
              <Input type="datetime-local" value={form.exitedAt} onChange={e => setForm(f => ({ ...f, exitedAt: e.target.value }))} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Followed setup toggle */}
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                id="followedSetup"
                checked={form.followedSetup}
                onChange={e => setForm(f => ({ ...f, followedSetup: e.target.checked }))}
                style={{ accentColor: "#00D4FF", width: "14px", height: "14px" }}
              />
              <Label htmlFor="followedSetup" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
                Followed DTI setup recommendation
              </Label>
            </div>

            {/* Tags */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="earnings, breakout, momentum" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px" }} />
            </div>

            {/* Notes */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Label style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="What was the thesis? What happened? What would you do differently?"
                rows={3}
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", marginTop: "4px", resize: "vertical" }}
              />
            </div>
          </div>

          <DialogFooter style={{ marginTop: "16px" }}>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={addMutation.isPending || updateMutation.isPending}
            >
              {editingId != null ? "Update Trade" : "Log Trade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
