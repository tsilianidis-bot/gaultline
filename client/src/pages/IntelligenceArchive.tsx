/**
 * Intelligence Archive — /intel-archive
 *
 * Searchable, filterable archive of all Historical Intelligence Records.
 * These are daily briefings, regime updates, and dashboard readings that
 * form FAULTLINE's public transparency and track-record documentation.
 *
 * SEO: This page is indexed. Individual intel_record posts are noindex,follow.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Search, ChevronRight, Archive, Clock, Filter, X } from "lucide-react";

const REGIME_OPTIONS = [
  { value: "all", label: "All Regimes" },
  { value: "macro intelligence", label: "Macro Intelligence" },
  { value: "crypto intelligence", label: "Crypto Intelligence" },
  { value: "risk-off", label: "Risk-Off" },
  { value: "risk-on", label: "Risk-On" },
];

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function extractPressureScore(title: string): string | null {
  const m = title.match(/\b(?:at|holds at|index at|at\s+)(\d{1,3})\b/i);
  return m ? m[1] : null;
}

function extractRegimeLabel(category: string): string {
  if (category.toLowerCase().includes("crypto")) return "Crypto";
  if (category.toLowerCase().includes("macro")) return "Macro";
  return category;
}

export default function IntelligenceArchive() {
  useSEO({
    title: "Intelligence Archive | FAULTLINE — Daily Market Readings & Regime History",
    description:
      "Browse FAULTLINE's complete archive of daily macro intelligence briefings, pressure index readings, and regime updates. Transparent model history since May 2025.",
    canonical: "https://getfaultline.live/intel-archive",
  });

  const [search, setSearch] = useState("");
  const [regime, setRegime] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  const queryInput = useMemo(() => ({
    limit: LIMIT,
    offset,
    regime: regime !== "all" ? regime : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [regime, dateFrom, dateTo, offset]);

  const { data: posts, isLoading } = trpc.blog.listIntelArchive.useQuery(queryInput);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (!search.trim()) return posts;
    const q = search.toLowerCase();
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.subtitle ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    );
  }, [posts, search]);

  function clearFilters() {
    setSearch("");
    setRegime("all");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  }

  const hasFilters = search || regime !== "all" || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-border/40 bg-card/30">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 mb-4">
            <Archive className="w-6 h-6 text-primary" />
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              Intelligence Archive
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            FAULTLINE Daily Intelligence Records
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Every daily macro briefing, pressure index reading, and regime update published by FAULTLINE.
            This archive is the public record of how the model read conditions at each date —
            preserved for transparency, track-record validation, and historical research.
          </p>
          <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Updated daily
            </span>
            <span className="text-border">·</span>
            <Link href="/blog" className="hover:text-foreground transition-colors">
              ← Back to Analysis Hub
            </Link>
            <span className="text-border">·</span>
            <Link href="/track-record" className="hover:text-foreground transition-colors">
              View Track Record →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="border-b border-border/30 bg-background/60 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search records…"
                value={search}
                onChange={e => { setSearch(e.target.value); setOffset(0); }}
                className="pl-9 h-9 text-sm bg-card/50"
              />
            </div>

            {/* Regime filter */}
            <Select value={regime} onValueChange={v => { setRegime(v); setOffset(0); }}>
              <SelectTrigger className="w-[180px] h-9 text-sm bg-card/50">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Regime" />
              </SelectTrigger>
              <SelectContent>
                {REGIME_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setOffset(0); }}
                className="h-9 text-sm w-[140px] bg-card/50"
                title="From date"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setOffset(0); }}
                className="h-9 text-sm w-[140px] bg-card/50"
                title="To date"
              />
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Post list ──────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-card/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Archive className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No records match your filters.</p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3 text-xs">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              Showing {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              {hasFilters ? " matching your filters" : ""}
            </p>

            <div className="space-y-2">
              {filtered.map(post => {
                const score = extractPressureScore(post.title);
                const regimeLabel = extractRegimeLabel(post.category ?? "");
                return (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group flex items-start gap-4 p-4 rounded-lg border border-border/30 bg-card/20 hover:bg-card/50 hover:border-border/60 transition-all duration-150"
                  >
                    {/* Date column */}
                    <div className="flex-shrink-0 w-20 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-border/50 text-muted-foreground">
                          {regimeLabel}
                        </Badge>
                        {score && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-amber-500/30 text-amber-500/80">
                            PI {score}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      {post.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.subtitle}</p>
                      )}
                    </div>

                    <ChevronRight className="flex-shrink-0 w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 transition-colors" />
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {(posts?.length ?? 0) >= LIMIT && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  className="text-xs"
                >
                  ← Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {Math.floor(offset / LIMIT) + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(posts?.length ?? 0) < LIMIT}
                  onClick={() => setOffset(offset + LIMIT)}
                  className="text-xs"
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
