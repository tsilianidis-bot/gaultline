import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Tag, ChevronRight, Rss } from "lucide-react";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function categoryColor(cat: string) {
  const map: Record<string, string> = {
    "Macro Intelligence": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "Market Analysis": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Risk Intelligence": "bg-red-500/10 text-red-400 border-red-500/20",
    "Crypto Intelligence": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Platform Updates": "bg-green-500/10 text-green-400 border-green-500/20",
  };
  return map[cat] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

export default function Blog() {
  useSEO({
    title: "Intelligence Briefings — Macro Commentary & Market Analysis",
    description:
      "FAULTLINE Intelligence Briefings: institutional macro commentary, market risk analysis, systemic pressure updates, and fault line reports from the FAULTLINE intelligence team.",
    canonical: "/blog",
  });

  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);

  const { data: posts = [], isLoading } = trpc.blog.list.useQuery({
    limit: 50,
    category: activeCategory,
  });

  const { data: categories = [] } = trpc.blog.getCategories.useQuery();

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="min-h-screen bg-[#080c18] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="font-['Orbitron'] text-lg font-bold tracking-widest text-white cursor-pointer">
              FAULT<span className="text-cyan-400">LINE</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-['IBM_Plex_Mono']">
            <Rss className="w-3.5 h-3.5 text-cyan-400" />
            INTELLIGENCE BRIEFINGS
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Page title */}
        <div className="mb-10">
          <h1 className="font-['Orbitron'] text-3xl font-bold tracking-wider text-white mb-2">
            INTELLIGENCE <span className="text-cyan-400">BRIEFINGS</span>
          </h1>
          <p className="text-slate-400 text-sm font-['IBM_Plex_Mono']">
            Macro commentary, market risk analysis, and fault line reports
          </p>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setActiveCategory(undefined)}
              className={`px-3 py-1 rounded text-xs font-['IBM_Plex_Mono'] border transition-colors ${
                !activeCategory
                  ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                  : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
              }`}
            >
              ALL
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? undefined : cat)}
                className={`px-3 py-1 rounded text-xs font-['IBM_Plex_Mono'] border transition-colors ${
                  activeCategory === cat
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="text-center py-24 text-slate-500 font-['IBM_Plex_Mono'] text-sm">
            NO BRIEFINGS PUBLISHED YET
          </div>
        )}

        {!isLoading && featured && (
          <>
            {/* Featured post */}
            <Link href={`/blog/${featured.slug}`}>
              <div className="group mb-8 p-6 rounded-lg border border-white/10 bg-white/[0.03] hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(featured.category)}`}>
                    {featured.category.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 font-['IBM_Plex_Mono']">FEATURED</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors leading-snug">
                  {featured.title}
                </h2>
                {featured.subtitle && (
                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">{featured.subtitle}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-slate-500 font-['IBM_Plex_Mono']">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(featured.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    — MIN READ
                  </span>
                  <span>{featured.author}</span>
                  <span className="ml-auto flex items-center gap-1 text-cyan-400 group-hover:gap-2 transition-all">
                    READ BRIEFING <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Rest of posts grid */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rest.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`}>
                    <div className="group p-5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all cursor-pointer h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded border font-['IBM_Plex_Mono'] ${categoryColor(post.category)}`}>
                          {post.category.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white mb-1.5 group-hover:text-cyan-400 transition-colors leading-snug">
                        {post.title}
                      </h3>
                      {post.subtitle && (
                        <p className="text-slate-500 text-xs mb-3 leading-relaxed line-clamp-2">{post.subtitle}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-['IBM_Plex_Mono'] mt-auto">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(post.publishedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          — MIN
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
