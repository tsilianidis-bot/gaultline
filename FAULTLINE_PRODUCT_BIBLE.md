# FAULTLINE Product Bible

> **Product purpose:** FAULTLINE is an evidence-led macro and systemic-risk intelligence platform designed to make market conditions understandable through one governed Case File: what is happening, why it is happening, what is most likely next, what to watch, and how to respond.

## Mission and positioning

FAULTLINE is positioned as an evidence-led decision-support environment rather than a hype-driven prediction product. It combines macro conditions, risk vectors, market data, historical context, and AI explanation into one institutional-style interface. The central promise is not certainty. It is clearer recognition of developing conditions, cross-market pressure, uncertainty, and decision-relevant change.

## Target users and strongest use cases

| User | Core need | FAULTLINE use |
|---|---|---|
| Serious self-directed investor | Understand macro risk before acting | Five Questions, Pressure, Outlook, historical context, watch conditions. |
| Active trader | Frame a setup inside market conditions | Signals, Symbol Intelligence, Day Trade Intelligence, Global Markets, rotation, levels, and invalidations. |
| Crypto market participant | Understand crypto in broader risk appetite | Crypto Intelligence, Rotation, crypto signals, macro context. |
| Research-oriented user | Inspect evidence and methodology | Seismograph, Historical Analogs, Track Record, Methodology, Intelligence Library. |
| FAULTLINE operator | Maintain platform quality | Admin/diagnostic views, content, pipeline health, approved scheduled workflows. |

## Product architecture

The experience is organized around the **Five Questions** as the primary cognitive framework. The **FAULTLINE Case File** is the synthesis layer that answers those five questions from the governed market state. Intelligence, Market Tools, and the Research Lab sit beneath that synthesis as evidence and specialist workspaces; they do not displace it.

| Layer | Components | User value |
|---|---|---|
| Case File / Five Questions | NOW, WHY, OUTLOOK, WATCH, ACT | One governed synthesis of the current market state and the evidence that could change it. |
| Core intelligence | Pressure Index, Seismograph, Canonical MarketState, PLATO | Evidence-led system-level understanding. |
| Market evidence | Global Markets, cross-asset context, rates, credit/liquidity signals | See whether the environment is broadly aligned or diverging. |
| Market Tools | Signals, Symbol Intelligence, Day Trade Intelligence, Rising Stars, Crypto, Watchlist, Alerts, Trade Journal | Apply macro context to securities, digital assets, monitoring, and trader workflows. |
| Research Lab | TIME MACHINE™, Historical Analogs, Track Record, Validation Lab, Decision Ledger, methodology, pressure simulation | Compare, test, and inspect the evidence without crowding the primary answer. |
| Decision support | Outlook, scenarios, Watch/Act, invalidation conditions | Make conditional, risk-aware decisions. |

## Five Questions philosophy

FAULTLINE should lead with plain-English explanation, not a score alone. The Case File should make the Five Questions visible as one coherent answer before the user enters deeper workspaces. A current reading should clarify what changed, its drivers, the forward path where governed evidence supports one, what to watch, how to respond conditionally, the historical frame, and what would invalidate the working conclusion. “Home” is the user-facing route to NOW (`/app/now`); there should not be duplicate Home/NOW destinations in primary navigation.

## PLATO

PLATO is the platform's intelligence guide. PLATO's job is to synthesize canonical evidence, point out agreement and divergence, name uncertainty, and explain decision-relevant implications. PLATO is neither a generic chatbot nor a predictive authority. Internal legacy identifiers may still use ASHA naming while customer-visible product language uses PLATO.

## Differentiation

FAULTLINE's differentiation is the connection between macro stress, market evidence, historical context, asset-level workflows, and a consistent explanatory layer. The visual language should feel institutional and legible rather than retail/gamified. Data should be labelled by freshness and limitations. The system should prefer transparent composition over black-box claims.

## Onboarding philosophy

Users should enter the full intelligence experience without repeating cinematic onboarding or transition screens when returning to Home. Onboarding should orient users to the Five Questions, source limitations, and how to interpret information; it should not make confidence claims or pressure conversions through fake scarcity.

## UX principles

1. **Explain before expanding.** Make the current market condition clear before adding dashboards or tool depth.
2. **Preserve hierarchy.** The Case File and Five Questions are Layer 1; Intelligence, Market Tools, and the Research Lab are Layer 2.
3. **Expose provenance.** Show source health, delayed/static/fallback data, and last-update context.
4. **Separate horizons.** Macro regimes, market probabilities, and ticker-specific setups are related but not interchangeable.
5. **Use conditional language.** Present what evidence favors, the counter-case, and invalidation conditions.
6. **Maintain institutional clarity.** Typography, layout, contrast, and labels should support efficient reading, not spectacle.

## Brand voice and terminology

The brand voice is calm, precise, direct, risk-aware, and professional. Core terms include **Case File**, **Pressure Index**, **Regime**, **Seismograph**, **Five Questions**, **MarketState**, **Evidence**, **Freshness**, **Source Health**, **Historical Analog**, **Risk-on/Risk-off**, and **FAULTLINE Market Read**. Avoid language that treats models as omniscient or historical reconstruction as a live forecast.

## Commercial model and trust

FAULTLINE should keep entitlement and membership logic **payment-provider-agnostic**. Stripe, Paddle, or another approved provider may supply checkout and subscription billing without changing the product's access model. Do not hard-wire customer entitlements to one processor.

The commercial structure may include free, core, premium/app, and founding access concepts. The **Market Tools** layer is intentionally preserved as future subscription value: Signals, Symbol Intelligence, Day Trade Intelligence, Rising Stars, Crypto tools, Watchlist, Alerts, Trade Journal, and future regime-aware technical tools can increase paid-app utility without becoming FAULTLINE's primary public positioning.

Actual price configuration, processor fees, tax treatment, and entitlement mappings must be verified against the active payment provider before public representation. Any founding-member count must be database-backed after successful purchase; never simulate scarcity, testimonials, reviews, or ratings.

## Current roadmap themes

Current source and task state indicate ongoing work around better market context, production reliability, SEO/public discoverability, data-provider health, a 90-day V3-H shadow evaluation, historical-methodology reconciliation, user education, and intelligence-workspace clarity. A roadmap item is not proof of a shipped feature.

## Known limitations

The platform depends on external providers and hosted infrastructure. Some macro series publish with lag; some elements are static or fallback models; TypeScript watcher diagnostics currently include pre-existing errors outside the Global Markets work; and historical performance language must remain retrospective pending methodology reconciliation. Production recovery depends separately on database exports, secrets, OAuth/Stripe/provider accounts, and domain/DNS control.
