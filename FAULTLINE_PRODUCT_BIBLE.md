# FAULTLINE Product Bible

> **Product purpose:** FAULTLINE is an AI-powered macro and systemic-risk intelligence platform designed to make market conditions understandable: what is happening, why it is happening, how long it has been building, and how conditions compare with history.

## Mission and positioning

FAULTLINE is positioned as an evidence-led decision-support environment rather than a hype-driven prediction product. It combines macro conditions, risk vectors, market data, historical context, and AI explanation into one institutional-style interface. The central promise is not certainty. It is clearer recognition of developing conditions, cross-market pressure, uncertainty, and decision-relevant change.

## Target users and strongest use cases

| User | Core need | FAULTLINE use |
|---|---|---|
| Serious self-directed investor | Understand macro risk before acting | Five Questions, Pressure, Outlook, historical context, watch conditions. |
| Active trader | Frame a setup inside market conditions | Signals, Symbol Intelligence, Global Markets, Pre-Flight, levels/invalidations. |
| Crypto market participant | Understand crypto in broader risk appetite | Crypto Intelligence, Rotation, crypto signals, macro context. |
| Research-oriented user | Inspect evidence and methodology | Seismograph, Historical Analogs, Track Record, Methodology, Intelligence Library. |
| FAULTLINE operator | Maintain platform quality | Admin/diagnostic views, content, pipeline health, approved scheduled workflows. |

## Product architecture

The experience is organized around the **Five Questions** as the primary cognitive framework. Deep tools comprise the Intelligence Lab: evidence surfaces and focused workspaces that explain or test the Five Questions without displacing them.

| Layer | Components | User value |
|---|---|---|
| Five Questions | Home/NOW, What, Why, Outlook, Watch, Act | A consistent path from current condition to decision framing. |
| Core intelligence | Pressure Index, Seismograph, Canonical MarketState, ASHA | Evidence-led system-level understanding. |
| Market evidence | Global Markets, cross-asset context, rates, credit/liquidity signals | See whether the environment is broadly aligned or diverging. |
| Asset workspaces | Signals, Symbol Intelligence, Crypto, portfolio/simulation | Apply context to a specific security, digital asset, or simulated process. |
| Research and history | TIME MACHINE™, analogs, Track Record, methodology | Compare current evidence with historical patterns honestly. |
| Decision support | Pre-Flight, outlook, scenarios, Watch/Act | Make conditional, risk-aware decisions. |

## Five Questions philosophy

FAULTLINE should lead with plain-English explanation, not a score alone. A current reading should clarify what changed, its drivers, how long the pattern has developed, the historical frame, plausible scenarios, and what would invalidate the working conclusion. “Home” is the user-facing route to the deep NOW dashboard (`/app/now`); there should not be duplicate Home/NOW destinations in primary navigation.

## ASHA

ASHA is the platform's intelligence guide. Her job is to synthesize canonical evidence, point out agreement and divergence, name uncertainty, and explain decision-relevant implications. ASHA is neither a generic chatbot nor a predictive authority. See `ASHA_MASTER_SYSTEM_PROMPT.md` for the full reconstruction specification.

## Differentiation

FAULTLINE's differentiation is the connection between macro stress, market evidence, historical context, asset-level workflows, and a consistent explanatory layer. The visual language should feel institutional and legible rather than retail/gamified. Data should be labelled by freshness and limitations. The system should prefer transparent composition over black-box claims.

## Onboarding philosophy

Users should enter the full intelligence experience without repeating cinematic onboarding or transition screens when returning to Home. Onboarding should orient users to the Five Questions, source limitations, and how to interpret information; it should not make confidence claims or pressure conversions through fake scarcity.

## UX principles

1. **Explain before expanding.** Make the current market condition clear before adding dashboards or tool depth.
2. **Preserve hierarchy.** The Five Questions are Layer 1; Markets and the Intelligence Lab are Layer 2 evidence.
3. **Expose provenance.** Show source health, delayed/static/fallback data, and last-update context.
4. **Separate horizons.** Macro regimes, market probabilities, and ticker-specific setups are related but not interchangeable.
5. **Use conditional language.** Present what evidence favors, the counter-case, and invalidation conditions.
6. **Maintain institutional clarity.** Typography, layout, contrast, and labels should support efficient reading, not spectacle.

## Brand voice and terminology

The brand voice is calm, precise, direct, risk-aware, and professional. Core terms include **Pressure Index**, **Regime**, **Seismograph**, **Five Questions**, **MarketState**, **Evidence**, **Freshness**, **Source Health**, **Historical Analog**, **Risk-on/Risk-off**, **Pre-Flight**, and **Faultline Market Read**. Avoid language that treats models as omniscient or historical reconstruction as a live forecast.

## Commercial model and trust

The source includes free, core, premium, and founding/lifetime access concepts with Stripe-managed price IDs and entitlement gates. Actual price configuration must be verified in the current Stripe account and product definitions before public representation. Any founding-membership count must be database-backed after successful purchase; never simulate scarcity, testimonials, reviews, or ratings.

## Current roadmap themes

Current source and task state indicate ongoing work around better market context, production reliability, SEO/public discoverability, data-provider health, a 90-day V3-H shadow evaluation, historical-methodology reconciliation, user education, and intelligence-workspace clarity. A roadmap item is not proof of a shipped feature.

## Known limitations

The platform depends on external providers and hosted infrastructure. Some macro series publish with lag; some elements are static or fallback models; TypeScript watcher diagnostics currently include pre-existing errors outside the Global Markets work; and historical performance language must remain retrospective pending methodology reconciliation. Production recovery depends separately on database exports, secrets, OAuth/Stripe/provider accounts, and domain/DNS control.
