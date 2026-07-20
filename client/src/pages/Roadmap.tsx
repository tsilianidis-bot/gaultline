/* ============================================================
   FAULTLINE — Platform Roadmap / Coming Soon
   Communicates the evolving intelligence platform vision.
   Premium cards, no inactive buttons, no placeholder pages.
   ============================================================ */
import { Briefcase, Bell, Link2, PiggyBank, FileText, Sliders, Sparkles, CheckCircle2, Clock } from "lucide-react";

// ── Feature definitions ───────────────────────────────────────
const COMING_SOON_FEATURES = [
  {
    id: "portfolio-intelligence",
    icon: Briefcase,
    label: "Portfolio Intelligence",
    tagline: "Understand how markets affect what you own.",
    description:
      "Monitor portfolio exposure, concentration, macro risk, historical vulnerability, and overall portfolio health through personalized intelligence powered by FAULTLINE. See exactly how today's market conditions interact with your specific holdings — not just the market in general.",
    benefits: [
      "Personalized macro risk score for your portfolio",
      "Concentration and sector exposure analysis",
      "Historical vulnerability mapping against past regimes",
      "Portfolio health dashboard updated in real time",
    ],
    color: "#00D4FF",
  },
  {
    id: "smart-alerts",
    icon: Bell,
    label: "Smart Portfolio Alerts",
    tagline: "Intelligent notifications. Zero noise.",
    description:
      "Receive intelligent notifications whenever meaningful market changes could materially affect your portfolio. FAULTLINE filters out the noise and surfaces only what truly deserves your attention — regime shifts, liquidity changes, and emerging systemic risks relevant to your holdings.",
    benefits: [
      "Regime-change alerts tied to your positions",
      "Liquidity and credit stress notifications",
      "Customizable alert thresholds by risk tolerance",
      "Delivered via app, email, or push notification",
    ],
    color: "#FFAA00",
  },
  {
    id: "brokerage-connections",
    icon: Link2,
    label: "Brokerage Connections",
    tagline: "Your holdings. Automatically analyzed.",
    description:
      "Securely connect supported brokerage accounts to automatically import your holdings and receive personalized market intelligence without manual updates. FAULTLINE reads your portfolio and applies its full intelligence engine to your actual positions.",
    benefits: [
      "Secure read-only brokerage integration",
      "Automatic holdings sync — no manual entry",
      "Instant portfolio intelligence on connection",
      "Supports major U.S. brokerages",
    ],
    color: "#00FF88",
  },
  {
    id: "retirement-monitor",
    icon: PiggyBank,
    label: "Retirement Monitor",
    tagline: "Long-term intelligence for long-term capital.",
    description:
      "View your retirement investments through a long-term macroeconomic lens. Understand how changing economic conditions — inflation regimes, rate cycles, credit expansions, and contractions — may influence retirement portfolios over time.",
    benefits: [
      "Macro regime impact on retirement allocations",
      "Long-term risk scenario modeling",
      "Inflation and rate sensitivity analysis",
      "Designed for 401(k), IRA, and pension portfolios",
    ],
    color: "#A78BFA",
  },
  {
    id: "weekly-health-report",
    icon: FileText,
    label: "Weekly Portfolio Health Report",
    tagline: "Institutional-quality briefings. Weekly.",
    description:
      "Receive an institutional-style weekly briefing that summarizes what changed, why it matters, emerging risks, improving conditions, and key portfolio observations — written by ASHA and calibrated to your specific holdings.",
    benefits: [
      "What changed in the macro environment this week",
      "Why it matters for your portfolio specifically",
      "Emerging risks and improving conditions",
      "Delivered every Sunday before markets open",
    ],
    color: "#FF6B6B",
  },
  {
    id: "custom-risk-profiles",
    icon: Sliders,
    label: "Custom Risk Profiles",
    tagline: "Intelligence calibrated to your investing style.",
    description:
      "Customize FAULTLINE around your investing goals. Choose from Long-Term Investor, Active Trader, Retirement Investor, Income Investor, Growth Investor, or Crypto Investor. The platform intelligently prioritizes the information most relevant to your style while maintaining complete market awareness.",
    benefits: [
      "Six investor profiles: Long-Term, Active, Retirement, Income, Growth, Crypto",
      "Personalized signal weighting and risk thresholds",
      "Tailored ASHA responses and briefings",
      "Switch profiles at any time without data loss",
    ],
    color: "#34D399",
  },
];

// ── Feature Card ──────────────────────────────────────────────
function FeatureCard({ feature }: { feature: typeof COMING_SOON_FEATURES[0] }) {
  const Icon = feature.icon;
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${feature.color}25`,
        boxShadow: `0 0 0 0 ${feature.color}00`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${feature.color}18`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${feature.color}45`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${feature.color}00`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${feature.color}25`;
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${feature.color}15`, border: `1px solid ${feature.color}30` }}
          >
            <Icon size={18} style={{ color: feature.color }} />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">{feature.label}</div>
            <div className="text-[11px] font-mono text-[#64748B] mt-0.5">{feature.tagline}</div>
          </div>
        </div>
        {/* Coming Soon badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Clock size={10} className="text-[#64748B]" />
          <span className="text-[9px] font-mono tracking-widest text-[#64748B]">COMING SOON</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-[#94A3B8] leading-relaxed">{feature.description}</p>

      {/* Benefits */}
      <ul className="space-y-2">
        {feature.benefits.map(b => (
          <li key={b} className="flex items-start gap-2">
            <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: feature.color }} />
            <span className="text-[12px] text-[#A8B8CC]">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function Roadmap() {
  return (
    <div className="min-h-screen" style={{ background: "#080A10" }}>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* ── Page Header ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: "#00D4FF" }} />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/70">PLATFORM ROADMAP</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            The Intelligence Platform<br />
            <span style={{ color: "#00D4FF" }}>Keeps Getting Smarter.</span>
          </h1>
          <p className="text-[15px] text-[#94A3B8] leading-relaxed max-w-2xl">
            Every FAULTLINE subscription becomes more valuable over time. We're continuously expanding the platform with powerful intelligence designed to help investors better understand markets, monitor risk, and make more informed decisions.
          </p>
        </div>

        {/* ── Founding Member Banner ── */}
        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(0,255,136,0.05) 100%)",
            border: "1px solid rgba(0,212,255,0.2)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.25)" }}>
            <CheckCircle2 size={20} style={{ color: "#00D4FF" }} />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#00D4FF]/70 mb-1">INCLUDED WITH YOUR MEMBERSHIP</div>
            <p className="text-[14px] text-white font-semibold leading-snug">
              As FAULTLINE evolves, upcoming features included within your subscription tier will become available automatically.
            </p>
            <p className="text-[12px] text-[#64748B] mt-1">
              No additional setup. No migration. No waiting for a new version. Your platform becomes more valuable over time.
            </p>
          </div>
        </div>

        {/* ── Feature Cards Grid ── */}
        <div>
          <div className="text-[10px] font-mono tracking-[0.3em] text-[#64748B] mb-6">UPCOMING CAPABILITIES</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {COMING_SOON_FEATURES.map(f => (
              <FeatureCard key={f.id} feature={f} />
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div
          className="rounded-2xl p-6 text-center space-y-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[10px] font-mono tracking-[0.3em] text-[#64748B]">CURRENTLY AVAILABLE</div>
          <p className="text-[14px] text-[#94A3B8]">
            The full intelligence platform is live today — Pressure Index, Seismograph, ASHA, Signals, Situation Room, and more.
          </p>
          <a
            href="/app/seismograph"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-mono font-bold tracking-wider transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00D4FF" }}
          >
            EXPLORE THE PLATFORM NOW
          </a>
        </div>

      </div>
    </div>
  );
}
