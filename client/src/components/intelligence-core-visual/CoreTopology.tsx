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
import type { CoreVisualTransition } from "./transitions";

export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  // The adapter only retains `current` after complete, admitted, non-expired
  // lineage checks. No historical classification may use the live label.
  current: "LIVE",
  delayed: "DELAYED",
  recent: "RECENT",
  stale: "STALE",
  static: "RECENT · MODEL",
  degraded: "UNAVAILABLE · DEGRADED",
  unavailable: "UNAVAILABLE",
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
function shortObservation(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return "No source observation";
  return (
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
const POSITIONS: Record<
  DomainId,
  { x: number; y: number; portX: number; portY: number; side: string }
> = {
  liquidity: { x: 265, y: 110, portX: 361, portY: 209, side: "left-top" },
  credit: { x: 255, y: 300, portX: 334, portY: 300, side: "left-mid" },
  volatility: { x: 265, y: 490, portX: 361, portY: 391, side: "left-bottom" },
  macro: { x: 735, y: 110, portX: 639, portY: 209, side: "right-top" },
  breadth: { x: 745, y: 300, portX: 666, portY: 300, side: "right-mid" },
  ai: { x: 735, y: 490, portX: 639, portY: 391, side: "right-bottom" },
};
const ICONS = {
  liquidity: Droplets,
  credit: GitBranch,
  volatility: Activity,
  macro: Layers3,
  breadth: ScanLine,
  ai: Sparkles,
};
const CONTEXT_LABELS: Record<EvidenceStatus, string> = {
  current: "Assessment not supplied",
  delayed: "Published, not a live signal",
  recent: "Recent observation only",
  stale: "Prior observation only",
  static: "Model context only",
  degraded: "Current claim withheld",
  unavailable: "No admitted input",
};

export function CoreTopology({
  model,
  selectedDomain,
  scenarioDomains,
  onSelect,
  transition = null,
}: {
  model: IntelligenceCoreViewModel;
  selectedDomain: DomainId | null;
  scenarioDomains: DomainId[];
  onSelect: (id: DomainId) => void;
  transition?: CoreVisualTransition | null;
}) {
  const uid = useId().replace(/:/g, "");
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
  const supportedRelationships = model.relationships.filter(
    item => item.supported && item.evidenceIds.length > 0
  );
  const currentCount = model.domains.filter(
    item => item.status === "current"
  ).length;
  return (
    <div
      className={`fic-topology ${transition?.regimeChanged ? "fic-core-event--regime" : ""} ${transition?.pressureChanged ? "fic-core-event--pressure" : ""}`}
      data-integrity={model.integrity}
      data-readout-current={hasPressure && model.pressure.status === "current"}
      data-transition-id={transition?.id || undefined}
    >
      <div className="fic-topology-coordinate" aria-hidden="true">
        <span>INTELLIGENCE TOPOLOGY</span>
        <span>06 / EVIDENCE DOMAINS</span>
      </div>
      <svg
        className="fic-topology-svg"
        viewBox={compact ? "270 70 460 460" : "0 0 1000 600"}
        role="img"
        aria-labelledby={`${uid}-title ${uid}-description`}
      >
        <title id={`${uid}-title`}>
          Intelligence Core — Pressure Index{" "}
          {hasPressure ? value : "unavailable"}, {currentCount} current evidence
          domains
        </title>
        <desc id={`${uid}-description`}>
          The inner measured ring shows the supplied Pressure Index, not
          confidence. Outer segments classify source availability. Domain
          organization paths are not causal claims. Separately labeled supported
          relationships retain their upstream association or causal type.
        </desc>
        <defs>
          <radialGradient id={`${uid}-halo`}>
            <stop offset="0" stopColor="#265765" stopOpacity=".32" />
            <stop offset=".65" stopColor="#14333f" stopOpacity=".16" />
            <stop offset="1" stopColor="#0a111b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}-face`} cx="38%" cy="24%" r="85%">
            <stop offset="0" stopColor="#203440" />
            <stop offset=".45" stopColor="#101e2a" />
            <stop offset="1" stopColor="#080f17" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0" stopColor="#bed6de" stopOpacity=".75" />
            <stop offset=".28" stopColor="#477180" stopOpacity=".52" />
            <stop offset=".58" stopColor="#162a36" />
            <stop offset="1" stopColor="#759aa8" stopOpacity=".65" />
          </linearGradient>
          <linearGradient id={`${uid}-signal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d1f4ee" />
            <stop offset="1" stopColor="#65b9c7" />
          </linearGradient>
        </defs>
        <circle
          className="fic-core-halo"
          cx="500"
          cy="300"
          r="267"
          fill={`url(#${uid}-halo)`}
        />
        <path
          className="fic-calibration-axis"
          d="M500 39V62 M500 538V561 M239 300H261 M739 300H761"
        />
        <circle className="fic-calibration-orbit" cx="500" cy="300" r="216" />
        <circle
          className="fic-calibration-orbit fic-calibration-orbit--inner"
          cx="500"
          cy="300"
          r="194"
        />
        {Array.from({ length: 24 }, (_, index) => (
          <path
            key={index}
            className={`fic-calibration-tick ${index % 4 === 0 ? "fic-calibration-tick--major" : ""}`}
            d={index % 4 === 0 ? "M500 78V90" : "M500 83V88"}
            transform={`rotate(${index * 15} 500 300)`}
          />
        ))}
        {model.domains.map(domain => {
          const p = POSITIONS[domain.id];
          return (
            <g
              key={domain.id}
              className={`fic-path-group fic-path-group--${domain.status} ${selectedDomain === domain.id || scenarioDomains.includes(domain.id) ? "fic-path-group--selected" : ""} ${transition?.admittedDomains.includes(domain.id) ? "fic-path-group--admitted" : ""}`}
            >
              <path
                className="fic-connection fic-connection--organization"
                d={`M${p.x} ${p.y} C${p.x < 500 ? 327 : 673} ${p.y} ${p.x < 500 ? 311 : 689} ${p.portY} ${p.portX} ${p.portY}`}
              />
              <circle
                className="fic-domain-port"
                cx={p.portX}
                cy={p.portY}
                r={domain.status === "current" ? 4 : 3}
              />
            </g>
          );
        })}
        {supportedRelationships.map(item => {
          const from = POSITIONS[item.from];
          const to = POSITIONS[item.to];
          const sameSide = from.x < 500 === to.x < 500;
          const bend = from.x < 500 ? 310 : 690;
          const path = sameSide
            ? `M${from.x} ${from.y} C${bend} ${from.y} ${bend} ${to.y} ${to.x} ${to.y}`
            : `M${from.x} ${from.y} C${from.x} 26 ${to.x} 26 ${to.x} ${to.y}`;
          const current = item.evidenceIds.every(id =>
            model.evidence.some(
              source =>
                source.id === id &&
                source.admitted &&
                source.status === "current"
            )
          );
          return (
            <path
              key={item.id}
              className={`fic-supported-relationship fic-supported-relationship--${item.kind} ${!current ? "fic-supported-relationship--historical" : ""} ${transition?.relationshipIds.includes(item.id) ? "fic-supported-relationship--admitted" : ""}`}
              d={path}
            >
              <title>
                {!current
                  ? "Historical relationship context, not a current claim. "
                  : ""}
                {item.kind === "causal"
                  ? "Upstream-supported causal relationship"
                  : "Supported association, not causation"}
                : {item.explanation}
              </title>
            </path>
          );
        })}
        <ellipse
          className="fic-core-foundation"
          cx="500"
          cy="458"
          rx="142"
          ry="14"
        />
        <circle
          className="fic-core-shell"
          cx="500"
          cy="300"
          r="179"
          style={{ fill: `url(#${uid}-face)`, stroke: `url(#${uid}-rim)` }}
        />
        <circle className="fic-core-machined-rim" cx="500" cy="300" r="175" />
        {model.domains.map((domain, index) => (
          <circle
            key={domain.id}
            className={`fic-availability-segment fic-availability-segment--${domain.status}`}
            cx="500"
            cy="300"
            r="166"
            pathLength="360"
            strokeDasharray="43 317"
            transform={`rotate(${index * 60 - 141} 500 300)`}
          >
            <title>
              {domain.label}: {STATUS_LABELS[domain.status]}
            </title>
          </circle>
        ))}
        <circle className="fic-core-inset" cx="500" cy="300" r="155" />
        <circle className="fic-pressure-track" cx="500" cy="300" r="146" />
        {hasPressure && (
          <circle
            className={`fic-pressure-value fic-pressure-value--${model.pressure.status}`}
            cx="500"
            cy="300"
            r="146"
            pathLength="100"
            strokeDasharray={`${value} 100`}
            transform="rotate(-90 500 300)"
            style={{
              stroke:
                model.pressure.status === "current"
                  ? `url(#${uid}-signal)`
                  : undefined,
            }}
          />
        )}
        <circle
          className="fic-core-face"
          cx="500"
          cy="300"
          r="137"
          fill={`url(#${uid}-face)`}
        />
        <path
          className="fic-core-reflection"
          d="M410 203A135 135 0 0 1 561 178"
        />
        {transition &&
          (transition.regimeChanged || transition.pressureChanged) && (
            <circle
              key={transition.id}
              className="fic-core-change-ring"
              cx="500"
              cy="300"
              r="186"
            />
          )}
      </svg>
      <div className="fic-core-readout">
        <span className="fic-core-name">INTELLIGENCE CORE</span>
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
              className={`fic-domain fic-domain--${POSITIONS[domain.id].side} fic-domain--${domain.status} ${selectedDomain === domain.id || scenarioDomains.includes(domain.id) ? "fic-domain--selected" : ""} ${selectedDomain === domain.id ? "fic-domain--focused" : ""} ${transition?.admittedDomains.includes(domain.id) ? "fic-domain--admitted" : ""} ${transition?.expiredDomains.includes(domain.id) ? "fic-domain--expired" : ""}`}
              onClick={() => onSelect(domain.id)}
              aria-haspopup="dialog"
              aria-pressed={selectedDomain === domain.id}
              aria-label={`Inspect ${domain.label}: ${STATUS_LABELS[domain.status]}`}
            >
              <span className="fic-domain-icon">
                <Icon size={18} strokeWidth={1.4} />
                <span className="fic-domain-number">0{index + 1}</span>
              </span>
              <span className="fic-domain-body">
                <span className="fic-domain-label">{domain.label}</span>
                <StatusBadge status={domain.status} />
                <span className="fic-domain-assessment">
                  {domain.assessment || CONTEXT_LABELS[domain.status]}
                </span>
                <span
                  className="fic-domain-observed"
                  title={observationLabel(domain.observationAt)}
                >
                  {shortObservation(domain.observationAt)}
                </span>
                {scenarioDomains.includes(domain.id) && (
                  <span className="fic-sr-only">
                    Related to the selected scenario, not a causal claim.
                  </span>
                )}
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
        <span className="fic-organization-key" aria-hidden="true" />{" "}
        Organization, not causation.
        {supportedRelationships.length > 0 && (
          <span className="fic-relationship-key">
            {" "}
            {supportedRelationships.length} explicitly supported{" "}
            {supportedRelationships.length === 1
              ? "relationship"
              : "relationships"}
            ; inspect domains for lineage.
          </span>
        )}
      </p>
    </div>
  );
}
