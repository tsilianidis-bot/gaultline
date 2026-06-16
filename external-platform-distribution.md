# FAULTLINE — External Visibility / Injected Platform Strategy

**Document type:** Internal Strategy  
**Version:** 1.0  
**Date:** June 2026  
**Status:** Pre-implementation planning  

---

## Executive Summary

FAULTLINE is a macro risk intelligence terminal for traders, live at [getfaultline.live](https://getfaultline.live). The core product is a web-based platform that synthesizes macroeconomic pressure, systemic risk signals, crypto regime analysis, and AI bubble exposure into actionable intelligence for serious traders.

This document defines a five-channel external visibility strategy. The goal is not to replicate the terminal on other platforms — it is to inject FAULTLINE's signal language and brand into the environments where traders already spend time, creating a persistent funnel back to the paid web terminal. Each channel is a **visibility product**, not a feature replacement.

**Core principle:** Every external touchpoint ends with a CTA to `getfaultline.live`. The terminal is the destination. External platforms are the roads.

---

## Priority Order

| Priority | Channel | Effort | Expected Reach |
|---|---|---|---|
| 1 | TradingView Pine Script Indicator | Medium | Very High — 50M+ TradingView users |
| 2 | Discord Server + Bot | Low-Medium | High — direct community ownership |
| 3 | Product Hunt Launch | Low | Medium-High — tech/trader audience |
| 4 | RapidAPI / Nokia API Hub | High | Medium — developer/institutional |
| 5 | Slack App | Medium | Medium — teams, funds, fintech |

---

## Channel 1: TradingView Lite Indicator

### Strategic Rationale

TradingView is the dominant charting platform for retail and semi-professional traders globally, with over 50 million registered users. A published indicator on TradingView's public library is permanently discoverable, searchable by keyword, and shareable between users. A well-positioned FAULTLINE indicator becomes a persistent brand impression on every chart it is applied to.

The indicator must not attempt to replicate the full terminal. It should display just enough signal to be genuinely useful — and conspicuously incomplete — so that traders feel the pull toward the full platform.

### Indicator Concept: FAULTLINE Pressure Index Lite

**Pine Script indicator name:** `FAULTLINE Pressure Index Lite`  
**Published as:** Open-source, public library  
**Target keywords:** macro risk, pressure index, bear market indicator, systemic risk, regime filter

#### What the Indicator Displays

The indicator renders five overlaid visual elements on any chart:

**1. Pressure Index Band (background color zone)**  
A background color band that shifts from deep green (low pressure, 0–30) through amber (moderate, 30–60) to deep red (critical, 60–100). This is the most visually prominent element — it makes the indicator immediately recognizable on any chart. The color is derived from a simplified composite of price momentum, volatility expansion, and volume divergence, all computable from OHLCV data alone.

**2. Regime Label (top-right corner)**  
A text label displaying the current regime: `BULL`, `NEUTRAL`, or `BEAR`. Updated on each bar close. The label uses FAULTLINE's signature cyan-on-dark color scheme to maintain brand consistency.

**3. Macro Risk State (subtitle line)**  
A secondary label showing one of four states: `LOW RISK`, `ELEVATED`, `HIGH RISK`, or `CRITICAL`. This is computed from a combination of ATR expansion, price distance from 200-period MA, and volume anomaly detection.

**4. AI Bubble Exposure Label (conditional)**  
Appears only when the chart symbol matches a known AI-adjacent ticker (NVDA, MSFT, META, GOOGL, AMD, SMCI, PLTR, or any user-defined list). Displays `AI EXPOSURE: ELEVATED` or `AI EXPOSURE: EXTREME` when the ticker is trading more than 2 standard deviations above its 52-week regression line. This label is unique to FAULTLINE and creates immediate differentiation from generic indicators.

**5. CTA Watermark**  
A persistent, semi-transparent text watermark in the lower-right corner of the pane reading: `Full Intelligence → getfaultline.live`. This is the single most important element from a distribution standpoint. Every screenshot, every shared chart, every stream capture carries the domain.

#### Pine Script Implementation Notes

The indicator is fully self-contained using only built-in Pine Script functions — no external API calls are required. The Pressure Index is approximated using:

- RSI divergence from 50 (momentum component)
- ATR as a percentage of price (volatility component)
- Volume relative to 20-bar average (volume component)
- Distance from 200-bar SMA as a percentage (trend component)

Each component is normalized to 0–100 and weighted: momentum 30%, volatility 25%, volume 20%, trend 25%. The composite score drives the color band and risk state labels.

The AI Bubble Exposure label uses a linear regression channel computed over 252 bars (approximately one trading year) and flags tickers trading above the upper 2σ band.

#### Publication Strategy

The indicator should be published to the TradingView public library under the FAULTLINE account with the following metadata:

- **Category:** Trend Analysis, Volatility
- **Tags:** macro, risk, regime, pressure, systemic, faultline, bear market, bubble
- **Description opening line:** "FAULTLINE Pressure Index Lite — a simplified version of the macro risk intelligence engine powering getfaultline.live"
- **Description body:** Explain each visual element, note that this is a lite approximation, and explicitly state that the full platform includes live FRED data, crypto regime analysis, AI bubble scoring, and LLM-powered signal interpretation.
- **Invite link in description:** `→ Full platform: https://getfaultline.live`

#### Required Assets

| Asset | Purpose |
|---|---|
| TradingView account (FAULTLINE brand) | Publisher identity |
| Pine Script v5 source file | Indicator code |
| 3–5 chart screenshots showing the indicator | Publication thumbnail and gallery |
| Short description copy (250 chars max) | TradingView listing |
| Long description copy (2000 chars max) | TradingView listing |

#### Funnel Flow

```
User discovers indicator in TradingView library
  → Applies it to chart
  → Sees Pressure Index, regime label, AI Bubble label
  → Notices "Full Intelligence → getfaultline.live" watermark
  → Visits getfaultline.live
  → Encounters paywall / free tier
  → Converts to Founding or Premium subscriber
```

---

## Channel 2: Discord Server + Bot

### Strategic Rationale

Discord is the primary community platform for active traders, crypto communities, and fintech enthusiasts. A well-structured FAULTLINE Discord server serves three functions simultaneously: it builds a free community layer that generates organic word-of-mouth, it creates a daily touchpoint that keeps FAULTLINE top-of-mind, and it acts as a direct upgrade funnel by making the limitations of the free Discord tier visible relative to the full terminal.

The bot is the key differentiator. A `/faultline` command that returns a real-time pressure reading — with a "See full analysis at getfaultline.live" footer — turns every bot interaction into a brand impression.

### Server Architecture

#### Channel Structure

**PUBLIC — No role required**

| Channel | Purpose | Post frequency |
|---|---|---|
| `#welcome` | Server intro, rules, CTA to getfaultline.live | Static |
| `#announcements` | Platform updates, new features, launch news | As needed |
| `#free-market-reading` | Daily macro summary — simplified, text-only | Daily |
| `#regime-watch` | Bull/Bear/Neutral regime status updates | On regime change |
| `#general` | Open discussion, questions | Continuous |

**PREMIUM — Requires "Founding Member" or "Premium" role (verified via OAuth)**

| Channel | Purpose | Post frequency |
|---|---|---|
| `#premium-alerts` | Full signal alerts with actionLabel, confidence, sizing | On signal |
| `#crypto-rotation` | Crypto regime shifts, BTC dominance alerts, rotation signals | Daily + on event |
| `#stock-risk` | Equity pressure alerts, asymmetric opportunity flags | Daily + on event |
| `#daily-briefing` | Full FAULTLINE daily briefing (same content as terminal) | Daily 9 AM ET |

**FOUNDER-ONLY — Requires "Founding Member" role**

| Channel | Purpose | Post frequency |
|---|---|---|
| `#founders-room` | Direct access to owner, roadmap previews, beta features | Weekly |
| `#feedback` | Feature requests, bug reports, direct feedback loop | Continuous |

#### Role Structure

| Role | How Obtained | Access |
|---|---|---|
| `@Member` | Join server | Public channels |
| `@Premium` | Active Premium subscription on getfaultline.live | Premium channels |
| `@Founding Member` | Founding tier subscriber | All channels including Founders Room |
| `@Admin` | Owner-assigned | All channels + moderation |

Role verification should be implemented via a Discord OAuth bot that checks the user's subscription tier against the FAULTLINE database. The bot issues the role automatically on verification. This creates a seamless upgrade path: a free Discord member who wants access to `#premium-alerts` must upgrade their subscription at getfaultline.live.

### Bot Command Concept

The FAULTLINE Discord Bot (`@FAULTLINE`) responds to slash commands in any channel. All responses include a footer CTA.

#### Command Specifications

**`/faultline`**  
Returns the current FAULTLINE Pressure Index reading.  
Response format:
```
FAULTLINE PRESSURE INDEX
━━━━━━━━━━━━━━━━━━━━━━━━
Current: 67 / 100 — HIGH RISK
Regime: BEAR
Macro State: Elevated Stress
AI Bubble Exposure: EXTREME

→ Full analysis: getfaultline.live
```
Access: Public (all members)

**`/ticker [SYMBOL]`**  
Returns a simplified signal reading for a given ticker.  
Response format:
```
FAULTLINE SIGNAL — NVDA
━━━━━━━━━━━━━━━━━━━━━━━━
Signal: Reduce Exposure
Asset Class: STOCK
Confidence: 74%
Pressure: Elevated

→ Full signal with sizing: getfaultline.live/app/signals
```
Access: Public (all members), with a note that full signal details require a subscription.

**`/crypto [COIN]`**  
Returns a simplified crypto signal and regime reading.  
Response format:
```
FAULTLINE CRYPTO — BTC
━━━━━━━━━━━━━━━━━━━━━━━━
Signal: Accumulation Zone
Regime: Neutral
BTC Dominance: Trending Up
Regime Conflict: None

→ Full crypto intelligence: getfaultline.live/app/crypto-signals
```
Access: Public (all members).

**`/regime`**  
Returns the current macro regime state across all asset classes.  
Response format:
```
FAULTLINE MACRO REGIME
━━━━━━━━━━━━━━━━━━━━━━━━
Equity Regime: BEAR
Crypto Regime: Neutral
Macro Pressure: HIGH RISK
AI Bubble: EXTREME
Fed Stress: Elevated

→ Full regime analysis: getfaultline.live/app/diagnostic
```
Access: Public (all members).

**`/briefing`**  
Returns the daily macro briefing summary (premium-only).  
Access: `@Premium` and `@Founding Member` roles only.

#### Bot Implementation Requirements

| Requirement | Detail |
|---|---|
| Platform | Discord.js v14 (Node.js) |
| Hosting | Separate lightweight server (can run on the same VPS as the terminal) |
| Data source | FAULTLINE tRPC API — public endpoints for pressure, regime, ticker signals |
| Rate limiting | 10 requests/minute per user for public commands |
| OAuth verification | Discord OAuth2 → FAULTLINE user lookup → role assignment |
| Scheduled posts | Daily briefing cron at 9 AM ET to `#daily-briefing` |

### Funnel Design

The Discord server is deliberately designed so that the most valuable content lives behind the Premium role gate. Free members can see the channel names and the lock icon — this is intentional. The gap between what free members see and what Premium members receive should be visible and felt. Every `/ticker` response that ends with "→ Full signal with sizing: getfaultline.live" reinforces the value proposition of the paid terminal.

---

## Channel 3: Product Hunt Launch Package

### Strategic Rationale

Product Hunt is the primary discovery platform for software products among tech-savvy early adopters, developers, investors, and fintech professionals. A well-executed Product Hunt launch generates a concentrated burst of high-quality traffic, press attention, and backlinks. For FAULTLINE, the goal is not mass consumer adoption — it is to reach the specific audience of traders, quant-adjacent professionals, and fintech builders who will become Founding Members.

The positioning must be precise. FAULTLINE is not "a trading signals app." It is a macro risk intelligence terminal. This distinction must be front and center in every piece of copy.

### Product Hunt Listing

**Product Title:** `FAULTLINE`

**Tagline:**  
`Macro risk intelligence terminal for traders — not signals, not noise.`

**Short Description (160 characters):**  
`Real-time macro pressure index, regime detection, AI bubble exposure, and systemic risk intelligence. For traders who need to see the fault lines before they break.`

**Long Description:**

> Most trading tools tell you what to buy. FAULTLINE tells you what the market is actually doing underneath.
>
> FAULTLINE is a macro risk intelligence terminal that monitors the hidden structural forces driving market behavior: systemic liquidity stress, late-cycle instability, sovereign debt pressure, AI bubble conditions, and crypto regime shifts. It synthesizes Federal Reserve data, credit spreads, volatility signals, and on-chain metrics into a single Pressure Index — a real-time gauge of how much stress the financial system is under right now.
>
> **What FAULTLINE gives you:**
>
> — The FAULTLINE Pressure Index (0–100): a composite score of macro stress across 12 data dimensions, updated in real time.
>
> — Bull/Bear/Neutral regime detection: not based on price alone, but on the underlying macro conditions that precede regime changes.
>
> — AI Bubble Exposure scoring: quantified exposure to AI-adjacent equities relative to historical valuation extremes.
>
> — Crypto regime intelligence: BTC dominance trends, altcoin rotation signals, and regime conflict detection.
>
> — Asymmetric Opportunity Engine: a 7-dimension scoring system that identifies high-conviction setups with favorable risk/reward profiles.
>
> — Trade Preflight: a pre-trade checklist that validates every trade against current macro conditions before you enter.
>
> — Diagnostic AI: LLM-powered interpretation of current macro conditions with plain-language risk summaries.
>
> FAULTLINE is built for traders who understand that price is the last thing to move. The fault lines form first.
>
> **→ Try it free at getfaultline.live**

### Founder Comment (to post on launch day)

> I built FAULTLINE because I kept watching traders get blindsided by macro events that were visible in the data weeks before they hit price. The 2022 rate shock. The 2023 banking stress. The AI bubble expansion. None of these were surprises if you were watching the right signals.
>
> Most retail traders don't have access to the kind of macro intelligence that institutional desks use. FAULTLINE is my attempt to close that gap — to give serious traders a real-time view of the structural forces that actually drive markets.
>
> This is not a signals app. There are thousands of those. FAULTLINE is a risk intelligence terminal. The difference is that signals tell you what to do. Intelligence tells you what is happening and why — and lets you make your own decisions with full context.
>
> We're in early access. Founding Members get lifetime access at a fixed price that will never be offered again. If you're a trader who thinks in macro terms, I'd love your feedback.
>
> — [Founder name], getfaultline.live

### Launch Checklist

**Pre-launch (2 weeks before)**

- [ ] Create Product Hunt account and claim FAULTLINE product page
- [ ] Connect Twitter/X account for cross-promotion
- [ ] Identify and brief a Product Hunt "hunter" (a well-followed PH user who posts the product — this significantly increases visibility)
- [ ] Prepare all visual assets (see screenshot list below)
- [ ] Write and schedule social posts for launch day
- [ ] Brief existing users to upvote on launch day (do not ask for upvotes publicly — this violates PH rules; use email or Discord)
- [ ] Prepare a short demo video (60–90 seconds) showing the Pressure Index, regime detection, and Diagnostic AI

**Launch day**

- [ ] Post goes live at 12:01 AM PT (Product Hunt resets daily at midnight PT)
- [ ] Founder posts the founder comment within the first hour
- [ ] Respond to every comment within the first 4 hours (PH algorithm rewards engagement)
- [ ] Post on Twitter/X, LinkedIn, and Discord announcing the launch
- [ ] Send email to existing user list with PH link and upvote request

**Post-launch**

- [ ] Respond to all remaining comments
- [ ] Write a brief post-launch update (how many upvotes, what you learned)
- [ ] Follow up with commenters who asked questions or expressed interest
- [ ] Update the PH listing with any corrections or additions

### Required Screenshots

Product Hunt allows up to 8 screenshots. Recommended sequence:

| # | Screenshot | What to show |
|---|---|---|
| 1 | FAULTLINE landing page / hero | Brand identity, "MACROECONOMIC RISK INTELLIGENCE" tagline |
| 2 | Pressure Index dashboard | The main pressure gauge at a high reading (60+) with color band |
| 3 | Regime detection panel | Bull/Bear/Neutral labels with supporting data |
| 4 | AI Bubble Exposure panel | NVDA/MSFT/GOOGL exposure scores |
| 5 | Crypto Intelligence page | Crypto regime, BTC dominance, rotation signals |
| 6 | Diagnostic AI panel | LLM-generated macro interpretation |
| 7 | Trade Preflight checklist | Pre-trade validation against macro conditions |
| 8 | Shareable report | A public report link showing the branded output |

All screenshots should be taken in dark mode at 1440×900 resolution. Add a thin border and subtle drop shadow for polish.

### CTA Structure

Every piece of Product Hunt copy follows this CTA hierarchy:

1. **Primary CTA:** "Try it free at getfaultline.live" — appears in short description, long description, and founder comment
2. **Secondary CTA:** "Founding Members get lifetime access — spots are limited" — appears in long description and founder comment
3. **Tertiary CTA:** "Join our Discord for daily macro briefings" — appears in comments and responses

---

## Channel 4: API Marketplace Plan (RapidAPI / Nokia API Hub)

### Strategic Rationale

Publishing FAULTLINE's core intelligence as a consumable API on RapidAPI and Nokia API Hub serves a different audience than the web terminal: developers, quant traders, algorithmic trading systems, hedge funds, fintech startups, and institutional data consumers. These users do not want a web UI — they want clean JSON endpoints they can integrate into their own systems.

The API marketplace strategy creates a secondary revenue stream while simultaneously expanding FAULTLINE's brand into the developer and institutional ecosystem. Every API consumer is a potential referral source to the web terminal.

### API Product Definitions

#### Product 1: Pressure Index API

**Endpoint:** `GET /v1/pressure`  
**Description:** Returns the current FAULTLINE Pressure Index score (0–100), component breakdown, and risk state label.

**Response schema:**
```json
{
  "pressureIndex": 67,
  "riskState": "HIGH_RISK",
  "components": {
    "liquidityStress": 72,
    "volatilityExpansion": 65,
    "creditSpread": 58,
    "sovereignDebt": 71,
    "aiBubble": 84
  },
  "timestamp": "2026-06-16T14:30:00Z",
  "source": "FAULTLINE"
}
```

**Use cases:** Portfolio risk dashboards, algorithmic position sizing, risk-off automation triggers.

#### Product 2: Ticker Risk API

**Endpoint:** `GET /v1/ticker/{symbol}`  
**Description:** Returns a FAULTLINE signal reading for a specific equity or ETF ticker, including actionLabel, confidence score, asset class, and pressure context.

**Response schema:**
```json
{
  "symbol": "NVDA",
  "assetClass": "STOCK",
  "actionLabel": "Reduce Exposure",
  "confidence": 74,
  "pressureContext": "HIGH_RISK",
  "aiBubbleExposure": "EXTREME",
  "regime": "BEAR",
  "timestamp": "2026-06-16T14:30:00Z"
}
```

**Use cases:** Automated trade validation, watchlist monitoring, signal aggregation platforms.

#### Product 3: Crypto Rotation API

**Endpoint:** `GET /v1/crypto/rotation`  
**Description:** Returns the current crypto regime state, BTC dominance trend, altcoin rotation signal, and top rotation candidates.

**Response schema:**
```json
{
  "btcDominance": {
    "current": 54.2,
    "trend": "RISING",
    "signal": "BTC_FAVORED"
  },
  "cryptoRegime": "NEUTRAL",
  "rotationSignal": "HOLD_BTC",
  "regimeConflict": false,
  "topRotationCandidates": ["ETH", "SOL", "AVAX"],
  "timestamp": "2026-06-16T14:30:00Z"
}
```

**Use cases:** Crypto portfolio rebalancing automation, DeFi protocol risk management, crypto fund dashboards.

#### Product 4: Macro Regime API

**Endpoint:** `GET /v1/regime`  
**Description:** Returns the current macro regime across equity, crypto, and macro dimensions, with supporting data points.

**Response schema:**
```json
{
  "equityRegime": "BEAR",
  "cryptoRegime": "NEUTRAL",
  "macroState": "ELEVATED_STRESS",
  "fedStress": "ELEVATED",
  "creditConditions": "TIGHTENING",
  "liquidityTrend": "DETERIORATING",
  "regimeConfidence": 81,
  "timestamp": "2026-06-16T14:30:00Z"
}
```

**Use cases:** Macro-aware algorithmic strategies, risk parity systems, institutional regime monitoring.

#### Product 5: Bull/Bear Probability API

**Endpoint:** `GET /v1/probability`  
**Description:** Returns probabilistic estimates of bull, bear, and neutral market conditions over 30-day and 90-day horizons, derived from FAULTLINE's composite pressure model.

**Response schema:**
```json
{
  "horizon30d": {
    "bull": 0.18,
    "neutral": 0.31,
    "bear": 0.51
  },
  "horizon90d": {
    "bull": 0.24,
    "neutral": 0.35,
    "bear": 0.41
  },
  "modelConfidence": 0.76,
  "pressureIndex": 67,
  "timestamp": "2026-06-16T14:30:00Z"
}
```

**Use cases:** Options pricing models, hedging strategy automation, risk-adjusted return optimization.

### Pricing Tiers

| Tier | Monthly Price | Requests/Month | Rate Limit | Products Included |
|---|---|---|---|---|
| **Free** | $0 | 100 | 1 req/min | Pressure Index only |
| **Starter** | $29 | 5,000 | 10 req/min | Pressure Index + Macro Regime |
| **Trader** | $99 | 25,000 | 60 req/min | All 5 products |
| **Pro** | $299 | 150,000 | 300 req/min | All 5 products + priority support |
| **Enterprise** | Custom | Unlimited | Custom SLA | All products + custom endpoints + dedicated support |

### Implementation Requirements

To publish on RapidAPI and Nokia API Hub, the following technical work is required:

| Requirement | Detail |
|---|---|
| API key management | Issue per-subscriber API keys, track usage per key |
| Rate limiting middleware | Express middleware counting requests per key per minute |
| Usage metering | Log every request with key, endpoint, timestamp for billing |
| OpenAPI 3.0 spec | Full specification document for both marketplaces |
| Webhook for overages | Notify subscribers when approaching tier limits |
| RapidAPI account | Create publisher account at rapidapi.com |
| Nokia API Hub account | Register at apimarket.nokia.com |

The API endpoints themselves are largely already implemented as tRPC procedures in the FAULTLINE backend. The primary implementation work is: creating a REST adapter layer (Express routes wrapping the existing logic), adding API key authentication middleware, and building the usage metering system.

### Listing Copy

**RapidAPI listing title:** `FAULTLINE Macro Risk Intelligence API`

**Short description:**  
`Real-time macro pressure index, regime detection, ticker risk signals, and bull/bear probability for algorithmic trading systems and risk dashboards.`

**Category tags:** Finance, Trading, Risk Management, Market Data

---

## Channel 5: Slack App Concept

### Strategic Rationale

Slack is the dominant communication platform for professional teams, trading firms, fintech startups, and investment funds. A FAULTLINE Slack app positions the product inside the daily workflow of professional traders and analysts — not as a separate tool they have to remember to visit, but as an ambient intelligence layer inside the tools they already use all day.

The target audience for the Slack app is distinct from the Discord audience: it skews toward teams (trading desks, fund analysts, fintech product teams) rather than individual retail traders. This makes the Slack app a natural enterprise and team subscription driver.

### App Feature Set

#### 1. Daily Macro Briefing (Scheduled Message)

Delivered every weekday at a configurable time (default: 8:00 AM ET) to a designated Slack channel.

**Format:**
```
FAULTLINE DAILY BRIEFING — Monday, June 16, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESSURE INDEX: 67 / 100 — HIGH RISK
EQUITY REGIME: BEAR
CRYPTO REGIME: Neutral
AI BUBBLE EXPOSURE: EXTREME

KEY RISKS TODAY:
• Credit spreads widening — watch IG/HY spread compression
• BTC dominance rising — altcoin rotation risk elevated
• NVDA/SMCI trading above 2σ regression — AI bubble pressure

→ Full briefing: getfaultline.live/app/diagnostic
```

#### 2. Watchlist Alerts (Event-Triggered)

Users configure a watchlist of tickers. When FAULTLINE detects a signal change (actionLabel changes, confidence crosses a threshold, or pressure context shifts), a Slack message is sent to the configured channel.

**Format:**
```
FAULTLINE WATCHLIST ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━
NVDA — Signal Changed
Previous: Hold
New: Reduce Exposure
Confidence: 74%
Trigger: AI Bubble Exposure crossed EXTREME threshold

→ Full signal: getfaultline.live/app/signals
```

#### 3. Regime Change Alerts (Event-Triggered)

When FAULTLINE's regime detection engine shifts from one regime to another (Bull → Neutral, Neutral → Bear, etc.), an immediate alert is sent to the configured channel. Regime changes are high-signal, low-frequency events — they should feel urgent.

**Format:**
```
⚠ FAULTLINE REGIME CHANGE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Equity Regime: NEUTRAL → BEAR
Pressure Index: 71 / 100
Trigger: Credit spread expansion + volatility surge

This is a macro regime shift. Review all open positions.
→ Full analysis: getfaultline.live/app/diagnostic
```

#### 4. Weekly Risk Summary (Scheduled Message)

Delivered every Friday at 4:30 PM ET (after US market close) to the configured channel.

**Format:**
```
FAULTLINE WEEKLY RISK SUMMARY — Week of June 9–13, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRESSURE INDEX: Started 61 → Ended 67 (+6 pts, trending higher)
EQUITY REGIME: Bear (unchanged)
CRYPTO REGIME: Neutral → Neutral (stable)
AI BUBBLE: Extreme (unchanged)

WEEK IN REVIEW:
• Pressure index rose 6 points — primary driver: credit spread widening
• BTC dominance increased 1.8% — altcoin rotation risk elevated
• 3 asymmetric opportunities identified: AAPL, GLD, TLT

NEXT WEEK WATCH:
• Fed minutes Wednesday — watch for liquidity language shift
• CPI Thursday — inflation surprise risk elevated

→ Full weekly analysis: getfaultline.live
```

### Slack App Technical Requirements

| Requirement | Detail |
|---|---|
| Slack API | Slack Bolt for JavaScript (Node.js) |
| OAuth 2.0 | Workspace installation via Slack OAuth |
| Slash commands | `/faultline`, `/ticker`, `/regime` (same as Discord bot) |
| Scheduled messages | Slack `chat.scheduleMessage` API for daily/weekly posts |
| Event subscriptions | Incoming webhooks for watchlist and regime alerts |
| Configuration UI | Simple web page at getfaultline.live/slack/config for setup |
| Subscription verification | Check user's FAULTLINE subscription tier before enabling premium features |
| Slack App Directory | Publish to Slack App Directory for organic discovery |

### Target Segments

| Segment | Use Case | Subscription Driver |
|---|---|---|
| Independent traders with Slack workspaces | Personal daily briefing | Individual Premium |
| Small trading firms (2–10 people) | Team-wide regime alerts | Team subscription |
| Fintech startups | Macro context for product decisions | Team subscription |
| Investment funds | Daily briefing + regime change alerts | Enterprise |
| Trading communities (Slack-based) | Community-wide macro intelligence | Community plan |

### Pricing for Slack App

The Slack app should be positioned as a **team add-on** to existing FAULTLINE subscriptions:

- **Free tier:** Daily briefing only, 1 channel, no watchlist alerts
- **Team tier ($49/month):** Full feature set, up to 5 channels, 10-ticker watchlist, regime alerts
- **Enterprise:** Custom pricing, unlimited channels, dedicated support, custom alert logic

---

## Implementation Sequencing

The five channels should be implemented in the following order, based on effort-to-impact ratio:

**Phase 1 — TradingView (Weeks 1–2)**  
Write and publish the Pine Script indicator. This requires no backend changes — the indicator is self-contained. The primary effort is writing clean Pine Script code and creating quality screenshots. Expected impact: persistent brand exposure to 50M+ TradingView users.

**Phase 2 — Discord (Weeks 3–5)**  
Set up the Discord server structure, configure roles and channels, and deploy the bot. The bot requires a small Node.js service that calls the existing FAULTLINE tRPC API. The OAuth role verification system requires a new tRPC endpoint and a Discord OAuth callback route. Expected impact: owned community with direct upgrade funnel.

**Phase 3 — Product Hunt (Week 6)**  
Prepare all assets, brief the hunter, and execute the launch. This is primarily a marketing and coordination effort, not a technical one. Expected impact: concentrated burst of high-quality traffic and press attention.

**Phase 4 — API Marketplace (Weeks 7–10)**  
Build the REST adapter layer, API key management, and usage metering. Publish to RapidAPI and Nokia API Hub. This is the highest technical effort but opens a new revenue stream and institutional audience. Expected impact: developer ecosystem penetration and secondary revenue.

**Phase 5 — Slack App (Weeks 11–14)**  
Build the Slack app using Slack Bolt, implement OAuth, and publish to the Slack App Directory. Expected impact: team and enterprise subscription driver.

---

## Brand Voice Guidelines for External Platforms

All external platform content must adhere to the following voice guidelines to maintain brand consistency:

**Tone:** Precise, institutional, understated. FAULTLINE does not hype. It reports.

**Language to use:** "macro risk intelligence," "pressure index," "regime detection," "systemic stress," "fault lines," "structural forces," "intelligence terminal"

**Language to avoid:** "signals app," "buy/sell signals," "trading tips," "alerts service," "stock picks," "guaranteed returns"

**CTA formula:** Every external touchpoint ends with a variant of: `→ Full intelligence at getfaultline.live`

**Visual identity:** Dark background (#0a0a0f), cyan accent (#00e5ff), amber warning (#f59e0b), red critical (#ef4444). Monospace or geometric sans-serif typography. No gradients, no stock photos of traders.
