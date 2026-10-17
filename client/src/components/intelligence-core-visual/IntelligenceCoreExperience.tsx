import {
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { adaptIntelligenceCore, createUnavailableCore } from "./adapter";
import { CoreTopology, observationLabel, StatusBadge } from "./CoreTopology";
import { EvidenceDrawer, type EvidenceSelection } from "./EvidenceDrawer";
import { ScenarioPanel, TrackRecordPanel } from "./Panels";
import {
  detectCoreVisualTransition,
  type CoreVisualTransition,
} from "./transitions";
import type {
  DomainId,
  IntelligenceCoreExperienceProps,
  IntelligenceCoreViewModel,
  ThesisDestination,
} from "./types";
import "./intelligence-core.css";
import "./core-refinement.css";

const THESIS: {
  id: ThesisDestination;
  label: string;
  question: string;
  short: string;
}[] = [
  {
    id: "now",
    label: "REALITY",
    question: "Read the current assessment",
    short: "What’s happening",
  },
  {
    id: "why",
    label: "CAUSATION",
    question: "Trace the evidence and drivers, without assuming causality",
    short: "Why it matters",
  },
  {
    id: "outlook",
    label: "CONSEQUENCE",
    question: "Explore conditional scenarios",
    short: "What could follow",
  },
  {
    id: "watch",
    label: "VERIFICATION",
    question: "Inspect confirmation and invalidation evidence",
    short: "What to watch",
  },
  {
    id: "act",
    label: "ACTION",
    question: "Review decision context",
    short: "What to do",
  },
];
const CLASSIFICATIONS = [
  "current",
  "delayed",
  "stale",
  "static",
  "degraded",
  "unavailable",
] as const;

export function IntelligenceCoreExperience({
  model: suppliedModel = createUnavailableCore(),
  onNavigate,
}: IntelligenceCoreExperienceProps) {
  const [freshnessTick, setFreshnessTick] = useState(0);
  const model = useMemo(() => {
    if (
      suppliedModel.mode === "demonstration" ||
      !suppliedModel.canonicalStateId
    )
      return suppliedModel;
    const checked = adaptIntelligenceCore(suppliedModel);
    checked.animateVerifiedChange =
      suppliedModel.animateVerifiedChange &&
      checked.integrity === "current" &&
      checked.pressure.status === "current";
    return checked;
  }, [suppliedModel, freshnessTick]);
  useEffect(() => {
    if (model.mode === "demonstration") return;
    const deadlines = model.evidence
      .filter(item => item.status === "current" && item.validUntil)
      .map(item => Date.parse(item.validUntil!))
      .filter(value => Number.isFinite(value) && value >= Date.now());
    if (!deadlines.length) return;
    const delay = Math.min(
      2_147_483_647,
      Math.max(1, Math.min(...deadlines) - Date.now() + 1)
    );
    const timer = window.setTimeout(
      () => setFreshnessTick(value => value + 1),
      delay
    );
    return () => window.clearTimeout(timer);
  }, [model.evidence, model.mode]);

  const previousModel = useRef<IntelligenceCoreViewModel | null>(null);
  const [activeTransition, setActiveTransition] =
    useState<CoreVisualTransition | null>(null);
  const [lastTransition, setLastTransition] =
    useState<CoreVisualTransition | null>(null);
  useEffect(() => {
    const transition = detectCoreVisualTransition(previousModel.current, model);
    previousModel.current = model;
    if (transition) {
      setActiveTransition(transition);
      setLastTransition(transition);
    }
  }, [model]);
  useEffect(() => {
    if (!activeTransition) return;
    const timer = window.setTimeout(() => setActiveTransition(null), 1200);
    return () => window.clearTimeout(timer);
  }, [activeTransition?.id]);

  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [scenarioDomains, setScenarioDomains] = useState<DomainId[]>([]);
  const selectEvidence = (ids: string[], title: string) =>
    setSelection({ ids, title });
  const selectDomain = (id: DomainId) => {
    const domain = model.domains.find(item => item.id === id);
    if (domain)
      setSelection({ ids: domain.evidenceIds, title: domain.label, domain });
  };
  const assessmentRefs = new Set([
    ...model.pressure.evidenceIds,
    ...model.regime.evidenceIds,
    ...(model.overviewEvidenceIds || []),
  ]);
  const supportingDomains = model.domains.filter(
    domain =>
      domain.status === "current" &&
      domain.evidenceIds.some(id => assessmentRefs.has(id))
  );
  const currentCount = model.domains.filter(
    domain => domain.status === "current"
  ).length;

  return (
    <section
      className="fic fic-experience"
      aria-label="FAULTLINE Intelligence Core"
    >
      {model.mode === "demonstration" && (
        <div className="fic-demo-notice">
          <span>ISOLATED DESIGN PREVIEW</span> Demonstration data. Not live
          market intelligence. Values, scenarios and records are fictional.
        </div>
      )}
      <header className="fic-page-heading">
        <div>
          <div className="fic-eyebrow">
            <span aria-hidden="true" /> INTELLIGENCE CORE{" "}
            <span className="fic-eyebrow-separator">/</span> SYSTEMIC MARKET
            INTELLIGENCE
          </div>
          <h1>The market, connected.</h1>
          <p>
            Understand current conditions. Trace what changed. Know what would
            invalidate the assessment.
          </p>
        </div>
        <button
          type="button"
          className="fic-outline-button"
          onClick={() =>
            selectEvidence(
              model.evidence.map(item => item.id),
              "Evidence integrity"
            )
          }
        >
          <ShieldCheck size={15} /> Inspect integrity <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="fic-observation-bar">
        <div>
          <span className="fic-micro">CANONICAL OBSERVATION</span>
          <strong>{observationLabel(model.observationAt)}</strong>
        </div>
        <div>
          <StatusBadge status={model.integrity} />
          <span className="fic-observation-id">
            {model.canonicalStateId || "No canonical state connected"}
          </span>
        </div>
      </div>
      <div className="fic-core-layout">
        <div className="fic-topology-section">
          <CoreTopology
            model={model}
            selectedDomain={selection?.domain?.id || null}
            scenarioDomains={scenarioDomains}
            onSelect={selectDomain}
            transition={activeTransition}
          />
          <div
            className="fic-status-legend"
            aria-label="Evidence classifications"
          >
            {CLASSIFICATIONS.map(status => (
              <span key={status} className="fic-classification-count">
                <StatusBadge status={status} />
                <small
                  aria-label={`${model.domains.filter(item => item.status === status).length} domains`}
                >
                  {model.domains.filter(item => item.status === status).length}
                </small>
              </span>
            ))}
          </div>
        </div>
        <aside
          className="fic-interpretation"
          aria-label="Market interpretation"
        >
          <div className="fic-rail-label">
            <span className="fic-micro">01 / CURRENT ASSESSMENT</span>
            <Fingerprint size={17} strokeWidth={1.4} />
          </div>
          <h2>{model.regime.label || "Evidence before certainty."}</h2>
          <p className="fic-interpretation-lead">
            {model.overview ||
              "The verified Intelligence Core has not supplied a supported current assessment. No current market condition is inferred from delayed, missing or unavailable observations."}
          </p>
          <div className="fic-rail-rule" />
          <div className="fic-rail-label">
            <span className="fic-micro">CURRENT EVIDENCE DOMAINS</span>
            <Layers3 size={15} />
          </div>
          <div className="fic-coverage-number">
            {currentCount}
            <span> / 6 domains</span>
          </div>
          <p className="fic-rail-small">
            Source availability, not confidence. Delayed and historical
            observations are kept separate.
          </p>
          {supportingDomains.length > 0 ? (
            <ul
              className="fic-support-domains"
              aria-label="Domains supporting this assessment"
            >
              {supportingDomains.map(domain => (
                <li key={domain.id}>
                  <button
                    type="button"
                    className="fic-support-domain"
                    onClick={() => selectDomain(domain.id)}
                  >
                    {domain.label}
                    <ArrowUpRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fic-rail-small">
              No admitted domains support a current assessment.
            </p>
          )}
          <div className="fic-rail-rule" />
          <div className="fic-change-heading">
            <h3>What changed</h3>
            <span>
              {model.mode === "demonstration"
                ? "FICTIONAL SNAPSHOTS"
                : "VERIFIED SNAPSHOTS"}
            </span>
          </div>
          <div
            className="fic-change-record"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {lastTransition ? (
              <ul>
                {lastTransition.summary.map((line, index) => (
                  <li key={`${lastTransition.id}-${index}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="fic-rail-small">
                No prior verified snapshot supplied. A current observation alone
                does not establish a change.
              </p>
            )}
          </div>
          <div className="fic-rail-rule" />
          <h3>Emerging stress</h3>
          {model.emergingStress.length ? (
            <ul className="fic-stress-list">
              {model.emergingStress.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      selectEvidence(
                        item.evidenceIds,
                        "Emerging stress evidence"
                      )
                    }
                  >
                    {item.statement}
                    <ArrowUpRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fic-rail-small">
              No evidence-supported emerging stress indicator connected. This is
              not an all-clear signal.
            </p>
          )}
          <button
            type="button"
            className="fic-text-button"
            onClick={() =>
              selectEvidence(
                model.evidence.map(item => item.id),
                "Evidence integrity"
              )
            }
          >
            Read the evidence <ArrowRight size={16} />
          </button>
          <p className="fic-integrity-reason">{model.integrityReason}</p>
        </aside>
      </div>
      <nav className="fic-thesis" aria-label="Pentagonal Thesis methodology">
        <div className="fic-thesis-title">
          <span className="fic-micro">PENTAGONAL THESIS™</span>
          <span>From reality to evidence-led action</span>
        </div>
        <div className="fic-thesis-steps">
          {THESIS.map((step, index) => (
            <a
              key={step.id}
              href={`/app/${step.id}`}
              title={step.question}
              onClick={event => {
                if (onNavigate) {
                  event.preventDefault();
                  onNavigate(step.id);
                }
              }}
            >
              <span className="fic-step-number">0{index + 1}</span>
              <span>
                {step.label}
                <small>{step.short}</small>
              </span>
              <ArrowUpRight size={14} />
            </a>
          ))}
        </div>
      </nav>
      <ScenarioPanel
        model={model}
        onEvidence={selectEvidence}
        onScenario={id =>
          setScenarioDomains(
            model.scenarios.find(item => item.id === id)?.domainIds || []
          )
        }
      />
      <TrackRecordPanel model={model} onEvidence={selectEvidence} />
      <footer className="fic-system-footer">
        <span>
          <ShieldCheck size={13} /> Evidence-grounded. Uncertainty preserved.
        </span>
        <span>Intelligence, not individualized investment advice.</span>
      </footer>
      <EvidenceDrawer
        model={model}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </section>
  );
}
