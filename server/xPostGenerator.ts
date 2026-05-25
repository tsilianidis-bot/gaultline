// FAULTLINE — X Post Generator (server/xPostGenerator.ts)
//
// Generates institutional-quality X posts using live FAULTLINE
// pressure data and an LLM. Returns 5 post variants per call.
// ============================================================

import { invokeLLM } from "./_core/llm";
import type { FaultlinePressureOutput } from "./pressure/engine";

export type PostType = "premarket" | "midday" | "closing" | "breaking";

export interface XPostVariants {
  short: string;        // ≤280 chars
  thread: string;       // multi-tweet thread (1/5, 2/5, etc.)
  founder: string;      // founder personal voice
  institutional: string; // formal institutional tone
  breaking: string;     // urgent breaking-alert style
}

interface GenerateXPostInput {
  postType: PostType;
  pressure: FaultlinePressureOutput;
  headline?: string; // for breaking alert mode
}

// ── Tone logic based on pressure ─────────────────────────────

function getToneGuidance(pressure: FaultlinePressureOutput): string {
  const p = pressure.overallPressure;
  const regime = pressure.regime;

  if (p >= 75) {
    return "DEFENSIVE/CRITICAL: Elevated systemic risk. Warn about fragility. Emphasize hidden pressure. Caution tone.";
  } else if (p >= 55) {
    return "CAUTIOUS/RISK-OFF: Pressure building. Highlight deteriorating conditions. Skeptical of rallies.";
  } else if (p >= 35) {
    return "NEUTRAL/WATCHFUL: Mixed signals. Acknowledge both sides. Focus on what to monitor.";
  } else {
    return "CONSTRUCTIVE/RISK-ON: Improving conditions. Acknowledge positive signals while noting tail risks.";
  }
}

// ── Build context string from pressure data ──────────────────

function buildPressureContext(pressure: FaultlinePressureOutput): string {
  const topVectors = [...pressure.vectors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const topAlerts = pressure.alerts.slice(0, 3);

  const bullProb = Math.max(5, Math.round(100 - pressure.overallPressure));
  const crashProb = Math.min(95, Math.round(pressure.overallPressure * 0.6));

  return `
FAULTLINE PRESSURE INDEX: ${pressure.overallPressure}/100
REGIME: ${pressure.regime}
LEVEL: ${pressure.level}
DATA SOURCE: ${pressure.dataSource === "live" ? "Live FRED data" : "Baseline estimates"}

BULL PROBABILITY: ~${bullProb}%
CRASH/RISK-OFF PROBABILITY: ~${crashProb}%

TOP RISK VECTORS:
${topVectors.map(v => `- ${v.label}: ${v.score}/100 (${v.level}) — ${v.driver}`).join("\n")}

ACTIVE ALERTS:
${topAlerts.length > 0 ? topAlerts.map(a => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.detail}`).join("\n") : "No critical alerts"}

HISTORICAL ANALOG: ${pressure.topAnalog.label} (${pressure.topAnalog.similarity}% similarity) — ${pressure.topAnalog.description}
`.trim();
}

// ── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(postType: PostType, pressure: FaultlinePressureOutput, headline?: string): string {
  const tone = getToneGuidance(pressure);
  const context = buildPressureContext(pressure);
  const timeContext = {
    premarket: "PRE-MARKET (before 9:30am ET). Markets haven't opened yet. Focus on what to watch, what pressure is building, what the setup looks like.",
    midday: "MIDDAY UPDATE (12pm–1pm ET). Markets are open. Assess whether early price action confirms or contradicts FAULTLINE pressure readings.",
    closing: "CLOSING SUMMARY (3:45–4:10pm ET). Markets are closing. Summarize the day's pressure dynamics, whether breadth confirmed moves, and what to watch tomorrow.",
    breaking: headline
      ? `BREAKING ALERT triggered by headline: "${headline}". Explain the macro implications, hidden pressure, and what it means for risk.`
      : "BREAKING ALERT. Major market event. Urgent tone. Explain systemic implications.",
  }[postType];

  return `You are FAULTLINE's institutional macro intelligence system. You generate X (Twitter) posts that interpret hidden systemic pressure beneath market surface action.

CORE POSITIONING: Most finance accounts report what already happened. FAULTLINE explains the hidden systemic pressure driving what happens next.

STYLE RULES:
- Professional macro-intelligence tone. Sharp, predictive, pressure-focused.
- NO generic finance commentary. NO hype. NO emojis.
- Always interpret the HIDDEN macro implications — not just surface price action.
- Always include breadth analysis: is participation broad or narrow? Are indexes masking weakness?
- Always include: current market tone, FAULTLINE risk level, bull probability, crash/risk-off probability, key takeaway, what to monitor next, and getfaultline.live
- End every post with getfaultline.live

TONE GUIDANCE: ${tone}

TIME CONTEXT: ${timeContext}

LIVE FAULTLINE DATA:
${context}`;
}

// ── User prompt ───────────────────────────────────────────────

function buildUserPrompt(postType: PostType, headline?: string): string {
  const typeLabel = postType === "breaking" && headline
    ? `Breaking Alert for: "${headline}"`
    : { premarket: "Premarket Intelligence Drop", midday: "Midday Market Update", closing: "Closing Summary", breaking: "Breaking Alert" }[postType];

  return `Generate a ${typeLabel} X post in ALL FIVE formats below. Return as JSON with keys: short, thread, founder, institutional, breaking.

FORMAT SPECS:

1. SHORT (key: "short")
Under 280 characters. One sharp sentence capturing the key pressure signal + risk level + getfaultline.live

2. THREAD (key: "thread")
5-tweet thread. Format each tweet as "1/5 [content]", "2/5 [content]", etc.
Tweet 1: Hook — the key pressure signal
Tweet 2: Breadth analysis — is participation confirming or diverging?
Tweet 3: The hidden macro implication most traders are missing
Tweet 4: What to watch next — specific indicators
Tweet 5: FAULTLINE risk level + bull/crash probabilities + getfaultline.live

3. FOUNDER (key: "founder")
Personal founder voice. 2–3 sentences. Direct, confident, slightly contrarian. Sounds like a macro practitioner sharing a real insight, not a bot. Include getfaultline.live

4. INSTITUTIONAL (key: "institutional")
Formal institutional tone. 3–4 sentences. References specific pressure vectors and probabilities. Reads like a risk desk note. Include getfaultline.live

5. BREAKING ALERT (key: "breaking")
Urgent alert format. Start with "⚠️ FAULTLINE ALERT:" then explain the systemic implication in 2–3 sharp sentences. Include risk level and getfaultline.live

Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;
}

// ── Main export ───────────────────────────────────────────────

export async function generateXPosts(input: GenerateXPostInput): Promise<XPostVariants> {
  const { postType, pressure, headline } = input;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(postType, pressure, headline),
      },
      {
        role: "user",
        content: buildUserPrompt(postType, headline),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "x_post_variants",
        strict: true,
        schema: {
          type: "object",
          properties: {
            short: { type: "string", description: "Under 280 characters" },
            thread: { type: "string", description: "5-tweet thread with 1/5 format" },
            founder: { type: "string", description: "Founder personal voice" },
            institutional: { type: "string", description: "Institutional tone" },
            breaking: { type: "string", description: "Breaking alert format" },
          },
          required: ["short", "thread", "founder", "institutional", "breaking"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const raw = typeof rawContent === "string" ? rawContent : null;
  if (!raw) throw new Error("LLM returned empty response");

  const parsed = JSON.parse(raw) as XPostVariants;
  return parsed;
}
