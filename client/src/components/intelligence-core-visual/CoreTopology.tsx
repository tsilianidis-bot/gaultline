import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleDot,
  Droplets,
  GitBranch,
  Layers3,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import type {
  DomainId,
  EvidenceStatus,
  IntelligenceCoreViewModel,
} from "./types";

export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  current: "Verified current",
  delayed: "Published · delayed",
  stale: "Stale observation",
  static: "Static baseline",
  degraded: "Degraded source",
  unavailable: "Unavailable",
};
export function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`fic-status fic-status--${status}`}>
      <span aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
export function observationLabel(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value)))
    return "No verified observation";
  return (
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
const POSITIONS: Record<DomainId, { x: number; y: number; side: string }> = {
  liquidity: { x: 170, y: 90, side: "left-top" },
  credit: { x: 150, y: 250, side: "left-mid" },
  volatility: { x: 170, y: 410, side: "left-bottom" },
  macro: { x: 830, y: 90, side: "right-top" },
  breadth: { x: 850, y: 250, side: "right-mid" },
  ai: { x: 830, y: 410, side: "right-bottom" },
};
const ICONS = {
  liquidity: Droplets,
  credit: GitBranch,
  volatility: Activity,
  macro: Layers3,
  breadth: ScanLine,
  ai: Sparkles,
};
export function CoreTopology({
  model,
  selectedDomain,
  scenarioDomains,
  onSelect,
}: {
  model: IntelligenceCoreViewModel;
  selectedDomain: DomainId | null;
  scenarioDomains: DomainId[];
  onSelect: (id: DomainId) => void;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [compact, setCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 700px)").matches
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const change = () => setCompact(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const value = model.pressure.value;
  const hasPressure =
    value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
  return (
    <div
      className={`fic-topology ${model.animateVerifiedChange ? "fic-topology--changed" : ""}`}
      data-integrity={model.integrity}
    >
      <div className="fic-topology-coordinate" aria-hidden="true">
        EVIDENCE TOPOLOGY / 06 DOMAINS
      </div>
      <svg
        className="fic-topology-svg"
        viewBox={compact ? "325 75 350 350" : "0 0 1000 500"}
        role="img"
        aria-label="Six intelligence domains organized around the Core. Organization lines do not indicate causality."
      >
        <defs>
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor="#14313b" stopOpacity=".8" />
            <stop offset="100%" stopColor="#0a111b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="500" cy="250" r="224" fill={`url(#${gradientId})`} />
        <circle className="fic-orbit" cx="500" cy="250" r="205" />
        <circle
          className="fic-orbit fic-orbit--inner"
          cx="500"
          cy="250"
          r="161"
        />
        <path className="fic-axis" d="M500 12V488 M265 250H735" />
        {model.domains.map(domain => {
          const point = POSITIONS[domain.id];
          return (
            <path
              key={domain.id}
              className={`fic-connection ${domain.status === "current" ? "fic-connection--current" : ""} ${selectedDomain === domain.id || scenarioDomains.includes(domain.id) ? "fic-connection--selected" : ""}`}
              d={`M${point.x} ${point.y} C${point.x < 500 ? 360 : 640} ${point.y} ${point.x < 500 ? 355 : 645} 250 ${point.x < 500 ? 385 : 615} 250`}
            />
          );
        })}
        {model.relationships
          .filter(
            item =>
              item.supported &&
              (item.from === selectedDomain || item.to === selectedDomain)
          )
          .map(item => {
            const from = POSITIONS[item.from];
            const to = POSITIONS[item.to];
            return (
              <path
                key={item.id}
                className={`fic-supported-relationship fic-supported-relationship--${item.kind}`}
                d={`M${from.x} ${from.y} Q500 25 ${to.x} ${to.y}`}
              >
                <title>
                  {item.kind === "causal"
                    ? "Upstream-supported causal relationship"
                    : "Association, not causation"}
                  : {item.explanation}
                </title>
              </path>
            );
          })}
        <circle className="fic-core-shell" cx="500" cy="250" r="127" />
        <circle className="fic-pressure-track" cx="500" cy="250" r="115" />
        {hasPressure && (
          <circle
            className={`fic-pressure-value fic-pressure-value--${model.pressure.status}`}
            cx="500"
            cy="250"
            r="115"
            pathLength="100"
            strokeDasharray={`${value} 100`}
            transform="rotate(-90 500 250)"
          />
        )}
        <path
          className="fic-core-crosshair"
          d="M500 105V115 M500 385V395 M355 250H365 M635 250H645"
        />
        <circle cx="500" cy="250" r="107" fill="#0b141e" stroke="#203540" />
      </svg>
      <div className="fic-core-readout">
        <span className="fic-micro">PRESSURE INDEX</span>
        <div
          className="fic-pressure-number"
          aria-label={
            hasPressure
              ? `Pressure Index ${value} out of 100`
              : "Pressure Index unavailable"
          }
        >
          {hasPressure
            ? value.toLocaleString("en-US", { maximumFractionDigits: 1 })
            : "—"}
          <span>/ 100</span>
        </div>
        <span className="fic-core-regime">
          {model.regime.label || "Regime unavailable"}
        </span>
        <StatusBadge status={model.pressure.status} />
      </div>
      <div className="fic-domain-matrix">
        {model.domains.map((domain, index) => {
          const Icon = ICONS[domain.id];
          return (
            <button
              key={domain.id}
              type="button"
              className={`fic-domain fic-domain--${POSITIONS[domain.id].side} ${selectedDomain === domain.id || scenarioDomains.includes(domain.id) ? "fic-domain--selected" : ""}`}
              onClick={() => onSelect(domain.id)}
              aria-haspopup="dialog"
              aria-label={`Inspect ${domain.label}: ${STATUS_LABELS[domain.status]}`}
            >
              <span className="fic-domain-icon">
                <Icon size={18} strokeWidth={1.5} />
                <span className="fic-domain-number">0{index + 1}</span>
              </span>
              <span className="fic-domain-body">
                <span className="fic-domain-label">{domain.label}</span>
                <StatusBadge status={domain.status} />
                <span className="fic-domain-assessment">
                  {domain.assessment || "Current assessment withheld"}
                </span>
              </span>
              <span
                className="fic-domain-direction"
                aria-label={`Direction ${domain.direction}`}
              >
                {domain.direction === "rising" ? (
                  <ArrowUpRight size={16} />
                ) : domain.direction === "falling" ? (
                  <ArrowDownRight size={16} />
                ) : domain.direction === "stable" ? (
                  <span>→</span>
                ) : (
                  <CircleDot size={13} />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="fic-topology-note">
        <span aria-hidden="true">⌁</span> Organization lines are not causal
        claims. Select a domain to inspect its evidence.
      </p>
    </div>
  );
}
