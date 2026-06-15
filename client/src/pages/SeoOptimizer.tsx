/**
 * FAULTLINE — SEO Optimizer (Simplified)
 * One-click flow: Enter URL → Analyze → Fix Everything
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search, Globe, CheckCircle2, XCircle, AlertTriangle,
  Copy, RefreshCw, Sparkles, Zap, Shield, Wrench,
  ChevronDown, ChevronUp, Code2, ArrowRight, CheckCheck,
  Flame, Tag, Hash, Eye, Monitor, Smartphone, Link2,
  FileText, BookOpen, BarChart2, TrendingUp, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";

// ── Types ─────────────────────────────────────────────────────

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
    title: string | null; titleLength: number;
    description: string | null; descriptionLength: number;
    keywords: string | null; canonical: string | null;
    robots: string | null; viewport: string | null;
    ogTitle: string | null; ogDescription: string | null;
    ogImage: string | null; twitterCard: string | null;
    twitterTitle: string | null; twitterDescription: string | null;
    schemaTypes: string[];
  };
  headings: { h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[] };
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

type AutoFix = {
  checkId: string;
  label: string;
  category: "meta" | "content" | "technical" | "links" | "performance";
  severity: "critical" | "important" | "minor";
  problem: string;
  solution: string;
  codeSnippet?: string;
  copyable: boolean;
};

type HtmlSnippet = {
  label: string;
  description: string;
  code: string;
  placement: "head" | "body" | "both";
};

type AutoFixResult = {
  summary: string;
  fixes: AutoFix[];
  htmlSnippets: HtmlSnippet[];
  estimatedImpact: "High" | "Medium" | "Low";
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

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

// ── Score Ring ────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
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
        <div className={`text-4xl font-black font-mono ${gradeColor(grade)}`}>{score}</div>
        <div className={`text-xs font-bold tracking-widest ${gradeColor(grade)}`}>GRADE {grade}</div>
      </div>
    </div>
  );
}

// ── Fix Card ──────────────────────────────────────────────────

function FixCard({ fix, index, expanded, onToggle }: {
  fix: AutoFix; index: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      fix.severity === "critical" ? "border-red-500/25 bg-red-500/5" :
      fix.severity === "important" ? "border-yellow-500/25 bg-yellow-500/5" :
      "border-white/10 bg-white/[0.02]"
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
          fix.severity === "critical" ? "bg-red-500/20 text-red-400" :
          fix.severity === "important" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-white/10 text-white/50"
        }`}>{index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{fix.label}</div>
          <div className="text-xs text-white/40 truncate">{fix.problem}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-[10px] border ${
            fix.severity === "critical" ? "bg-red-500/10 text-red-400 border-red-500/20" :
            fix.severity === "important" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
            "bg-white/5 text-white/40 border-white/10"
          }`}>{fix.severity}</Badge>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-sm text-white/70">{fix.solution}</p>
          </div>
          {fix.codeSnippet && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-cyan-400/70" />
                  <span className="text-xs text-white/40 uppercase tracking-wider">Code Fix</span>
                </div>
                <button onClick={() => copyToClipboard(fix.codeSnippet!, "Code fix")}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                  <Copy className="w-3 h-3" />Copy
                </button>
              </div>
              <pre className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-emerald-300/90 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{fix.codeSnippet}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Meta Generator ────────────────────────────────────────────

function MetaGenerator() {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [pageType, setPageType] = useState<"blog" | "landing" | "product" | "category" | "homepage" | "about" | "service">("landing");
  const [result, setResult] = useState<{ titles: string[]; descriptions: string[]; keywords: string[] } | null>(null);

  const generateMeta = trpc.seo.generateMeta.useMutation({
    onSuccess: (data) => { setResult(data); toast.success("Meta tags generated"); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Topic / Page Subject</label>
          <Input value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Market risk intelligence platform"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Target Keyword</label>
          <Input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="e.g. market risk analysis"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 text-sm" />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Page Type</label>
          <Select value={pageType} onValueChange={(v) => setPageType(v as typeof pageType)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0a0f1a] border-white/10">
              {["blog", "landing", "product", "category", "homepage", "about", "service"].map(t => (
                <SelectItem key={t} value={t} className="text-white/80 capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => generateMeta.mutate({ topic, targetKeyword: keyword, pageType })}
        disabled={!topic.trim() || !keyword.trim() || generateMeta.isPending}
        className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 h-9">
        {generateMeta.isPending
          ? <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />Generating…</>
          : <><Sparkles className="w-3.5 h-3.5 mr-2" />Generate Meta Tags</>}
      </Button>
      {result && (
        <div className="space-y-4 pt-2">
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
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Suggested Keywords</div>
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((k, i) => (
                <button key={i} onClick={() => copyToClipboard(k, "Keyword")}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 hover:border-cyan-500/40 hover:text-cyan-400 transition-all">
                  <Hash className="w-3 h-3" />{k}
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

type ActiveSection = "overview" | "checks" | "keywords" | "serp" | "technical" | "ai" | "fixes" | "meta-gen";

export default function SeoOptimizer() {
  useSEO(PAGE_SEO.seoOptimizer);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SeoAnalysisResult | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [expandedFix, setExpandedFix] = useState<number | null>(null);
  const [expandedSnippet, setExpandedSnippet] = useState<number | null>(null);
  const [serpView, setSerpView] = useState<"desktop" | "mobile">("desktop");

  // ── Analyze ──────────────────────────────────────────────────
  const analyzeUrl = trpc.seo.analyzeUrl.useMutation({
    onSuccess: (data) => {
      setResult(data as SeoAnalysisResult);
      setAutoFixResult(null);
      setActiveSection("overview");
      toast.success("Analysis complete");
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

  // ── Auto Fix ─────────────────────────────────────────────────
  const autoFix = trpc.seo.autoFix.useMutation({
    onSuccess: (data) => {
      setAutoFixResult(data as AutoFixResult);
      setActiveSection("fixes");
      toast.success("Auto-fix plan ready");
    },
    onError: (err) => toast.error(err.message || "Auto fix failed"),
  });

  const handleAutoFix = useCallback(() => {
    if (!result) return;
    setAutoFixResult(null);
    autoFix.mutate({ analysisJson: JSON.stringify(result) });
  }, [result, autoFix]);

  // ── Apply SEO Fixes to Site ───────────────────────────────────
  const [applyStatus, setApplyStatus] = useState<{ success: boolean; changes: string[] } | null>(null);
  const applyFix = trpc.seo.applyFix.useMutation({
    onSuccess: (data) => {
      setApplyStatus(data);
      toast.success(`Applied ${data.changes.length} SEO fix${data.changes.length !== 1 ? 'es' : ''} to index.html`);
    },
    onError: (err) => toast.error(err.message || "Apply failed"),
  });

  const handleApplyFix = useCallback(() => {
    if (!result) return;
    // Extract best values from the analysis to apply
    const title = result.meta.title || undefined;
    const description = result.meta.description || undefined;
    const canonicalUrl = result.meta.canonical || undefined;
    const ogTitle = result.meta.ogTitle || undefined;
    const ogDescription = result.meta.ogDescription || undefined;
    const ogImage = result.meta.ogImage || undefined;
    const twitterCard = result.meta.twitterCard || undefined;
    const twitterTitle = result.meta.twitterTitle || undefined;
    const twitterDescription = result.meta.twitterDescription || undefined;
    const robots = result.meta.robots || undefined;
    const keywords = result.meta.keywords || undefined;
    applyFix.mutate({ title, description, canonicalUrl, ogTitle, ogDescription, ogImage, twitterCard, twitterTitle, twitterDescription, robots, keywords });
  }, [result, applyFix]);

  const checkCounts = result ? {
    pass: result.checks.filter(c => c.status === "pass").length,
    warning: result.checks.filter(c => c.status === "warning").length,
    fail: result.checks.filter(c => c.status === "fail").length,
  } : null;

  const issueCount = checkCounts ? checkCounts.fail + checkCounts.warning : 0;

  // ── Section Nav ───────────────────────────────────────────────
  const sections: { id: ActiveSection; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "checks", label: "Checks", icon: Shield },
    { id: "keywords", label: "Keywords", icon: Tag },
    { id: "serp", label: "SERP", icon: Eye },
    { id: "technical", label: "Technical", icon: Zap },
    { id: "ai", label: "AI Tips", icon: Sparkles },
    { id: "fixes", label: "Fixes", icon: Wrench },
    { id: "meta-gen", label: "Meta Gen", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      {/* ── Sticky Header ── */}
      <div className="border-b border-white/5 bg-[#030712]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">SEO Optimizer</h1>
              <p className="text-xs text-white/40">Analyze any URL · One-click fix all issues</p>
            </div>
          </div>

          {/* URL bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                placeholder="https://yoursite.com"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-10 text-sm focus:border-cyan-500/50"
              />
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={!url.trim() || analyzeUrl.isPending}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-10 px-6 shrink-0"
            >
              {analyzeUrl.isPending
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Analyzing…</>
                : <><Search className="w-4 h-4 mr-2" />Analyze</>}
            </Button>
            {result && (
              <Button
                onClick={handleAutoFix}
                disabled={autoFix.isPending}
                className="bg-orange-500 hover:bg-orange-400 text-black font-bold h-10 px-5 shrink-0"
              >
                {autoFix.isPending
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Fixing…</>
                  : <><Wrench className="w-4 h-4 mr-2" />Fix All
                    {issueCount > 0 && (
                      <span className="ml-1.5 w-5 h-5 rounded-full bg-black/30 text-white text-[10px] font-black flex items-center justify-center">
                        {issueCount}
                      </span>
                    )}
                  </>}
              </Button>
            )}
          </div>

          {/* Quick links */}
          {!result && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Try:</span>
              {["https://getfaultline.live", "https://getfaultline.live/blog"].map(ex => (
                <button key={ex} onClick={() => setUrl(ex)}
                  className="text-xs text-cyan-500/60 hover:text-cyan-400 transition-colors">
                  {ex.replace("https://", "")}
                </button>
              ))}
            </div>
          )}

          {/* Section nav — only shown after analysis */}
          {result && (
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    activeSection === id
                      ? id === "fixes" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "text-white/40 hover:text-white/70 border border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {id === "fixes" && autoFixResult && (
                    <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                      {autoFixResult.fixes.length}
                    </span>
                  )}
                  {id === "checks" && checkCounts && checkCounts.fail > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                      {checkCounts.fail}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Loading ── */}
        {analyzeUrl.isPending && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
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

        {/* ── Empty state ── */}
        {!analyzeUrl.isPending && !result && (
          <div className="space-y-8">
            {/* Feature grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: BarChart2, label: "SEO Score", desc: "0–100 with letter grade", color: "text-cyan-400" },
                { icon: Shield, label: "14 SEO Checks", desc: "Pass / warn / fail audit", color: "text-emerald-400" },
                { icon: Tag, label: "Keyword Analysis", desc: "Density & prominence", color: "text-purple-400" },
                { icon: Eye, label: "SERP Preview", desc: "Desktop & mobile views", color: "text-yellow-400" },
                { icon: Sparkles, label: "AI Suggestions", desc: "LLM-powered improvements", color: "text-orange-400" },
                { icon: Wrench, label: "One-Click Fix", desc: "Auto-generates all code fixes", color: "text-red-400" },
                { icon: BookOpen, label: "Readability", desc: "Flesch-Kincaid score", color: "text-blue-400" },
                { icon: TrendingUp, label: "Meta Generator", desc: "AI meta tags from topic", color: "text-pink-400" },
              ].map(({ icon: Icon, label, desc, color }) => (
                <div key={label} className="border border-white/8 rounded-xl p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <Icon className={`w-5 h-5 ${color} mb-2`} />
                  <div className="text-sm font-medium text-white/80">{label}</div>
                  <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                </div>
              ))}
            </div>

            {/* Standalone Meta Generator */}
            <div className="border border-white/10 rounded-xl bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">AI Meta Tag Generator</h2>
                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px]">No URL needed</Badge>
              </div>
              <MetaGenerator />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && !analyzeUrl.isPending && (
          <div className="space-y-5">

            {/* ── OVERVIEW ── */}
            {activeSection === "overview" && (
              <div className="space-y-5">
                {/* Score + stats */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className={`border rounded-xl p-6 flex flex-col items-center justify-center gap-3 ${gradeBg(result.grade)}`}>
                    <ScoreRing score={result.overallScore} grade={result.grade} />
                    <div className="text-center">
                      <div className="text-xs text-white/50 uppercase tracking-wider">Overall SEO Score</div>
                      <div className="text-xs text-white/30 mt-1 truncate max-w-[160px]">
                        {result.url.replace(/^https?:\/\//, "").substring(0, 40)}
                      </div>
                    </div>
                  </div>
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
                      <div className={`text-2xl font-black ${scoreColor(result.readability.score)}`}>{result.readability.score}</div>
                      <div className="text-xs text-white/30">{result.readability.grade}</div>
                    </div>
                    <div className="border border-white/10 bg-white/[0.02] rounded-xl p-4">
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Total Links</div>
                      <div className="text-2xl font-black text-white/80">{result.links.totalLinks}</div>
                      <div className="text-xs text-white/30">{result.links.internal} int · {result.links.external} ext</div>
                    </div>
                  </div>
                </div>

                {/* One-Click Fix CTA */}
                {issueCount > 0 && !autoFixResult && (
                  <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <Wrench className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <div className="text-base font-bold text-white/90 mb-1">
                        {issueCount} issue{issueCount !== 1 ? "s" : ""} found — fix them all automatically
                      </div>
                      <div className="text-sm text-white/50">
                        AI generates ready-to-paste code fixes, optimized meta tags, and a prioritized action plan in one click.
                      </div>
                    </div>
                    <Button
                      onClick={handleAutoFix}
                      disabled={autoFix.isPending}
                      className="bg-orange-500 hover:bg-orange-400 text-black font-bold h-11 px-8 shrink-0"
                    >
                      {autoFix.isPending
                        ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                        : <><Wrench className="w-4 h-4 mr-2" />Fix All Issues</>}
                    </Button>
                  </div>
                )}

                {/* Auto-fix generating */}
                {autoFix.isPending && (
                  <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-6 flex items-center gap-4">
                    <div className="relative w-10 h-10 shrink-0">
                      <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                      <Wrench className="absolute inset-0 m-auto w-4 h-4 text-orange-400/60" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/80">AI is generating fix plan…</div>
                      <div className="text-xs text-white/40 mt-0.5">Writing code snippets and prioritized recommendations</div>
                    </div>
                  </div>
                )}

                {/* Fix plan ready */}
                {autoFixResult && !autoFix.isPending && (
                  <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 flex items-center gap-3">
                    <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white/90">{autoFixResult.summary}</div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {autoFixResult.fixes.length} fixes · {autoFixResult.htmlSnippets.length} HTML snippets ·{" "}
                        <span className={autoFixResult.estimatedImpact === "High" ? "text-red-400" : autoFixResult.estimatedImpact === "Medium" ? "text-yellow-400" : "text-emerald-400"}>
                          {autoFixResult.estimatedImpact} impact
                        </span>
                      </div>
                    </div>
                    <Button onClick={() => setActiveSection("fixes")} variant="outline"
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-8 text-xs shrink-0">
                      View Fixes →
                    </Button>
                  </div>
                )}

                {/* Top issues quick list */}
                {checkCounts && checkCounts.fail > 0 && (
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Top Issues to Fix</div>
                    <div className="space-y-2">
                      {result.checks.filter(c => c.status === "fail").slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm text-white/80">{c.label}</div>
                            {c.recommendation && <div className="text-xs text-white/40 mt-0.5">{c.recommendation}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {checkCounts.fail > 5 && (
                      <button onClick={() => setActiveSection("checks")} className="mt-3 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors">
                        View all {checkCounts.fail} failed checks →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SEO CHECKS ── */}
            {activeSection === "checks" && (
              <div className="space-y-2">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-3">
                  {checkCounts?.pass} passed · {checkCounts?.warning} warnings · {checkCounts?.fail} failed
                </div>
                {result.checks.map(check => (
                  <div key={check.id} className={`border rounded-xl overflow-hidden ${
                    check.status === "pass" ? "border-emerald-500/20 bg-emerald-500/5" :
                    check.status === "warning" ? "border-yellow-500/20 bg-yellow-500/5" :
                    check.status === "fail" ? "border-red-500/20 bg-red-500/5" :
                    "border-cyan-500/20 bg-cyan-500/5"
                  }`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      {check.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
                       check.status === "warning" ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" /> :
                       check.status === "fail" ? <XCircle className="w-4 h-4 text-red-400 shrink-0" /> :
                       <Zap className="w-4 h-4 text-cyan-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white/90">{check.label}</div>
                        <div className="text-xs text-white/50 mt-0.5">{check.detail}</div>
                        {check.recommendation && (
                          <div className="flex items-start gap-1.5 mt-1.5 bg-white/5 rounded px-2 py-1.5">
                            <Zap className="w-3 h-3 text-cyan-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-cyan-300">{check.recommendation}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/30 font-mono">{check.score}/{check.maxScore}</span>
                        <Badge className={`text-[10px] border ${
                          check.status === "pass" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                          check.status === "warning" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                          check.status === "fail" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                          "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                        }`}>
                          {check.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── KEYWORDS ── */}
            {activeSection === "keywords" && (
              <div className="space-y-4">
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-white/5 border-b border-white/10 text-xs text-white/40 uppercase tracking-wider">
                    <div className="col-span-4">Keyword</div>
                    <div className="col-span-2 text-center">Count</div>
                    <div className="col-span-3 text-center">Density</div>
                    <div className="col-span-3 text-center">Prominence</div>
                  </div>
                  {result.keywords.length === 0 ? (
                    <div className="px-4 py-8 text-center text-white/30 text-sm">No significant keywords found</div>
                  ) : result.keywords.map((kw, i) => (
                    <div key={kw.word} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-white/5 last:border-0 ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="text-xs text-white/20 font-mono w-4">{i + 1}</span>
                        <span className="text-sm text-white/80 font-medium">{kw.word}</span>
                      </div>
                      <div className="col-span-2 text-center"><span className="text-sm font-mono text-white/60">{kw.count}</span></div>
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
                  ))}
                </div>
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
              </div>
            )}

            {/* ── SERP PREVIEW ── */}
            {activeSection === "serp" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["desktop", "mobile"] as const).map(v => (
                    <button key={v} onClick={() => setSerpView(v)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs transition-all ${serpView === v ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "bg-white/5 border-white/10 text-white/50"}`}>
                      {v === "desktop" ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
                <div className={`rounded-lg border border-white/10 bg-white/5 p-4 ${serpView === "mobile" ? "max-w-sm" : ""}`}>
                  <div className="text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">{serpView} SERP Preview</div>
                  <div className="space-y-1">
                    <div className="text-xs text-green-400/80 truncate">{result.serpPreview.breadcrumb}</div>
                    <div className="text-base font-medium text-blue-400 hover:underline cursor-pointer leading-tight line-clamp-2">{result.serpPreview.title}</div>
                    <div className="text-xs text-white/60 leading-relaxed line-clamp-3">{result.serpPreview.description}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Meta Title</div>
                    <div className="text-sm text-white/80">{result.meta.title || <span className="text-red-400/70 italic">Missing</span>}</div>
                    <div className="flex items-center gap-2">
                      <Progress value={result.meta.titleLength > 0 ? Math.min(100, (result.meta.titleLength / 60) * 100) : 0} className="h-1.5 flex-1" />
                      <span className={`text-xs font-mono ${result.meta.titleLength >= 50 && result.meta.titleLength <= 60 ? "text-emerald-400" : "text-yellow-400"}`}>{result.meta.titleLength}/60</span>
                    </div>
                    {result.meta.title && (
                      <button onClick={() => copyToClipboard(result.meta.title!, "Title")} className="flex items-center gap-1 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    )}
                  </div>
                  <div className="border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Meta Description</div>
                    <div className="text-sm text-white/80 leading-relaxed">{result.meta.description || <span className="text-red-400/70 italic">Missing</span>}</div>
                    <div className="flex items-center gap-2">
                      <Progress value={result.meta.descriptionLength > 0 ? Math.min(100, (result.meta.descriptionLength / 160) * 100) : 0} className="h-1.5 flex-1" />
                      <span className={`text-xs font-mono ${result.meta.descriptionLength >= 120 && result.meta.descriptionLength <= 160 ? "text-emerald-400" : "text-yellow-400"}`}>{result.meta.descriptionLength}/160</span>
                    </div>
                    {result.meta.description && (
                      <button onClick={() => copyToClipboard(result.meta.description!, "Description")} className="flex items-center gap-1 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TECHNICAL ── */}
            {activeSection === "technical" && (
              <div className="space-y-4">
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
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-4 h-4 ${value ? "text-emerald-400" : "text-red-400"}`} />
                        {value ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="text-xs font-medium text-white/80">{label}</div>
                    </div>
                  ))}
                </div>
                {result.technical.totalImages > 0 && (
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Image Alt Text</div>
                    <div className="flex items-center gap-3">
                      <Progress value={((result.technical.totalImages - result.technical.imagesWithoutAlt) / result.technical.totalImages) * 100} className="flex-1 h-2" />
                      <span className="text-sm font-mono text-white/60 shrink-0">
                        {result.technical.totalImages - result.technical.imagesWithoutAlt}/{result.technical.totalImages} with alt
                      </span>
                    </div>
                  </div>
                )}
                {result.meta.schemaTypes.length > 0 && (
                  <div className="border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Schema Types Detected</div>
                    <div className="flex flex-wrap gap-2">
                      {result.meta.schemaTypes.map(t => (
                        <Badge key={t} className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── AI SUGGESTIONS ── */}
            {activeSection === "ai" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white/80">AI-Powered Recommendations</span>
                  <Badge className={`border text-[10px] ${
                    result.aiSuggestions.estimatedDifficulty === "Low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
                    result.aiSuggestions.estimatedDifficulty === "Medium" ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                    "text-red-400 bg-red-500/10 border-red-500/30"
                  }`}>{result.aiSuggestions.estimatedDifficulty} Difficulty</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="border border-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Recommended Focus Keywords</div>
                  <div className="flex flex-wrap gap-2">
                    {result.aiSuggestions.focusKeywords.map((kw, i) => (
                      <button key={i} onClick={() => copyToClipboard(kw, "Keyword")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 hover:bg-emerald-500/20 transition-all">
                        <Hash className="w-3 h-3" />{kw}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            )}

            {/* ── AUTO FIXES ── */}
            {activeSection === "fixes" && (
              <div className="space-y-5">
                {/* Not yet generated */}
                {!autoFixResult && !autoFix.isPending && (
                  <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-8 flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="text-center">
                      <div className="text-base font-bold text-white/90 mb-1">AI Auto Fix Engine</div>
                      <div className="text-sm text-white/50 max-w-md">
                        Analyzes all {issueCount} issues and generates ready-to-paste code fixes, optimized meta tags, and a prioritized action plan.
                      </div>
                    </div>
                    <Button onClick={handleAutoFix} className="bg-orange-500 hover:bg-orange-400 text-black font-bold h-11 px-8">
                      <Wrench className="w-4 h-4 mr-2" />Fix All {issueCount} Issues
                    </Button>
                  </div>
                )}

                {/* Loading */}
                {autoFix.isPending && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                      <Wrench className="absolute inset-0 m-auto w-5 h-5 text-orange-400/60" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-white/70">Generating auto-fix plan…</div>
                      <div className="text-xs text-white/40 mt-1">AI is analyzing all issues and writing code fixes</div>
                    </div>
                  </div>
                )}

                {/* Results */}
                {autoFixResult && !autoFix.isPending && (
                  <div className="space-y-5">
                    {/* Summary */}
                    <div className="flex items-center gap-3 border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        autoFixResult.estimatedImpact === "High" ? "bg-red-500/10 border border-red-500/20" :
                        autoFixResult.estimatedImpact === "Medium" ? "bg-yellow-500/10 border border-yellow-500/20" :
                        "bg-emerald-500/10 border border-emerald-500/20"
                      }`}>
                        <Flame className={`w-5 h-5 ${
                          autoFixResult.estimatedImpact === "High" ? "text-red-400" :
                          autoFixResult.estimatedImpact === "Medium" ? "text-yellow-400" : "text-emerald-400"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white/80">{autoFixResult.summary}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-white/40">{autoFixResult.fixes.length} fixes</span>
                          <span className="text-xs text-white/40">·</span>
                          <span className="text-xs text-white/40">{autoFixResult.htmlSnippets.length} HTML snippets</span>
                          <Badge className={`text-[10px] border ml-1 ${
                            autoFixResult.estimatedImpact === "High" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            autoFixResult.estimatedImpact === "Medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>{autoFixResult.estimatedImpact} Impact</Badge>
                        </div>
                      </div>
                      <Button onClick={handleAutoFix} variant="outline"
                        className="border-white/10 text-white/50 hover:text-white h-8 text-xs shrink-0">
                        <RefreshCw className="w-3 h-3 mr-1.5" />Re-run
                      </Button>
                    </div>

                    {/* Apply SEO Fixes to Site — one-click auto-write to index.html */}
                    <div className="border border-violet-500/20 bg-violet-500/5 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white/90">Apply SEO Fixes to Site</div>
                          <div className="text-xs text-white/40 mt-0.5">Writes title, description, OG tags, Twitter card, canonical URL, robots, and keywords directly to index.html</div>
                        </div>
                        <Button
                          onClick={handleApplyFix}
                          disabled={applyFix.isPending || !result}
                          className="bg-violet-600 hover:bg-violet-500 text-white h-8 text-xs shrink-0 border-0">
                          {applyFix.isPending ? (
                            <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Applying...</>
                          ) : (
                            <><Sparkles className="w-3 h-3 mr-1.5" />Apply Fixes</>
                          )}
                        </Button>
                      </div>
                      {applyStatus && (
                        <div className="mt-3 flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-3 py-2">
                          <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs text-emerald-300">
                            Applied {applyStatus.changes.length} fix{applyStatus.changes.length !== 1 ? 'es' : ''} to index.html:
                            {' '}{applyStatus.changes.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Fix cards */}
                    <div>
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Prioritized Fixes</div>
                      <div className="space-y-2">
                        {autoFixResult.fixes.map((fix, i) => (
                          <FixCard key={fix.checkId} fix={fix} index={i}
                            expanded={expandedFix === i}
                            onToggle={() => setExpandedFix(expandedFix === i ? null : i)} />
                        ))}
                      </div>
                    </div>

                    {/* HTML Snippets */}
                    {autoFixResult.htmlSnippets.length > 0 && (
                      <div>
                        <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Ready-to-Paste HTML Snippets</div>
                        <div className="space-y-3">
                          {autoFixResult.htmlSnippets.map((snippet, i) => (
                            <div key={i} className="border border-cyan-500/20 bg-cyan-500/5 rounded-xl overflow-hidden">
                              <button onClick={() => setExpandedSnippet(expandedSnippet === i ? null : i)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
                                <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white/90">{snippet.label}</div>
                                  <div className="text-xs text-white/40">{snippet.description}</div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge className="bg-cyan-500/10 text-cyan-400/70 border-cyan-500/20 text-[10px]">&lt;{snippet.placement}&gt;</Badge>
                                  {expandedSnippet === i ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                                </div>
                              </button>
                              {expandedSnippet === i && (
                                <div className="px-4 pb-4">
                                  <div className="flex justify-end mb-1.5">
                                    <button onClick={() => copyToClipboard(snippet.code, snippet.label)}
                                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-cyan-400 transition-colors">
                                      <Copy className="w-3 h-3" />Copy all
                                    </button>
                                  </div>
                                  <pre className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-cyan-300/90 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">{snippet.code}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {autoFixResult.fixes.filter(f => f.severity === "critical").length === 0 && (
                      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 flex items-center gap-3">
                        <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div className="text-sm text-emerald-300/80">No critical issues found. Apply the remaining fixes to maximize your SEO score.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── META GENERATOR ── */}
            {activeSection === "meta-gen" && (
              <div className="border border-white/10 rounded-xl bg-white/[0.02] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold tracking-wider uppercase text-white/80">AI Meta Tag Generator</h2>
                </div>
                <MetaGenerator />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
