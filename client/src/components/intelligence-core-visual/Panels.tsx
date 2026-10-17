import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, FileText } from "lucide-react";
import type {
  CoreAssessmentRecord,
  CoreScenario,
  IntelligenceCoreViewModel,
  ScenarioId,
} from "./types";
import "./panels.css";

const SCENARIO_IDS: ScenarioId[] = ["A", "B", "C"];

type RecordCohort = "forward_recorded" | "reconstructed";

const cohortCopy: Record<RecordCohort, { label: string; shortLabel: string }> =
  {
    forward_recorded: { label: "Forward recorded", shortLabel: "Forward" },
    reconstructed: { label: "Reconstructed", shortLabel: "Reconstructed" },
  };

function scenarioStatus(scenario: CoreScenario): CoreScenario["status"] {
  // Scenario C is reserved for a conditional reading, even if an upstream payload
  // accidentally marks it as favored.
  return scenario.id === "C" && scenario.status === "favored"
    ? "conditional"
    : scenario.status;
}

function statusLabel(status: CoreScenario["status"]): string {
  if (status === "favored") return "Favored";
  if (status === "conditional") return "Conditional";
  return "Unsupported";
}

function scenarioName(scenario: CoreScenario): string {
  return scenario.title.trim() || `Scenario ${scenario.id}`;
}

function scenarioInitialId(scenarios: CoreScenario[]): ScenarioId {
  const nonCChoice = scenarios.find(
    scenario => scenario.id !== "C" && scenario.status === "favored"
  );
  if (nonCChoice) return nonCChoice.id;

  return (
    scenarios.find(scenario => scenario.id === "A")?.id ??
    scenarios.find(scenario => scenario.id === "B")?.id ??
    scenarios.find(scenario => scenario.id === "C")?.id ??
    "A"
  );
}

function formatAssessmentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function outcomeLabel(outcome: CoreAssessmentRecord["outcome"]): string {
  if (outcome === "supported") return "Supported";
  if (outcome === "contradicted") return "Contradicted";
  return "Unresolved";
}

function idToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Scenario readings are presentation-only: conditions, invalidations, domains, and
 * evidence identifiers are all supplied by the canonical view model.
 */
export function ScenarioPanel({
  model,
  onEvidence,
  onScenario,
}: {
  model: IntelligenceCoreViewModel;
  onEvidence: (ids: string[], title: string) => void;
  onScenario?: (id: ScenarioId) => void;
}) {
  const scenarios = model.scenarios ?? [];
  const scenariosById = useMemo(
    () => new Map(scenarios.map(scenario => [scenario.id, scenario])),
    [scenarios]
  );
  const availableScenarioIds = SCENARIO_IDS.filter(id => scenariosById.has(id));
  const [selectedId, setSelectedId] = useState<ScenarioId>(() =>
    scenarioInitialId(scenarios)
  );
  const tabRefs = useRef<Partial<Record<ScenarioId, HTMLButtonElement | null>>>(
    {}
  );
  const panelId = `fic-scenarios-${idToken(useId())}`;

  const selectedScenario =
    scenariosById.get(selectedId) ??
    scenariosById.get(scenarioInitialId(scenarios));

  const selectScenario = (id: ScenarioId) => {
    if (!scenariosById.has(id)) return;
    setSelectedId(id);
    onScenario?.(id);
  };

  const moveScenarioFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    id: ScenarioId
  ) => {
    if (availableScenarioIds.length < 2) return;

    const currentIndex = availableScenarioIds.indexOf(id);
    let nextId: ScenarioId | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextId =
        availableScenarioIds[(currentIndex + 1) % availableScenarioIds.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextId =
        availableScenarioIds[
          (currentIndex - 1 + availableScenarioIds.length) %
            availableScenarioIds.length
        ];
    } else if (event.key === "Home") {
      nextId = availableScenarioIds[0];
    } else if (event.key === "End") {
      nextId = availableScenarioIds[availableScenarioIds.length - 1];
    }

    if (nextId) {
      event.preventDefault();
      selectScenario(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <section
      className="fic-panel fic-scenario-panel"
      aria-labelledby={`${panelId}-heading`}
    >
      <header className="fic-panel-header">
        <div>
          <p className="fic-eyebrow">03 / Scenario register</p>
          <h2 id={`${panelId}-heading`}>Scenario paths</h2>
        </div>
        <p className="fic-header-note">Conditions before conclusion</p>
      </header>

      {availableScenarioIds.length === 0 ? (
        <div className="fic-empty-state" role="status">
          <p className="fic-empty-state-title">
            No scenario assessments connected
          </p>
          <p>No canonical scenario paths were supplied to this view.</p>
        </div>
      ) : (
        <>
          <div className="fic-tabs" role="tablist" aria-label="Scenario paths">
            {SCENARIO_IDS.map(id => {
              const scenario = scenariosById.get(id);
              const isSelected = selectedScenario?.id === id;
              const tabStatus = scenario ? scenarioStatus(scenario) : null;

              return (
                <button
                  key={id}
                  ref={element => {
                    tabRefs.current[id] = element;
                  }}
                  className={`fic-tab${isSelected ? " is-selected" : ""}`}
                  type="button"
                  role="tab"
                  id={`${panelId}-tab-${id}`}
                  aria-selected={isSelected}
                  aria-controls={
                    isSelected ? `${panelId}-content-${id}` : undefined
                  }
                  aria-disabled={!scenario}
                  disabled={!scenario}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectScenario(id)}
                  onKeyDown={event => moveScenarioFocus(event, id)}
                >
                  <span className="fic-tab-index">{id}</span>
                  <span>
                    {scenario ? scenarioName(scenario) : "Not connected"}
                  </span>
                  {tabStatus && (
                    <span className={`fic-tab-status is-${tabStatus}`}>
                      {statusLabel(tabStatus)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedScenario && (
            <article
              className="fic-scenario-reading"
              id={`${panelId}-content-${selectedScenario.id}`}
              role="tabpanel"
              aria-labelledby={`${panelId}-tab-${selectedScenario.id}`}
              tabIndex={0}
            >
              <header className="fic-scenario-reading-header">
                <div className="fic-scenario-identity">
                  <span className="fic-scenario-index" aria-hidden="true">
                    {selectedScenario.id}
                  </span>
                  <div>
                    <h3>{scenarioName(selectedScenario)}</h3>
                    <span
                      className={`fic-status-chip is-${scenarioStatus(selectedScenario)}`}
                    >
                      {statusLabel(scenarioStatus(selectedScenario))}
                    </span>
                  </div>
                </div>
                {selectedScenario.evidenceIds.length > 0 ? (
                  <button
                    className="fic-evidence-action"
                    type="button"
                    onClick={() =>
                      onEvidence(
                        selectedScenario.evidenceIds,
                        `${scenarioName(selectedScenario)} — scenario evidence`
                      )
                    }
                  >
                    <FileText size={15} aria-hidden="true" />
                    Review evidence
                  </button>
                ) : (
                  <span className="fic-no-evidence">No linked evidence</span>
                )}
              </header>

              <p className="fic-scenario-summary">
                {selectedScenario.summary?.trim() ||
                  "No scenario summary was supplied."}
              </p>

              <div className="fic-scenario-detail-grid">
                <section
                  className="fic-detail-block"
                  aria-labelledby={`${panelId}-conditions-${selectedScenario.id}`}
                >
                  <h4 id={`${panelId}-conditions-${selectedScenario.id}`}>
                    Selected conditions
                  </h4>
                  {selectedScenario.conditions.length > 0 ? (
                    <ul className="fic-condition-list">
                      {selectedScenario.conditions.map((condition, index) => (
                        <li key={`${selectedScenario.id}-condition-${index}`}>
                          {condition}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="fic-absent-copy">
                      No enabling conditions were supplied.
                    </p>
                  )}
                </section>

                <section
                  className="fic-detail-block"
                  aria-labelledby={`${panelId}-invalidations-${selectedScenario.id}`}
                >
                  <h4 id={`${panelId}-invalidations-${selectedScenario.id}`}>
                    Invalidation
                  </h4>
                  {selectedScenario.invalidations.length > 0 ? (
                    <ul className="fic-condition-list fic-invalidation-list">
                      {selectedScenario.invalidations.map(
                        (invalidation, index) => (
                          <li
                            key={`${selectedScenario.id}-invalidation-${index}`}
                          >
                            {invalidation}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="fic-absent-copy">
                      No invalidation criteria were supplied.
                    </p>
                  )}
                </section>
              </div>

              <section
                className="fic-domain-line"
                aria-labelledby={`${panelId}-domains-${selectedScenario.id}`}
              >
                <h4 id={`${panelId}-domains-${selectedScenario.id}`}>
                  Related domains
                </h4>
                {selectedScenario.domainIds.length > 0 ? (
                  <ul className="fic-domain-list">
                    {selectedScenario.domainIds.map(domainId => {
                      const domain = model.domains.find(
                        candidate => candidate.id === domainId
                      );
                      return (
                        <li key={domainId}>{domain?.label || domainId}</li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="fic-absent-copy">
                    No associated domains were recorded.
                  </p>
                )}
              </section>
            </article>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Assessment history deliberately reports only supplied records. It never derives
 * an aggregate hit rate or eligibility threshold from the visible rows.
 */
export function TrackRecordPanel({
  model,
  onEvidence,
}: {
  model: IntelligenceCoreViewModel;
  onEvidence: (ids: string[], title: string) => void;
}) {
  const records = model.trackRecord?.records ?? [];
  const metrics = model.trackRecord?.metrics ?? [];
  const forwardRecords = records.filter(
    record => record.classification === "forward_recorded"
  );
  const reconstructedRecords = records.filter(
    record => record.classification === "reconstructed"
  );
  const [selectedCohort, setSelectedCohort] = useState<RecordCohort>(() =>
    forwardRecords.length > 0 ? "forward_recorded" : "reconstructed"
  );
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const tabRefs = useRef<
    Partial<Record<RecordCohort, HTMLButtonElement | null>>
  >({});
  const panelId = `fic-track-record-${idToken(useId())}`;

  const activeCohort: RecordCohort =
    selectedCohort === "forward_recorded" &&
    forwardRecords.length === 0 &&
    reconstructedRecords.length > 0
      ? "reconstructed"
      : selectedCohort;
  const cohortRecords =
    activeCohort === "forward_recorded" ? forwardRecords : reconstructedRecords;
  const admittedMetrics = metrics.filter(
    metric =>
      metric.cohort === activeCohort &&
      metric.admitted &&
      metric.eligibleSample >= metric.minimumSample
  );

  const selectCohort = (cohort: RecordCohort) => {
    setSelectedCohort(cohort);
    setExpandedRecord(null);
  };

  const moveCohortFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    cohort: RecordCohort
  ) => {
    const cohortOrder: RecordCohort[] = ["forward_recorded", "reconstructed"];
    const currentIndex = cohortOrder.indexOf(cohort);
    let nextCohort: RecordCohort | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextCohort = cohortOrder[(currentIndex + 1) % cohortOrder.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextCohort =
        cohortOrder[
          (currentIndex - 1 + cohortOrder.length) % cohortOrder.length
        ];
    } else if (event.key === "Home") {
      nextCohort = cohortOrder[0];
    } else if (event.key === "End") {
      nextCohort = cohortOrder[cohortOrder.length - 1];
    }

    if (nextCohort) {
      event.preventDefault();
      selectCohort(nextCohort);
      tabRefs.current[nextCohort]?.focus();
    }
  };

  return (
    <section
      className="fic-panel fic-track-record-panel"
      aria-labelledby={`${panelId}-heading`}
    >
      <header className="fic-panel-header">
        <div>
          <p className="fic-eyebrow">04 / Assessment ledger</p>
          <h2 id={`${panelId}-heading`}>Track record</h2>
        </div>
        <p className="fic-header-note">Recorded outcomes only</p>
      </header>

      {records.length === 0 ? (
        <div className="fic-empty-state" role="status">
          <p className="fic-empty-state-title">
            No verified assessments connected
          </p>
          <p>
            No forward-recorded or reconstructed assessment records were
            supplied to this view.
          </p>
        </div>
      ) : (
        <>
          <div
            className="fic-tabs fic-record-tabs"
            role="tablist"
            aria-label="Assessment record cohorts"
          >
            {(["forward_recorded", "reconstructed"] as RecordCohort[]).map(
              cohort => {
                const count =
                  cohort === "forward_recorded"
                    ? forwardRecords.length
                    : reconstructedRecords.length;
                const isSelected = activeCohort === cohort;

                return (
                  <button
                    key={cohort}
                    ref={element => {
                      tabRefs.current[cohort] = element;
                    }}
                    className={`fic-tab${isSelected ? " is-selected" : ""}`}
                    type="button"
                    role="tab"
                    id={`${panelId}-tab-${cohort}`}
                    aria-selected={isSelected}
                    aria-controls={
                      isSelected ? `${panelId}-content-${cohort}` : undefined
                    }
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => selectCohort(cohort)}
                    onKeyDown={event => moveCohortFocus(event, cohort)}
                  >
                    <span>{cohortCopy[cohort].label}</span>
                    <span
                      className="fic-tab-count"
                      aria-label={`${count} records`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          <div
            className="fic-record-ledger"
            id={`${panelId}-content-${activeCohort}`}
            role="tabpanel"
            aria-labelledby={`${panelId}-tab-${activeCohort}`}
            tabIndex={0}
          >
            {cohortRecords.length === 0 ? (
              <div className="fic-cohort-empty" role="status">
                No {cohortCopy[activeCohort].shortLabel.toLowerCase()}{" "}
                assessment records were supplied.
              </div>
            ) : (
              <ol className="fic-record-list">
                {cohortRecords.map((record, recordIndex) => {
                  const recordKey = `${record.id}-${recordIndex}`;
                  const detailsId = `${panelId}-record-${idToken(record.id)}-${recordIndex}`;
                  const isExpanded = expandedRecord === recordKey;
                  const hasEvidence = record.evidenceIds.length > 0;

                  return (
                    <li className="fic-record-row" key={recordKey}>
                      <article>
                        <header className="fic-record-header">
                          <time
                            className="fic-record-date"
                            dateTime={record.assessmentAt}
                          >
                            {formatAssessmentDate(record.assessmentAt)}
                          </time>
                          <div className="fic-record-badges">
                            <span
                              className={`fic-outcome-badge is-${record.outcome}`}
                            >
                              {outcomeLabel(record.outcome)}
                            </span>
                            {model.mode === "demonstration" && (
                              <span className="fic-demo-badge">
                                Demonstration record
                              </span>
                            )}
                          </div>
                        </header>

                        <p className="fic-record-summary">
                          {record.summary.trim() ||
                            "No assessment summary was supplied."}
                        </p>

                        <div className="fic-record-actions">
                          <button
                            className="fic-disclosure-button"
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() =>
                              setExpandedRecord(isExpanded ? null : recordKey)
                            }
                          >
                            <ChevronDown
                              size={16}
                              aria-hidden="true"
                              className={isExpanded ? "is-open" : undefined}
                            />
                            Evidence lineage
                          </button>
                          {hasEvidence && (
                            <button
                              className="fic-evidence-action"
                              type="button"
                              onClick={() =>
                                onEvidence(
                                  record.evidenceIds,
                                  `${formatAssessmentDate(record.assessmentAt)} assessment evidence`
                                )
                              }
                            >
                              <FileText size={15} aria-hidden="true" />
                              Open evidence
                            </button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="fic-record-evidence" id={detailsId}>
                            {hasEvidence ? (
                              <>
                                <p className="fic-evidence-lineage-label">
                                  Linked evidence identifiers
                                </p>
                                <ul className="fic-evidence-id-list">
                                  {record.evidenceIds.map(
                                    (evidenceId, evidenceIndex) => (
                                      <li
                                        key={`${recordKey}-evidence-${evidenceIndex}`}
                                      >
                                        {evidenceId}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </>
                            ) : (
                              <p>
                                No evidence identifiers were linked to this
                                assessment.
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {admittedMetrics.length > 0 ? (
            <section
              className="fic-metrics"
              aria-labelledby={`${panelId}-metrics-${activeCohort}`}
            >
              <div className="fic-metrics-heading">
                <h3 id={`${panelId}-metrics-${activeCohort}`}>
                  Admitted measures
                </h3>
                <p>Eligible cohort only</p>
              </div>
              <dl className="fic-metric-list">
                {admittedMetrics.map(metric => (
                  <div className="fic-metric" key={metric.id}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.displayValue}</dd>
                    <dd className="fic-metric-sample">
                      Sample: {metric.eligibleSample} eligible /{" "}
                      {metric.minimumSample} minimum
                    </dd>
                    {metric.evidenceIds.length > 0 && (
                      <button
                        className="fic-metric-evidence"
                        type="button"
                        onClick={() =>
                          onEvidence(
                            metric.evidenceIds,
                            `${metric.label} evidence`
                          )
                        }
                      >
                        Evidence
                      </button>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <section
              className="fic-metrics fic-metrics-withheld"
              aria-labelledby={`${panelId}-metrics-withheld-${activeCohort}`}
            >
              <h3 id={`${panelId}-metrics-withheld-${activeCohort}`}>
                Measures withheld
              </h3>
              <p>
                No admitted measures are available for this cohort. Measures
                remain withheld unless admitted and the supplied eligible sample
                minimum is met.
              </p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
