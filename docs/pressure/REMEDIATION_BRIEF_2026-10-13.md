<!-- Verbatim copy of James's message t401u (Oct 13 2026, 2:21 AM ET), as received by the executor via the parent conversation. HTML entity "&amp;" rendered as "&". No truncation marker was present in this copy. -->
FAULTLINE — PRESSURE INDEX REMEDIATION & V2 SHADOW DEVELOPMENT

Platform: FAULTLINE
Repository: https://github.com/tsilianidis-bot/gaultline
Priority: Critical — Pre-Launch Integrity
Authorization: Approved for controlled implementation

OBJECTIVE

Restore the scientific and operational integrity of FAULTLINE’s Pressure Index while preserving existing platform functionality.

The reconstruction establishes that v1 is a macroeconomic and interest-rate conditions gauge, not a validated systemic-crisis prediction model.

A replacement v2 may offer broader financial-stress measurement, but its predictive superiority remains unproven.

We will correct v1, eliminate unsupported claims, and develop v2 in parallel without prematurely replacing the production index.

PHASE 1 — CRITICAL V1 REPAIRS

I explicitly authorize two narrowly scoped exceptions to the frozen v1 engine.

1. Repair CPI calculation

* Replace the fixed 12-row year-over-year calculation with date-matched observations.
* Handle missing, delayed, and irregular CPI releases.
* Prevent NaN, Infinity, or invalid inputs from propagating into the Pressure Index.
* Add regression tests covering the next CPI publication.
* Preserve the original v1 methodology apart from this correctness repair.

2. Make FRED data loading fail closed

* Validate every required observation before calculating a new canonical score.
* Reject incomplete or invalid input sets.
* Preserve the last verified reading when fresh data cannot be established.
* Display accurate observation timestamps and stale/unavailable indicators.
* Never present an incomplete calculation as current.

PHASE 2 — INTERPRETATION AND API CORRECTIONS

Implement these through the normal release process.

3. Correct unsupported claims

Remove or qualify language suggesting that the Pressure Index has demonstrated an ability to predict financial crises, market crashes, or systemic failures.

Do not remove FAULTLINE’s broader intelligence mission or Pentagonal Thesis framework.

4. Remove unsupported probabilities

Hide unvalidated probability estimates from public interfaces and public API responses. Preserve internal research data where appropriate.

5. Correct the Today label

Historical readings must display their actual observation dates. Never label an older audit record as today’s reading.

6. Repair recovery interpretation

The Broad Recovery conclusion must depend on verified directional improvement, not simply low absolute stress readings.

Clearly distinguish:

* Low current stress
* Improving conditions
* Deteriorating conditions
* Elevated stress
* Insufficient evidence

Credit, Liquidity, and Macro Sensitivity must be evaluated using actual changes in underlying observations.

7. Eliminate public-read database mutations

Public Pressure Index requests must be read-only.

Move necessary persistence into explicitly authorized ingestion or scheduled processing workflows.

PHASE 3 — V2 SHADOW ENGINE

I authorize development of a separate, non-public v2 Pressure Index.

The model will use five pillars:

1. Credit stress
2. Funding stress
3. Market volatility
4. Equity-market drawdown
5. Real-time unemployment deterioration

Begin with the preregistered equal-weight specification from the reconstruction.

Do not retrospectively optimize weights or thresholds to improve historical performance.

Mandatory safeguards

* Keep v1 frozen and independently reproducible.
* Store v2 observations separately.
* Version all methodologies and parameter changes.
* Preserve input provenance and timestamps.
* Separate historical backtests from genuinely forward-recorded results.
* Record all observations, including failures and false positives.
* Compare v2 against VIX, S&P 500 drawdown, and a simple equal-weight composite.
* Evaluate false alarms, missed events, lead time, calibration, and performance across market regimes.
* Do not promote v2 to production without explicit authorization.

PHASE 4 — PREMIUM INTELLIGENCE PRESENTATION

Maintain FAULTLINE’s premium financial intelligence positioning.

The public interface must answer:

WHAT: What is happening in financial conditions?

WHY: Which measurable factors explain the reading?

WHAT’S NEXT: What scenarios are plausible, without claiming unsupported probabilities?

WHAT TO WATCH: Which observable indicators could confirm or contradict the interpretation?

WHAT TO DO: What risk-management considerations follow, with uncertainty clearly disclosed?

Preserve NOW / OUTLOOK / WATCH / ACT navigation.

The platform should communicate analytical depth without implying predictive certainty.

PHASE 5 — VALIDATION

Before release:

* Verify the canonical Pressure Index against reproducible source observations.
* Test CPI date matching and missing observations.
* Test incomplete FRED responses.
* Verify that invalid values cannot enter public output.
* Confirm that recovery labels reflect actual directional changes.
* Confirm that public requests cannot mutate stored observations.
* Check all public-facing crisis and probability claims.
* Run relevant regression tests, TypeScript validation, and production build.
* Confirm unrelated signals, crypto rotation, sector rotation, winners/losers, and membership functionality remain intact.

DELIVERY REQUIREMENTS

Provide:

1. Exact files modified.
2. Before-and-after behavior for every defect.
3. Test results and any failures.
4. v1 methodology/version documentation.
5. v2 preregistration and shadow architecture.
6. Git commit SHA and deployment status.
7. Remaining limitations and evidence gaps.

Do not create a disconnected application.

Do not perform unrelated refactoring or a platform-wide audit.

Do not deploy v2 publicly.

Do not change membership pricing.

EXECUTION DIRECTIVE

Prioritize the production correctness and integrity fixes. Complete and validate them before expanding v2 development.

Preserve all working FAULTLINE functionality.

Use the existing repository and release controls. Do not claim completion until changes have been implemented, tested, and their deployment status verified.

The objective is a defensible financial intelligence platform built on reproducible measurements, transparent interpretation, and forward-tested evidence—not retrospective claims of predictive success.
