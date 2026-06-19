import { useSEO } from "@/hooks/useSEO";

export default function NotFound() {
  useSEO({
    title: "404 — Page Not Found | FAULTLINE",
    description: "The page you're looking for doesn't exist. Return to FAULTLINE market risk intelligence.",
    canonical: "/404",
  });

  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-xl">
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00D4FF]/50 mb-4">
          ERROR 404
        </div>
        <h1 className="text-6xl font-bold text-white mb-4 font-mono">
          4<span className="text-[#00D4FF]">0</span>4
        </h1>
        <p className="text-[#A8B8CC] text-lg mb-2">
          Page not found.
        </p>
        <p className="text-[#64748B] text-sm mb-10">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 text-[12px] font-mono tracking-widest text-[#050608] font-bold px-8 py-3 rounded bg-[#00D4FF] hover:bg-[#00D4FF]/90 transition-colors"
          >
            ← RETURN HOME
          </a>
          <a
            href="/app"
            className="inline-flex items-center justify-center gap-2 text-[12px] font-mono tracking-widest text-[#A8B8CC] hover:text-white transition-colors px-8 py-3 rounded border border-[rgba(168,184,204,0.2)] hover:border-[rgba(168,184,204,0.4)]"
          >
            ENTER PLATFORM
          </a>
        </div>

        <div className="border-t border-[rgba(255,255,255,0.05)] pt-8">
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#374151] mb-4">
            POPULAR PAGES
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: "Pressure Index", href: "/pressure-index" },
              { label: "Stock Signals", href: "/signals" },
              { label: "Crypto Signals", href: "/crypto-signals" },
              { label: "Situation Room", href: "/situation-room" },
              { label: "Market Analogs", href: "/analogs" },
              { label: "AI Bubble Tracker", href: "/ai-bubble-risk-tracker" },
              { label: "Blog", href: "/blog" },
              { label: "Track Record", href: "/track-record" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[11px] font-mono tracking-widest text-[#64748B] hover:text-[#00D4FF] transition-colors px-3 py-1.5 border border-[rgba(255,255,255,0.05)] hover:border-[rgba(0,212,255,0.2)] rounded"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
