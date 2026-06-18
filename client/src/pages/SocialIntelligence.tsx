/* ============================================================
   FAULTLINE — Social Intelligence™
   Real-time market narrative tracking, sentiment analysis,
   and social buzz monitoring powered by Polygon.io News API
   and Yahoo Finance trending/screener data.
   ============================================================ */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import { useSEO } from "@/hooks/useSEO";
import {
  TrendingUp, TrendingDown, Minus, Activity, BarChart2,
  RefreshCw, ExternalLink, Clock, Zap, Radio, MessageSquare,
  AlertTriangle, CheckCircle, Eye, Newspaper, Hash, Target,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ── Types (mirrored from server) ──────────────────────────────
type SentimentLabel =
  | "STRONGLY BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONGLY BEARISH";

type TickerSentiment = "bullish" | "bearish" | "neutral" | "unknown";
type NarrativeSentiment = "bullish" | "bearish" | "neutral";
type ArticleSentiment = "positive" | "neutral" | "negative" | "unknown";

interface TrendingTicker {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  marketState: string | null;
  sentiment: TickerSentiment;
  buzzScore: number;
  newsCount: number;
  latestHeadline: string | null;
}

interface SentimentSummary {
  ticker: string;
  name: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalArticles: number;
  sentimentScore: number;
  label: SentimentLabel;
  latestHeadline: string | null;
  latestPublished: string | null;
}

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  publishedUtc: string;
  articleUrl: string;
  imageUrl: string | null;
  publisher: string;
  publisherLogoUrl: string | null;
  tickers: string[];
  keywords: string[];
  sentiment: ArticleSentiment;
  sentimentReasoning: string;
  primaryTicker: string | null;
}

interface NarrativeCluster {
  theme: string;
  description: string;
  tickers: string[];
  articleCount: number;
  dominantSentiment: NarrativeSentiment;
  keywords: string[];
}

// ── Color helpers ─────────────────────────────────────────────
function sentimentColor(s: TickerSentiment | ArticleSentiment | NarrativeSentiment | SentimentLabel): string {
  if (s === "bullish" || s === "positive" || s === "BULLISH" || s === "STRONGLY BULLISH") return "#00FF88";
  if (s === "bearish" || s === "negative" || s === "BEARISH" || s === "STRONGLY BEARISH") return "#FF2D55";
  return "#FF9500";
}

function sentimentBg(s: TickerSentiment | ArticleSentiment | NarrativeSentiment | SentimentLabel): string {
  if (s === "bullish" || s === "positive" || s === "BULLISH" || s === "STRONGLY BULLISH") return "rgba(0,255,136,0.12)";
  if (s === "bearish" || s === "negative" || s === "BEARISH" || s === "STRONGLY BEARISH") return "rgba(255,45,85,0.12)";
  return "rgba(255,149,0,0.12)";
}

function sentimentLabel(s: TickerSentiment): string {
  if (s === "bullish") return "BULLISH";
  if (s === "bearish") return "BEARISH";
  if (s === "neutral") return "NEUTRAL";
  return "—";
}

function changeColor(v: number | null): string {
  if (v === null) return "#64748B";
  return v >= 0 ? "#00FF88" : "#FF2D55";
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVolume(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(v);
}

function timeAgo(utc: string): string {
  const diff = Date.now() - new Date(utc).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function BuzzBar({ score }: { score: number }) {
  const color = score >= 70 ? "#FF2D55" : score >= 40 ? "#FF9500" : "#00D4FF";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: "monospace", minWidth: 28 }}>{score}</span>
    </div>
  );
}

function SentimentBar({ bullish, bearish, neutral }: { bullish: number; bearish: number; neutral: number }) {
  const total = bullish + bearish + neutral;
  if (total === 0) return <span style={{ color: "#64748B", fontSize: 11 }}>No data</span>;
  const bPct = Math.round((bullish / total) * 100);
  const rPct = Math.round((bearish / total) * 100);
  const nPct = 100 - bPct - rPct;
  return (
    <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", gap: 1 }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div style={{ width: `${bPct}%`, background: "#00FF88", cursor: "help" }} />
        </TooltipTrigger>
        <TooltipContent>Bullish: {bullish} articles ({bPct}%)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div style={{ width: `${nPct}%`, background: "#FF9500", cursor: "help" }} />
        </TooltipTrigger>
        <TooltipContent>Neutral: {neutral} articles ({nPct}%)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div style={{ width: `${rPct}%`, background: "#FF2D55", cursor: "help" }} />
        </TooltipTrigger>
        <TooltipContent>Bearish: {bearish} articles ({rPct}%)</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── Trending Ticker Card ──────────────────────────────────────
function TrendingCard({ t }: { t: TrendingTicker }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="intel-module"
      style={{
        background: "var(--fl-surface)",
        border: "1px solid var(--fl-border)",
        borderRadius: 8,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "border-color 0.2s, transform 0.15s",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#00D4FF" }}>{t.symbol}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "2px 6px", borderRadius: 3,
                  background: sentimentBg(t.sentiment),
                  color: sentimentColor(t.sentiment),
                  cursor: "help",
                }}>
                  {sentimentLabel(t.sentiment)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Sentiment derived from {t.newsCount} Polygon.io news articles with AI-generated insights
              </TooltipContent>
            </Tooltip>
          </div>
          <div style={{ fontSize: 11, color: "var(--fl-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {t.name}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fl-text-primary)", fontFamily: "monospace" }}>
            {fmtPrice(t.price)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: changeColor(t.changePercent), fontFamily: "monospace" }}>
            {fmtPct(t.changePercent)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div style={{ cursor: "help" }}>
              <div style={{ fontSize: 10, color: "var(--fl-text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>
                BUZZ SCORE
              </div>
              <BuzzBar score={t.buzzScore} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Buzz score = log-scaled news volume × sentiment intensity. Range 0–100. Based on {t.newsCount} article{t.newsCount !== 1 ? "s" : ""} in the last 24h.
          </TooltipContent>
        </Tooltip>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--fl-border)" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--fl-text-muted)", marginBottom: 2 }}>VOLUME</div>
              <div style={{ fontSize: 12, color: "var(--fl-text-primary)", fontFamily: "monospace" }}>{fmtVolume(t.volume)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fl-text-muted)", marginBottom: 2 }}>NEWS COUNT</div>
              <div style={{ fontSize: 12, color: "var(--fl-text-primary)", fontFamily: "monospace" }}>{t.newsCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--fl-text-muted)", marginBottom: 2 }}>MARKET STATE</div>
              <div style={{ fontSize: 12, color: "var(--fl-text-primary)", fontFamily: "monospace" }}>{t.marketState ?? "—"}</div>
            </div>
          </div>
          {t.latestHeadline && (
            <div style={{ fontSize: 11, color: "var(--fl-text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
              "{t.latestHeadline}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sentiment Leaderboard Row ─────────────────────────────────
function SentimentRow({ s, rank }: { s: SentimentSummary; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const scoreAbs = Math.abs(s.sentimentScore);
  const isBull = s.sentimentScore > 0;
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--fl-border)",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "var(--fl-text-muted)", fontFamily: "monospace", minWidth: 20 }}>
          #{rank}
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#00D4FF", fontFamily: "monospace", minWidth: 56 }}>
          {s.ticker}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
              padding: "2px 6px", borderRadius: 3,
              background: sentimentBg(s.label),
              color: sentimentColor(s.label),
              cursor: "help", minWidth: 100, textAlign: "center",
            }}>
              {s.label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Sentiment score: {(s.sentimentScore * 100).toFixed(0)}% ({s.bullishCount} bullish, {s.bearishCount} bearish, {s.neutralCount} neutral across {s.totalArticles} articles)
          </TooltipContent>
        </Tooltip>
        <div style={{ flex: 1 }}>
          <SentimentBar bullish={s.bullishCount} bearish={s.bearishCount} neutral={s.neutralCount} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {isBull ? <TrendingUp size={12} color="#00FF88" /> : <TrendingDown size={12} color="#FF2D55" />}
          <span style={{ fontSize: 11, fontFamily: "monospace", color: sentimentColor(s.label) }}>
            {(scoreAbs * 100).toFixed(0)}%
          </span>
        </div>
        <span style={{ fontSize: 10, color: "var(--fl-text-muted)", fontFamily: "monospace", minWidth: 32 }}>
          {s.totalArticles}art
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {s.latestHeadline && (
            <div style={{ fontSize: 11, color: "var(--fl-text-secondary)", fontStyle: "italic", lineHeight: 1.5, marginBottom: 6 }}>
              "{s.latestHeadline}"
            </div>
          )}
          {s.latestPublished && (
            <div style={{ fontSize: 10, color: "var(--fl-text-muted)" }}>
              {timeAgo(s.latestPublished)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── News Card ─────────────────────────────────────────────────
function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.articleUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        padding: "14px 16px",
        borderBottom: "1px solid var(--fl-border)",
        textDecoration: "none",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  padding: "1px 5px", borderRadius: 3,
                  background: sentimentBg(article.sentiment),
                  color: sentimentColor(article.sentiment),
                  cursor: "help",
                }}>
                  {article.sentiment === "positive" ? "BULLISH" : article.sentiment === "negative" ? "BEARISH" : article.sentiment === "neutral" ? "NEUTRAL" : "—"}
                </span>
              </TooltipTrigger>
              <TooltipContent style={{ maxWidth: 300 }}>
                {article.sentimentReasoning || "Sentiment derived from Polygon.io AI article analysis"}
              </TooltipContent>
            </Tooltip>
            {article.tickers.slice(0, 4).map((t) => (
              <span key={t} style={{ fontSize: 10, color: "#00D4FF", fontFamily: "monospace", background: "rgba(0,212,255,0.1)", padding: "1px 5px", borderRadius: 3 }}>
                {t}
              </span>
            ))}
            <span style={{ fontSize: 10, color: "var(--fl-text-muted)", marginLeft: "auto" }}>
              {timeAgo(article.publishedUtc)}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fl-text-primary)", lineHeight: 1.4, marginBottom: 4 }}>
            {article.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--fl-text-secondary)" }}>
            {article.publisher}
          </div>
        </div>
        <ExternalLink size={12} color="#64748B" style={{ flexShrink: 0, marginTop: 2 }} />
      </div>
    </a>
  );
}

// ── Narrative Cluster Card ────────────────────────────────────
function NarrativeCard({ cluster }: { cluster: NarrativeCluster }) {
  const sentIcon =
    cluster.dominantSentiment === "bullish" ? <TrendingUp size={14} color="#00FF88" /> :
    cluster.dominantSentiment === "bearish" ? <TrendingDown size={14} color="#FF2D55" /> :
    <Minus size={14} color="#FF9500" />;

  return (
    <div
      className="intel-module"
      style={{
        background: "var(--fl-surface)",
        border: `1px solid ${sentimentColor(cluster.dominantSentiment)}33`,
        borderRadius: 8,
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {sentIcon}
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fl-text-primary)" }}>{cluster.theme}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span style={{
              fontSize: 11, fontFamily: "monospace", color: "var(--fl-text-muted)",
              background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 3, cursor: "help",
            }}>
              {cluster.articleCount} articles
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Number of news articles matching this narrative theme in the last 24h
          </TooltipContent>
        </Tooltip>
      </div>
      <p style={{ fontSize: 11, color: "var(--fl-text-secondary)", lineHeight: 1.5, marginBottom: 10 }}>
        {cluster.description}
      </p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {cluster.tickers.map((t) => (
          <span key={t} style={{ fontSize: 10, color: "#00D4FF", fontFamily: "monospace", background: "rgba(0,212,255,0.1)", padding: "2px 6px", borderRadius: 3 }}>
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {cluster.keywords.map((kw) => (
          <span key={kw} style={{ fontSize: 10, color: "var(--fl-text-muted)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>
            #{kw}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SocialIntelligence() {
  useSEO({
    title: "Social Intelligence | FAULTLINE",
    description: "Real-time market narrative tracking, sentiment analysis, and social buzz monitoring.",
  });

  const [activeTab, setActiveTab] = useState<"trending" | "sentiment" | "news" | "narratives" | "active">("trending");
  const [newsFilter, setNewsFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");

  const { data, isLoading, error, refetch, isFetching } = trpc.social.getIntelligence.useQuery(undefined, {
    staleTime: 4 * 60 * 1000, // 4 minutes
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
  });

  const filteredNews = useMemo(() => {
    if (!data?.latestNews) return [];
    if (newsFilter === "all") return data.latestNews;
    return data.latestNews.filter((n) => n.sentiment === newsFilter);
  }, [data?.latestNews, newsFilter]);

  const tabs = [
    { id: "trending" as const, label: "Trending", icon: <TrendingUp size={13} />, count: data?.trendingTickers?.length },
    { id: "sentiment" as const, label: "Sentiment", icon: <Activity size={13} />, count: data?.sentimentLeaderboard?.length },
    { id: "news" as const, label: "News Feed", icon: <Newspaper size={13} />, count: data?.latestNews?.length },
    { id: "narratives" as const, label: "Narratives", icon: <Hash size={13} />, count: data?.narrativeClusters?.length },
    { id: "active" as const, label: "Most Active", icon: <BarChart2 size={13} />, count: data?.mostActive?.length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--fl-void)", color: "var(--fl-text-primary)" }}>
      <PageHeader
        title="Social Intelligence"
        subtitle="Real-time narrative tracking, sentiment analysis, and social buzz monitoring"
      />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px 40px" }}>

        {/* ── Status Bar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", marginBottom: 20,
          background: "var(--fl-surface)", border: "1px solid var(--fl-border)", borderRadius: 8,
          flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: data ? "#00FF88" : "#FF9500",
                boxShadow: data ? "0 0 6px #00FF88" : "0 0 6px #FF9500",
                animation: "fl-pulse 2s infinite",
              }} />
              <span style={{ fontSize: 11, color: "var(--fl-text-secondary)", fontFamily: "monospace" }}>
                {data ? "LIVE" : isLoading ? "LOADING" : "OFFLINE"}
              </span>
            </div>
            {data && (
              <>
                <span style={{ fontSize: 11, color: "var(--fl-text-muted)" }}>
                  {data.trendingTickers.length} trending · {data.sentimentLeaderboard.length} sentiment entries · {data.latestNews.length} articles
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span style={{ fontSize: 10, color: "var(--fl-text-muted)", cursor: "help" }}>
                      <Clock size={10} style={{ display: "inline", marginRight: 3 }} />
                      {timeAgo(new Date(data.fetchedAt).toISOString())}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Data refreshes every 5 minutes. Source: {data.dataSource}</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 5,
              background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)",
              color: "#00D4FF", fontSize: 11, cursor: isFetching ? "not-allowed" : "pointer",
              opacity: isFetching ? 0.6 : 1, transition: "opacity 0.2s",
            }}
          >
            <RefreshCw size={11} style={{ animation: isFetching ? "fl-spin 1s linear infinite" : "none" }} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* ── Error State ── */}
        {error && (
          <div style={{
            padding: 20, marginBottom: 20, borderRadius: 8,
            background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertTriangle size={16} color="#FF2D55" />
            <span style={{ fontSize: 13, color: "#FF2D55" }}>
              Failed to load social intelligence data. Please try refreshing.
            </span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 20,
          background: "var(--fl-surface)", border: "1px solid var(--fl-border)",
          borderRadius: 8, padding: 4, flexWrap: "wrap",
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 5, border: "none",
                background: activeTab === tab.id ? "rgba(0,212,255,0.15)" : "transparent",
                color: activeTab === tab.id ? "#00D4FF" : "var(--fl-text-muted)",
                fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 400,
                cursor: "pointer", transition: "all 0.15s",
                borderBottom: activeTab === tab.id ? "2px solid #00D4FF" : "2px solid transparent",
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 10, background: "rgba(255,255,255,0.08)",
                  padding: "1px 5px", borderRadius: 10, color: "var(--fl-text-muted)",
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Loading Skeleton ── */}
        {isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                height: 110, borderRadius: 8,
                background: "var(--fl-surface)", border: "1px solid var(--fl-border)",
                animation: "fl-pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        )}

        {/* ── TRENDING TAB ── */}
        {!isLoading && activeTab === "trending" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={14} color="#00D4FF" />
              <span style={{ fontSize: 12, color: "var(--fl-text-secondary)" }}>
                Trending tickers on Yahoo Finance US market — enriched with Polygon.io sentiment scores
              </span>
            </div>
            {data?.trendingTickers?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {data.trendingTickers.map((t) => (
                  <TrendingCard key={t.symbol} t={t} />
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--fl-text-muted)", fontSize: 13 }}>
                Calculated levels unavailable — no trending data returned from data source.
              </div>
            )}
          </div>
        )}

        {/* ── SENTIMENT TAB ── */}
        {!isLoading && activeTab === "sentiment" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={14} color="#00D4FF" />
              <span style={{ fontSize: 12, color: "var(--fl-text-secondary)" }}>
                Sentiment leaderboard — ranked by absolute sentiment intensity. Scores derived from Polygon.io AI-analyzed news insights.
              </span>
            </div>
            <div className="intel-module" style={{
              background: "var(--fl-surface)", border: "1px solid var(--fl-border)", borderRadius: 8, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                borderBottom: "1px solid var(--fl-border)",
                background: "rgba(255,255,255,0.02)",
              }}>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", minWidth: 20 }}>#</span>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", minWidth: 56 }}>TICKER</span>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", minWidth: 100 }}>SIGNAL</span>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", flex: 1 }}>BULL / NEUTRAL / BEAR</span>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", minWidth: 50 }}>SCORE</span>
                <span style={{ fontSize: 10, color: "var(--fl-text-muted)", minWidth: 32 }}>ART.</span>
              </div>
              {data?.sentimentLeaderboard?.length ? (
                data.sentimentLeaderboard.map((s, i) => (
                  <SentimentRow key={s.ticker} s={s} rank={i + 1} />
                ))
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--fl-text-muted)", fontSize: 13 }}>
                  Calculated levels unavailable — insufficient news data to compute sentiment scores.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NEWS TAB ── */}
        {!isLoading && activeTab === "news" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <Newspaper size={14} color="#00D4FF" />
              <span style={{ fontSize: 12, color: "var(--fl-text-secondary)", flex: 1 }}>
                Latest market news with per-article AI sentiment analysis from Polygon.io
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "positive", "negative", "neutral"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setNewsFilter(f)}
                    style={{
                      padding: "4px 10px", borderRadius: 4, border: "none",
                      background: newsFilter === f ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)",
                      color: newsFilter === f ? "#00D4FF" : "var(--fl-text-muted)",
                      fontSize: 11, cursor: "pointer", textTransform: "capitalize",
                    }}
                  >
                    {f === "positive" ? "Bullish" : f === "negative" ? "Bearish" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="intel-module" style={{
              background: "var(--fl-surface)", border: "1px solid var(--fl-border)", borderRadius: 8, overflow: "hidden",
            }}>
              {filteredNews.length ? (
                filteredNews.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "var(--fl-text-muted)", fontSize: 13 }}>
                  No articles match the selected filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NARRATIVES TAB ── */}
        {!isLoading && activeTab === "narratives" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Hash size={14} color="#00D4FF" />
              <span style={{ fontSize: 12, color: "var(--fl-text-secondary)" }}>
                Market narrative clusters — thematic groupings of news articles with dominant sentiment. Article counts are real; themes are predefined structural categories.
              </span>
            </div>
            {data?.narrativeClusters?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {data.narrativeClusters.map((c) => (
                  <NarrativeCard key={c.theme} cluster={c} />
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--fl-text-muted)", fontSize: 13 }}>
                Calculated levels unavailable — no narrative clusters identified from current news data.
              </div>
            )}
          </div>
        )}

        {/* ── MOST ACTIVE TAB ── */}
        {!isLoading && activeTab === "active" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <BarChart2 size={14} color="#00D4FF" />
              <span style={{ fontSize: 12, color: "var(--fl-text-secondary)" }}>
                Highest-volume stocks on Yahoo Finance screener — enriched with Polygon.io sentiment data
              </span>
            </div>
            {data?.mostActive?.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {data.mostActive.map((t) => (
                  <TrendingCard key={t.symbol} t={t} />
                ))}
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "var(--fl-text-muted)", fontSize: 13 }}>
                Calculated levels unavailable — no most-active data returned from data source.
              </div>
            )}
          </div>
        )}

        {/* ── Data Source Footer ── */}
        {data && (
          <div style={{
            marginTop: 32, padding: "12px 16px",
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--fl-border)", borderRadius: 6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle size={12} color="#00FF88" />
              <span style={{ fontSize: 11, color: "var(--fl-text-muted)" }}>
                <strong style={{ color: "var(--fl-text-secondary)" }}>Data source:</strong> {data.dataSource}
              </span>
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--fl-text-dim)", lineHeight: 1.5 }}>
              Sentiment scores are derived from Polygon.io's AI-generated article insights — not fabricated or LLM-invented.
              Buzz scores are calculated from news volume and sentiment intensity. All values are computed from real market data.
              Cache TTL: 5 minutes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
