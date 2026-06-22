/**
 * Analysis — /analysis
 *
 * Evergreen SEO hub: all 26 evergreen articles organised by topic cluster.
 * This is the primary indexed content destination for FAULTLINE's macro
 * research, designed for organic search discovery and internal linking.
 *
 * SEO: canonical https://getfaultline.live/analysis, Article JSON-LD
 * Robots: index, follow (default)
 */
import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, ChevronRight, Clock, Eye, Archive,
  TrendingUp, Zap, BarChart2, Globe, Cpu, RefreshCw,
} from "lucide-react";

// ── Topic cluster definitions ────────────────────────────────────────────────
const CLUSTERS = [
  { id: "all",     label: "All Analysis",         icon: BookOpen },
  { id: "macro",   label: "Macro & Fed Policy",   icon: Globe },
  { id: "market",  label: "Market Cycles",        icon: TrendingUp },
  { id: "risk",    label: "Risk & Systemic",      icon: Zap },
  { id: "crypto",  label: "Crypto Intelligence",  icon: BarChart2 },
  { id: "ai",      label: "AI Bubble",            icon: Cpu },
  { id: "platform",label: "Platform & Method",   icon: RefreshCw },
] as const;

type ClusterId = typeof CLUSTERS[number]["id"];

/** Map a post's category to a cluster id */
function clusterOf(category: string): ClusterId {
  const c = category.toLowerCase();
  if (c.includes("crypto"))   return "crypto";
  if (c.includes("macro"))    return "macro";
  if (c.includes("market"))   return "market";
  if (c.includes("risk"))     return "risk";
  if (c.includes("platform")) return "platform";
  // Keyword-based fallback for evergreen articles
  return "macro";
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    "Macro Intelligence":  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "Market Analysis":     "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Risk Intelligence":   "bg-red-500/10 text-red-400 border-red-500/20",
    "Crypto Intelligence": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Platform Updates":    "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[cat] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function Analysis() {
  useSEO({
    title: "Macro Analysis & Market Research | FAULTLINE",
    description:
      "In-depth evergreen research on macro cycles, Fed policy, systemic risk, AI bubble dynamics, crypto intelligence, and market regime analysis — powered by the FAULTLINE Pressure Index™.",
    canonical: "/analysis",
  });

  // Inject CollectionPage + BreadcrumbList JSON-LD
  useEffect(() => {
    const id = "faultline-analysis-ld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "FAULTLINE Macro Analysis & Research",
        "description":
          "In-depth evergreen research on macro cycles, Fed policy, systemic risk, AI bubble dynamics, crypto intelligence, and market regime analysis.",
        "url": "https://getfaultline.live/analysis",
        "publisher": {
          "@type": "Organization",
          "name": "FAULTLINE",
          "url": "https://getfaultline.live",
          "logo": {
            "@type": "ImageObject",
            "url": "https://getfaultline.live/favicon-32x32.png",
          },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://getfaultline.live/" },
          { "@type": "ListItem", "position": 2, "name": "Analysis", "item": "https://getfaultline.live/analysis" },
        ],
      },
    ]);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  const [activeCluster, setActiveCluster] = useState<ClusterId>("all");

  const { data: posts = [], isLoading } = trpc.blog.listEvergreen.useQuery({ limit: 50 });

  const filtered = useMemo(() => {
    if (activeCluster === "all") return posts;
    return posts.filter(p => {
      const base = clusterOf(p.category ?? "");
      if (base === activeCluster) return true;
      // AI cluster: match by title keywords
      if (activeCluster === "ai") {
        const t = (p.title + " " + (p.subtitle ?? "")).toLowerCase();
        return t.includes("ai") || t.includes("artificial intelligence") ||
               t.includes("bubble") || t.includes("nvidia") || t.includes("tech bubble");
      }
      return false;
    });
  }, [posts, activeCluster]);

  // Featured post = first in filtered list
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="min-h-screen bg-[#080c18] text-white">
      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="font-['Orbitron'] text-lg font-bold tracking-widest text-white cursor-pointer">
              FAULT<span className="text-cyan-400">LINE</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-['IBM_Plex_Mono']">
            <Link href="/blog">
              <span className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">
                BRIEFINGS
              </span>
            </Link>
            <Link href="/intel-archive">
              <span className="flex items-center gap-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer">
                <Archive className="w-3 h-3" /> INTEL ARCHIVE
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-gradient-to-b from-[#0a0e1a] to-[#080c18]">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-cyan-400/60 uppercase">
              Analysis Hub
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4 leading-tight">
            Macro Analysis & Market Research
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
            In-depth evergreen research on macro cycles, Fed policy, systemic risk, AI bubble dynamics,
            crypto intelligence, and market regime analysis — built on the same methodology that powers
            the <strong className="text-slate-300">FAULTLINE Pressure Index™</strong>.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500 font-['IBM_Plex_Mono']">
            <span>{posts.length} articles published</span>
            <span className="text-white/10">·</span>
            <Link href="/intel-archive">
              <span className="hover:text-amber-400 transition-colors cursor-pointer">
                Daily Intelligence Archive →
              </span>
            </Link>
            <span className="text-white/10">·</span>
            <a href="/app" className="hover:text-cyan-400 transition-colors">
              Live Platform →
            </a>
          </div>
        </div>
      </div>

      {/* ── Topic cluster filter ────────────────────────────────────── */}
      <div className="border-b border-white/5 bg-[#080c18]/90 backdrop-blur-sm sticky top-[57px] z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-none">
            {CLUSTERS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveCluster(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-['IBM_Plex_Mono'] whitespace-nowrap transition-all border ${
                  activeCluster === id
                    ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                    : "bg-transparent text-slate-500 border-transparent hover:text-slate-300 hover:border-white/10"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500 font-['IBM_Plex_Mono'] text-sm">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
            No articles in this cluster yet.
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <>
            {/* Featured article */}
            {featured && (
              <Link href={`/blog/${featured.slug}`}>
                <div className="group mb-8 p-6 md:p-8 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] to-transparent hover:border-cyan-500/40 hover:bg-cyan-500/[0.06] transition-all cursor-pointer">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(featured.category)}`}>
                      {featured.category?.toUpperCase()}
                    </span>
                    <Badge className="text-[10px] px-1.5 py-0 font-mono bg-cyan-500/10 text-cyan-400 border-cyan-500/20 border">
                      FEATURED
                    </Badge>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors leading-snug mb-3">
                    {featured.title}
                  </h2>
                  {(featured as any).metaDescription && (
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-3xl line-clamp-3">
                      {(featured as any).metaDescription}
                    </p>
                  )}
                  {!((featured as any).metaDescription) && featured.subtitle && (
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-3xl line-clamp-3">
                      {featured.subtitle}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-['IBM_Plex_Mono']">
                    <span>{formatDate(featured.publishedAt)}</span>
                    {(featured as any).readTimeMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(featured as any).readTimeMinutes} MIN READ
                      </span>
                    )}
                    {((featured as any).viewCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {((featured as any).viewCount ?? 0).toLocaleString()}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-cyan-400 group-hover:gap-2 transition-all">
                      READ FULL ANALYSIS <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {/* Article grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map(post => (
                  <Link key={post.id} href={`/blog/${post.slug}`}>
                    <div className="group h-full p-5 rounded-lg border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all cursor-pointer flex flex-col">
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span className={`text-[10px] px-1.5 py-0 rounded border font-['IBM_Plex_Mono'] ${categoryColor(post.category)}`}>
                          {post.category?.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors leading-snug mb-2 flex-1 line-clamp-3">
                        {post.title}
                      </h3>
                      {(post as any).metaDescription && (
                        <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                          {(post as any).metaDescription}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-['IBM_Plex_Mono'] mt-auto pt-3 border-t border-white/5">
                        <span>{formatDate(post.publishedAt)}</span>
                        <div className="flex items-center gap-3">
                          {(post as any).readTimeMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {(post as any).readTimeMinutes}m
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-cyan-400/50 group-hover:text-cyan-400 transition-colors">
                            READ <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Footer CTA ─────────────────────────────────────────── */}
        <div className="mt-16 pt-10 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Intel Archive CTA */}
            <div className="p-6 rounded-lg border border-amber-500/15 bg-amber-500/[0.03]">
              <div className="flex items-center gap-2 mb-3">
                <Archive className="w-4 h-4 text-amber-400/70" />
                <span className="text-[10px] font-mono tracking-widest text-amber-400/60 uppercase">
                  Intelligence Archive
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Daily Macro Briefings & Regime History
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Browse FAULTLINE's complete archive of daily intelligence records —
                every pressure index reading, regime update, and macro briefing since May 2025.
              </p>
              <Link href="/intel-archive">
                <span className="inline-flex items-center gap-2 text-xs text-amber-400 font-['IBM_Plex_Mono'] hover:underline cursor-pointer">
                  BROWSE ARCHIVE <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>

            {/* Platform CTA */}
            <div className="p-6 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.03]">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-cyan-400/70" />
                <span className="text-[10px] font-mono tracking-widest text-cyan-400/60 uppercase">
                  Live Platform
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Real-Time Market Risk Intelligence
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                The FAULTLINE Pressure Index™ monitors systemic stress, liquidity conditions,
                and macro regime shifts in real time — so you position before the move, not after.
              </p>
              <a href="/app">
                <span className="inline-flex items-center gap-2 text-xs text-cyan-400 font-['IBM_Plex_Mono'] hover:underline cursor-pointer">
                  ACCESS PLATFORM <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
