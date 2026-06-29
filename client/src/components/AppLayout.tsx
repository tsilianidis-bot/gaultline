/* ============================================================
   FAULTLINE — AppLayout v2
   Desktop: top nav with grouped sections + dividers
   Mobile: bottom tab bar (5 primary) + "More" overflow drawer
   Design: Palantir Noir — void black, neon accents, scanlines
   ============================================================ */
import { useLocation } from "wouter";
import { ReactNode, useState, useCallback } from "react";
import {
  Activity, BarChart2, Brain, Clock, AlertTriangle, TrendingUp,
  LayoutDashboard, Zap, FileText, Bell, Radio, Gauge, BookOpen,
  Cpu, MoreHorizontal, X, Briefcase, Shield, Bitcoin, Bookmark, Waves, BarChart3,
  User, LogIn, Crown, ChevronDown, LogOut, RotateCcw, Trophy, Newspaper, Settings, History, Crosshair, Eye, Search, Telescope, MessageSquare, Sparkles, Target, MessageCircle, Command, ScanSearch, FlaskConical,
} from "lucide-react";
import { loadWatchlist, evaluateBreach, INDICATOR_MAP } from "@/lib/watchlist";
import AIReceptionistLink from "@/components/AIReceptionistLink";
import UniversalTickerBar from "@/components/UniversalTickerBar";
import CommandSearch, { useCommandSearch } from "@/components/CommandSearch";
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

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
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    // INTELLIGENCE: Observe — situational awareness and proactive discovery
    label: "INTELLIGENCE",
    items: [
      { id: "discover",       label: "Ask FAULTLINE",       shortLabel: "Ask",         icon: Search,          path: "/app/discover" },
      { id: "command",        label: "Command Center",       shortLabel: "Command",     icon: Command,         path: "/app/command" },
      { id: "todays-story",   label: "Today's Story",       shortLabel: "Story",       icon: BookOpen,        path: "/app/todays-story" },
      { id: "opportunities",  label: "Opportunities",       shortLabel: "Opps",        icon: Sparkles,        path: "/app/opportunities" },
      { id: "signals",        label: "Signals",             shortLabel: "Signals",     icon: Radio,           path: "/app/signals" },
      { id: "crypto",         label: "Crypto Hub",          shortLabel: "Crypto",      icon: Bitcoin,         path: "/app/crypto" },
      { id: "pre-flight",     label: "Pre-Flight",          shortLabel: "Pre-Flight",  icon: Shield,          path: "/app/pre-flight" },
      { id: "dashboard",      label: "Dashboard",           shortLabel: "Dash",        icon: LayoutDashboard, path: "/app/dashboard" },
    ],
  },
  {
    // ANALYSIS: Analyze + Decide — deep intelligence and decision support
    label: "ANALYSIS",
    items: [
      { id: "symbol-intel",    label: "Symbol Intelligence", shortLabel: "Symbol Intel", icon: Telescope,     path: "/app/symbol-intelligence" },
      { id: "decision-engine", label: "Decision Engine",     shortLabel: "Decide",       icon: Crosshair,     path: "/app/decision-engine" },
      { id: "diagnostic",      label: "AI Diagnostic",       shortLabel: "Diagnostic",   icon: Cpu,           path: "/app/diagnostic" },
      { id: "pressure",        label: "Market Stress",       shortLabel: "Stress",       icon: Gauge,         path: "/app/pressure" },
      { id: "signal-outlook",  label: "Signal Outlook",      shortLabel: "Outlook",      icon: Eye,           path: "/app/signal-outlook" },
      { id: "day-trade",       label: "Day Trade Intel",     shortLabel: "Day Trade",    icon: Target,        path: "/app/day-trade-intelligence" },
    ],
  },
  {
    // PORTFOLIO: Monitor — track, manage, and review positions
    label: "PORTFOLIO",
    items: [
      { id: "portfolio",     label: "Portfolio",       shortLabel: "Portfolio",  icon: Briefcase,  path: "/app/portfolio" },
      { id: "watchlist",     label: "Watchlist",       shortLabel: "Watch",      icon: Bell,       path: "/app/watchlist" },
      { id: "alt-rotation",  label: "Sector Rotation", shortLabel: "Rotation",   icon: RotateCcw,  path: "/app/alt-rotation" },
      { id: "trade-journal", label: "Trade Journal",   shortLabel: "Journal",    icon: BookOpen,   path: "/app/trade-journal" },
      { id: "decision-ledger", label: "Decision Ledger",  shortLabel: "Ledger",     icon: Bookmark,   path: "/app/decision-ledger" },
    ],
  },
  {
    // LEARN: Context, education, and account management
    label: "LEARN",
    items: [
      { id: "report",       label: "Daily Briefing", shortLabel: "Briefing",  icon: FileText,   path: "/app/report" },
      { id: "track-record",  label: "Track Record",   shortLabel: "Track Rec", icon: Trophy,        path: "/app/track-record" },
      { id: "validation-lab", label: "Validation Lab", shortLabel: "Val. Lab",  icon: FlaskConical,  path: "/app/validation-lab" },
      { id: "fmos-health",     label: "FMOS Health",     shortLabel: "FMOS",      icon: Shield,        path: "/app/fmos-health" },
      { id: "guide",          label: "Guide",          shortLabel: "Guide",     icon: BookOpen,      path: "/app/guide" },
      { id: "account",      label: "Account",        shortLabel: "Account",   icon: User,       path: "/app/account" },
    ],
  },
];

// Owner Portal nav items — admin-only group rendered last with distinct amber styling
const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "admin-portal",     label: "Owner Portal",     shortLabel: "Portal",    icon: Shield,    path: "/app/admin" },
  { id: "admin-users",      label: "Users",            shortLabel: "Users",     icon: User,      path: "/app/admin/users" },
  { id: "x-posts",          label: "X Posts",          shortLabel: "X Posts",   icon: Zap,       path: "/app/x-posts" },
  { id: "x-post-queue",     label: "Post Queue",       shortLabel: "Queue",     icon: Settings,  path: "/app/x-post-queue" },
  { id: "admin-blog",       label: "Blog Manager",     shortLabel: "Blog Mgr",  icon: Newspaper, path: "/app/admin/blog" },
  { id: "admin-publishing", label: "Publishing",        shortLabel: "Publish",   icon: Zap,       path: "/app/admin/publishing" },
  { id: "owner-simulation", label: "Owner Simulation", shortLabel: "Simulation",icon: Trophy,    path: "/owner/simulation" },
  { id: "seo-optimizer",    label: "SEO Optimizer",    shortLabel: "SEO",       icon: Search,    path: "/app/seo-optimizer" },
  { id: "analytics",        label: "Site Analytics",   shortLabel: "Analytics", icon: BarChart2, path: "/app/analytics" },
  { id: "chat-inbox",       label: "Chat Inbox",       shortLabel: "Chat",      icon: MessageCircle, path: "/app/admin/chat-inbox" },
];

// Flat list for convenience
const ALL_TABS = NAV_GROUPS.flatMap(g => g.items);

// Mobile primary tabs (bottom bar — 5 most important)
// Market Stress replaces Blog as a primary tab
// Mobile primary tabs: Today (Dashboard), Signals, Portfolio, Search (Symbol Intel), Account
const MOBILE_PRIMARY_IDS = ["discover", "signals", "portfolio", "symbol-intel", "account"];
const MOBILE_PRIMARY = ALL_TABS.filter(t => MOBILE_PRIMARY_IDS.includes(t.id));

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
  // BTC dominance — static proxy (no live feed)
  const btcDom = 54.2;
  // Fear & Greed proxy from overall score
  const fearGreed = Math.max(0, Math.min(100, Math.round(100 - overall.score * 10)));
  const fearGreedLabel = fearGreed > 75 ? 'Extreme Greed' : fearGreed > 55 ? 'Greed' : fearGreed > 45 ? 'Neutral' : fearGreed > 25 ? 'Fear' : 'Extreme Fear';
  const liveTickerItems: { label: string; value: string; direction: 'up' | 'down' | 'flat' }[] = [
    { label: 'Regime', value: regimeShort, direction: overall.score > 6 ? 'up' : overall.score > 4 ? 'flat' : 'down' },
    { label: 'Pressure Index', value: `${overall.score.toFixed(1)}`, direction: overall.delta > 0 ? 'up' : 'down' },
    { label: 'Liquidity', value: liquidityLabel, direction: liquidityDir },
    { label: 'AI Concentration', value: aiConcLabel, direction: aiConc > 28 ? 'up' : 'flat' },
    { label: 'Credit Stress', value: creditLabel, direction: creditDir },
    { label: 'VIX', value: vix.toFixed(1), direction: vix > 20 ? 'up' : 'down' },
    { label: 'DXY', value: '97.4', direction: 'flat' },
    { label: 'Fed Cut Prob', value: `${fedCutProb}%`, direction: fedCutProb > 50 ? 'down' : 'up' },
    { label: '10Y Treasury', value: `${yield10Y.toFixed(2)}%`, direction: yield10Y > 4.5 ? 'up' : 'flat' },
    { label: 'HY Spread', value: `${hySpread}bps`, direction: hySpread > 350 ? 'up' : 'flat' },
    { label: 'BTC Dominance', value: `${btcDom}%`, direction: 'flat' },
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
    <div className="min-h-screen flex flex-col" style={{ background: '#050608', fontFamily: "'IBM Plex Sans', sans-serif" }}>

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
          <div style={{
            display: 'flex',
            gap: '48px',
            animation: 'ticker-scroll 40s linear infinite',
            whiteSpace: 'nowrap',
            paddingLeft: '100%',
          }}>
            {liveTickerItems.map((item, i) => (
              <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>
                <span style={{ color: '#6B7280' }}>{item.label} </span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8' }}>{item.value}</span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8', marginLeft: '2px' }}>{item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '—'}</span>
              </span>
            ))}
            {liveTickerItems.slice(0, 5).map((item, i) => (
              <span key={`dup-${i}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>
                <span style={{ color: '#6B7280' }}>{item.label} </span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8' }}>{item.value}</span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8', marginLeft: '2px' }}>{item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '—'}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Logo row + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '24px', height: '24px',
              background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
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
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '16px', color: '#F0F4FF', letterSpacing: '0.08em', lineHeight: 1 }}>
                FAULTLINE
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Systemic Risk Intelligence
              </div>
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
            {/* ── AI Receptionist phone ── */}
            <AIReceptionistLink variant="button" location="header" />

            {/* ── Cmd+K search button ── */}
            <button
              onClick={openCmd}
              title="Search pages & symbols (⌘K)"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,255,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <Search size={11} style={{ color: '#6B7280' }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7280', letterSpacing: '0.08em' }}>Search</span>
              <kbd style={{ padding: '1px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#374151' }}>⌘K</kbd>
            </button>

            {isLive && !isLoading && (
              <button
                onClick={forceRefresh}
                title="Force refresh FRED data"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: '#374151', transition: 'color 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#00D4FF')}
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
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,102,255,0.3) 100%)',
                    border: '1px solid rgba(0,212,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={10} style={{ color: '#00D4FF' }} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#9CA3AF', letterSpacing: '0.08em', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {authUser.name?.split(' ')[0] ?? 'USER'}
                  </span>
                  <ChevronDown size={10} style={{ color: '#6B7280', flexShrink: 0 }} />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <>
                    <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
                      background: 'rgba(10,12,18,0.98)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '8px',
                      minWidth: '180px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(12px)',
                    }}>
                      {/* User info */}
                      <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '6px' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#E2E8F0', fontWeight: 600 }}>
                          {authUser.name ?? 'FAULTLINE USER'}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
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
                        onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.06)'); (e.currentTarget.style.color = '#E2E8F0'); }}
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
                          borderRadius: '6px', color: '#6B7280', cursor: 'pointer',
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.08em',
                          textAlign: 'left', transition: 'all 0.12s ease',
                          marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)',
                          paddingTop: '12px',
                        }}
                        onMouseEnter={e => { (e.currentTarget.style.color = '#FF4444'); }}
                        onMouseLeave={e => { (e.currentTarget.style.color = '#6B7280'); }}
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
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  borderRadius: '20px',
                  color: '#00D4FF',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '13px', letterSpacing: '0.1em',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.15)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.08)'; }}
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
          {[...NAV_GROUPS, ...(isAdmin ? [{ label: "OWNER PORTAL", items: ADMIN_NAV_ITEMS }] : [])].map((group, gi) => {
            const isOwnerPortal = group.label === 'OWNER PORTAL';
            return (
            <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              {/* Group divider (not before first group) */}
              {gi > 0 && (
                <div style={{
                  width: '1px',
                  height: '28px',
                  background: isOwnerPortal ? 'rgba(255,170,0,0.35)' : 'rgba(255,255,255,0.07)',
                  margin: isOwnerPortal ? '0 12px' : '0 8px',
                  flexShrink: 0,
                }} />
              )}
              {/* Group label */}
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '12px',
                color: isOwnerPortal ? 'rgba(255,170,0,0.7)' : '#374151',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '0 6px',
                flexShrink: 0,
                userSelect: 'none',
                ...(isOwnerPortal ? { textShadow: '0 0 8px rgba(255,170,0,0.4)' } : {}),
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
                const flagshipColor = isPreFlight ? '#00D4FF' : '#FFAA00';
                const flagshipBg = isPreFlight ? 'rgba(0,212,255,0.08)' : 'rgba(255,170,0,0.08)';
                const flagshipBgActive = isPreFlight ? 'rgba(0,212,255,0.15)' : 'rgba(255,170,0,0.15)';
                const flagshipBorder = isPreFlight ? 'rgba(0,212,255,0.3)' : 'rgba(255,170,0,0.3)';
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
                        ? `2px solid ${isTrackRecord ? trackGreen : '#00D4FF'}`
                        : (isTrackRecord ? `2px solid rgba(34,197,94,0.3)` : '2px solid transparent')) : undefined,
                      color: active
                        ? (isFlagship ? flagshipColor : isTrackRecord ? trackGreen : '#00D4FF')
                        : (isFlagship ? flagshipColor : isTrackRecord ? '#22C55E' : '#6B7280'),
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
                        (e.currentTarget as HTMLElement).style.color = isFlagship ? flagshipColor : isTrackRecord ? '#4ADE80' : '#94A3B8';
                        (e.currentTarget as HTMLElement).style.background = isFlagship ? flagshipBgActive : isTrackRecord ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = isFlagship ? flagshipColor : isTrackRecord ? '#22C55E' : '#6B7280';
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, background: 'rgba(0,212,255,0.03)', animation: 'data-refresh-flash 0.8s ease-out forwards' }} />
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, paddingBottom: '72px' }} className="lg:pb-0">
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
                color: active ? '#00D4FF' : '#4B5563',
                cursor: 'pointer', position: 'relative',
                transition: 'color 0.15s ease',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
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

        {/* "More" button */}
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '8px 2px', gap: '3px',
            background: 'transparent', border: 'none',
            color: moreOpen ? '#00D4FF' : '#4B5563',
            cursor: 'pointer',
            transition: 'color 0.15s ease',
          }}
        >
          <MoreHorizontal size={18} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            More
          </span>
        </button>
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
              padding: '16px 16px calc(env(safe-area-inset-bottom) + 80px)',
              animation: 'drawer-up 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            {/* Drawer handle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7280', letterSpacing: '0.15em' }}>
                ALL MODULES
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Groups in drawer */}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
                          gap: 6, padding: '12px 8px',
                          borderRadius: 8,
                          background: active
                            ? (isTR ? 'rgba(34,197,94,0.12)' : 'rgba(0, 212, 255, 0.1)')
                            : (isTR ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)'),
                          border: active
                            ? `1px solid ${isTR ? 'rgba(34,197,94,0.4)' : 'rgba(0, 212, 255, 0.3)'}`
                            : (isTR ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,255,255,0.06)'),
                          color: active ? (isTR ? '#22C55E' : '#00D4FF') : (isTR ? '#22C55E' : '#94A3B8'),
                          cursor: 'pointer',
                          position: 'relative',
                          boxShadow: isTR ? '0 0 12px rgba(34,197,94,0.12)' : 'none',
                        }}
                      >
                        <Icon size={20} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>
                          {tab.shortLabel}
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
    </div>
  );
}
