# FAULTLINE — Design Brainstorm

## App Concept
Cinematic, institutional-grade macroeconomic risk intelligence platform. Tagline: "See the pressure before the break."

---

<response>
<probability>0.07</probability>
<text>
## Idea A: "Seismic Command" — Tectonic Data Brutalism

**Design Movement:** Brutalist Data Visualization meets Seismic Monitoring Station

**Core Principles:**
1. Raw data density — every pixel earns its place
2. Asymmetric tension — layouts that feel like they're about to shift
3. Monochromatic base with surgical accent injections
4. Information hierarchy through scale contrast, not decoration

**Color Philosophy:**
- Base: #080A0F (near-black with blue undertone)
- Surface: #0D1117 (GitHub dark — familiar, credible)
- Graphite: #1C2333
- Gold accent: #C9A84C (muted gold — institutional, not garish)
- Crimson: #DC2626 (alert state only)
- Electric blue: #3B82F6 (data lines)
- Amber: #F59E0B (warning state)
- All text: #E2E8F0 primary, #94A3B8 secondary

**Layout Paradigm:**
- Mobile: Full-bleed card stacks with edge-to-edge charts
- Desktop: Asymmetric 3-column grid — narrow sidebar (nav), wide main, narrow data rail
- No centered hero sections — data starts immediately at the fold

**Signature Elements:**
1. Seismic waveform dividers between sections
2. Glowing score rings with radial gradient halos
3. Ticker tape data strip at top of screen

**Interaction Philosophy:**
- Tap to expand — cards reveal deeper data layers
- Long-press for contextual risk interpretation
- Swipe between timeframes

**Animation:**
- Score numbers count up on mount (0 → value, 800ms ease-out)
- Waveform lines draw themselves left-to-right
- Cards slide up from bottom with stagger (40ms delay each)
- Glow pulses on critical scores (2s sine wave opacity)
- Chart lines animate in with path-drawing effect

**Typography System:**
- Display: Space Grotesk 700 — angular, technical
- Body: JetBrains Mono — monospace credibility for data
- Labels: Space Grotesk 500
- Numbers: Tabular figures, JetBrains Mono
</text>
</response>

<response>
<probability>0.06</probability>
<text>
## Idea B: "Palantir Noir" — Intelligence Terminal Aesthetic

**Design Movement:** Dark Intelligence UI / Surveillance Terminal

**Core Principles:**
1. Everything is a signal — visual noise is eliminated ruthlessly
2. Depth through layering — cards float above void
3. Neon accents as warning systems, not decoration
4. Cinematic pacing — transitions feel like a film cut

**Color Philosophy:**
- Void: #050608 (true near-black)
- Panel: #0A0C10 (slightly lighter)
- Surface: #111318
- Border: rgba(255,255,255,0.06)
- Neon gold: #FFD700 → used sparingly for highest-signal elements
- Electric blue: #00D4FF — data visualization primary
- Crimson: #FF2D55 — critical risk only
- Amber: #FF9500 — elevated warning
- Text: #F0F4FF primary, #6B7280 muted

**Layout Paradigm:**
- Mobile-first: single column, full-bleed, bottom tab nav
- Desktop: left rail navigation (icon + label), content area fills remaining space
- Dashboard uses masonry-style card grid — cards of varying heights
- No symmetry — intentional imbalance creates tension

**Signature Elements:**
1. Scanline overlay texture (subtle CSS repeating-linear-gradient)
2. Corner bracket decorations on key cards (CSS clip-path)
3. Animated number tickers for live metrics

**Interaction Philosophy:**
- Hover reveals hidden data layers
- Tap/click triggers cinematic zoom-in on charts
- Smooth tab transitions with slide + fade

**Animation:**
- Tab switch: content fades out (100ms) then new content slides up (200ms)
- Score gauges fill with liquid animation
- Alert indicators pulse with box-shadow glow
- Background: subtle particle field (CSS only, no canvas)
- Numbers: rolling digit animation on value change

**Typography System:**
- Display: Rajdhani 700 — military-technical feel
- Data: IBM Plex Mono — terminal authenticity
- Body: IBM Plex Sans 400/500
- All caps labels with 0.15em letter-spacing
</text>
</response>

<response>
<probability>0.05</probability>
<text>
## Idea C: "Bloomberg Evolved" — Institutional Data Theater

**Design Movement:** Financial Terminal Reimagined for the Cinematic Age

**Core Principles:**
1. Data density with breathing room — not cramped, not sparse
2. Color as semantic language — every hue carries meaning
3. Motion as information — animations communicate data change
4. Institutional credibility through restraint

**Color Philosophy:**
- Background: #060810
- Card: #0C0F1A
- Border: #1A2035
- Primary accent: #B8860B (dark goldenrod — old money)
- Alert: #E53E3E
- Positive: #38A169
- Neutral: #4299E1
- Text primary: #EDF2F7
- Text secondary: #718096

**Layout Paradigm:**
- Mobile: Scrollable dashboard with sticky header metrics
- Desktop: Top navigation bar + full-width content zones
- Dashboard uses a 12-column grid with intentional asymmetry
- Charts take 60% width, metadata takes 40%

**Signature Elements:**
1. Horizontal rule dividers with gradient fade
2. Micro-sparklines embedded in every metric card
3. Status bar at top showing live market regime

**Interaction Philosophy:**
- Everything is filterable by timeframe
- Side-by-side comparison mode
- Fullscreen cinematic mode for presentations

**Animation:**
- Sparklines draw on scroll-into-view
- Metric cards entrance: fade + translateY(8px) stagger
- Chart tooltips: instant appear, 150ms fade out
- Score rings: SVG stroke-dashoffset animation

**Typography System:**
- Display: Bebas Neue — bold, financial headlines
- Body: DM Sans — clean, readable
- Mono: Fira Code — data values
- Numbers always tabular-nums
</text>
</response>

---

## CHOSEN APPROACH: Idea B — "Palantir Noir" Intelligence Terminal

**Rationale:** Best matches the FAULTLINE brand — cinematic, elite, predictive. The void-black base with neon accents creates maximum visual impact. IBM Plex Mono gives terminal authenticity while Rajdhani provides the military-technical display weight needed for a systemic risk platform.

**Key design decisions:**
- Dark theme only (no toggle)
- Bottom tab navigation on mobile, left rail on desktop
- Scanline texture overlay for cinematic depth
- Neon gold (#FFD700) reserved for the highest-signal elements only
- Electric blue (#00D4FF) for all chart data lines
- Crimson (#FF2D55) for critical risk alerts only
- Corner bracket motifs on key cards
- All-caps labels with letter-spacing
