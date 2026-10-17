import {
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adaptIntelligenceCore, createUnavailableCore } from "./adapter";
import { CoreTopology, observationLabel, StatusBadge } from "./CoreTopology";
import { EvidenceDrawer, type EvidenceSelection } from "./EvidenceDrawer";
import { ScenarioPanel, TrackRecordPanel } from "./Panels";
import type {
  DomainId,
  IntelligenceCoreExperienceProps,
  ThesisDestination,
} from "./types";
import "./intelligence-core.css";

const THESIS: { id: ThesisDestination; label: string; question: string }[] = [
  {
    id: "now",
    label: "What’s happening",
    question: "Read the current assessment",
  },
  { id: "why", label: "Why", question: "Trace the evidence and drivers" },
  {
    id: "outlook",
    label: "What’s next",
    question: "Explore conditional scenarios",
  },
  {
    id: "watch",
    label: "What to watch",
    question: "Inspect confirmation conditions",
  },
  { id: "act", label: "What to do", question: "Review decision context" },
];
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
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [scenarioDomains, setScenarioDomains] = useState<DomainId[]>([]);
  const selectEvidence = (ids: string[], title: string) =>
    setSelection({ ids, title });
  const selectDomain = (id: DomainId) => {
    const domain = model.domains.find(item => item.id === id);
    if (domain)
      setSelection({ ids: domain.evidenceIds, title: domain.label, domain });
  };
  const navigate = (destination: ThesisDestination) =>
    onNavigate?.(destination);
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
            <span className="fic-eyebrow-separator">/</span> MARKET EVIDENCE
            SYSTEM
          </div>
          <h1>The market, connected.</h1>
          <p>
            Understand the conditions. Trace the evidence. See what would change
            the assessment.
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
          />
          <div
            className="fic-status-legend"
            aria-label="Evidence classifications"
          >
            {(
              [
                "current",
                "delayed",
                "stale",
                "static",
                "degraded",
                "unavailable",
              ] as const
            ).map(status => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </div>
        <aside
          className="fic-interpretation"
          aria-label="Market interpretation"
        >
          <div className="fic-rail-label">
            <span className="fic-micro">01 / CURRENT READOUT</span>
            <Fingerprint size={17} strokeWidth={1.4} />
          </div>
          <h2>{model.regime.label || "Evidence before certainty."}</h2>
          <p className="fic-interpretation-lead">
            {model.overview ||
              "The verified Intelligence Core has not been connected to this presentation. No current market assessment is being inferred."}
          </p>
          <div className="fic-rail-rule" />
          <div className="fic-rail-label">
            <span className="fic-micro">EVIDENCE COVERAGE</span>
            <Layers3 size={15} />
          </div>
          <div className="fic-coverage-number">
            {model.domains.filter(item => item.status === "current").length}
            <span> / 6 domains</span>
          </div>
          <p className="fic-rail-small">
            With admitted current evidence. Other classifications remain
            visible, not blended into a live signal.
          </p>
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
          <span>From evidence to understanding</span>
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
                  navigate(step.id);
                }
              }}
            >
              <span className="fic-step-number">0{index + 1}</span>
              <span>{step.label}</span>
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
