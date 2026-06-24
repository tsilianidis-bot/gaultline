/**
 * SEOLandingPage — Full-content SEO landing page template.
 * Used by all new SEO expansion pages.
 * Includes: hero, features, long-form content, FAQ, schema markup, internal links, CTA.
 * No login required. Crawlable. Self-referencing canonical via useSEO.
 */
import { useEffect } from "react";
import { useSEO } from "@/hooks/useSEO";
import { getLoginUrl } from "@/const";
import { trackStartFreeClicked } from "@/hooks/useAnalytics";

const PLATFORM_URL = "/app";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ContentSection {
  heading: string;
  body: string;
}

export interface InternalLink {
  label: string;
  href: string;
  desc: string;
}

export interface SEOLandingPageProps {
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
  accentColor?: string;
  features: { icon: string; title: string; desc: string }[];
  contentSections?: ContentSection[];
  faqs?: FAQItem[];
  internalLinks?: InternalLink[];
  schemaType?: "WebPage" | "Article" | "FAQPage";
  datePublished?: string;
  dateModified?: string;
}

function injectSchema(data: object) {
  const id = "seo-landing-schema";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export default function SEOLandingPage({
  seo,
  badge,
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  accentColor = "#00D4FF",
  features,
  contentSections = [],
  faqs = [],
  internalLinks = [],
  schemaType = "WebPage",
  datePublished = "2024-01-01",
  dateModified = new Date().toISOString().split("T")[0],
}: SEOLandingPageProps) {
  useSEO(seo);

  useEffect(() => {
    const BASE = "https://getfaultline.live";
    const schemas: object[] = [];

    // WebPage / Article schema
    if (schemaType === "Article") {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: seo.title,
        description: seo.description,
        url: `${BASE}${seo.canonical}`,
        datePublished,
        dateModified,
        author: { "@type": "Organization", name: "FAULTLINE", url: BASE },
        publisher: {
          "@type": "Organization",
          name: "FAULTLINE",
          url: BASE,
          logo: { "@type": "ImageObject", url: `${BASE}/favicon.ico` },
        },
      });
    } else {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: seo.title,
        description: seo.description,
        url: `${BASE}${seo.canonical}`,
        dateModified,
        publisher: { "@type": "Organization", name: "FAULTLINE", url: BASE },
      });
    }

    // FAQ schema
    if (faqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      });
    }

    injectSchema(schemas.length === 1 ? schemas[0] : schemas);
    return () => {
      const el = document.getElementById("seo-landing-schema");
      if (el) el.remove();
    };
  }, [seo, faqs, schemaType, datePublished, dateModified]);

  const headlineLines = headline.split("\n");

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
              onClick={() => trackStartFreeClicked("seo_landing")}
              className="text-[11px] font-mono tracking-widest text-[#050608] font-bold px-4 py-2 rounded"
              style={{ background: accentColor }}
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
            {headlineLines.map((line, i) => (
              <span key={i}>
                {line}
                {i < headlineLines.length - 1 && <br />}
              </span>
            ))}
          </h1>
          <p className="text-[#A8B8CC] text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={ctaHref}
              onClick={() => trackStartFreeClicked("seo_landing_hero")}
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

      {/* Long-form content sections */}
      {contentSections.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto space-y-12">
            {contentSections.map((sec, i) => (
              <div key={i}>
                <h2 className="text-2xl font-bold text-white mb-4">{sec.heading}</h2>
                <div className="text-[#A8B8CC] leading-relaxed text-sm whitespace-pre-line">
                  {sec.body}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Internal links */}
      {internalLinks.length > 0 && (
        <section className="py-12 px-6 bg-[#0C0F16]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-mono font-bold tracking-widest text-[#A8B8CC] mb-6 text-center">
              EXPLORE FAULTLINE INTELLIGENCE
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {internalLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="p-4 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(0,212,255,0.25)] transition-colors group"
                >
                  <div
                    className="text-xs font-mono font-bold tracking-widest mb-1 group-hover:text-[#00D4FF] transition-colors"
                    style={{ color: accentColor }}
                  >
                    {link.label} →
                  </div>
                  <div className="text-[#64748B] text-xs leading-relaxed">{link.desc}</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ section */}
      {faqs.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-[rgba(255,255,255,0.06)] rounded-xl p-6 bg-[rgba(255,255,255,0.02)]"
                >
                  <h3 className="text-white font-semibold text-sm mb-3">{faq.question}</h3>
                  <p className="text-[#A8B8CC] text-xs leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-20 px-6 bg-[#0C0F16]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Move before the market does.
          </h2>
          <p className="text-[#A8B8CC] mb-8">
            Free access. No credit card required. Upgrade when you need more.
          </p>
          <a
            href={ctaHref}
            onClick={() => trackStartFreeClicked("seo_landing_bottom")}
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
          <div className="flex flex-wrap gap-4 text-[11px] font-mono tracking-widest text-[#64748B] justify-center">
            <a href="/" className="hover:text-[#00D4FF] transition-colors">HOME</a>
            <a href="/pressure-index" className="hover:text-[#00D4FF] transition-colors">PRESSURE INDEX</a>
            <a href="/signals" className="hover:text-[#00D4FF] transition-colors">SIGNALS</a>
            <a href="/crypto-signals" className="hover:text-[#00D4FF] transition-colors">CRYPTO</a>
            <a href="/analysis" className="hover:text-[#00D4FF] transition-colors">ANALYSIS</a>
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
