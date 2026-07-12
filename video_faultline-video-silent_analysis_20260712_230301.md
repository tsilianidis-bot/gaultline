Here is a detailed design specification document based on the video provided.

# FAULTLINE Design Specification Document

## Overall Aesthetic & Design Language
The application employs a "Dark Mode HUD / Terminal" aesthetic. It is characterized by high information density, stark contrast, and a futuristic, analytical feel.
*   **Backgrounds:** Deep space blacks (`#000000`) and very dark blues/greys (`#04080F` approx.), often overlaid with subtle, animated particle grids or dot matrices to suggest data flow.
*   **Color Palette:**
    *   **Primary Accent:** Neon Cyan/Light Blue (`#00E5FF` approx.) used for branding, primary data points, active states, and borders.
    *   **Secondary Accent:** Muted Teal/Cyan (`#008B8B` approx.) used for secondary text, labels, and inactive elements.
    *   **Alert/Status Colors:**
        *   **Red:** High Risk, Crash, Tail Risk (`#FF3333` approx.).
        *   **Yellow/Orange:** Moderate Risk, Cautious, Stagflation, Recession (`#FFB300` to `#FF5722`).
        *   **Green:** Bull Market, Improvement, Live Status (`#00E676` approx.).
        *   **Blue:** Watch state, Stabilization (`#2979FF` approx.).
*   **Typography:**
    *   **Headers/Titles:** Bold, sans-serif (e.g., Montserrat or similar), uppercase, tracking applied.
    *   **Data/Numbers:** Monospaced fonts (e.g., Roboto Mono, Courier) to align digits perfectly and emphasize a technical, terminal-like interface.
    *   **Body/Labels:** Clean, legible sans-serif (e.g., Inter, Helvetica Neue).
*   **Effects:** Subtle glow effects on primary text and active icons. Thin, sharp borders (1px) define panels, avoiding heavy drop shadows in favor of a flat, layered, screen-based look.

---

## Scene 1: Title & Branding (00:00 - 00:02)
*   **Layout:** Centered, minimalist.
*   **Background:** Dark void with a 3D particle field. Particles are predominantly tiny blue dots with sparse red dots, drifting slowly to create depth.
*   **Corner Elements:** Top-left and top-right corners feature thin, cyan, right-angle brackets (`┌` and `┐`), establishing the HUD framing.
*   **Typography:**
    *   **Main Logo:** "FAULTLINE" (Centered, massive size, bold weight). "FAULT" is pure white (`#FFFFFF`); "LINE" is neon cyan.
    *   **Subtitle:** "MACROECONOMIC RISK INTELLIGENCE" (Centered below logo, small size, uppercase, wide letter-spacing, muted teal color).
    *   **Version:** "v1.0 BETA" (Bottom-left corner, very small, monospaced, muted teal).

---

## Scene 2: Regime Probabilities & Market Intelligence Panel (00:03 - 00:06)
*   **Layout:** A single, vertically oriented rectangular panel centered on a black screen. The panel is enclosed by a thin cyan border with rounded corners.
*   **Market Ticker (Top Edge):**
    *   Positioned inside the top border of the panel.
    *   Text: `10Y Treasury 4.54% [Green Up Arrow] | HY Spread 270bps | BTC 67,420`
    *   Style: Monospaced, cyan text. Vertical line separators.
*   **Regime Probabilities Section (Upper Half):**
    *   **Header:** "REGIME PROBABILITIES [Info Icon]" (Left-aligned, small, uppercase, cyan).
    *   **Timestamp:** "AS OF 2025-05-18 14:32 UTC" (Right-aligned, small, monospaced, muted teal).
    *   **Data Rows (5 items):** Each row contains a label (left), a horizontal bar chart (center), and a percentage (right). The bar chart track consists of small, discrete vertical dashes.
        *   `BULL`: White label, Green bar, `57%` Green text.
        *   `SOFT LAND`: White label, Teal bar, `45%` Teal text.
        *   `STAGFLATION`: White label, Yellow bar, `30%` Yellow text.
        *   `RECESSION`: White label, Orange bar, `22%` Orange text.
        *   `CRASH`: White label, Red bar, `43%` Red text.
*   **Market Intelligence Section (Lower Half):**
    *   Separated from the top section by a thin cyan line.
    *   **Header:** "MARKET INTELLIGENCE" (Cyan, medium size).
    *   **Sub-header:** "Systemic risk composite at 3" (White text, the number "3" is significantly larger and cyan).
    *   **Iconography:** A stylized cyan icon of a human head profile containing a brain/circuit node.
    *   **AI Insight Box:** A nested box with a thin cyan border.
        *   Icon: "AI" inside a rounded square.
        *   Primary Text: "AI Bubble/Speculation (5.7/10):" (Cyan).
        *   Secondary Text: "AI/mega-cap S&P concentration 32.4%" (White).
*   **Footer Status Bar:**
    *   Left: Green dot + "LIVE" (Green text).
    *   Center-Left: "10/10" (Cyan).
    *   Center: Hexagon logo + "MACRO INTEL" (Cyan text) over "MACROECONOMIC INTELLIGENCE PLATFORM" (Tiny, muted teal text).
    *   Right: "DATA AS OF 14:32 UTC" (Cyan, monospaced).

---

## Scene 3: Faultline Seismograph Dashboard (00:07 - 00:11)
*   **Layout:** A complex, full-screen dashboard divided into a header, a wide left column (Market State & Active Patterns), a narrower right column (Transition Probabilities), and a footer.
*   **Background:** Very dark blue with a faint, static dot-grid overlay.
*   **Header:**
    *   **Title:** "FAULTLINE SEISMOGRAPH™" (Large, cyan, bold).
    *   **Subtitle:** "SEISMOGRAPH INTELLIGENCE DASHBOARD" (Small, white, uppercase).
    *   **Status (Top Right):** "SYSTEM STATUS [Green Dot] ONLINE" and "DATA FEED [Green Dot] LIVE".
    *   **Timestamp (Below Status):** "LAST UPDATE: 2025-05-20 09:32:41 UTC" (Cyan, monospaced).
*   **Left Column: Market State (Top):**
    *   Enclosed in a thin cyan border.
    *   **Title:** "MARKET STATE" with an eye/node icon.
    *   **Current State:** "CURRENT STATE: CAUTIOUS" (Large, yellow text).
    *   **Evidence Consensus:** "6.2/10" (Large, yellow monospaced text). Below it is a horizontal gauge bar filled yellow up to the 6.2 mark on a 0-10 scale.
    *   **Details:** "Active Regime: Late Cycle Stress" (White) and "Historical Analog: 2018 Q4 Fed Pivot - 84% similarity" (White).
*   **Left Column: Active Patterns (Bottom):**
    *   **Title:** "ACTIVE PATTERNS" with a radar icon.
    *   **Three Data Cards:**
        1.  **Pressure Buildup:** Red target icon. "Day 47". Two equalizer-style bar charts: "PATTERN STRENGTH" and "SIGNAL QUALITY" (bars are red). Badge: "RISK LEVEL: HIGH" (Red box, black text).
        2.  **Regime Transition:** Yellow cycle icon. "Day 12". Equalizer charts (yellow). Badge: "RISK LEVEL: MODERATE" (Yellow box, black text).
        3.  **Credit Contagion:** Blue node icon. "Day 0". Equalizer charts (blue). Badge: "RISK LEVEL: WATCH" (Blue box, black text).
*   **Right Column: Transition Probabilities:**
    *   **Title:** "TRANSITION PROBABILITIES" with a bar chart icon.
    *   **Time Horizon Selector:** Tabs for "1M", "3M", "6M", "12M". "3M" is highlighted with a cyan box.
    *   **Data Rows:** Each has a label, a horizontal bar, and a percentage.
        *   `Deterioration (Elevated Stress)`: Red text, red bar, `28%`.
        *   `Sideways / Choppy (Range-Bound)`: Orange text, orange bar, `42%`.
        *   `Stabilization (Base-Building)`: Blue text, blue bar, `20%`.
        *   `Improvement (Early Expansion)`: Green text, green bar, `7%`.
        *   `Systemic Event (Tail Risk)`: Dark red text, dark red bar, `3%`.
*   **Footer:**
    *   Four small, cyan text blocks with icons: "DATA COVERAGE: GLOBAL MARKETS", "HISTORY: 25 YRS", "MODEL VERSION: 3.7.4", "CONFIDENCE FRAMEWORK: INSTITUTIONAL GRADE".

---

## Scene 4: Ask Faultline AI Interface (00:12 - 00:16)
*   **Layout:** A three-pane layout typical of modern web apps: Navigation Sidebar (Left), Main Content/Chat (Center), Context Panel (Right).
*   **Left Sidebar:**
    *   Logo ("F" icon) + "FAULTLINE".
    *   Vertical menu icons with labels: Seismograph (highlighted cyan), Signals, Analysis, Portfolio, Watchlist, Settings, Logout.
*   **Center Pane: Ask Faultline (Chat Interface):**
    *   **Header:** "ASK FAULTLINE" (Large, white) / "Your AI Macro research partner" (Small, teal). "AI +" button on the right.
    *   **Chat History:**
        *   **User Message:** Avatar "YOU", Timestamp "09:30 AM". Text: "What does the current Seismograph say about transition risk?" (White text).
        *   **AI Response:** Avatar "FAULTLINE AI" (Cyan icon), Timestamp "09:30 AM". The text response heavily uses cyan to highlight key data points extracted from the dashboard (e.g., "Pressure Buildup", "Day 47", "HIGH intensity", "6.2/10", "2018 Q4", "28%", "350bps"). Standard text is muted teal/white.
    *   **Input Field:** Bottom of the pane. Placeholder text: "Ask a question about markets, macro, or risk...". Send arrow icon on the right.
*   **Right Pane: Seismograph Context:**
    *   **Header:** "SYSTEM STATUS [Green Dot] OPERATIONAL", "DATA AS OF: MAY 22, 2025 09:30 ET" (Right-aligned, small, teal).
    *   **Panel Title:** "SEISMOGRAPH CONTEXT" (White, uppercase).
    *   **Alert Box:** Large yellow warning triangle icon next to "CAUTIOUS" (Large, yellow text).
    *   **Evidence Consensus:** "6.2/10" (Large, yellow). Yellow progress bar. Subtitle: "Cautious Territory".
    *   **Current Pattern Box:** "Pressure Buildup" (White), "DAY 47" (Teal), "HIGH" badge (Red box). Icon of converging arrows.
    *   **Historical Analog Box:** "2018 Q4" (White), "84% similarity" (Teal). Calendar icon.

---

## Scene 5: Call to Action (00:17 - 00:20)
*   **Layout:** Centered content, returning to the aesthetic of Scene 1.
*   **Background:** The dark space with the blue/red drifting particle field.
*   **Corner Elements:** The cyan HUD corner brackets (`┌` and `┐`) return.
*   **Typography:**
    *   **Main Logo:** "FAULTLINE" (White/Cyan, large, bold).
    *   **URL:** "getfaultline.live" (Cyan, lowercase, sans-serif, positioned directly below the logo).
    *   **Body Copy:** "Detect systemic risk before it becomes visible. / Understand what is happening and why. / Act with complete market awareness." (Centered, muted teal, sans-serif, line breaks between sentences).
*   **Interactive Element:**
    *   **Button:** "START YOUR FREE TRIAL" (Cyan text, uppercase, enclosed in a thin cyan rectangular border with a transparent background).