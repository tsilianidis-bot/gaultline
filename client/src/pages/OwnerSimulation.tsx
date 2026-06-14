/* ============================================================
   FAULTLINE — Owner Simulation Cockpit
   Private admin-only $100K → $1M virtual trading module.
   SIMULATION ONLY — NOT FINANCIAL ADVICE.
   ============================================================ */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Target, TrendingUp, TrendingDown, Shield, Zap, RefreshCw,
  AlertTriangle, ChevronDown, ChevronUp, BookOpen, BarChart3, DollarSign,
  Clock, CheckCircle2, XCircle, Eye, Minus, Plus, Activity, Cpu,
  ArrowUpRight, ArrowDownRight, Crosshair, Lock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
type ObjectiveType = "short_swing" | "long_position" | "crypto_momentum" | "defensive" | "ai_tech_momentum" | "custom";
type AssetFilter = "stocks" | "crypto" | "both";
type RiskMode = "aggressive" | "balanced" | "defensive";
type Timeframe = "intraday" | "1_5_days" | "2_6_weeks" | "3_12_months";
type Direction = "LONG" | "AVOID" | "WATCH" | "TRIM" | "DEFENSIVE";
type DataFreshness = "LIVE" | "DELAYED" | "STALE" | "UNAVAILABLE";

interface Opportunity {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  assetType: "stock" | "crypto";
  direction: Direction;
  currentPrice: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  dataFreshness: DataFreshness;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  targetOne: number;
  targetTwo: number;
  riskRewardRatio: number;
  suggestedPositionSizePct: number;
  suggestedPositionSizeUsd: number;
  riskAmountUsd: number;
  faultlineConfidence: number;
  compositeScore: number;
  momentumScore: number;
  macroFit: number;
  objectiveFit: boolean;
  objectiveFitReason: string;
  whyNow: string;
  invalidation: string;
  keyRisks: string[];
  labels: string[];
  fetchedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUsd(n: number) {
  return "$" + fmt(Math.abs(n));
}
function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + fmt(n) + "%";
}
function dirColor(d: Direction) {
  if (d === "LONG") return "text-[#00FF88]";
  if (d === "AVOID") return "text-[#FF2D55]";
  if (d === "WATCH") return "text-[#FFD700]";
  if (d === "TRIM") return "text-[#FF9500]";
  return "text-[#A8B8CC]";
}
function dirBg(d: Direction) {
  if (d === "LONG") return "bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]";
  if (d === "AVOID") return "bg-[#FF2D55]/10 border-[#FF2D55]/30 text-[#FF2D55]";
  if (d === "WATCH") return "bg-[#FFD700]/10 border-[#FFD700]/30 text-[#FFD700]";
  if (d === "TRIM") return "bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]";
  return "bg-white/5 border-white/10 text-[#A8B8CC]";
}
function freshnessColor(f: DataFreshness) {
  if (f === "LIVE") return "text-[#00FF88]";
  if (f === "DELAYED") return "text-[#FFD700]";
  return "text-[#FF2D55]";
}
function scoreBar(score: number) {
  const color = score >= 70 ? "#00FF88" : score >= 50 ? "#FFD700" : "#FF2D55";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Objective Clarifier Modal ─────────────────────────────────
interface ObjectiveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (obj: {
    objectiveType: ObjectiveType;
    assetPreference: AssetFilter;
    riskMode: RiskMode;
    maxPositionSizePct: number;
    maxLossPerTrade: number;
    timeframe: Timeframe;
    customNote?: string;
  }) => void;
  current: {
    objectiveType?: string;
    assetPreference?: string;
    riskMode?: string;
    maxPositionSizePct?: string | number;
    maxLossPerTrade?: string | number;
    timeframe?: string;
    customNote?: string | null;
  } | null;
  isSaving: boolean;
}

function ObjectiveModal({ open, onClose, onSave, current, isSaving }: ObjectiveModalProps) {
  const [objType, setObjType] = useState<ObjectiveType>((current?.objectiveType as ObjectiveType) ?? "short_swing");
  const [assetPref, setAssetPref] = useState<AssetFilter>((current?.assetPreference as AssetFilter) ?? "both");
  const [riskMode, setRiskMode] = useState<RiskMode>((current?.riskMode as RiskMode) ?? "balanced");
  const [maxPosPct, setMaxPosPct] = useState<number>(Number(current?.maxPositionSizePct ?? 10));
  const [maxLoss, setMaxLoss] = useState<number>(Number(current?.maxLossPerTrade ?? 2000));
  const [timeframe, setTimeframe] = useState<Timeframe>((current?.timeframe as Timeframe) ?? "1_5_days");
  const [customNote, setCustomNote] = useState(current?.customNote ?? "");

  const OBJECTIVES = [
    { id: "short_swing",      label: "Short-Term Swing Trade",     icon: Zap,       desc: "1–5 day momentum plays with tight stops" },
    { id: "long_position",    label: "Long-Term Position Build",   icon: TrendingUp, desc: "2–12 month conviction holds" },
    { id: "crypto_momentum",  label: "Crypto Momentum Trade",      icon: Activity,  desc: "Crypto rotation and momentum breakouts" },
    { id: "defensive",        label: "Defensive / Capital Preservation", icon: Shield, desc: "Protect capital in uncertain regimes" },
    { id: "ai_tech_momentum", label: "AI / Tech Momentum",         icon: Cpu,       desc: "High-growth AI and tech sector exposure" },
    { id: "custom",           label: "Custom Objective",           icon: Target,    desc: "Define your own parameters" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0C0F16] border-[#00D4FF]/20 text-[#F4F8FF]">
        <DialogHeader>
          <DialogTitle className="text-[#00D4FF] font-mono text-lg tracking-wider">
            WHAT IS YOUR OBJECTIVE TODAY?
          </DialogTitle>
          <DialogDescription className="text-[#A8B8CC] text-sm">
            FAULTLINE will filter and rank opportunities based on your selected objective.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Objective type */}
          <div>
            <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-3 block">TRADING OBJECTIVE</Label>
            <div className="grid grid-cols-2 gap-2">
              {OBJECTIVES.map(o => {
                const Icon = o.icon;
                const active = objType === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setObjType(o.id as ObjectiveType)}
                    className={`flex items-start gap-3 p-3 rounded border text-left transition-all ${
                      active
                        ? "border-[#00D4FF]/60 bg-[#00D4FF]/10"
                        : "border-white/10 bg-white/3 hover:border-white/20"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? "text-[#00D4FF]" : "text-[#64748B]"}`} />
                    <div>
                      <div className={`text-xs font-semibold ${active ? "text-[#F4F8FF]" : "text-[#A8B8CC]"}`}>{o.label}</div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">{o.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Asset preference */}
            <div>
              <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">ASSET UNIVERSE</Label>
              <Select value={assetPref} onValueChange={v => setAssetPref(v as AssetFilter)}>
                <SelectTrigger className="bg-[#111520] border-white/10 text-[#F4F8FF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/10">
                  <SelectItem value="both">Stocks + Crypto</SelectItem>
                  <SelectItem value="stocks">Stocks Only</SelectItem>
                  <SelectItem value="crypto">Crypto Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Risk mode */}
            <div>
              <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">RISK MODE</Label>
              <Select value={riskMode} onValueChange={v => setRiskMode(v as RiskMode)}>
                <SelectTrigger className="bg-[#111520] border-white/10 text-[#F4F8FF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/10">
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="defensive">Defensive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe */}
            <div>
              <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">TIMEFRAME</Label>
              <Select value={timeframe} onValueChange={v => setTimeframe(v as Timeframe)}>
                <SelectTrigger className="bg-[#111520] border-white/10 text-[#F4F8FF]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111520] border-white/10">
                  <SelectItem value="intraday">Intraday</SelectItem>
                  <SelectItem value="1_5_days">1–5 Days</SelectItem>
                  <SelectItem value="2_6_weeks">2–6 Weeks</SelectItem>
                  <SelectItem value="3_12_months">3–12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max loss per trade */}
            <div>
              <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">
                MAX LOSS / TRADE: ${maxLoss.toLocaleString()}
              </Label>
              <Slider
                min={100} max={20000} step={100}
                value={[maxLoss]}
                onValueChange={([v]) => setMaxLoss(v)}
                className="mt-3"
              />
            </div>
          </div>

          {/* Max position size */}
          <div>
            <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">
              MAX POSITION SIZE: {maxPosPct}% of account
            </Label>
            <Slider
              min={1} max={50} step={1}
              value={[maxPosPct]}
              onValueChange={([v]) => setMaxPosPct(v)}
            />
          </div>

          {objType === "custom" && (
            <div>
              <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">CUSTOM NOTES</Label>
              <Input
                value={customNote}
                onChange={e => setCustomNote(e.target.value)}
                placeholder="Describe your custom objective..."
                className="bg-[#111520] border-white/10 text-[#F4F8FF]"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => onSave({ objectiveType: objType, assetPreference: assetPref, riskMode, maxPositionSizePct: maxPosPct, maxLossPerTrade: maxLoss, timeframe, customNote: customNote || undefined })}
            disabled={isSaving}
            className="flex-1 bg-[#00D4FF] text-[#050608] hover:bg-[#00D4FF]/90 font-mono font-bold tracking-wider"
          >
            {isSaving ? "SAVING..." : "SET OBJECTIVE & SCAN"}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-[#A8B8CC]">
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Trade Execution Modal ─────────────────────────────────────
interface TradeModalProps {
  opp: Opportunity;
  accountValue: number;
  onClose: () => void;
  onExecute: (side: "BUY" | "SELL" | "TRIM" | "ADD", qty: number) => void;
  isExecuting: boolean;
}

function TradeModal({ opp, accountValue, onClose, onExecute, isExecuting }: TradeModalProps) {
  const [side, setSide] = useState<"BUY" | "ADD">("BUY");
  const [qty, setQty] = useState<number>(() => {
    const suggestedQty = opp.suggestedPositionSizeUsd / opp.currentPrice;
    return Math.max(1, Math.round(suggestedQty * 100) / 100);
  });

  const notional = qty * opp.currentPrice;
  const maxLossIfStop = qty * Math.abs(opp.currentPrice - opp.stopLoss);
  const pctOfAccount = (notional / accountValue) * 100;
  const exceedsRisk = maxLossIfStop > opp.riskAmountUsd * 1.5;

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0C0F16] border-[#00D4FF]/20 text-[#F4F8FF]">
        <DialogHeader>
          <DialogTitle className="text-[#00D4FF] font-mono tracking-wider flex items-center gap-2">
            <Crosshair className="w-4 h-4" />
            SIMULATE TRADE — {opp.ticker}
          </DialogTitle>
          <DialogDescription className="text-[#FF9500] text-xs font-mono">
            SIMULATION ONLY — NOT FINANCIAL ADVICE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Price info */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "PRICE", val: `$${fmt(opp.currentPrice, opp.currentPrice < 1 ? 4 : 2)}` },
              { label: "STOP", val: `$${fmt(opp.stopLoss, 2)}`, color: "text-[#FF2D55]" },
              { label: "TARGET 1", val: `$${fmt(opp.targetOne, 2)}`, color: "text-[#00FF88]" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/5 rounded p-2 text-center">
                <div className="text-[10px] text-[#64748B] font-mono">{label}</div>
                <div className={`text-sm font-mono font-bold ${color ?? "text-[#F4F8FF]"}`}>{val}</div>
              </div>
            ))}
          </div>

          {/* Side selector */}
          <div>
            <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">TRADE SIDE</Label>
            <div className="flex gap-2">
              {(["BUY", "ADD"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded border font-mono text-sm font-bold transition-all ${
                    side === s ? "border-[#00FF88]/60 bg-[#00FF88]/10 text-[#00FF88]" : "border-white/10 text-[#64748B] hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-[#A8B8CC] text-xs font-mono tracking-widest mb-2 block">QUANTITY</Label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(q => Math.max(0.001, q - (opp.assetType === "crypto" ? 0.01 : 1)))}
                className="w-8 h-8 rounded border border-white/10 flex items-center justify-center text-[#A8B8CC] hover:border-white/30">
                <Minus className="w-3 h-3" />
              </button>
              <Input
                type="number"
                value={qty}
                onChange={e => setQty(Math.max(0.001, Number(e.target.value)))}
                className="flex-1 bg-[#111520] border-white/10 text-[#F4F8FF] text-center font-mono"
              />
              <button onClick={() => setQty(q => q + (opp.assetType === "crypto" ? 0.01 : 1))}
                className="w-8 h-8 rounded border border-white/10 flex items-center justify-center text-[#A8B8CC] hover:border-white/30">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Risk summary */}
          <div className={`rounded border p-3 space-y-1 ${exceedsRisk ? "border-[#FF2D55]/40 bg-[#FF2D55]/5" : "border-white/10 bg-white/3"}`}>
            <div className="text-[10px] text-[#64748B] font-mono tracking-widest mb-2">RISK SUMMARY</div>
            {[
              { label: "Notional Value", val: fmtUsd(notional) },
              { label: "% of Account", val: `${fmt(pctOfAccount)}%` },
              { label: "Max Loss if Stop Hit", val: fmtUsd(maxLossIfStop), color: "text-[#FF2D55]" },
              { label: "R/R Ratio", val: `${opp.riskRewardRatio}:1`, color: "text-[#00FF88]" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-[#64748B]">{label}</span>
                <span className={`font-mono font-bold ${color ?? "text-[#F4F8FF]"}`}>{val}</span>
              </div>
            ))}
          </div>

          {exceedsRisk && (
            <div className="flex items-start gap-2 bg-[#FF2D55]/10 border border-[#FF2D55]/30 rounded p-3">
              <AlertTriangle className="w-4 h-4 text-[#FF2D55] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF2D55]">
                This trade exceeds your configured risk limits. Confirm to proceed anyway.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => onExecute(side, qty)}
            disabled={isExecuting}
            className={`flex-1 font-mono font-bold tracking-wider ${
              exceedsRisk
                ? "bg-[#FF9500] text-[#050608] hover:bg-[#FF9500]/90"
                : "bg-[#00FF88] text-[#050608] hover:bg-[#00FF88]/90"
            }`}
          >
            {isExecuting ? "EXECUTING..." : `CONFIRM ${side}`}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-[#A8B8CC]">
            CANCEL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Opportunity Card ──────────────────────────────────────────
function OpportunityCard({ opp, onTrade, onReject }: {
  opp: Opportunity;
  onTrade: (opp: Opportunity) => void;
  onReject: (opp: Opportunity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const priceDecimals = opp.currentPrice < 1 ? 4 : 2;

  return (
    <div className={`rounded border transition-all ${
      opp.objectiveFit ? "border-white/10 bg-[#0C0F16]" : "border-white/5 bg-[#0A0D13] opacity-70"
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded flex items-center justify-center font-mono font-bold text-sm ${
                opp.assetType === "crypto" ? "bg-[#C084FC]/10 text-[#C084FC]" : "bg-[#00D4FF]/10 text-[#00D4FF]"
              }`}>
                {opp.ticker.slice(0, 3)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-[#F4F8FF]">{opp.ticker}</span>
                <span className="text-xs text-[#64748B]">{opp.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${dirBg(opp.direction)}`}>
                  {opp.direction}
                </span>
                <span className={`text-[10px] font-mono ${freshnessColor(opp.dataFreshness)}`}>
                  ● {opp.dataFreshness}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="font-mono text-[#F4F8FF]">${fmt(opp.currentPrice, priceDecimals)}</span>
                <span className={`text-xs font-mono ${opp.changePercent >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]"}`}>
                  {opp.changePercent >= 0 ? <ArrowUpRight className="inline w-3 h-3" /> : <ArrowDownRight className="inline w-3 h-3" />}
                  {fmtPct(opp.changePercent)}
                </span>
                <span className="text-xs text-[#64748B]">{opp.sector}</span>
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 text-right">
            <div className="text-2xl font-mono font-bold" style={{
              color: opp.compositeScore >= 70 ? "#00FF88" : opp.compositeScore >= 50 ? "#FFD700" : "#FF2D55"
            }}>
              {opp.compositeScore}
            </div>
            <div className="text-[10px] text-[#64748B] font-mono">SCORE</div>
          </div>
        </div>

        {/* Labels */}
        {opp.labels.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {opp.labels.map(l => (
              <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-[#00D4FF]/8 border border-[#00D4FF]/15 text-[#00D4FF]/80 font-mono">
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Key metrics row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: "ENTRY", val: `$${fmt(opp.entryZoneLow, priceDecimals)}–${fmt(opp.entryZoneHigh, priceDecimals)}` },
            { label: "STOP", val: `$${fmt(opp.stopLoss, priceDecimals)}`, color: "text-[#FF2D55]" },
            { label: "T1", val: `$${fmt(opp.targetOne, priceDecimals)}`, color: "text-[#00FF88]" },
            { label: "R/R", val: `${opp.riskRewardRatio}:1`, color: "text-[#FFD700]" },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white/4 rounded p-2">
              <div className="text-[9px] text-[#64748B] font-mono">{label}</div>
              <div className={`text-xs font-mono font-bold mt-0.5 ${color ?? "text-[#F4F8FF]"}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Sizing */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-[#64748B]">
            Suggested: <span className="text-[#F4F8FF] font-mono">{fmtUsd(opp.suggestedPositionSizeUsd)}</span>
            <span className="text-[#64748B]"> ({opp.suggestedPositionSizePct}%)</span>
          </span>
          <span className="text-[#64748B]">
            Risk: <span className="text-[#FF2D55] font-mono">{fmtUsd(opp.riskAmountUsd)}</span>
          </span>
        </div>

        {/* FAULTLINE confidence */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-[#64748B] font-mono mb-1">
            <span>FAULTLINE CONFIDENCE</span>
            <span>{opp.faultlineConfidence}/100</span>
          </div>
          {scoreBar(opp.faultlineConfidence)}
        </div>

        {/* Objective fit */}
        <div className={`flex items-start gap-2 mt-2 text-xs rounded p-2 ${
          opp.objectiveFit ? "bg-[#00FF88]/5 border border-[#00FF88]/15" : "bg-[#FF2D55]/5 border border-[#FF2D55]/15"
        }`}>
          {opp.objectiveFit
            ? <CheckCircle2 className="w-3 h-3 text-[#00FF88] flex-shrink-0 mt-0.5" />
            : <XCircle className="w-3 h-3 text-[#FF2D55] flex-shrink-0 mt-0.5" />
          }
          <span className={opp.objectiveFit ? "text-[#00FF88]/80" : "text-[#FF2D55]/80"}>
            {opp.objectiveFitReason}
          </span>
        </div>
      </div>

      {/* Expandable rationale */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-white/5 text-[#64748B] hover:text-[#A8B8CC] transition-colors"
      >
        <span className="text-[10px] font-mono tracking-widest">FULL RATIONALE</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <div>
            <div className="text-[10px] text-[#00D4FF] font-mono tracking-widest mb-1">WHY NOW</div>
            <p className="text-xs text-[#A8B8CC] leading-relaxed">{opp.whyNow}</p>
          </div>
          <div>
            <div className="text-[10px] text-[#FF9500] font-mono tracking-widest mb-1">INVALIDATION</div>
            <p className="text-xs text-[#A8B8CC]">{opp.invalidation}</p>
          </div>
          {opp.keyRisks.length > 0 && (
            <div>
              <div className="text-[10px] text-[#FF2D55] font-mono tracking-widest mb-1">KEY RISKS</div>
              <ul className="space-y-1">
                {opp.keyRisks.map((r, i) => (
                  <li key={i} className="text-xs text-[#A8B8CC] flex items-start gap-1.5">
                    <span className="text-[#FF2D55] mt-0.5">▸</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] text-[#64748B] font-mono">MOMENTUM</div>
              {scoreBar(opp.momentumScore)}
            </div>
            <div>
              <div className="text-[9px] text-[#64748B] font-mono">MACRO FIT</div>
              {scoreBar(opp.macroFit)}
            </div>
            <div>
              <div className="text-[9px] text-[#64748B] font-mono">COMPOSITE</div>
              {scoreBar(opp.compositeScore)}
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 px-4 pb-4">
        {opp.direction === "LONG" || opp.direction === "WATCH" ? (
          <Button
            size="sm"
            onClick={() => onTrade(opp)}
            className="flex-1 bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/20 font-mono text-xs"
          >
            <TrendingUp className="w-3 h-3 mr-1" /> SIMULATE BUY
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject(opp)}
          className="flex-1 border-white/10 text-[#64748B] hover:text-[#A8B8CC] font-mono text-xs"
        >
          <XCircle className="w-3 h-3 mr-1" /> REJECT
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function OwnerSimulation() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("both");
  const [activeTab, setActiveTab] = useState("opportunities");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Opportunity | null>(null);

  const isAdmin = (user as { role?: string } | null)?.role === "admin";

  // tRPC queries
  const accountQuery = trpc.ownerSim.getAccount.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 60000,
  });
  const objectiveQuery = trpc.ownerSim.getObjective.useQuery(undefined, {
    enabled: isAdmin,
  });
  const positionsQuery = trpc.ownerSim.getPositions.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const tradesQuery = trpc.ownerSim.getTrades.useQuery(undefined, {
    enabled: isAdmin,
  });
  const snapshotsQuery = trpc.ownerSim.getDailySnapshots.useQuery(undefined, {
    enabled: isAdmin,
  });
  const opportunitiesQuery = trpc.ownerSim.getOpportunities.useQuery(
    { assetFilter },
    { enabled: isAdmin && !!objectiveQuery.data?.objective, staleTime: 120000 }
  );

  const utils = trpc.useUtils();

  // Mutations
  const setObjectiveMut = trpc.ownerSim.setObjective.useMutation({
    onSuccess: () => {
      utils.ownerSim.getObjective.invalidate();
      utils.ownerSim.getOpportunities.invalidate();
      setShowObjectiveModal(false);
      toast.success("Objective set — scanning opportunities...");
    },
    onError: (e) => toast.error(e.message),
  });

  const enterTradeMut = trpc.ownerSim.enterTrade.useMutation({
    onSuccess: (data) => {
      utils.ownerSim.getAccount.invalidate();
      utils.ownerSim.getPositions.invalidate();
      utils.ownerSim.getTrades.invalidate();
      setSelectedOpp(null);
      toast.success(`Trade executed — notional: ${fmtUsd((data as { notional?: number }).notional ?? 0)}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const closePositionMut = trpc.ownerSim.closePosition.useMutation({
    onSuccess: (data) => {
      utils.ownerSim.getAccount.invalidate();
      utils.ownerSim.getPositions.invalidate();
      utils.ownerSim.getTrades.invalidate();
      const d = data as { realizedPnl?: number };
      const pnl = d.realizedPnl ?? 0;
      toast.success(`Position closed — P&L: ${pnl >= 0 ? "+" : ""}${fmtUsd(pnl)}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectTradeMut = trpc.ownerSim.rejectTrade.useMutation({
    onSuccess: () => {
      utils.ownerSim.getTrades.invalidate();
      setRejectTarget(null);
      setRejectReason("");
      toast.success("Trade rejected and logged");
    },
    onError: (e) => toast.error(e.message),
  });

  const generateJournalMut = trpc.ownerSim.generateJournal.useMutation({
    onSuccess: () => {
      utils.ownerSim.getDailySnapshots.invalidate();
      toast.success("Journal entry generated");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetMut = trpc.ownerSim.resetAccount.useMutation({
    onSuccess: () => {
      utils.ownerSim.getAccount.invalidate();
      utils.ownerSim.getPositions.invalidate();
      utils.ownerSim.getTrades.invalidate();
      toast.success("Account reset to $100,000");
    },
    onError: (e) => toast.error(e.message),
  });

  // Derived data
  const account = accountQuery.data?.account;
  const valuation = accountQuery.data?.valuation;
  const goal = accountQuery.data?.goal;
  const objective = objectiveQuery.data?.objective;
  const positions = positionsQuery.data ?? [];
  const trades = tradesQuery.data ?? [];
  const snapshots = snapshotsQuery.data ?? [];
  const opportunities = (opportunitiesQuery.data?.opportunities ?? []) as Opportunity[];

  const objectiveLabel = useMemo(() => {
    const types = objectiveQuery.data?.objectiveTypes ?? [];
    return types.find(t => t.id === objective?.objectiveType)?.label ?? "No Objective Set";
  }, [objective, objectiveQuery.data]);

  // Guard: not admin
  if (!authLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Lock className="w-12 h-12 text-[#FF2D55] mx-auto" />
          <h1 className="text-[#F4F8FF] font-mono text-xl">RESTRICTED ACCESS</h1>
          <p className="text-[#64748B] text-sm">Owner Simulation is admin-only.</p>
          <Button onClick={() => navigate("/app")} variant="outline" className="border-white/10 text-[#A8B8CC]">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (authLoading || accountQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center">
        <div className="text-[#00D4FF] font-mono text-sm animate-pulse">INITIALIZING SIMULATION COCKPIT...</div>
      </div>
    );
  }

  const totalPnl = valuation?.totalPnl ?? 0;
  const totalPnlPct = valuation?.totalPnlPct ?? 0;
  const totalValue = valuation?.totalValue ?? 100000;
  const cashBalance = valuation?.cashBalance ?? 100000;

  return (
    <div className="min-h-screen bg-[#050608] text-[#F4F8FF] pb-20">
      {/* Simulation warning banner */}
      <div className="bg-[#FF9500]/10 border-b border-[#FF9500]/20 px-4 py-2 flex items-center justify-center gap-3">
        <AlertTriangle className="w-3 h-3 text-[#FF9500] flex-shrink-0" />
        <span className="text-[10px] font-mono text-[#FF9500] tracking-widest">
          SIMULATION ONLY — NOT FINANCIAL ADVICE — RESEARCH &amp; EDUCATIONAL PURPOSES ONLY
        </span>
        <AlertTriangle className="w-3 h-3 text-[#FF9500] flex-shrink-0" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-[#FFD700]" />
              <h1 className="text-2xl font-mono font-bold text-[#F4F8FF] tracking-wider">OWNER SIMULATION</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-[#FF9500]/10 border border-[#FF9500]/30 text-[#FF9500] font-mono">PRIVATE</span>
            </div>
            <p className="text-[#64748B] text-sm mt-1">$100,000 → $1,000,000 Virtual Trading Cockpit</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setShowObjectiveModal(true)}
              className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/20 font-mono text-xs"
            >
              <Target className="w-3 h-3 mr-1.5" />
              {objective ? "CHANGE OBJECTIVE" : "SET OBJECTIVE"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { utils.ownerSim.getAccount.invalidate(); utils.ownerSim.getOpportunities.invalidate(); }}
              className="border-white/10 text-[#64748B] font-mono text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1.5" /> REFRESH
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (confirm("Reset account to $100K? All positions will be closed.")) resetMut.mutate(); }}
              className="border-[#FF2D55]/20 text-[#FF2D55]/60 hover:text-[#FF2D55] font-mono text-xs"
            >
              RESET
            </Button>
          </div>
        </div>

        {/* ── Portfolio Header Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "CURRENT VALUE", val: fmtUsd(totalValue), sub: null, color: "text-[#F4F8FF]" },
            { label: "TOTAL P&L", val: (totalPnl >= 0 ? "+" : "") + fmtUsd(totalPnl), sub: fmtPct(totalPnlPct), color: totalPnl >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]" },
            { label: "CASH AVAILABLE", val: fmtUsd(cashBalance), sub: `${fmt((cashBalance / totalValue) * 100)}% of portfolio`, color: "text-[#00D4FF]" },
            { label: "POSITIONS VALUE", val: fmtUsd(valuation?.positionsValue ?? 0), sub: `${positions.length} open`, color: "text-[#F4F8FF]" },
            { label: "UNREALIZED P&L", val: (valuation?.unrealizedPnl ?? 0) >= 0 ? "+" + fmtUsd(valuation?.unrealizedPnl ?? 0) : fmtUsd(valuation?.unrealizedPnl ?? 0), sub: null, color: (valuation?.unrealizedPnl ?? 0) >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]" },
            { label: "STARTING CAPITAL", val: fmtUsd(100000), sub: "Virtual", color: "text-[#64748B]" },
          ].map(({ label, val, sub, color }) => (
            <div key={label} className="bg-[#0C0F16] border border-white/8 rounded p-3">
              <div className="text-[10px] text-[#64748B] font-mono tracking-widest">{label}</div>
              <div className={`text-lg font-mono font-bold mt-1 ${color}`}>{val}</div>
              {sub && <div className="text-[10px] text-[#64748B] mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        {/* ── $1M Goal Progress ── */}
        {goal && (
          <div className="bg-[#0C0F16] border border-[#FFD700]/15 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FFD700]" />
                <span className="font-mono text-sm font-bold text-[#FFD700]">$1,000,000 GOAL TRACKER</span>
              </div>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                goal.status === "ACHIEVED" ? "border-[#00FF88]/40 text-[#00FF88] bg-[#00FF88]/10" :
                goal.status === "AHEAD" ? "border-[#00D4FF]/40 text-[#00D4FF] bg-[#00D4FF]/10" :
                goal.status === "BEHIND" ? "border-[#FF2D55]/40 text-[#FF2D55] bg-[#FF2D55]/10" :
                "border-white/10 text-[#A8B8CC]"
              }`}>
                {goal.status}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#64748B]">$100K</span>
                <span className="text-[#FFD700]">{fmt(goal.pctComplete)}% complete</span>
                <span className="text-[#64748B]">$1M</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(0.5, goal.pctComplete)}%`,
                    background: "linear-gradient(90deg, #FFD700, #FF9500)",
                  }}
                />
              </div>
            </div>

            {/* Milestones */}
            <div className="flex gap-1 flex-wrap mb-3">
              {goal.milestones.map(m => (
                <span key={m.label} className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                  m.achieved
                    ? "border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700]"
                    : "border-white/8 text-[#64748B]"
                }`}>
                  {m.achieved ? "✓ " : ""}{m.label}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "REMAINING", val: fmtUsd(goal.dollarsRemaining) },
                { label: "MULTIPLE NEEDED", val: `${fmt(goal.multipleRemaining)}×` },
                { label: "DAILY RETURN (3MO)", val: `${fmt(goal.requiredDailyReturn3mo, 3)}%/day` },
                { label: "DAILY RETURN (12MO)", val: `${fmt(goal.requiredDailyReturn12mo, 3)}%/day` },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/3 rounded p-2">
                  <div className="text-[9px] text-[#64748B] font-mono">{label}</div>
                  <div className="text-sm font-mono font-bold text-[#F4F8FF] mt-0.5">{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Objective Banner ── */}
        {!objective ? (
          <div className="bg-[#FF9500]/8 border border-[#FF9500]/25 rounded p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FF9500] flex-shrink-0" />
              <div>
                <div className="font-mono font-bold text-[#FF9500]">NO OBJECTIVE SET</div>
                <div className="text-xs text-[#A8B8CC] mt-0.5">Set your trading objective to unlock ranked opportunities</div>
              </div>
            </div>
            <Button
              onClick={() => setShowObjectiveModal(true)}
              className="bg-[#FF9500] text-[#050608] hover:bg-[#FF9500]/90 font-mono font-bold text-xs flex-shrink-0"
            >
              SET OBJECTIVE
            </Button>
          </div>
        ) : (
          <div className="bg-[#00D4FF]/5 border border-[#00D4FF]/15 rounded p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Target className="w-4 h-4 text-[#00D4FF] flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-[#64748B] font-mono">ACTIVE OBJECTIVE: </span>
                <span className="text-sm font-mono font-bold text-[#00D4FF]">{objectiveLabel}</span>
                <span className="text-xs text-[#64748B] ml-2">
                  {objective.assetPreference} · {objective.riskMode} · {objective.timeframe?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            <button onClick={() => setShowObjectiveModal(true)} className="text-[10px] text-[#64748B] hover:text-[#A8B8CC] font-mono flex-shrink-0">
              CHANGE
            </button>
          </div>
        )}

        {/* ── Main Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#0C0F16] border border-white/8 p-1">
            {[
              { id: "opportunities", label: "OPPORTUNITIES", icon: Crosshair },
              { id: "positions", label: "POSITIONS", icon: BarChart3 },
              { id: "trades", label: "TRADE LOG", icon: Clock },
              { id: "journal", label: "JOURNAL", icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="font-mono text-xs data-[state=active]:bg-[#00D4FF]/10 data-[state=active]:text-[#00D4FF]"
              >
                <Icon className="w-3 h-3 mr-1.5" />{label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Opportunities Tab ── */}
          <TabsContent value="opportunities" className="mt-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] font-mono">FILTER:</span>
                {(["both", "stocks", "crypto"] as AssetFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setAssetFilter(f)}
                    className={`text-xs px-3 py-1 rounded border font-mono transition-all ${
                      assetFilter === f
                        ? "border-[#00D4FF]/40 bg-[#00D4FF]/10 text-[#00D4FF]"
                        : "border-white/10 text-[#64748B] hover:border-white/20"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {opportunitiesQuery.data && (
                  <span className="text-[10px] text-[#64748B] font-mono">
                    {opportunities.length} opportunities · scanned {new Date(opportunitiesQuery.data.scannedAt).toLocaleTimeString()}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => utils.ownerSim.getOpportunities.invalidate()}
                  disabled={opportunitiesQuery.isFetching}
                  className="border-white/10 text-[#64748B] font-mono text-xs"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${opportunitiesQuery.isFetching ? "animate-spin" : ""}`} />
                  RESCAN
                </Button>
              </div>
            </div>

            {!objective ? (
              <div className="text-center py-16 text-[#64748B]">
                <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-mono text-sm">Set your objective to unlock real-time opportunities</p>
              </div>
            ) : opportunitiesQuery.isLoading ? (
              <div className="text-center py-16 text-[#00D4FF] font-mono text-sm animate-pulse">
                SCANNING MARKETS — FETCHING LIVE PRICES &amp; FAULTLINE READINGS...
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-16 text-[#64748B]">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-mono text-sm">No opportunities found for current filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {opportunities.map(opp => (
                  <OpportunityCard
                    key={opp.id}
                    opp={opp}
                    onTrade={setSelectedOpp}
                    onReject={setRejectTarget}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Positions Tab ── */}
          <TabsContent value="positions" className="mt-4">
            {positions.length === 0 ? (
              <div className="text-center py-16 text-[#64748B]">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-mono text-sm">No open positions — use the Opportunities tab to enter trades</p>
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(pos => {
                  const qty = parseFloat(pos.quantity?.toString() ?? "0");
                  const avgEntry = parseFloat(pos.averageEntry?.toString() ?? "0");
                  const currentPrice = parseFloat(pos.currentPrice?.toString() ?? "0");
                  const mv = parseFloat(pos.marketValue?.toString() ?? "0");
                  const upnl = parseFloat(pos.unrealizedPnl?.toString() ?? "0");
                  const upnlPct = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;

                  return (
                    <div key={pos.id} className="bg-[#0C0F16] border border-white/8 rounded p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-xs font-bold ${
                            pos.assetType === "crypto" ? "bg-[#C084FC]/10 text-[#C084FC]" : "bg-[#00D4FF]/10 text-[#00D4FF]"
                          }`}>
                            {pos.symbol?.slice(0, 3)}
                          </div>
                          <div>
                            <div className="font-mono font-bold text-[#F4F8FF]">{pos.symbol}</div>
                            <div className="text-xs text-[#64748B]">{pos.name}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-right">
                          <div>
                            <div className="text-[10px] text-[#64748B] font-mono">QTY</div>
                            <div className="text-sm font-mono text-[#F4F8FF]">{fmt(qty, pos.assetType === "crypto" ? 4 : 2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#64748B] font-mono">AVG ENTRY</div>
                            <div className="text-sm font-mono text-[#F4F8FF]">${fmt(avgEntry, 2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#64748B] font-mono">CURRENT</div>
                            <div className="text-sm font-mono text-[#F4F8FF]">${fmt(currentPrice, 2)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-[#64748B] font-mono">UNREALIZED P&L</div>
                            <div className={`text-sm font-mono font-bold ${upnl >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]"}`}>
                              {upnl >= 0 ? "+" : ""}{fmtUsd(upnl)}
                              <span className="text-[10px] ml-1">({fmtPct(upnlPct)})</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Close ${pos.symbol} position at $${fmt(currentPrice, 2)}?`)) {
                              closePositionMut.mutate({
                                symbol: pos.symbol ?? "",
                                assetType: pos.assetType ?? "stock",
                                currentPrice,
                              });
                            }
                          }}
                          className="border-[#FF2D55]/20 text-[#FF2D55]/60 hover:text-[#FF2D55] font-mono text-xs"
                        >
                          CLOSE
                        </Button>
                      </div>

                      {/* Stop / targets */}
                      <div className="flex gap-3 mt-3 text-xs">
                        {pos.stopLoss && <span className="text-[#64748B]">Stop: <span className="text-[#FF2D55] font-mono">${fmt(parseFloat(pos.stopLoss.toString()), 2)}</span></span>}
                        {pos.targetOne && <span className="text-[#64748B]">T1: <span className="text-[#00FF88] font-mono">${fmt(parseFloat(pos.targetOne.toString()), 2)}</span></span>}
                        {pos.targetTwo && <span className="text-[#64748B]">T2: <span className="text-[#00FF88] font-mono">${fmt(parseFloat(pos.targetTwo.toString()), 2)}</span></span>}
                        {pos.regimeAtEntry && <span className="text-[#64748B]">Entry Regime: <span className="text-[#A8B8CC] font-mono">{pos.regimeAtEntry}</span></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Trade Log Tab ── */}
          <TabsContent value="trades" className="mt-4">
            {trades.length === 0 ? (
              <div className="text-center py-16 text-[#64748B]">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-mono text-sm">No trades yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trades.slice(0, 50).map(trade => {
                  const entryPrice = parseFloat(trade.entryPrice?.toString() ?? "0");
                  const exitPrice = trade.exitPrice ? parseFloat(trade.exitPrice.toString()) : null;
                  const realizedPnl = trade.realizedPnl ? parseFloat(trade.realizedPnl.toString()) : null;
                  const isRejected = trade.status === "rejected";

                  return (
                    <div key={trade.id} className={`bg-[#0C0F16] border rounded p-3 ${
                      isRejected ? "border-white/5 opacity-50" : "border-white/8"
                    }`}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded border font-mono ${
                            trade.side === "BUY" || trade.side === "ADD" ? "border-[#00FF88]/30 text-[#00FF88] bg-[#00FF88]/8" :
                            isRejected ? "border-white/10 text-[#64748B]" :
                            "border-[#FF2D55]/30 text-[#FF2D55] bg-[#FF2D55]/8"
                          }`}>
                            {isRejected ? "REJECTED" : trade.side}
                          </span>
                          <span className="font-mono font-bold text-[#F4F8FF]">{trade.symbol}</span>
                          <span className="text-xs text-[#64748B]">{trade.assetType}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-[#64748B]">Entry: <span className="text-[#F4F8FF] font-mono">${fmt(entryPrice, 2)}</span></span>
                          {exitPrice && <span className="text-[#64748B]">Exit: <span className="text-[#F4F8FF] font-mono">${fmt(exitPrice, 2)}</span></span>}
                          {realizedPnl !== null && (
                            <span className={`font-mono font-bold ${realizedPnl >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]"}`}>
                              {realizedPnl >= 0 ? "+" : ""}{fmtUsd(realizedPnl)}
                            </span>
                          )}
                          <span className="text-[#64748B]">{trade.createdAt ? new Date(trade.createdAt).toLocaleDateString() : ""}</span>
                        </div>
                      </div>

                      {trade.rationale && (
                        <p className="text-[10px] text-[#64748B] mt-2 line-clamp-2">{trade.rationale}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Journal Tab ── */}
          <TabsContent value="journal" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button
                size="sm"
                onClick={() => generateJournalMut.mutate()}
                disabled={generateJournalMut.isPending}
                className="bg-[#C084FC]/10 border border-[#C084FC]/30 text-[#C084FC] hover:bg-[#C084FC]/20 font-mono text-xs"
              >
                <BookOpen className="w-3 h-3 mr-1.5" />
                {generateJournalMut.isPending ? "GENERATING..." : "GENERATE TODAY'S JOURNAL"}
              </Button>
            </div>

            {snapshots.length === 0 ? (
              <div className="text-center py-16 text-[#64748B]">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-mono text-sm">No journal entries yet — click "Generate Today's Journal" to start</p>
              </div>
            ) : (
              <div className="space-y-4">
                {snapshots.map(snap => (
                  <div key={snap.id} className="bg-[#0C0F16] border border-white/8 rounded p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-sm text-[#00D4FF]">{snap.date}</span>
                      <div className="flex gap-3 text-xs">
                        {snap.endValue && (
                          <span className="text-[#64748B]">
                            Value: <span className="text-[#F4F8FF] font-mono">{fmtUsd(parseFloat(snap.endValue.toString()))}</span>
                          </span>
                        )}
                        {snap.dailyPnl && (
                          <span className={`font-mono font-bold ${parseFloat(snap.dailyPnl.toString()) >= 0 ? "text-[#00FF88]" : "text-[#FF2D55]"}`}>
                            {parseFloat(snap.dailyPnl.toString()) >= 0 ? "+" : ""}{fmtUsd(parseFloat(snap.dailyPnl.toString()))}
                          </span>
                        )}
                      </div>
                    </div>
                    {snap.aiSummary && (
                      <div className="prose prose-invert prose-sm max-w-none text-[#A8B8CC] text-xs leading-relaxed whitespace-pre-wrap">
                        {snap.aiSummary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Objective Modal ── */}
      <ObjectiveModal
        open={showObjectiveModal}
        onClose={() => setShowObjectiveModal(false)}
        onSave={data => setObjectiveMut.mutate(data)}
        current={objective ?? null}
        isSaving={setObjectiveMut.isPending}
      />

      {/* ── Trade Execution Modal ── */}
      {selectedOpp && (
        <TradeModal
          opp={selectedOpp}
          accountValue={totalValue}
          onClose={() => setSelectedOpp(null)}
          onExecute={(side, qty) => enterTradeMut.mutate({ opportunity: selectedOpp, side, quantity: qty })}
          isExecuting={enterTradeMut.isPending}
        />
      )}

      {/* ── Reject Modal ── */}
      {rejectTarget && (
        <Dialog open onOpenChange={v => !v && setRejectTarget(null)}>
          <DialogContent className="max-w-sm bg-[#0C0F16] border-white/10 text-[#F4F8FF]">
            <DialogHeader>
              <DialogTitle className="font-mono text-[#FF2D55]">REJECT TRADE — {rejectTarget.ticker}</DialogTitle>
              <DialogDescription className="text-[#A8B8CC] text-xs">Record why you're passing on this opportunity</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="bg-[#111520] border-white/10 text-[#F4F8FF]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => rejectTradeMut.mutate({ symbol: rejectTarget.ticker, assetType: rejectTarget.assetType, price: rejectTarget.currentPrice, reason: rejectReason || "No reason given" })}
                  disabled={rejectTradeMut.isPending}
                  className="flex-1 bg-[#FF2D55]/10 border border-[#FF2D55]/30 text-[#FF2D55] hover:bg-[#FF2D55]/20 font-mono text-xs"
                >
                  CONFIRM REJECT
                </Button>
                <Button variant="outline" onClick={() => setRejectTarget(null)} className="border-white/10 text-[#64748B]">
                  CANCEL
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
