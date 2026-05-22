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
  Cpu, MoreHorizontal, X,
} from "lucide-react";
import { loadWatchlist, evaluateBreach, INDICATOR_MAP } from "@/lib/watchlist";
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";

// ── Navigation structure ──────────────────────────────────────
// Groups define the cognitive flow: situational → interpretation → analysis → manage

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
    label: "CORE",
    items: [
      { id: "dashboard",  label: "Dashboard",    shortLabel: "Dash",    icon: LayoutDashboard, path: "/" },
      { id: "pressure",   label: "Pressure",     shortLabel: "Pressure",icon: Gauge,           path: "/pressure" },
      { id: "scores",     label: "Scores",       shortLabel: "Scores",  icon: Activity,        path: "/scores" },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { id: "diagnostic", label: "Diagnostic AI",shortLabel: "AI Diag", icon: Cpu,             path: "/diagnostic" },
      { id: "ai-watch",   label: "AI Watch",     shortLabel: "AI Watch",icon: Brain,           path: "/ai-watch" },
      { id: "signals",    label: "Signals",      shortLabel: "Signals", icon: Radio,           path: "/signals" },
    ],
  },
  {
    label: "ANALYSIS",
    items: [
      { id: "charts",     label: "Charts",       shortLabel: "Charts",  icon: BarChart2,       path: "/charts" },
      { id: "scenarios",  label: "Scenarios",    shortLabel: "Scen",    icon: TrendingUp,      path: "/scenarios" },
      { id: "analogs",    label: "Analogs",      shortLabel: "Analogs", icon: Clock,           path: "/analogs" },
      { id: "simulate",   label: "Simulate",     shortLabel: "Sim",     icon: Zap,             path: "/simulate" },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { id: "watchlist",  label: "Watchlist",    shortLabel: "Watch",   icon: Bell,            path: "/watchlist" },
      { id: "alerts",     label: "Alerts",       shortLabel: "Alerts",  icon: AlertTriangle,   path: "/alerts" },
      { id: "report",     label: "Report",       shortLabel: "Report",  icon: FileText,        path: "/report" },
      { id: "guide",      label: "Guide",        shortLabel: "Guide",   icon: BookOpen,        path: "/guide" },
    ],
  },
];

// Flat list for convenience
const ALL_TABS = NAV_GROUPS.flatMap(g => g.items);

// Mobile primary tabs (bottom bar — 5 most important)
const MOBILE_PRIMARY_IDS = ["dashboard", "pressure", "diagnostic", "signals", "watchlist"];
const MOBILE_PRIMARY = ALL_TABS.filter(t => MOBILE_PRIMARY_IDS.includes(t.id));

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { output, rawFred, isLoading, isLive, isRefreshing, lastUpdated, isSimulating, forceRefresh, indicators } = useEngine();

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

  const { tickerValues, regime } = output;

  // Build live ticker items
  const liveTickerItems = tickerValues.map(item => {
    if (item.label === '10Y' && rawFred['DGS10'] != null) {
      const v = rawFred['DGS10']!;
      return { ...item, value: `${v.toFixed(2)}%`, direction: v > 4.5 ? 'up' as const : 'neutral' as const };
    }
    if (item.label === '30Y' && rawFred['DGS30'] != null) {
      const v = rawFred['DGS30']!;
      return { ...item, value: `${v.toFixed(2)}%`, direction: v > 4.8 ? 'up' as const : 'neutral' as const };
    }
    if (item.label === 'HY SPREAD' && rawFred['BAMLH0A0HYM2'] != null) {
      const v = rawFred['BAMLH0A0HYM2']!;
      const bps = v > 20 ? Math.round(v) : Math.round(v * 100);
      return { ...item, value: `${bps}bps`, direction: bps > 400 ? 'up' as const : 'neutral' as const };
    }
    if (item.label === 'SOFR' && rawFred['SOFR'] != null) {
      const v = rawFred['SOFR']!;
      return { ...item, value: `${v.toFixed(2)}%`, direction: v > 5 ? 'up' as const : 'neutral' as const };
    }
    if (item.label === 'UNRATE' && rawFred['UNRATE'] != null) {
      const v = rawFred['UNRATE']!;
      return { ...item, value: `${v.toFixed(1)}%`, direction: v > 4.5 ? 'up' as const : 'neutral' as const };
    }
    return item;
  });

  const isActive = useCallback((path: string) => {
    if (path === "/") return location === "/";
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.4)',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8 L6 4 L10 9 L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12 L6 8 L10 11 L14 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '18px', color: '#F0F4FF', letterSpacing: '0.08em', lineHeight: 1 }}>
                FAULTLINE
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#6B7280', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Systemic Risk Intelligence
              </div>
            </div>
          </div>

          {/* Status + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isSimulating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 7px', background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)', borderRadius: '3px' }}>
                <Zap size={9} style={{ color: '#FF9500' }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#FF9500', letterSpacing: '0.1em' }}>SIM</span>
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
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              {/* Group divider (not before first group) */}
              {gi > 0 && (
                <div style={{
                  width: '1px',
                  height: '28px',
                  background: 'rgba(255,255,255,0.07)',
                  margin: '0 8px',
                  flexShrink: 0,
                }} />
              )}
              {/* Group label */}
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px',
                color: '#374151',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '0 6px',
                flexShrink: 0,
                userSelect: 'none',
              }}>
                {group.label}
              </span>
              {/* Group items */}
              {group.items.map(tab => {
                const Icon = tab.icon;
                const active = isActive(tab.path);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNavigate(tab.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 10px',
                      borderRadius: '4px',
                      background: active ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                      border: 'none',
                      borderBottom: active ? '2px solid #00D4FF' : '2px solid transparent',
                      color: active ? '#00D4FF' : '#6B7280',
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = '#94A3B8';
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.color = '#6B7280';
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
                  >
                    <Icon size={11} />
                    {tab.label}
                    {tab.id === 'watchlist' && breachCount > 0 && (
                      <span style={{
                        background: '#FF2D55', color: '#fff', borderRadius: '8px',
                        fontSize: '7px', fontFamily: "'IBM Plex Mono', monospace",
                        padding: '0 4px', lineHeight: '14px', minWidth: '14px',
                        textAlign: 'center', display: 'inline-block',
                      }}>{breachCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </header>

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
                    fontSize: '7px', fontFamily: "'IBM Plex Mono', monospace",
                    width: '13px', height: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(255,45,85,0.8)', animation: 'blink-alert 2s ease-in-out infinite',
                  }}>{breachCount}</span>
                )}
              </div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            More
          </span>
        </button>
      </nav>

      {/* ── Mobile: "More" drawer ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden"
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Drawer */}
          <div
            className="lg:hidden"
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
            {NAV_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: 16 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px',
                  color: '#374151', letterSpacing: '0.2em', textTransform: 'uppercase',
                  marginBottom: 8, paddingLeft: 4,
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {group.items.map(tab => {
                    const Icon = tab.icon;
                    const active = isActive(tab.path);
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleNavigate(tab.path)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 6, padding: '12px 8px',
                          borderRadius: 8,
                          background: active ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255,255,255,0.04)',
                          border: active ? '1px solid rgba(0, 212, 255, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                          color: active ? '#00D4FF' : '#94A3B8',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <Icon size={20} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>
                          {tab.shortLabel}
                        </span>
                        {tab.id === 'watchlist' && breachCount > 0 && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6,
                            background: '#FF2D55', color: '#fff', borderRadius: '50%',
                            fontSize: '7px', width: '13px', height: '13px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{breachCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
    </div>
  );
}
