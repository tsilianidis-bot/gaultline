/**
 * PublicLandingPage — Reusable public SEO landing page shell.
 * Used by /signals, /crypto-signals, /situation-room, /analogs,
 * /stock-market-risk-dashboard, /crypto-market-risk-dashboard,
 * /ai-bubble-risk-tracker, /diagnostic-ai
 *
 * No login required. Crawlable. Self-referencing canonical via useSEO.
 */
import { useSEO } from "@/hooks/useSEO";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";

const PLATFORM_URL = "/app";

interface Feature {
  icon: string;
  title: string;
  desc: string;
}

interface PublicLandingPageProps {
  seo: {
    title: string;
    description: string;
    canonical: string;
  };
  badge: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  features: Feature[];
  accentColor?: string;
}

export default function PublicLandingPage({
  seo,
  badge,
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  features,
  accentColor = "#00D4FF",
}: PublicLandingPageProps) {
  useSEO(seo);

  return (
    <div className="min-h-screen bg-[#050608] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgba(5,6,8,0.95)] border-b border-[rgba(0,212,255,0.12)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
            <span className="font-mono text-sm font-bold tracking-[0.3em] text-white">FAULTLINE</span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href={getLoginUrl()}
              className="text-[11px] font-mono tracking-widest text-[#A8B8CC] hover:text-white transition-colors px-4 py-2 border border-[rgba(168,184,204,0.25)] hover:border-[rgba(168,184,204,0.55)] rounded"
            >
              MEMBER LOGIN
            </a>
            <a
              href={PLATFORM_URL}
              onClick={() => trackStartFreeClicked("public_landing")}
              className="text-[11px] font-mono tracking-widest text-[#050608] bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors px-4 py-2 rounded font-bold"
            >
              ENTER FREE
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="inline-block text-[10px] font-mono tracking-[0.3em] border px-4 py-1.5 rounded-full mb-6"
            style={{ color: accentColor, borderColor: `${accentColor}30` }}
          >
            {badge}
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            {headline.split("\\n").map((line, i) => (
              <span key={i}>
                {line}
                {i < headline.split("\\n").length - 1 && <br />}
              </span>
            ))}
          </h1>
          <p className="text-[#A8B8CC] text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={ctaHref}
              onClick={() => trackStartFreeClicked("public_landing_hero")}
              className="inline-flex items-center justify-center gap-2 text-[13px] font-mono tracking-widest text-[#050608] font-bold px-8 py-4 rounded"
              style={{ background: accentColor }}
            >
              {ctaLabel} →
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 text-[13px] font-mono tracking-widest text-[#A8B8CC] hover:text-white transition-colors px-8 py-4 rounded border border-[rgba(168,184,204,0.2)] hover:border-[rgba(168,184,204,0.4)]"
            >
              LEARN MORE
            </a>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 px-6 bg-[#0C0F16]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(0,212,255,0.2)] transition-colors"
              >
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-white font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-[#64748B] text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Move before the market does.
          </h2>
          <p className="text-[#A8B8CC] mb-8">
            Free access. No credit card required. Upgrade when you need more.
          </p>
          <a
            href={ctaHref}
            onClick={() => trackStartFreeClicked("public_landing_bottom")}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-mono tracking-widest text-[#050608] font-bold px-10 py-4 rounded"
            style={{ background: accentColor }}
          >
            START FREE →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.05)] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]" />
            <span className="font-mono text-xs font-bold tracking-[0.3em] text-white">FAULTLINE</span>
          </div>
          <div className="flex gap-6 text-[11px] font-mono tracking-widest text-[#64748B]">
            <a href="/" className="hover:text-[#00D4FF] transition-colors">HOME</a>
            <a href="/pressure-index" className="hover:text-[#00D4FF] transition-colors">PRESSURE INDEX</a>
            <a href="/blog" className="hover:text-[#00D4FF] transition-colors">BLOG</a>
            <a href="/track-record" className="hover:text-[#00D4FF] transition-colors">TRACK RECORD</a>
            <a href="/legal" className="hover:text-[#00D4FF] transition-colors">LEGAL</a>
          </div>
          <div className="text-[10px] font-mono text-[#374151]">
            © {new Date().getFullYear()} FAULTLINE. Not financial advice.
          </div>
        </div>
      </footer>
    </div>
  );
}
