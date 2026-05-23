// FAULTLINE — Recovery Confirmation Status Component
// Displays the full Recovery Confirmation System output:
//   • Color-coded status card (Red/Orange/Yellow/Blue/Green)
//   • Recovery Confidence Score gauge (0–100)
//   • Aftershock Risk badge
//   • Confirmation checklist (8 rules with pass/fail)
//   • BTC-specific language panel
//   • Tooltip explanations for all key terms
import { useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Shield, TrendingDown, Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Types (mirrored from server/recoveryEngine.ts) ────────────
export type RecoveryStatus =
  | "Breakdown Continuing"
  | "Relief Bounce"
  | "Recovery Attempt"
  | "Stabilizing"
  | "Confirmed Recovery";

export type AftershockRisk = "Low" | "Moderate" | "Elevated" | "High";

export interface ConfirmationRule {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  weight: number;
  detail: string;
}

export interface RecoveryAnalysis {
  symbol: string;
  name: string;
  isCrypto: boolean;
  isBitcoin: boolean;
  status: RecoveryStatus;
  statusColor: "red" | "orange" | "yellow" | "blue" | "green";
  recoveryConfidence: number;
  confidenceTier: "Weak Bounce" | "Recovery Attempt" | "Improving" | "Confirmed";
  aftershockRisk: AftershockRisk;
  aftershockRiskScore: number;
  confirmationRules: ConfirmationRule[];
  confirmationsPassed: number;
  confirmationsRequired: number;
  trendBias: "Bearish" | "Neutral" | "Cautiously Bullish" | "Bullish";
  marketRegime: string;
  keyReasoning: string;
  btcSpecificLanguage: string | null;
  consecutiveGreenCloses: number;
  requiredConsecutiveCloses: number;
  computedAt: number;
}

// ── Color maps ────────────────────────────────────────────────
const STATUS_COLORS: Record<RecoveryAnalysis["statusColor"], {
  border: string; bg: string; text: string; badge: string; glow: string;
}> = {
  red:    { border: "border-red-500/40",    bg: "bg-red-950/30",    text: "text-red-400",    badge: "bg-red-500/20 text-red-300 border-red-500/30",    glow: "shadow-red-500/10" },
  orange: { border: "border-orange-500/40", bg: "bg-orange-950/30", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30", glow: "shadow-orange-500/10" },
  yellow: { border: "border-yellow-500/40", bg: "bg-yellow-950/20", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", glow: "shadow-yellow-500/10" },
  blue:   { border: "border-blue-500/40",   bg: "bg-blue-950/30",   text: "text-blue-400",   badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",   glow: "shadow-blue-500/10" },
  green:  { border: "border-emerald-500/40",bg: "bg-emerald-950/30",text: "text-emerald-400",badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", glow: "shadow-emerald-500/10" },
};

const AFTERSHOCK_COLORS: Record<AftershockRisk, { text: string; bg: string; bar: string }> = {
  Low:      { text: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", bar: "bg-emerald-500" },
  Moderate: { text: "text-yellow-400",  bg: "bg-yellow-500/15 border-yellow-500/30",  bar: "bg-yellow-500" },
  Elevated: { text: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",  bar: "bg-orange-500" },
  High:     { text: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",         bar: "bg-red-500" },
};

const CONFIDENCE_BAR_COLOR = (score: number): string => {
  if (score >= 76) return "bg-emerald-500";
  if (score >= 51) return "bg-blue-500";
  if (score >= 26) return "bg-yellow-500";
  return "bg-red-500";
};

// ── Tooltip definitions ───────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  "Recovery Confidence": "A 0–100 score measuring how reliably an asset is recovering. Scores above 75 indicate a confirmed recovery across price, trend, volume, volatility, and macro conditions. Scores below 25 suggest a weak bounce with high failure risk.",
  "Aftershock Risk": "The probability that the asset experiences a secondary selloff after a recent decline. High aftershock risk means the bounce has not been confirmed and conditions remain fragile.",
  "Recovery Attempt": "The asset is showing early signs of recovery, but has not yet met the required confirmation criteria. Caution is warranted — this may still fail.",
  "Confirmed Recovery": "The asset has met all confirmation rules: multiple consecutive green closes, reclaimed key breakdown levels, volume support, cooling volatility, and stable macro conditions.",
  "Relief Bounce": "A short-term price increase following a selloff that does not meet recovery confirmation criteria. Often a temporary bounce before selling resumes.",
  "Breakdown Level": "The price level at which the asset broke down during the recent selloff. Recovery requires reclaiming and holding above this level.",
  "Trend Bias": "The overall directional bias based on the recovery confidence score. Bearish means conditions favor further downside; Bullish means conditions support continued recovery.",
  "Confirmation Status": "A checklist of 8 rules that must be met for a recovery to be confirmed. Each rule carries a weight; passing more rules increases the Recovery Confidence Score.",
};

// ── InfoTooltip helper ────────────────────────────────────────
function InfoTooltip({ term }: { term: string }) {
  const content = TOOLTIPS[term];
  if (!content) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center ml-1 text-gray-500 hover:text-gray-300 transition-colors">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs bg-gray-900 border border-gray-700 text-gray-200 p-3">
          <p className="font-medium text-white mb-1">{term}</p>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Confidence Gauge ──────────────────────────────────────────
function ConfidenceGauge({ score, tier }: { score: number; tier: RecoveryAnalysis["confidenceTier"] }) {
  const tierColors: Record<RecoveryAnalysis["confidenceTier"], string> = {
    "Weak Bounce": "text-red-400",
    "Recovery Attempt": "text-yellow-400",
    "Improving": "text-blue-400",
    "Confirmed": "text-emerald-400",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Recovery Confidence</span>
          <InfoTooltip term="Recovery Confidence" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${tierColors[tier]}`}>{tier}</span>
          <span className="text-sm font-bold font-mono text-white">{score}<span className="text-gray-500 text-xs">/100</span></span>
        </div>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${CONFIDENCE_BAR_COLOR(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-gray-600">
        <span>0 Weak</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100 Confirmed</span>
      </div>
    </div>
  );
}

// ── Aftershock Risk Badge ─────────────────────────────────────
function AftershockRiskBadge({ risk, score }: { risk: AftershockRisk; score: number }) {
  const colors = AFTERSHOCK_COLORS[risk];
  const icons: Record<AftershockRisk, React.ReactNode> = {
    Low:      <Shield className="w-3 h-3" />,
    Moderate: <Activity className="w-3 h-3" />,
    Elevated: <AlertTriangle className="w-3 h-3" />,
    High:     <Zap className="w-3 h-3" />,
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Aftershock Risk</span>
        <InfoTooltip term="Aftershock Risk" />
      </div>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium ${colors.bg} ${colors.text}`}>
        {icons[risk]}
        <span>{risk} Aftershock Risk</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ── Confirmation Checklist ────────────────────────────────────
function ConfirmationChecklist({ rules, passed, required }: {
  rules: ConfirmationRule[];
  passed: number;
  required: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Confirmation Status</span>
          <InfoTooltip term="Confirmation Status" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400">{passed}/{required} rules met</span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 transition-colors" />
          }
        </div>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-700"
          style={{ width: `${(passed / required) * 100}%` }}
        />
      </div>

      {/* Expanded checklist */}
      {expanded && (
        <div className="mt-2 space-y-1.5 border border-gray-800 rounded-lg p-3 bg-gray-900/50">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-start gap-2">
              {rule.passed
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-red-500/70 mt-0.5 shrink-0" />
              }
              <div className="min-w-0">
                <div className={`text-xs font-medium ${rule.passed ? "text-gray-200" : "text-gray-500"}`}>
                  {rule.label}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">{rule.detail}</div>
              </div>
              <div className="ml-auto shrink-0">
                <span className="text-[10px] font-mono text-gray-600">{rule.weight}pt</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
interface RecoveryStatusProps {
  data: RecoveryAnalysis;
  compact?: boolean;
}

export function RecoveryStatusCard({ data, compact = false }: RecoveryStatusProps) {
  const colors = STATUS_COLORS[data.statusColor];

  const trendBiasColor: Record<RecoveryAnalysis["trendBias"], string> = {
    "Bearish": "text-red-400",
    "Neutral": "text-gray-400",
    "Cautiously Bullish": "text-blue-400",
    "Bullish": "text-emerald-400",
  };

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} shadow-lg ${colors.glow} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingDown className={`w-4 h-4 ${colors.text}`} />
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Recovery Analysis</span>
          </div>
          <div className={`text-sm font-bold ${colors.text}`}>{data.status}</div>
        </div>
        <div className="text-right space-y-1">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-xs text-gray-500">Trend Bias</span>
            <InfoTooltip term="Trend Bias" />
          </div>
          <div className={`text-xs font-medium ${trendBiasColor[data.trendBias]}`}>{data.trendBias}</div>
        </div>
      </div>

      {/* Dashboard fields row */}
      <div className="grid grid-cols-3 gap-3 py-2 border-y border-gray-800/50">
        <div>
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-0.5">Market Regime</div>
          <div className="text-xs font-medium text-gray-300 truncate">{data.marketRegime}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-0.5">Consecutive Closes</div>
          <div className="text-xs font-medium text-gray-300">
            {data.consecutiveGreenCloses}/{data.requiredConsecutiveCloses}
            <span className="text-gray-600 ml-1">required</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-0.5">Confirmations</div>
          <div className="text-xs font-medium text-gray-300">
            {data.confirmationsPassed}/{data.confirmationsRequired}
          </div>
        </div>
      </div>

      {/* Recovery Confidence Gauge */}
      <ConfidenceGauge score={data.recoveryConfidence} tier={data.confidenceTier} />

      {/* Aftershock Risk */}
      <AftershockRiskBadge risk={data.aftershockRisk} score={data.aftershockRiskScore} />

      {/* Confirmation checklist — hidden in compact mode */}
      {!compact && (
        <ConfirmationChecklist
          rules={data.confirmationRules}
          passed={data.confirmationsPassed}
          required={data.confirmationsRequired}
        />
      )}

      {/* BTC-specific language */}
      {data.btcSpecificLanguage && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-950/20 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-mono text-orange-400 uppercase tracking-wider">Bitcoin Assessment</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{data.btcSpecificLanguage}</p>
        </div>
      )}

      {/* Key Reasoning */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">Key Reasoning</div>
        <p className="text-xs text-gray-400 leading-relaxed">{data.keyReasoning}</p>
      </div>

      {/* Timestamp */}
      <div className="text-[10px] font-mono text-gray-700 text-right">
        Updated {new Date(data.computedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ── Compact inline badge for use in screener cards ────────────
export function RecoveryStatusBadge({ status, color, confidence }: {
  status: RecoveryStatus;
  color: RecoveryAnalysis["statusColor"];
  confidence: number;
}) {
  const colors = STATUS_COLORS[color];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colors.badge}`}>
        {status}
      </span>
      <span className="text-[10px] font-mono text-gray-600">{confidence}/100</span>
    </div>
  );
}

// ── Aftershock Risk inline badge ──────────────────────────────
export function AftershockRiskInline({ risk }: { risk: AftershockRisk }) {
  const colors = AFTERSHOCK_COLORS[risk];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.text}`}>
      <AlertTriangle className="w-2.5 h-2.5" />
      {risk} Aftershock Risk
    </span>
  );
}
