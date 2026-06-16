# FAULTLINE — External Platform Launch Checklist

**Document type:** Marketing & Admin Operations  
**Version:** 1.0  
**Date:** June 2026  
**Status:** Pre-launch  

---

## Overview

This checklist governs the sequential rollout of FAULTLINE's five external visibility channels. Each channel is a funnel back to the paid web terminal at [getfaultline.live](https://getfaultline.live). Channels are executed in priority order: TradingView → Discord → Product Hunt → RapidAPI / Nokia API Hub → Slack.

Each section contains pre-work tasks, launch tasks, and post-launch maintenance tasks. Items marked **[BLOCKING]** must be completed before proceeding to the next phase. Items marked **[ASSET]** require a creative or technical asset to be produced first.

---

## Global Pre-Work (Complete Before Any Channel Launch)

These items apply across all five channels and must be completed once before the first channel goes live.

- [ ] Register `@FAULTLINE` handle on all platforms: TradingView, Discord, Product Hunt, RapidAPI, Slack App Directory, Twitter/X, LinkedIn
- [ ] Create a brand asset kit: logo (SVG + PNG), dark background version, light background version, 1:1 square crop for avatars, 16:9 banner crop for channel headers
- [ ] Write the master brand bio (150 words): "FAULTLINE is a macro risk intelligence terminal for traders. It monitors systemic liquidity stress, late-cycle instability, AI bubble conditions, and crypto regime shifts — synthesizing them into a real-time Pressure Index and actionable intelligence. Built for traders who understand that price is the last thing to move. → getfaultline.live"
- [ ] Prepare a short-form bio (50 words) and ultra-short bio (15 words) from the master bio
- [ ] Create a 60–90 second screen-capture demo video showing: Pressure Index at a high reading, regime detection, Diagnostic AI output, and a shareable report link
- [ ] Set up a `platform-assets/` folder in the project repository to store all logos, screenshots, and copy assets
- [ ] Confirm the live domain `getfaultline.live` is fully operational and the landing page CTA is visible without login

---

## Channel 1: TradingView

**Target launch:** Week 1–2  
**Effort estimate:** 8–12 hours  
**Expected impact:** Persistent brand exposure, organic discovery via TradingView library search

### Pre-Work

- [ ] **[BLOCKING]** Create TradingView account with username `FAULTLINE` or `FaultlineIntel`
- [ ] **[BLOCKING]** Write Pine Script v5 indicator code (see `external-platform-distribution.md` for full spec)
- [ ] **[ASSET]** Capture 5 chart screenshots showing the indicator applied to: SPY (bear regime), NVDA (AI bubble label active), BTC (crypto context), QQQ (high pressure), GLD (low risk / safe haven)
- [ ] Write TradingView listing short description (250 chars max): "FAULTLINE Pressure Index Lite — simplified macro risk intelligence from getfaultline.live. Shows pressure score, regime label, AI bubble exposure, and risk color band."
- [ ] Write TradingView listing long description (2000 chars max): include explanation of each visual element, note that this is a lite approximation, list what the full platform adds, end with "→ Full platform: https://getfaultline.live"
- [ ] Test the Pine Script indicator on at least 10 different tickers and timeframes before publishing
- [ ] Verify the CTA watermark ("Full Intelligence → getfaultline.live") is visible on all chart sizes

### Launch

- [ ] Publish indicator to TradingView public library
- [ ] Set category to "Trend Analysis" and add tags: macro, risk, regime, pressure, systemic, faultline, bear market, bubble
- [ ] Post about the indicator launch on Twitter/X with a chart screenshot showing the indicator in action
- [ ] Post in relevant TradingView comment sections and forums (do not spam — post only where genuinely relevant)
- [ ] Share the indicator in the FAULTLINE Discord `#announcements` channel once Discord is live

### Post-Launch Maintenance

- [ ] Monitor TradingView comments weekly and respond to questions
- [ ] Update the indicator when FAULTLINE's signal methodology changes significantly
- [ ] Track "likes" and "saves" on the indicator as a proxy for reach
- [ ] Review keyword performance quarterly and update tags if needed

---

## Channel 2: Discord

**Target launch:** Week 3–5  
**Effort estimate:** 15–20 hours (server setup + bot development)  
**Expected impact:** Owned community, direct upgrade funnel, daily brand touchpoint

### Pre-Work

- [ ] **[BLOCKING]** Create Discord server named "FAULTLINE — Macro Risk Intelligence"
- [ ] **[BLOCKING]** Set up server icon (FAULTLINE logo), banner (dark background with Pressure Index visualization), and description
- [ ] Create all channels in the correct order (see `external-platform-distribution.md` for full channel list)
- [ ] Configure roles: `@Member` (auto-assigned on join), `@Premium`, `@Founding Member`, `@Admin`
- [ ] Write `#welcome` channel message: server overview, channel guide, rules, and CTA to getfaultline.live
- [ ] Write server rules (5–7 rules covering: no spam, no financial advice, no sharing premium content outside server, respect all members, no self-promotion without permission)
- [ ] **[ASSET]** Design role permission matrix (which roles can read/write in which channels)
- [ ] **[BLOCKING]** Develop FAULTLINE Discord Bot (Node.js, Discord.js v14) with commands: `/faultline`, `/ticker`, `/crypto`, `/regime`
- [ ] **[BLOCKING]** Deploy bot to a persistent hosting environment (can use the same server as the FAULTLINE backend)
- [ ] Build Discord OAuth role verification flow: user visits getfaultline.live/discord/verify → authorizes Discord OAuth → bot assigns correct role based on subscription tier
- [ ] Add new tRPC endpoint `discord.verifyRole` that accepts a Discord user ID and returns the correct role based on subscription tier
- [ ] Test all bot commands with at least 5 different inputs each
- [ ] Set up daily briefing cron job: posts to `#daily-briefing` at 9 AM ET on weekdays

### Launch

- [ ] Announce Discord server on Twitter/X with invite link
- [ ] Send email to existing FAULTLINE users with Discord invite link
- [ ] Post invite link on Product Hunt (once that channel launches)
- [ ] Add Discord invite link to getfaultline.live footer and user account page
- [ ] Seed `#free-market-reading` with 3–5 days of back-content so the channel looks active on launch day
- [ ] Post the first daily briefing manually on launch day to demonstrate the format

### Post-Launch Maintenance

- [ ] Post daily macro reading to `#free-market-reading` every weekday (can be automated via bot)
- [ ] Monitor all channels daily for the first 2 weeks, then weekly thereafter
- [ ] Review bot error logs weekly
- [ ] Update bot commands when FAULTLINE signal methodology changes
- [ ] Run monthly community events (e.g., "Ask the Pressure Index" Q&A sessions)
- [ ] Track member count, role distribution (free vs. premium), and upgrade conversion rate monthly

---

## Channel 3: Product Hunt

**Target launch:** Week 6  
**Effort estimate:** 10–15 hours (asset preparation + coordination)  
**Expected impact:** Concentrated traffic burst, press attention, backlinks, early adopter acquisition

### Pre-Work

- [ ] **[BLOCKING]** Create Product Hunt account and claim FAULTLINE product page
- [ ] **[BLOCKING]** Identify a Product Hunt hunter with 500+ followers who is willing to post FAULTLINE (a well-followed hunter significantly increases visibility)
- [ ] **[ASSET]** Prepare all 8 screenshots (see `external-platform-distribution.md` for full screenshot list) — 1440×900, dark mode, thin border, drop shadow
- [ ] **[ASSET]** Produce the 60–90 second demo video (can reuse the global pre-work video)
- [ ] Write and finalize all listing copy: title, tagline, short description, long description (see `external-platform-distribution.md` for approved copy)
- [ ] Write the founder comment (see `external-platform-distribution.md` for approved copy)
- [ ] Prepare 5–10 anticipated Q&A responses for common questions (What is a Pressure Index? How is this different from TradingView signals? Is this for crypto or stocks? What does "macro risk" mean?)
- [ ] Write launch day social posts for Twitter/X and LinkedIn
- [ ] Brief existing FAULTLINE users (via email and Discord) about the upcoming launch — do NOT ask for upvotes publicly; frame it as "we're launching on Product Hunt, come check it out"
- [ ] Schedule the Product Hunt post to go live at 12:01 AM PT on the chosen launch day
- [ ] Confirm the chosen launch day does not conflict with major competing launches (check PH upcoming page)

### Launch Day

- [ ] Verify the post went live at 12:01 AM PT
- [ ] Post the founder comment within the first 30 minutes
- [ ] Post on Twitter/X at 7 AM ET: "We just launched on Product Hunt — [link]"
- [ ] Post on LinkedIn at 8 AM ET with a brief explanation of what FAULTLINE does
- [ ] Post in FAULTLINE Discord `#announcements` at 9 AM ET
- [ ] Send email to existing user list at 10 AM ET with PH link
- [ ] Monitor PH comments continuously from 7 AM to 7 PM ET and respond to every comment within 2 hours
- [ ] Engage with upvoters — thank them in comments or DMs

### Post-Launch

- [ ] Write a post-launch update post (how many upvotes, top comments, what you learned) — post to Blog and Discord
- [ ] Follow up with every commenter who expressed interest or asked a question
- [ ] Update the PH listing with any corrections or additions within 48 hours
- [ ] Track referral traffic from Product Hunt in analytics for 30 days
- [ ] Add Product Hunt badge to getfaultline.live footer if the launch achieved top 5 of the day

---

## Channel 4: RapidAPI / Nokia API Hub

**Target launch:** Week 7–10  
**Effort estimate:** 30–40 hours (backend development + listing setup)  
**Expected impact:** Developer ecosystem penetration, secondary API revenue stream, institutional discovery

### Pre-Work

- [ ] **[BLOCKING]** Create RapidAPI publisher account at rapidapi.com/provider
- [ ] **[BLOCKING]** Create Nokia API Hub account at apimarket.nokia.com
- [ ] **[BLOCKING]** Build REST adapter layer: Express routes wrapping existing FAULTLINE tRPC logic for all 5 API products (Pressure Index, Ticker Risk, Crypto Rotation, Macro Regime, Bull/Bear Probability)
- [ ] **[BLOCKING]** Build API key management system: issue per-subscriber keys, validate keys on each request, track usage per key per day
- [ ] **[BLOCKING]** Build rate limiting middleware: enforce per-tier request limits (see `external-platform-distribution.md` for tier specs)
- [ ] Build usage metering: log every API request with key, endpoint, timestamp, response time to a `api_usage_logs` table
- [ ] Write OpenAPI 3.0 specification document covering all 5 endpoints with full request/response schemas
- [ ] Write API documentation: getting started guide, authentication guide, endpoint reference, code examples in JavaScript, Python, and cURL
- [ ] Set up a test API key for use in documentation examples
- [ ] Test all 5 endpoints with at least 20 different inputs each
- [ ] Implement error handling: standardized error responses with `code`, `message`, and `documentation_url` fields
- [ ] Write RapidAPI listing copy: title, description, category tags (Finance, Trading, Risk Management, Market Data)
- [ ] Prepare API response examples for each endpoint (use realistic but non-live data)

### Launch

- [ ] Submit API to RapidAPI for review (review typically takes 3–5 business days)
- [ ] Submit API to Nokia API Hub for review
- [ ] Once approved, announce on Twitter/X: "FAULTLINE macro risk intelligence is now available as an API — [RapidAPI link]"
- [ ] Post in developer communities: Hacker News (Show HN), relevant subreddits (r/algotrading, r/quant), Discord servers for developers and quant traders
- [ ] Add "API Access" section to getfaultline.live with a link to the RapidAPI listing
- [ ] Send email to existing users announcing API availability

### Post-Launch Maintenance

- [ ] Monitor API usage logs weekly for anomalies or abuse
- [ ] Review and respond to RapidAPI reviews and questions monthly
- [ ] Update API documentation when endpoints change
- [ ] Monitor API uptime and response time — target 99.9% uptime, <500ms p95 response time
- [ ] Review pricing tiers quarterly and adjust based on usage patterns

---

## Channel 5: Slack

**Target launch:** Week 11–14  
**Effort estimate:** 20–25 hours (app development + listing setup)  
**Expected impact:** Team and enterprise subscription driver, professional workflow integration

### Pre-Work

- [ ] **[BLOCKING]** Create Slack App at api.slack.com/apps
- [ ] **[BLOCKING]** Build Slack app using Slack Bolt for JavaScript (Node.js)
- [ ] Implement slash commands: `/faultline`, `/ticker`, `/regime` (same logic as Discord bot — can share the underlying API call layer)
- [ ] Implement scheduled messages: daily briefing (8 AM ET weekdays), weekly summary (4:30 PM ET Fridays)
- [ ] Implement watchlist alert system: users configure tickers via `/faultline watchlist add NVDA`, alerts fire when signal changes
- [ ] Implement regime change alerts: triggered automatically when FAULTLINE's regime engine detects a shift
- [ ] Build Slack OAuth 2.0 workspace installation flow
- [ ] Build configuration UI at getfaultline.live/slack/config: channel selection, alert preferences, watchlist management
- [ ] Build subscription verification: check user's FAULTLINE tier before enabling premium features (watchlist alerts, full briefing)
- [ ] Write Slack App Directory listing: name, description, category, screenshots, privacy policy URL
- [ ] Test the full app in a private Slack workspace with at least 5 different configurations
- [ ] Prepare onboarding message: sent to the installing workspace's general channel on first install

### Launch

- [ ] Submit Slack app to Slack App Directory for review (review typically takes 1–2 weeks)
- [ ] Once approved, announce on Twitter/X and LinkedIn
- [ ] Post in FAULTLINE Discord `#announcements`
- [ ] Send email to existing users with Slack app install link
- [ ] Post in relevant Slack communities (fintech, trading, quant) where self-promotion is permitted
- [ ] Add "Slack Integration" to getfaultline.live integrations or account page

### Post-Launch Maintenance

- [ ] Monitor Slack app error logs weekly
- [ ] Review Slack App Directory reviews monthly and respond to feedback
- [ ] Update app when FAULTLINE signal methodology changes
- [ ] Track workspace install count and active workspace count monthly
- [ ] Review team subscription conversion rate quarterly

---

## Cross-Channel Metrics Dashboard

Track the following metrics monthly across all five channels to evaluate funnel performance:

| Channel | Primary Metric | Secondary Metric | Conversion Metric |
|---|---|---|---|
| TradingView | Indicator saves/likes | Chart applications | getfaultline.live referral traffic |
| Discord | Member count | Premium role count | Upgrade conversion rate |
| Product Hunt | Upvotes | Comments | Day-of signups |
| RapidAPI | API calls/month | Active subscribers | Revenue from API tiers |
| Slack | Workspace installs | Active workspaces | Team subscription conversions |

**Monthly review cadence:** First Monday of each month, review all five channels against these metrics. Update this checklist with any new maintenance tasks discovered during review.

---

## Asset Registry

All assets produced for external platform distribution should be catalogued here as they are created.

| Asset | Format | Status | Location |
|---|---|---|---|
| FAULTLINE logo (dark bg) | SVG, PNG | Pending | `platform-assets/logo-dark.*` |
| FAULTLINE logo (light bg) | SVG, PNG | Pending | `platform-assets/logo-light.*` |
| Avatar (1:1 square) | PNG 512×512 | Pending | `platform-assets/avatar.png` |
| Channel banner (16:9) | PNG 1920×1080 | Pending | `platform-assets/banner.png` |
| Demo video (60–90s) | MP4 | Pending | `platform-assets/demo.mp4` |
| TradingView screenshots (×5) | PNG 1440×900 | Pending | `platform-assets/tradingview/` |
| Product Hunt screenshots (×8) | PNG 1440×900 | Pending | `platform-assets/producthunt/` |
| Pine Script indicator | `.pine` | Pending | `platform-assets/faultline-lite.pine` |
| OpenAPI spec | YAML | Pending | `platform-assets/openapi.yaml` |
| API documentation | Markdown | Pending | `platform-assets/api-docs/` |

---

## Notes

**Do not build full integrations prematurely.** The Discord bot and Slack app require backend work. The API marketplace requires significant infrastructure. These should be built in the order listed, with each channel fully launched and stable before the next begins.

**The TradingView indicator is the highest-leverage first step.** It requires no backend changes, reaches the largest audience, and creates a permanent presence on the platform. It should be the first thing shipped.

**Maintain brand voice discipline across all channels.** Every external touchpoint must feel like FAULTLINE — precise, institutional, understated. No hype, no generic trading language, no stock photos. The brand is the differentiator.
