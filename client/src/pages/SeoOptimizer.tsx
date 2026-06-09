/**
 * FAULTLINE — SEO Optimizer
 * ============================================================
 * Features:
 *  - URL analysis with overall score + grade
 *  - Categorized SEO checks (pass/warning/fail)
 *  - Keyword density table with prominence scoring
 *  - Readability score (Flesch-Kincaid)
 *  - SERP preview (desktop + mobile)
 *  - Technical SEO audit
 *  - AI-powered meta title/description/keyword suggestions
 *  - Meta tag generator (standalone tool)
 *  - Copy-to-clipboard for all generated content
 * ============================================================
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, Globe, CheckCircle2, XCircle, AlertTriangle, Info,
  Copy, RefreshCw, Sparkles, BarChart2, Link2, FileText,
  Tag, Eye, Smartphone, Monitor, ChevronDown, ChevronUp,
  TrendingUp, Shield, Zap, BookOpen, ExternalLink, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types (mirrored from server) ──────────────────────────────
type SeoCheck = {
  id: string;
  category: "meta" | "content" | "technical" | "links" | "performance";
  label: string;
  status: "pass" | "warning" | "fail" | "info";
  score: number;
  maxScore: number;
  detail: string;
  recommendation?: string;
};

type SeoAnalysisResult = {
  url: string;
  fetchedAt: number;
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: SeoCheck[];
  meta: {
    title: string | null;
    titleLength: number;
    description: string | null;
    descriptionLength: number;
    keywords: string | null;
    canonical: string | null;
    robots: string | null;
    viewport: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    schemaTypes: string[];
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  keywords: { word: string; count: number; density: number; prominence: number }[];
  readability: { score: number; grade: string; avgWordsPerSentence: number; avgSyllablesPerWord: number; sentenceCount: number };
  links: { internal: number; external: number; broken: number; nofollow: number; totalLinks: number };
  technical: {
    hasCanonical: boolean; hasRobots: boolean; hasViewport: boolean; hasOgTags: boolean;
    hasTwitterCard: boolean; hasSchema: boolean; hasHttps: boolean; hasAltTags: boolean;
    imagesWithoutAlt: number; totalImages: number;
  };
  serpPreview: { title: string; url: string; description: string; breadcrumb: string };
  aiSuggestions: {
    metaTitle: string; metaDescription: string; focusKeywords: string[];
    contentGaps: string[]; improvements: string[]; estimatedDifficulty: "Low" | "Medium" | "High";
  };
  wordCount: number;
  pageTitle: string;
};

// ── Helpers ───────────────────────────────────────────────────

function gradeColor(grade: string) {
  if (grade === "A") return "text-emerald-400";
  if (grade === "B") return "text-cyan-400";
  if (grade === "C") return "text-yellow-400";
  if (grade === "D") return "text-orange-400";
  return "text-red-400";
}

function gradeBg(grade: string) {
  if (grade === "A") return "border-emerald-500/40 bg-emerald-500/10";
  if (grade === "B") return "border-cyan-500/40 bg-cyan-500/10";
  if (grade === "C") return "border-yellow-500/40 bg-yellow-500/10";
  if (grade === "D") return "border-orange-500/40 bg-orange-500/10";
  return "border-red-500/40 bg-red-500/10";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-cyan-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function statusIcon(status: SeoCheck["status"]) {
  if (status === "pass") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />;
  if (status === "fail") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
}

function statusBadge(status: SeoCheck["status"]) {
  if (status === "pass") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">PASS</Badge>;
  if (status === "warning") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">WARN</Badge>;
  if (status === "fail") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">FAIL</Badge>;
  return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">INFO</Badge>;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied to clipboard`));
}

function difficultyColor(d: string) {
  if (d === "Low") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (d === "Medium") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

// ── Score Ring ────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const colorClass = gradeColor(grade);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" className="absolute inset-0 -rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={grade === "A" ? "#34d399" : grade === "B" ? "#22d3ee" : grade === "C" ? "#facc15" : grade === "D" ? "#fb923c" : "#f87171"}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.23,1,0.32,1)" }}
        />
      </svg>
      <div className="relative text-center">
        <div className={`text-4xl font-black font-mono ${colorClass}`}>{score}</div>
        <div className={`text-xs font-bold tracking-widest ${colorClass}`}>GRADE {grade}</div>
      </div>
    </div>
  );
}

// ── Check Card ────────────────────────────────────────────────

function CheckCard({ check }: { check: SeoCheck }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all duration-200 ${
        check.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5" :
        check.status === "warning" ? "border-yellow-500/20 bg-yellow-500/5" :
        check.status === "fail" ? "border-red-500/20 bg-red-500/5" :
        "border-cyan-500/20 bg-cyan-500/5"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {statusIcon(check.status)}
        <span className="flex-1 text-sm font-medium text-white/90">{check.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 font-mono">{check.score}/{check.maxScore}</span>
          {statusBadge(check.status)}
          {open ? <ChevronUp className="w-3 h-3 text-white/40" /> : <ChevronDown className="w-3 h-3 text-white/40" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-white/60">{check.detail}</p>
          {check.recommendation && (
            <div className="flex items-start gap-2 bg-white/5 rounded p-2">
              <Zap className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300">{check.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SERP Preview ──────────────────────────────────────────────

function SerpPreview({ serp, isMobile }: { serp: SeoAnalysisResult["serpPreview"]; isMobile: boolean }) {
  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 p-4 ${isMobile ? "max-w-sm" : ""}`}>
      <div className="text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">
        {isMobile ? "Mobile SERP" : "Desktop SERP"} Preview
      </div>
      <div className="space-y-1">
        <div className="text-xs text-green-400/80 truncate">{serp.breadcrumb}</div>
        <div className="text-base font-medium text-blue-400 hover:underline cursor-pointer leading-tight line-clamp-2">
          {serp.title}
        </div>
        <div className="text-xs text-white/60 leading-relaxed line-clamp-3">
          {serp.description}
        </div>
      </div>
    </div>
  );
}

// ── Meta Generator Panel ──────────────────────────────────────

function MetaGenerator() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pageType, setPageType] = useState<"blog" | "landing" | "product" | "category" | "homepage" | "about" | "service">("blog");
  const [result, setResult] = useState<{ titles: string[]; descriptions: string[]; keywords: string[] } | null>(null);

  const generateMeta = trpc.seo.generateMeta.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Meta tags generated");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Topic / Page Subject</label>
          <Input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Macro risk intelligence platform"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Target Keyword</label>
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="e.g. market risk analysis"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Page Type</label>
          <Select value={pageType} onValueChange={(v) => setPageType(v as typeof pageType)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0f1a] border-white/10">
              {["blog", "landing", "product", "category", "homepage", "about", "service"].map(t => (
                <SelectItem key={t} value={t} className="text-white/80 capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => generateMeta.mutate({ topic, targetKeyword: keyword, pageType })}
        disabled={!topic.trim() || !keyword.trim() || generateMeta.isPending}
        className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 h-9"
      >
        {generateMeta.isPending ? (
          <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
        ) : (
          <><Sparkles className="w-3.5 h-3.5 mr-2" />Generate Meta Tags</>
        )}
      </Button>

      {result && (
        <div className="space-y-4 pt-2">
          {/* Titles */}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Meta Title Options</div>
            <div className="space-y-2">
              {result.titles.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm text-white/90">{t}</span>
                  <span className="text-xs text-white/30 font-mono">{t.length}c</span>
                  <button onClick={() => copyToClipboard(t, "Title")} className="text-white/30 hover:text-cyan-400 transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Descriptions */}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Meta Description Options</div>
            <div className="space-y-2">
              {result.descriptions.map((d, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm text-white/80 leading-relaxed">{d}</span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-white/30 font-mono">{d.length}c</span>
                    <button onClick={() => copyToClipboard(d, "Description")} className="text-white/30 hover:text-cyan-400 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Suggested Keywords</div>
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((k, i) => (
                <button
                  key={i}
                  onClick={() => copyToClipboard(k, "Keyword")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 hover:border-cyan-500/40 hover:text-cyan-400 transition-all"
                >
                  <Hash className="w-3 h-3" />
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function SeoOptimizer() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SeoAnalysisResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [serpView, setSerpView] = useState<"desktop" | "mobile">("desktop");

  const analyzeUrl = trpc.seo.analyzeUrl.useMutation({
    onSuccess: (data) => {
      setResult(data as SeoAnalysisResult);
      setActiveCategory("all");
      toast.success("SEO analysis complete");
    },
    onError: (err) => toast.error(err.message || "Analysis failed"),
  });

  const handleAnalyze = useCallback(() => {
    let target = url.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "https://" + target;
      setUrl(target);
    }
    analyzeUrl.mutate({ url: target });
  }, [url, analyzeUrl]);

  const categories = ["all", "meta", "content", "technical", "links"];
  const filteredChecks = result?.checks.filter(c =>
    activeCategory === "all" || c.category === activeCategory
  ) ?? [];

  const checkCounts = result ? {
    pass: result.checks.filter(c => c.status === "pass").length,
    warning: result.checks.filter(c => c.status === "warning").length,
    fail: result.checks.filter(c => c.status === "fail").length,
  } : null;

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#030712]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SEO Optimizer</h1>
              <p className="text-xs text-white/40">Analyze any URL for on-page SEO, keywords, readability, and AI-powered improvements</p>
            </div>
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder="https://example.com/page-to-analyze"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm focus:border-cyan-500/50"
              />
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={!url.trim() || analyzeUrl.isPending}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-10 px-6 shrink-0"
            >
              {analyzeUrl.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing…</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Analyze</>
              )}
            </Button>
          </div>

          {/* Quick examples */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-white/30">Try:</span>
            {["https://getfaultline.live", "https://getfaultline.live/blog"].map(ex => (
              <button
                key={ex}
                onClick={() => setUrl(ex)}
                className="text-xs text-cyan-500/60 hover:text-cyan-400 transition-colors"
              >
                {ex.replace("https://", "")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Loading state */}
        {analyzeUrl.isPending && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
              <Globe className="absolute inset-0 m-auto w-6 h-6 text-cyan-400/60" />
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-white/70">Fetching and analyzing page…</div>
              <div className="text-xs text-white/40 mt-1">Checking meta tags, content, keywords, and technical SEO</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!analyzeUrl.isPending && !result && (
          <div className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Meta Generator — available even without URL analysis */}
              <div className="md:col-span-2 border border-white/10 rounded-xl bg-white/[0.02] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">AI Meta Tag Generator</h2>
                  <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">No URL needed</Badge>
                </div>
                <MetaGenerator />
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: BarChart2, label: "SEO Score", desc: "0–100 score with letter grade", color: "text-cyan-400" },
                { icon: Tag, label: "Keyword Analysis", desc: "Density, prominence, top 20 terms", color: "text-emerald-400" },
                { icon: Eye, label: "SERP Preview", desc: "See how Google displays your page", color: "text-purple-400" },
                { icon: Sparkles, label: "AI Suggestions", desc: "LLM-generated meta & improvements", color: "text-yellow-400" },
                { icon: Shield, label: "Technical Audit", desc: "Canonical, OG, schema, HTTPS", color: "text-red-400" },
                { icon: Link2, label: "Link Analysis", desc: "Internal, external, nofollow counts", color: "text-blue-400" },
                { icon: BookOpen, label: "Readability", desc: "Flesch-Kincaid reading ease score", color: "text-orange-400" },
                { icon: FileText, label: "Heading Structure", desc: "H1–H6 hierarchy audit", color: "text-pink-400" },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className="border border-white/8 rounded-lg p-4 bg-white/[0.02]">
                  <Icon className={`w-5 h-5 ${color} mb-2`} />
                  <div className="text-sm font-medium text-white/80">{label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !analyzeUrl.isPending && (
          <div className="space-y-6">
            {/* Score overview */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Main score */}
              <div className={`border rounded-xl p-6 flex flex-col items-center justify-center gap-3 ${gradeBg(result.grade)}`}>
                <ScoreRing score={result.overallScore} grade={result.grade} />
                <div className="text-center">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Overall SEO Score</div>
                  <div className="text-xs text-white/30 mt-1 truncate max-w-[160px]">
                    {result.url.replace(/^https?:\/\//, "").substring(0, 40)}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                {checkCounts && (
                  <>
                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-white/50 uppercase tracking-wider">Passed</span>
                      </div>
                      <div className="text-3xl font-black text-emerald-400">{checkCounts.pass}</div>
                      <div className="text-xs text-white/30">checks</div>
                    </div>
                    <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-white/50 uppercase tracking-wider">Warnings</span>
                      </div>
                      <div className="text-3xl font-black text-yellow-400">{checkCounts.warning}</div>
                      <div className="text-xs text-white/30">checks</div>
                    </div>
                    <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-white/50 uppercase tracking-wider">Failed</span>
                      </div>
                      <div className="text-3xl font-black text-red-400">{checkCounts.fail}</div>
                      <div className="text-xs text-white/30">checks</div>
                    </div>
                  </>
                )}
                <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Word Count</div>
                  <div className={`text-2xl font-black ${scoreColor(Math.min(100, (result.wordCount / 1000) * 100))}`}>
                    {result.wordCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-white/30">words</div>
                </div>
                <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Readability</div>
                  <div className={`text-2xl font-black ${scoreColor(result.readability.score)}`}>
                    {result.readability.score}
                  </div>
                  <div className="text-xs text-white/30">{result.readability.grade}</div>
                </div>
                <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Total Links</div>
                  <div className="text-2xl font-black text-white/80">{result.links.totalLinks}</div>
                  <div className="text-xs text-white/30">{result.links.internal} int · {result.links.external} ext</div>
                </div>
              </div>
            </div>

            {/* Main tabs */}
            <Tabs defaultValue="checks" className="space-y-4">
              <TabsList className="bg-white/5 border border-white/10 h-10 p-1">
                <TabsTrigger value="checks" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Shield className="w-3.5 h-3.5 mr-1.5" />SEO Checks
                </TabsTrigger>
                <TabsTrigger value="keywords" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Tag className="w-3.5 h-3.5 mr-1.5" />Keywords
                </TabsTrigger>
                <TabsTrigger value="serp" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Eye className="w-3.5 h-3.5 mr-1.5" />SERP Preview
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />AI Suggestions
                </TabsTrigger>
                <TabsTrigger value="technical" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />Technical
                </TabsTrigger>
                <TabsTrigger value="meta-gen" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Meta Generator
                </TabsTrigger>
              </TabsList>

              {/* SEO Checks Tab */}
              <TabsContent value="checks" className="space-y-4">
                {/* Category filter */}
                <div className="flex gap-2 flex-wrap">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        activeCategory === cat
                          ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                          : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      {cat !== "all" && (
                        <span className="ml-1.5 text-white/30">
                          ({result.checks.filter(c => c.category === cat).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {filteredChecks.map(check => (
                    <CheckCard key={check.id} check={check} />
                  ))}
                </div>
              </TabsContent>

              {/* Keywords Tab */}
              <TabsContent value="keywords" className="space-y-4">
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider">
                    <div className="col-span-4">Keyword</div>
                    <div className="col-span-2 text-center">Count</div>
                    <div className="col-span-3 text-center">Density</div>
                    <div className="col-span-3 text-center">Prominence</div>
                  </div>
                  {result.keywords.length === 0 ? (
                    <div className="px-4 py-8 text-center text-white/30 text-sm">No significant keywords found</div>
                  ) : (
                    result.keywords.map((kw, i) => (
                      <div key={kw.word} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-white/5 last:border-0 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                        <div className="col-span-4 flex items-center gap-2">
                          <span className="text-xs text-white/20 font-mono w-4">{i + 1}</span>
                          <span className="text-sm text-white/80 font-medium">{kw.word}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-mono text-white/60">{kw.count}</span>
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(100, kw.density * 20)} className="h-1.5 flex-1" />
                            <span className="text-xs font-mono text-white/40 w-10 text-right">{kw.density.toFixed(2)}%</span>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <Progress value={kw.prominence} className="h-1.5 flex-1" />
                            <span className={`text-xs font-mono w-8 text-right ${kw.prominence >= 80 ? "text-emerald-400" : kw.prominence >= 60 ? "text-cyan-400" : "text-white/40"}`}>
                              {kw.prominence}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Headings breakdown */}
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Heading Structure</div>
                  <div className="space-y-2">
                    {(["h1", "h2", "h3", "h4"] as const).map(level => {
                      const items = result.headings[level];
                      if (items.length === 0) return null;
                      return (
                        <div key={level}>
                          <div className="text-xs text-cyan-400/70 font-mono uppercase mb-1">{level.toUpperCase()} ({items.length})</div>
                          <div className="space-y-1">
                            {items.slice(0, 5).map((h, i) => (
                              <div key={i} className="text-xs text-white/60 bg-white/5 rounded px-2 py-1 truncate">{h}</div>
                            ))}
                            {items.length > 5 && <div className="text-xs text-white/30">+{items.length - 5} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* SERP Preview Tab */}
              <TabsContent value="serp" className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSerpView("desktop")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs transition-all ${serpView === "desktop" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-white/50"}`}
                  >
                    <Monitor className="w-3.5 h-3.5" />Desktop
                  </button>
                  <button
                    onClick={() => setSerpView("mobile")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs transition-all ${serpView === "mobile" ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-white/50"}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />Mobile
                  </button>
                </div>

                <SerpPreview serp={result.serpPreview} isMobile={serpView === "mobile"} />

                {/* Meta details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Current Meta Title</div>
                    <div className="text-sm text-white/80">{result.meta.title || <span className="text-red-400/70 italic">Missing</span>}</div>
                    <div className="flex items-center gap-2">
                      <Progress value={result.meta.titleLength > 0 ? Math.min(100, (result.meta.titleLength / 60) * 100) : 0} className="h-1.5 flex-1" />
                      <span className={`text-xs font-mono ${result.meta.titleLength >= 50 && result.meta.titleLength <= 60 ? "text-emerald-400" : "text-yellow-400"}`}>
                        {result.meta.titleLength}/60
                      </span>
                    </div>
                    {result.meta.title && (
                      <button onClick={() => copyToClipboard(result.meta.title!, "Title")} className="flex items-center gap-1 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    )}
                  </div>
                  <div className="border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Current Meta Description</div>
                    <div className="text-sm text-white/80 leading-relaxed">{result.meta.description || <span className="text-red-400/70 italic">Missing</span>}</div>
                    <div className="flex items-center gap-2">
                      <Progress value={result.meta.descriptionLength > 0 ? Math.min(100, (result.meta.descriptionLength / 160) * 100) : 0} className="h-1.5 flex-1" />
                      <span className={`text-xs font-mono ${result.meta.descriptionLength >= 120 && result.meta.descriptionLength <= 160 ? "text-emerald-400" : "text-yellow-400"}`}>
                        {result.meta.descriptionLength}/160
                      </span>
                    </div>
                    {result.meta.description && (
                      <button onClick={() => copyToClipboard(result.meta.description!, "Description")} className="flex items-center gap-1 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* AI Suggestions Tab */}
              <TabsContent value="ai" className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white/80">AI-Powered Recommendations</span>
                  <Badge className={`border text-[10px] ${difficultyColor(result.aiSuggestions.estimatedDifficulty)}`}>
                    {result.aiSuggestions.estimatedDifficulty} Difficulty
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Optimized title */}
                  <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-cyan-400/70 uppercase tracking-wider">Optimized Meta Title</div>
                      <button onClick={() => copyToClipboard(result.aiSuggestions.metaTitle, "Optimized title")} className="text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-sm text-white/90 font-medium">{result.aiSuggestions.metaTitle}</div>
                    <div className="text-xs text-white/30 font-mono">{result.aiSuggestions.metaTitle.length} characters</div>
                  </div>

                  {/* Optimized description */}
                  <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-cyan-400/70 uppercase tracking-wider">Optimized Meta Description</div>
                      <button onClick={() => copyToClipboard(result.aiSuggestions.metaDescription, "Optimized description")} className="text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-sm text-white/80 leading-relaxed">{result.aiSuggestions.metaDescription}</div>
                    <div className="text-xs text-white/30 font-mono">{result.aiSuggestions.metaDescription.length} characters</div>
                  </div>
                </div>

                {/* Focus keywords */}
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Recommended Focus Keywords</div>
                  <div className="flex flex-wrap gap-2">
                    {result.aiSuggestions.focusKeywords.map((kw, i) => (
                      <button
                        key={i}
                        onClick={() => copyToClipboard(kw, "Keyword")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        <Hash className="w-3 h-3" />{kw}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Content gaps */}
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Content Gaps</div>
                    <div className="space-y-2">
                      {result.aiSuggestions.contentGaps.map((gap, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] text-orange-400 font-bold">{i + 1}</span>
                          </div>
                          <span className="text-sm text-white/70">{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Improvements */}
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Priority Improvements</div>
                    <div className="space-y-2">
                      {result.aiSuggestions.improvements.map((imp, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="text-sm text-white/70">{imp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Technical Tab */}
              <TabsContent value="technical" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "HTTPS", value: result.technical.hasHttps, icon: Shield },
                    { label: "Canonical", value: result.technical.hasCanonical, icon: Link2 },
                    { label: "Viewport", value: result.technical.hasViewport, icon: Smartphone },
                    { label: "Open Graph", value: result.technical.hasOgTags, icon: Globe },
                    { label: "Twitter Card", value: result.technical.hasTwitterCard, icon: ExternalLink },
                    { label: "Structured Data", value: result.technical.hasSchema, icon: FileText },
                    { label: "Robots Meta", value: result.technical.hasRobots, icon: Shield },
                    { label: "All Images Alt", value: result.technical.hasAltTags, icon: Eye },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className={`border rounded-xl p-4 ${value ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${value ? "text-emerald-400" : "text-red-400"}`} />
                        {value ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" /> : <XCircle className="w-3.5 h-3.5 text-red-400 ml-auto" />}
                      </div>
                      <div className="text-xs text-white/70 font-medium">{label}</div>
                      <div className={`text-xs mt-0.5 ${value ? "text-emerald-400/70" : "text-red-400/70"}`}>{value ? "Present" : "Missing"}</div>
                    </div>
                  ))}
                </div>

                {/* Schema types */}
                {result.meta.schemaTypes.length > 0 && (
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Detected Schema Types</div>
                    <div className="flex flex-wrap gap-2">
                      {result.meta.schemaTypes.map((t, i) => (
                        <Badge key={i} className="bg-purple-500/10 text-purple-400 border-purple-500/20">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Images */}
                {result.technical.totalImages > 0 && (
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Image Audit</div>
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-2xl font-black text-white/80">{result.technical.totalImages}</div>
                        <div className="text-xs text-white/30">total images</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-black ${result.technical.imagesWithoutAlt > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {result.technical.imagesWithoutAlt}
                        </div>
                        <div className="text-xs text-white/30">missing alt text</div>
                      </div>
                      <div className="flex-1">
                        <Progress
                          value={result.technical.totalImages > 0 ? ((result.technical.totalImages - result.technical.imagesWithoutAlt) / result.technical.totalImages) * 100 : 100}
                          className="h-2"
                        />
                        <div className="text-xs text-white/30 mt-1">alt text coverage</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Canonical & robots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.meta.canonical && (
                    <div className="border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Canonical URL</div>
                      <div className="text-xs text-cyan-400/80 break-all">{result.meta.canonical}</div>
                    </div>
                  )}
                  {result.meta.robots && (
                    <div className="border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Robots Meta</div>
                      <div className="text-xs text-white/70 font-mono">{result.meta.robots}</div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Meta Generator Tab */}
              <TabsContent value="meta-gen" className="space-y-4">
                <div className="border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">AI Meta Tag Generator</h2>
                  </div>
                  <MetaGenerator />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
