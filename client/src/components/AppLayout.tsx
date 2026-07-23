/* ============================================================
   FAULTLINE — AppLayout v2
   Desktop: top nav with grouped sections + dividers
   Mobile: bottom tab bar (5 primary) + "More" overflow drawer
   Design: Palantir Noir — void black, neon accents, scanlines
   ============================================================ */
import { useLocation } from "wouter";
import { ReactNode, useState, useCallback, useEffect } from "react";
import {
  Activity, BarChart2, Brain, Clock, AlertTriangle, TrendingUp,
  LayoutDashboard, Zap, FileText, Bell, Radio, Gauge, BookOpen,
  Cpu, MoreHorizontal, X, Briefcase, Shield, Bitcoin, Bookmark, Waves, BarChart3,
  User, LogIn, Crown, ChevronDown, LogOut, RotateCcw, Trophy, Newspaper, Settings, History, Crosshair, Eye, Search, Telescope, MessageSquare, Sparkles, Target, MessageCircle, Command, ScanSearch, FlaskConical, Users, TrendingDown, BellRing, Home, BrainCircuit,
} from "lucide-react";
import { loadWatchlist, evaluateBreach, INDICATOR_MAP } from "@/lib/watchlist";
import MarketContextStrip from "@/components/MarketContextStrip";
import UniversalTickerBar from "@/components/UniversalTickerBar";
import CommandSearch, { useCommandSearch } from "@/components/CommandSearch";
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import AshaIntroModal from "@/components/AshaIntroModal";
import AshaPanel from "@/components/AshaPanel";
import { formatCanonicalScore } from "@shared/marketMetrics";
import { DrawerProvider } from "@/contexts/DrawerContext";
import LeftNavDrawer from "@/components/LeftNavDrawer";
import RightActionDrawer from "@/components/RightActionDrawer";
import { CANONICAL_DESTINATIONS } from "@shared/routeRegistry";
import { getRouteIcon } from "@/lib/routeIcons";

// ── Navigation structure ──────────────────────────────────────
// Groups define the cognitive flow: command → markets → intelligence → analysis → account
// Owner Portal is a separate admin-only group rendered last with distinct styling

type NavItem = {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  path: string;
};

type NavGroup = {
  label: string;
  color: string;       // bright accent color for the category header
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [{
  label: "MARKET QUESTIONS",
  color: "#00E5FF",
  items: CANONICAL_DESTINATIONS.map(destination => ({
    id: destination.id,
    label: destination.label,
    shortLabel: destination.shortLabel,
    icon: getRouteIcon(destination.icon),
    path: destination.path,
  })),
}];

// Owner Portal nav items — admin-only group rendered last with distinct amber styling
const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "admin-portal",     label: "Owner Portal",     shortLabel: "Portal",    icon: Shield,    path: "/app/admin" },
  { id: "demo-tokens",      label: "Demo Tokens",      shortLabel: "Tokens",    icon: Zap,       path: "/app/admin?tab=demo" },
  { id: "admin-users",      label: "Users",            shortLabel: "Users",     icon: User,      path: "/app/admin/users" },
  { id: "x-posts",          label: "X Posts",          shortLabel: "X Posts",   icon: Zap,       path: "/app/x-posts" },
  { id: "x-post-queue",     label: "Post Queue",       shortLabel: "Queue",     icon: Settings,  path: "/app/x-post-queue" },
  { id: "admin-blog",       label: "Blog Manager",     shortLabel: "Blog Mgr",  icon: Newspaper, path: "/app/admin/blog" },
  { id: "admin-publishing", label: "Publishing",        shortLabel: "Publish",   icon: Zap,       path: "/app/admin/publishing" },
  { id: "owner-simulation", label: "Owner Simulation", shortLabel: "Simulation",icon: Trophy,    path: "/owner/simulation" },
  { id: "seo-optimizer",    label: "SEO Optimizer",    shortLabel: "SEO",       icon: Search,    path: "/app/seo-optimizer" },
  { id: "analytics",        label: "Site Analytics",   shortLabel: "Analytics", icon: BarChart2, path: "/app/analytics" },
  { id: "chat-inbox",       label: "ASHA Intelligence", shortLabel: "ASHA Intel", icon: BrainCircuit, path: "/app/asha-intelligence" },
  { id: "engineering",      label: "Engineering Diagnostics", shortLabel: "Eng. Diag", icon: FlaskConical,  path: "/app/admin/engineering" },
  { id: "conv-intelligence", label: "Conversation Intelligence", shortLabel: "Conv. Intel", icon: BrainCircuit, path: "/app/admin/conversation-intelligence" },
];

// Flat list for convenience
const ALL_TABS = NAV_GROUPS.flatMap(g => g.items);

// Mobile and desktop share one five-question order.
const MOBILE_PRIMARY = ALL_TABS;

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { output, rawFred, isLoading, isLive, isRefreshing, lastUpdated, isSimulating, forceRefresh, indicators } = useEngine();
  const { user: authUser, logout } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isOpen: cmdOpen, open: openCmd, close: closeCmd } = useCommandSearch();
  // Market regime intelligence — 10-min cache, non-blocking
  const { data: miData } = trpc.marketIntelligence.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const isMobile = useIsMobile();

  // Count breached watchlist items for badge
  const breachCount = useMemo(() => {
    const items = loadWatchlist();
    let count = 0;
    items.forEach(item => {
      const def = INDICATOR_MAP[item.indicatorKey];
      if (!def) return;
      let lv: number | null = null;
      if (item.indicatorKey === 'score_overall') lv = output.overall.score;
      else if (item.indicatorKey === 'score_credit') lv = output.domains.find(d => d.id === 'credit-stress')?.score ?? null;
      else if (item.indicatorKey === 'score_ai') lv = output.domains.find(d => d.id === 'ai-bubble')?.score ?? null;
      else if (item.indicatorKey === 'score_treasury') lv = output.domains.find(d => d.id === 'treasury-debt')?.score ?? null;
      else if (item.indicatorKey === 'score_recession') lv = output.domains.find(d => d.id === 'recession')?.score ?? null;
      else lv = (indicators as unknown as Record<string, number>)[item.indicatorKey] ?? null;
      if (lv != null && evaluateBreach(item, lv)) count++;
    });
    return count;
  }, [output, indicators]);

  const { tickerValues, regime, domains, overall } = output;
  // Build enriched smart market intelligence ticker (13 items from spec)
  const liquidityDomain = domains.find(d => d.id === 'liquidity');
  const creditDomain = domains.find(d => d.id === 'credit-stress');
  const liquidityScore = liquidityDomain?.score ?? 5;
  const liquidityLabel = liquidityScore < 4 ? 'Improving' : liquidityScore < 7 ? 'Neutral' : 'Tightening';
  const liquidityDir = liquidityScore < 4 ? 'down' as const : liquidityScore < 7 ? 'flat' as const : 'up' as const;
  const creditScore = creditDomain?.score ?? 5;
  const creditLabel = creditScore < 4 ? 'Stable' : creditScore < 7 ? 'Elevated' : 'Stressed';
  const creditDir = creditScore < 4 ? 'flat' as const : 'up' as const;
  const aiConc = indicators.aiConcentration;
  const aiConcLabel = aiConc > 35 ? 'Extreme' : aiConc > 28 ? 'Elevated' : 'Moderate';
  const vix = indicators.vix;
  const hySpread = rawFred['BAMLH0A0HYM2'] != null
    ? (rawFred['BAMLH0A0HYM2']! > 20 ? Math.round(rawFred['BAMLH0A0HYM2']!) : Math.round(rawFred['BAMLH0A0HYM2']! * 100))
    : indicators.hySpread;
  const yield10Y = rawFred['DGS10'] != null ? rawFred['DGS10']! : indicators.yield10Y;
  // Regime label from engine
  const regimeShort = regime.label.length > 18 ? regime.label.split(' ').slice(0, 2).join(' ') : regime.label;
  // Fed cut probability derived from fed funds rate vs CPI
  const fedCutProb = Math.max(0, Math.min(99, Math.round(100 - (indicators.fedFundsRate - indicators.cpi) * 15)));
  // Market breadth proxy: inverse of overall risk score
  const breadthScore = Math.max(0, Math.min(100, Math.round(100 - overall.score * 10)));
  const breadthLabel = breadthScore > 65 ? 'Broad' : breadthScore > 40 ? 'Mixed' : 'Narrow';
  // BTC dominance — live from /api/crypto/global (5-min cache)
  const [btcDom, setBtcDom] = useState<number>(54.2);
  const [btcDomPrev, setBtcDomPrev] = useState<number>(54.2);
  useEffect(() => {
    let cancelled = false;
    const fetchBtcDom = async () => {
      try {
        const res = await fetch('/api/crypto/global');
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled && typeof d.btcDominance === 'number') {
          setBtcDomPrev(d.btcDominance); // will be stale on first render, that's fine
          setBtcDom(d.btcDominance);
        }
      } catch { /* silent */ }
    };
    fetchBtcDom();
    const iv = setInterval(fetchBtcDom, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // DXY — live from FRED DTWEXBGS (Broad Dollar Index, weekly)
  const [dxy, setDxy] = useState<{ value: string; direction: 'up' | 'down' | 'flat' }>({ value: '—', direction: 'flat' });
  useEffect(() => {
    let cancelled = false;
    const fetchDxy = async () => {
      try {
        const res = await fetch('/api/fred?series_id=DTWEXBGS&limit=2');
        if (!res.ok) return;
        const d = await res.json();
        const obs: Array<{ value: string }> = d.observations ?? [];
        if (!cancelled && obs.length >= 1 && obs[0].value !== '.') {
          const current = parseFloat(obs[0].value);
          const prev = obs.length >= 2 && obs[1].value !== '.' ? parseFloat(obs[1].value) : current;
          const dir: 'up' | 'down' | 'flat' = current > prev + 0.1 ? 'up' : current < prev - 0.1 ? 'down' : 'flat';
          setDxy({ value: current.toFixed(1), direction: dir });
        }
      } catch { /* silent */ }
    };
    fetchDxy();
    const iv = setInterval(fetchDxy, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);
  // Fear & Greed proxy from overall score
  const fearGreed = Math.max(0, Math.min(100, Math.round(100 - overall.score * 10)));
  const fearGreedLabel = fearGreed > 75 ? 'Extreme Greed' : fearGreed > 55 ? 'Greed' : fearGreed > 45 ? 'Neutral' : fearGreed > 25 ? 'Fear' : 'Extreme Fear';
  const liveTickerItems: { label: string; value: string; direction: 'up' | 'down' | 'flat' }[] = [
    { label: 'Regime', value: regimeShort, direction: overall.score > 6 ? 'up' : overall.score > 4 ? 'flat' : 'down' },
    { label: 'Pressure Index', value: formatCanonicalScore(overall.score * 10), direction: overall.delta > 0 ? 'up' : 'down' },
    { label: 'Liquidity', value: liquidityLabel, direction: liquidityDir },
    { label: 'AI Concentration', value: aiConcLabel, direction: aiConc > 28 ? 'up' : 'flat' },
    { label: 'Credit Stress', value: creditLabel, direction: creditDir },
    { label: 'VIX', value: vix.toFixed(1), direction: vix > 20 ? 'up' : 'down' },
    { label: 'DXY', value: dxy.value, direction: dxy.direction },
    { label: 'Fed Cut Prob', value: `${fedCutProb}%`, direction: fedCutProb > 50 ? 'down' : 'up' },
    { label: '10Y Treasury', value: `${yield10Y.toFixed(2)}%`, direction: yield10Y > 4.5 ? 'up' : 'flat' },
    { label: 'HY Spread', value: `${hySpread}bps`, direction: hySpread > 350 ? 'up' : 'flat' },
    { label: 'BTC Dominance', value: `${btcDom.toFixed(1)}%`, direction: btcDom > btcDomPrev + 0.2 ? 'up' : btcDom < btcDomPrev - 0.2 ? 'down' : 'flat' },
    { label: 'Market Breadth', value: breadthLabel, direction: breadthScore > 55 ? 'down' : 'up' },
    { label: 'Fear & Greed', value: fearGreedLabel, direction: fearGreed > 55 ? 'down' : fearGreed < 45 ? 'up' : 'flat' },
    // Legacy items for backward compat
    ...tickerValues.filter(t => !['10Y','HY SPREAD','VIX','AI CONC.','SYSTEMIC RISK'].includes(t.label))
      .map(item => ({ ...item, direction: item.direction as 'up' | 'down' | 'flat' })),
  ];

  const isActive = useCallback((path: string) => {
    if (path === "/app") return location === "/app";
    return location.startsWith(path);
  }, [location]);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    setMoreOpen(false);
  }, [navigate]);

  return (
    <DrawerProvider>
    <div className="min-h-screen flex flex-col" style={{ background: '#080A0F', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Edge navigation drawers ── */}
      <LeftNavDrawer breachCount={breachCount} />
      <RightActionDrawer />

      {/* ── Top header bar ── */}
      <header style={{
        background: 'rgba(10, 12, 16, 0.97)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Ticker strip */}
        <div style={{
          background: 'rgba(0, 212, 255, 0.04)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.06)',
          overflow: 'hidden',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: '0', animation: 'ticker-scroll 55s linear infinite', whiteSpace: 'nowrap', willChange: 'transform' }}>
            {[...liveTickerItems, ...liveTickerItems].map((item, i) => (
              <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em', paddingRight: '48px' }}>
                <span style={{ color: '#8A9AB0' }}>{item.label} </span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#B0C4D8' }}>{item.value}</span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#B0C4D8', marginLeft: '2px' }}>{item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '—'}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Regime indicator strip (shows when market intelligence data is loaded) ── */}
        {miData && !isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '3px 16px',
            background: 'rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            overflowX: 'auto',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>REGIME</span>
            {/* Stock regime pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '1px 7px', borderRadius: '3px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#8A9AB0', letterSpacing: '0.08em' }}>EQ</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#93C5FD', letterSpacing: '0.06em' }}>{miData.stockRegime?.regime ?? '—'}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151' }}>{miData.stockRegime?.confidence ? `${miData.stockRegime.confidence}%` : ''}</span>
            </div>
            {/* Crypto regime pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '1px 7px', borderRadius: '3px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#8A9AB0', letterSpacing: '0.08em' }}>BTC</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#FCD34D', letterSpacing: '0.06em' }}>{miData.cryptoRegime?.regime ?? '—'}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151' }}>{miData.cryptoRegime?.confidence ? `${miData.cryptoRegime.confidence}%` : ''}</span>
            </div>
            {/* Alignment pill */}
            {miData.alignmentStatus && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '1px 7px', borderRadius: '3px',
                background: miData.alignmentScore != null && miData.alignmentScore > 65 ? 'rgba(16,185,129,0.08)' : miData.alignmentScore != null && miData.alignmentScore < 35 ? 'rgba(239,68,68,0.08)' : 'rgba(107,114,128,0.08)',
                border: miData.alignmentScore != null && miData.alignmentScore > 65 ? '1px solid rgba(16,185,129,0.2)' : miData.alignmentScore != null && miData.alignmentScore < 35 ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(107,114,128,0.2)',
                flexShrink: 0,
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#8A9AB0', letterSpacing: '0.08em' }}>ALIGN</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: miData.alignmentScore != null && miData.alignmentScore > 65 ? '#6EE7B7' : miData.alignmentScore != null && miData.alignmentScore < 35 ? '#FCA5A5' : '#9CA3AF', letterSpacing: '0.06em' }}>{miData.alignmentStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Logo row + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 16px', borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '24px', height: '24px',
              background: 'linear-gradient(135deg, #00E5FF 0%, #0066FF 100%)',
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8 L6 4 L10 9 L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12 L6 8 L10 11 L14 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: '#FFFFFF', letterSpacing: '0.08em', lineHeight: 1 }}>
                FAULTLINE
              </div>
              {!isMobile && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8A9AB0', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Systemic Risk Intelligence
                </div>
              )}
            </div>
          </div>

          {/* Status + refresh + auth controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSimulating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: '3px' }}>
                <Zap size={9} style={{ color: '#FF9500' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#FF9500', letterSpacing: '0.1em' }}>SIM</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: isLoading ? '#4B5563' : isLive ? '#00FF88' : regime.color,
                boxShadow: isLoading ? 'none' : `0 0 8px ${isLive ? '#00FF88' : regime.color}cc`,
                animation: isLoading ? 'none' : 'pulse-gold 2s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: isLoading ? '#4B5563' : isLive ? '#00FF88' : regime.color, letterSpacing: '0.1em' }}>
                {isLoading ? 'LOADING' : isRefreshing ? 'UPDATING' : isLive ? 'LIVE' : 'SIM'}
              </span>
            </div>
            {/* ── Cmd+K search button ── */}
            <button
              onClick={openCmd}
              title="Search pages & symbols (⌘K)"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: isMobile ? '4px 8px' : '4px 10px',
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,255,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)'; }}
            >
              <Search size={11} style={{ color: '#8A9AB0' }} />
              {!isMobile && (
                <>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A9AB0', letterSpacing: '0.08em' }}>Search</span>
                  <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '2px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151' }}>⌘K</kbd>
                </>
              )}
            </button>

            {isLive && !isLoading && (
              <button
                onClick={forceRefresh}
                title="Force refresh FRED data"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#374151', transition: 'color 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
                onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5A3.5 3.5 0 1 0 5 1.5M1.5 5V2.5M1.5 5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* ── Auth controls ── */}
            {authUser ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px 4px 6px',
                    background: 'rgba(255,255,255,0.14)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.45)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)')}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,229,255,0.45) 0%, rgba(0,102,255,0.3) 100%)',
                    border: '1px solid rgba(0,229,255,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={10} style={{ color: '#00E5FF' }} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#9CA3AF', letterSpacing: '0.08em', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authUser.name?.split(' ')[0] ?? 'USER'}
                  </span>
                  <ChevronDown size={10} style={{ color: '#8A9AB0', flexShrink: 0 }} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <>
                    <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
                      background: 'rgba(10,12,18,0.98)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: '10px',
                      padding: '8px',
                      minWidth: '180px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(12px)',
                    }}>
                      {/* User info */}
                      <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.11)', marginBottom: '6px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#F0F6FF', fontWeight: 600 }}>
                          {authUser.name ?? 'FAULTLINE USER'}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#8A9AB0', marginTop: '2px' }}>
                          {authUser.email ?? ''}
                        </div>
                      </div>

                      {/* Account link */}
                      <button
                        onClick={() => { navigate('/app/account'); setUserMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                          padding: '8px 10px', background: 'transparent', border: 'none',
                          borderRadius: '6px', color: '#9CA3AF', cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em',
                          textAlign: 'left', transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.11)'); (e.currentTarget.style.color = '#F0F6FF'); }}
                        onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = '#9CA3AF'); }}
                      >
                        <User size={12} /> MY ACCOUNT
                      </button>

                      {/* Admin link */}
                      {isAdmin && (
                        <button
                          onClick={() => { navigate('/app/admin'); setUserMenuOpen(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                            padding: '8px 10px', background: 'transparent', border: 'none',
                            borderRadius: '6px', color: '#FF9500', cursor: 'pointer',
                            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em',
                            textAlign: 'left', transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,149,0,0.08)'); }}
                          onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); }}
                        >
                          <Shield size={12} /> OWNER PORTAL
                        </button>
                      )}

                      {/* Logout */}
                      <button
                        onClick={() => { logout(); setUserMenuOpen(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                          padding: '8px 10px', background: 'transparent', border: 'none',
                          borderRadius: '6px', color: '#8A9AB0', cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em',
                          textAlign: 'left', transition: 'all 0.12s ease',
                          marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.09)',
                          paddingTop: '12px',
                        }}
                        onMouseEnter={e => { (e.currentTarget.style.color = '#FF4444'); }}
                        onMouseLeave={e => { (e.currentTarget.style.color = '#8A9AB0'); }}
                      >
                        <LogOut size={12} /> SIGN OUT
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <a
                href={getLoginUrl()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px',
                  background: 'rgba(0,229,255,0.14)',
                  border: '1px solid rgba(0,229,255,0.38)',
                  borderRadius: '20px',
                  color: '#00E5FF',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '13px', letterSpacing: '0.1em',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.14)'; }}
              >
                <LogIn size={11} /> SIGN IN
              </a>
            )}
          </div>
        </div>

        {/* ── Desktop grouped nav ── */}
        <nav className="hidden lg:flex" style={{
          alignItems: 'center',
          padding: '0 12px',
          gap: '0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {NAV_GROUPS.map((group, gi) => {
            const isOwnerPortal = group.label === 'OWNER PORTAL';
            const groupColor = (group as NavGroup & { color?: string }).color ?? '#FFAA00';
            return (
            <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              {/* Group divider (not before first group) */}
              {gi > 0 && (
                <div style={{
                  width: '1px',
                  height: '28px',
                  background: `${groupColor}40`,
                  margin: '0 6px',
                  flexShrink: 0,
                }} />
              )}
              {/* Group label — bright, color-coded category header */}
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9px',
                color: groupColor,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                padding: '0 5px',
                flexShrink: 0,
                userSelect: 'none',
                fontWeight: 700,
                textShadow: `0 0 10px ${groupColor}55`,
                opacity: 0.9,
              }}>
                {group.label}
              </span>
              {/* Group items */}
              {group.items.filter(tab => !(tab.id === 'sim-portfolio' && !isAdmin)).map(tab => {
                const Icon = tab.icon;
                const active = isActive(tab.path);
                const isTrackRecord = tab.id === 'track-record';
                const trackGreen = '#22C55E';
                const isPreFlight = tab.id === 'pre-flight';
                const isSitRoom = tab.id === 'situation-room';
                const isFlagship = isPreFlight || isSitRoom;
                // Flagship colors: Pre-Flight = cyan, Situation Room = amber
                const flagshipColor = isPreFlight ? '#00E5FF' : '#FFAA00';
                const flagshipBg = isPreFlight ? 'rgba(0,229,255,0.14)' : 'rgba(255,170,0,0.08)';
                const flagshipBgActive = isPreFlight ? 'rgba(0,229,255,0.25)' : 'rgba(255,170,0,0.15)';
                const flagshipBorder = isPreFlight ? 'rgba(0,229,255,0.45)' : 'rgba(255,170,0,0.3)';
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigate(tab.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: isFlagship ? '6px 12px' : '7px 10px',
                      borderRadius: isFlagship ? '3px' : '4px',
                      background: active
                        ? (isFlagship ? flagshipBgActive : isTrackRecord ? 'rgba(34,197,94,0.12)' : 'rgba(0, 212, 255, 0.1)')
                        : (isFlagship ? flagshipBg : isTrackRecord ? 'rgba(34,197,94,0.06)' : 'transparent'),
                      border: isFlagship ? `1px solid ${active ? flagshipColor + '66' : flagshipBorder}` : 'none',
                      borderBottom: !isFlagship ? (active
                        ? `2px solid ${isTrackRecord ? trackGreen : '#00E5FF'}`
                        : (isTrackRecord ? `2px solid rgba(34,197,94,0.3)` : '2px solid transparent')) : undefined,
                      color: active
                        ? (isFlagship ? flagshipColor : isTrackRecord ? trackGreen : '#00E5FF')
                        : (isFlagship ? flagshipColor : isTrackRecord ? '#22C55E' : '#8A9AB0'),
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: isFlagship ? '11px' : '10px',
                      fontWeight: isFlagship ? '600' : 'normal',
                      letterSpacing: isFlagship ? '0.1em' : '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      position: 'relative',
                      ...(isFlagship && !active ? { boxShadow: `0 0 10px ${flagshipColor}22` } : {}),
                      ...(isFlagship && active ? { boxShadow: `0 0 14px ${flagshipColor}44` } : {}),
                      ...(isTrackRecord && !active ? { boxShadow: '0 0 8px rgba(34,197,94,0.15)' } : {}),
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = isFlagship ? flagshipColor : isTrackRecord ? '#4ADE80' : '#B0C4D8';
                        (e.currentTarget as HTMLElement).style.background = isFlagship ? flagshipBgActive : isTrackRecord ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.14)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = isFlagship ? flagshipColor : isTrackRecord ? '#22C55E' : '#8A9AB0';
                        (e.currentTarget as HTMLElement).style.background = isFlagship ? flagshipBg : isTrackRecord ? 'rgba(34,197,94,0.06)' : 'transparent';
                      }
                    }}
                  >
                    <Icon size={isFlagship ? 12 : 11} />
                    {tab.label}
                    {isTrackRecord && (
                      <span style={{
                        fontSize: '7px', letterSpacing: '0.1em',
                        color: '#22C55E', background: 'rgba(34,197,94,0.15)',
                        padding: '1px 3px', borderRadius: '2px',
                        border: '1px solid rgba(34,197,94,0.3)',
                        marginLeft: '2px',
                      }}>VERIFIED</span>
                    )}
                    {tab.id === 'watchlist' && breachCount > 0 && (
                      <span style={{
                        background: '#FF2D55', color: '#fff', borderRadius: '8px',
                        fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace",
                        padding: '0 4px', lineHeight: '14px', minWidth: '14px',
                        textAlign: 'center', display: 'inline-block',
                      }}>{breachCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
            );
          })}
        </nav>
      </header>

      {/* ── Universal Ticker Bar (active security strip) ── */}
      <UniversalTickerBar />

      {/* Cinematic refresh flash overlay */}
      {isRefreshing && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, background: 'rgba(0,229,255,0.08)', animation: 'data-refresh-flash 0.8s ease-out forwards' }} />
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, paddingBottom: '0' }} className="lg:pb-0">
        <MarketContextStrip />
        {children}
      </main>

      {/* ── Mobile: bottom primary tabs ── */}
      <nav className="lg:hidden" style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'rgba(10, 12, 16, 0.98)',
        borderTop: '1px solid rgba(0, 212, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {MOBILE_PRIMARY.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => handleNavigate(tab.path)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '8px 2px', gap: '3px',
                background: 'transparent', border: 'none',
                color: active ? '#00E5FF' : '#8B9BB4',
                cursor: 'pointer', position: 'relative',
                transition: 'color 0.15s ease',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #00E5FF, transparent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <div style={{ position: 'relative' }}>
                <Icon size={18} style={{ filter: active ? 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.6))' : 'none' }} />
                {tab.id === 'watchlist' && breachCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-5px',
                    background: '#FF2D55', color: '#fff', borderRadius: '50%',
                    fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace",
                    width: '13px', height: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(255,45,85,0.8)', animation: 'blink-alert 2s ease-in-out infinite',
                  }}>{breachCount}</span>
                )}
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Mobile: "More" drawer ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Drawer */}
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70,
              background: 'rgba(10, 12, 16, 0.99)',
              borderTop: '1px solid rgba(0, 212, 255, 0.15)',
              borderRadius: '16px 16px 0 0',
              padding: '12px 12px 0',
              animation: 'drawer-up 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Drawer handle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#8A9AB0', letterSpacing: '0.15em' }}>
                ALL MODULES
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8A9AB0', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Groups in drawer */}
            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)', paddingRight: 4 }}>
            {[...NAV_GROUPS, ...(isAdmin ? [{ label: "OWNER PORTAL", items: ADMIN_NAV_ITEMS }] : [])].map(group => {
              const isOwnerPortalGroup = group.label === 'OWNER PORTAL';
              return (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px',
                  color: isOwnerPortalGroup ? 'rgba(255,170,0,0.7)' : '#374151',
                  letterSpacing: '0.2em', textTransform: 'uppercase',
                  marginBottom: 8, paddingLeft: 4,
                  ...(isOwnerPortalGroup ? { textShadow: '0 0 8px rgba(255,170,0,0.4)', borderTop: '1px solid rgba(255,170,0,0.2)', paddingTop: 12 } : {}),
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {group.items.filter(tab => !(tab.id === 'sim-portfolio' && !isAdmin)).map(tab => {
                    const Icon = tab.icon;
                    const active = isActive(tab.path);
                    const isTR = tab.id === 'track-record';
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleNavigate(tab.path)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, padding: '8px 4px',
                          borderRadius: 8,
                          background: active
                            ? (isTR ? 'rgba(34,197,94,0.12)' : 'rgba(0, 212, 255, 0.1)')
                            : (isTR ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.14)'),
                          border: active
                            ? `1px solid ${isTR ? 'rgba(34,197,94,0.4)' : 'rgba(0, 212, 255, 0.3)'}`
                            : (isTR ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.11)'),
                          color: active ? (isTR ? '#22C55E' : '#00E5FF') : (isTR ? '#22C55E' : '#B0C4D8'),
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: isTR ? '0 0 12px rgba(34,197,94,0.12)' : 'none',
                        }}
                      >
                        <Icon size={18} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>
                          {tab.label}
                        </span>
                        {isTR && (
                          <span style={{
                            position: 'absolute', top: 5, right: 5,
                            fontSize: '6px', letterSpacing: '0.08em',
                            color: '#22C55E', background: 'rgba(34,197,94,0.15)',
                            padding: '1px 3px', borderRadius: '2px',
                            border: '1px solid rgba(34,197,94,0.3)',
                          }}>✓</span>
                        )}
                        {tab.id === 'watchlist' && breachCount > 0 && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            background: '#FF2D55', color: '#fff', borderRadius: '50%',
                            fontSize: '11px', width: '13px', height: '13px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{breachCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}
            </div>
          </div>
        </>
      )}

      {/* Drawer animation keyframe */}
      <style>{`
        @keyframes drawer-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* ── Universal Command Search (Cmd+K) ── */}
      <CommandSearch isOpen={cmdOpen} onClose={closeCmd} />

      {/* ── ASHA — Spirit of FAULTLINE ── */}
      <AshaIntroModal />
      <AshaPanel />
    </div>
    </DrawerProvider>
  );
}
