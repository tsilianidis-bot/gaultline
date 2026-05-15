/* ============================================================
   FAULTLINE — AppLayout
   Mobile: bottom tab navigation | Desktop: left rail navigation
   Design: Palantir Noir — void black, neon accents, scanlines
   ============================================================ */
import { useLocation } from "wouter";
import { ReactNode } from "react";
import {
  Activity, BarChart2, Brain, Clock, AlertTriangle, TrendingUp, LayoutDashboard, Zap, FileText, Bell, Radio
} from "lucide-react";
import { loadWatchlist, evaluateBreach, INDICATOR_MAP } from "@/lib/watchlist";
import { useMemo } from "react";
import { useEngine } from "@/contexts/EngineContext";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "scores", label: "Scores", icon: Activity, path: "/scores" },
  { id: "charts", label: "Charts", icon: BarChart2, path: "/charts" },
  { id: "ai-watch", label: "AI Watch", icon: Brain, path: "/ai-watch" },
  { id: "scenarios", label: "Scenarios", icon: TrendingUp, path: "/scenarios" },
  { id: "alerts", label: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { id: "analogs", label: "Analogs", icon: Clock, path: "/analogs" },
  { id: "simulate", label: "Simulate", icon: Zap, path: "/simulate" },
  { id: "report", label: "Report", icon: FileText, path: "/report" },
  { id: "watchlist", label: "Watch", icon: Bell, path: "/watchlist" },
  { id: "signals", label: "Signals", icon: Radio, path: "/signals" },
];

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
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

  // Build live ticker items — prefer rawFred values over engine-computed
  const liveTickerItems = tickerValues.map(item => {
    // Override specific items with direct FRED values
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
    if (item.label === 'CPI' && rawFred['CPIAUCSL'] != null) {
      return item; // CPI shown as YoY from engine
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

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050608', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Top header bar */}
      <header style={{
        background: 'rgba(10, 12, 16, 0.95)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Ticker strip */}
        <div style={{
          background: 'rgba(0, 212, 255, 0.04)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
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
            {/* Duplicate for seamless loop */}
            {liveTickerItems.slice(0, 5).map((item, i) => (
              <span key={`dup-${i}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>
                <span style={{ color: '#6B7280' }}>{item.label} </span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8' }}>{item.value}</span>
                <span style={{ color: item.direction === 'up' ? '#FF9500' : item.direction === 'down' ? '#00FF88' : '#94A3B8', marginLeft: '2px' }}>{item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '—'}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Main header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
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

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden lg:flex" style={{ gap: '2px' }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.path);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: active ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                    border: active ? '1px solid rgba(0, 212, 255, 0.2)' : '1px solid transparent',
                    color: active ? '#00D4FF' : '#6B7280',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
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
                  <Icon size={12} />
                  {tab.label}
                  {tab.id === 'watchlist' && breachCount > 0 && (
                    <span style={{ marginLeft: '4px', background: '#FF2D55', color: '#fff', borderRadius: '8px', fontSize: '8px', fontFamily: "'IBM Plex Mono', monospace", padding: '0 4px', lineHeight: '14px', minWidth: '14px', textAlign: 'center', display: 'inline-block' }}>{breachCount}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Cinematic refresh flash overlay */}
          {isRefreshing && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, background: 'rgba(0,212,255,0.03)', animation: 'data-refresh-flash 0.8s ease-out forwards' }} />
          )}

          {/* Status indicator — live data + simulate state */}
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
      </header>

      {/* Main content */}
      <main style={{ flex: 1, paddingBottom: '72px' }} className="lg:pb-0">
        {children}
      </main>

      {/* Bottom tab navigation — mobile only */}
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
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 2px',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                color: active ? '#00D4FF' : '#4B5563',
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s ease',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '20%', right: '20%',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #00D4FF, transparent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <div style={{ position: 'relative' }}>
                <Icon size={18} style={{ filter: active ? 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.6))' : 'none' }} />
                {tab.id === 'watchlist' && breachCount > 0 && (
                  <span style={{ position: 'absolute', top: '-4px', right: '-5px', background: '#FF2D55', color: '#fff', borderRadius: '50%', fontSize: '7px', fontFamily: "'IBM Plex Mono', monospace", width: '13px', height: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px rgba(255,45,85,0.8)', animation: 'blink-alert 2s ease-in-out infinite' }}>{breachCount}</span>
                )}
              </div>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '8px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
