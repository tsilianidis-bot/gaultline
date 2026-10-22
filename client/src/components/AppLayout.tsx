/* ============================================================
   FAULTLINE — application shell
   Desktop: the Five Questions stay visible in the header.
   Mobile: the same five destinations are the entire bottom bar.
   Secondary navigation lives in the accessible LeftNavDrawer.
   ============================================================ */
import { useLocation } from "wouter";
import { ReactNode, useState, useCallback, useMemo } from "react";
import { Activity, Bell, Brain, ChevronDown, Crosshair, LogIn, LogOut, Search, Telescope, User } from "lucide-react";
import { loadWatchlist, evaluateBreach, INDICATOR_MAP } from "@/lib/watchlist";
import MarketContextStrip from "@/components/MarketContextStrip";
import UniversalTickerBar from "@/components/UniversalTickerBar";
import CommandSearch, { useCommandSearch } from "@/components/CommandSearch";
import { useEngine } from "@/contexts/EngineContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import AshaIntroModal from "@/components/AshaIntroModal";
import AshaPanel from "@/components/AshaPanel";
import { customerIntegrityColor } from "@shared/customerIntegrityLabels";
import { buildAppHeaderStrip } from "@/lib/appHeaderStrip";
import { useAppHeaderFred } from "@/hooks/useAppHeaderFred";
import { useLiveIndicatorReadings } from "@/hooks/useLiveIndicatorReadings";
import { evaluableIndicatorValues } from "@/lib/liveIndicatorReadings";
import { DrawerProvider } from "@/contexts/DrawerContext";
import LeftNavDrawer from "@/components/LeftNavDrawer";
import RightActionDrawer from "@/components/RightActionDrawer";
import AppMarketHeader, { type MarketTickerItem } from "@/components/AppMarketHeader";
import GlobalMarketTicker from "@/components/GlobalMarketTicker";
import { NAVIGATION_HIERARCHY, isNavigationItemActive, type NavigationItem } from "@shared/navigationHierarchy";
import { CANONICAL_DESTINATION_BY_ID } from "@shared/routeRegistry";

const PRIMARY_ICON_BY_ID: Record<string, typeof Activity> = {
  now: Activity,
  why: Brain,
  outlook: Telescope,
  watch: Bell,
  act: Crosshair,
};

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
  const { isLoading, isLive, integrityLabel, isRefreshing, isSimulating, canonicalState, marketMode, forceRefresh } = useEngine();
  const { user: authUser, logout } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isOpen: cmdOpen, open: openCmd, close: closeCmd } = useCommandSearch();
  const isMobile = useIsMobile();

  // Market regime intelligence — 10-minute cache, intentionally non-blocking.
  const { data: miData } = trpc.marketIntelligence.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    retry: false,
    trpc: { context: { skipBatch: true } },
  });

  const { readings: liveIndicatorReadings } = useLiveIndicatorReadings();
  const breachCount = useMemo(() => {
    const evaluable = evaluableIndicatorValues(liveIndicatorReadings) as Record<string, number | undefined>;
    const overall100 = marketMode === 'canonical' ? canonicalState?.pressureIndex : null;
    let count = 0;
    loadWatchlist().forEach(item => {
      const definition = INDICATOR_MAP[item.indicatorKey];
      if (!definition) return;
      const liveValue = item.indicatorKey === "score_overall"
        ? (typeof overall100 === "number" && Number.isFinite(overall100) ? overall100 : null)
        : item.indicatorKey.startsWith("score_")
          ? null
          : evaluable[item.indicatorKey] ?? null;
      if (liveValue != null && evaluateBreach(item, liveValue)) count += 1;
    });
    return count;
  }, [liveIndicatorReadings, marketMode, canonicalState?.pressureIndex]);

  const { data: marketSnapshot } = trpc.markets.getGlobalSnapshot.useQuery(undefined, {
    refetchInterval: 90_000,
    staleTime: 60_000,
    retry: 2,
  });
  const headerFred = useAppHeaderFred();
  const liveTickerItems: MarketTickerItem[] = useMemo(() => buildAppHeaderStrip({
    canonical: canonicalState,
    integrity: integrityLabel,
    quotes: marketSnapshot?.items ?? null,
    fred: headerFred,
    now: Date.now(),
  }), [canonicalState, integrityLabel, marketSnapshot?.items, headerFred]);

  const isActive = useCallback((item: NavigationItem) => isNavigationItemActive(item, location), [location]);
  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <DrawerProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "#080A0F", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        {(authUser as { isQaSession?: boolean } | null)?.isQaSession && (
          <div role="status" style={{ position: "fixed", right: 12, bottom: 74, zIndex: 80, border: "1px solid rgba(0,212,255,0.45)", background: "rgba(0,20,28,0.96)", color: "#00D4FF", borderRadius: 4, padding: "7px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.12em", boxShadow: "0 0 16px rgba(0,212,255,0.12)" }}>
            OWNER QA · READ ONLY
          </div>
        )}

        <LeftNavDrawer breachCount={breachCount} />
        <RightActionDrawer />

        <header style={{ background: "rgba(10, 12, 16, 0.97)", borderBottom: "1px solid rgba(0, 212, 255, 0.1)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
          <AppMarketHeader items={liveTickerItems} intelligence={miData} canonicalAvailable={canonicalState !== null} isMobile={isMobile} />
          <GlobalMarketTicker />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 16px", borderBottom: "1px solid rgba(255,255,255,0.14)", gap: 10 }}>
            <button
              className="faultline-nav-focus"
              onClick={() => handleNavigate(CANONICAL_DESTINATION_BY_ID.now.path)}
              style={{ display: "flex", alignItems: "center", gap: "10px", background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: "6px", flexShrink: 0 }}
              title="FAULTLINE — NOW"
            >
              <div style={{ width: 24, height: 24, background: "linear-gradient(135deg, #00E5FF 0%, #0066FF 100%)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(0, 212, 255, 0.4)", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 8 L6 4 L10 9 L14 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12 L6 8 L10 11 L14 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "16px", color: "#FFFFFF", letterSpacing: "0.08em", lineHeight: 1 }}>FAULTLINE</div>
                {!isMobile && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#8A9AB0", letterSpacing: "0.12em", textTransform: "uppercase" }}>Structural Market Intelligence</div>}
              </div>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {isSimulating && <div title="Simulation mode" style={{ display: "flex", alignItems: "center", padding: "2px 6px", borderRadius: 3, background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.3)", color: "#FF9500", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.1em" }}>SIM</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }} aria-live="polite">
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: isLoading ? "#4B5563" : customerIntegrityColor(integrityLabel), boxShadow: isLoading ? "none" : `0 0 8px ${customerIntegrityColor(integrityLabel)}cc` }} />
                {!isMobile && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: isLoading ? "#4B5563" : customerIntegrityColor(integrityLabel), letterSpacing: "0.1em" }}>{isLoading ? "LOADING" : integrityLabel}</span>}
              </div>

              <button
                className="faultline-nav-focus"
                onClick={openCmd}
                title="Search pages and symbols (⌘K)"
                aria-label="Search pages and symbols"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "5px 7px" : "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 4, cursor: "pointer", color: "#8A9AB0" }}
              >
                <Search size={13} />
                {!isMobile && <><span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.08em" }}>Search</span><kbd style={{ padding: "1px 4px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 2, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9 }}>⌘K</kbd></>}
              </button>

              {isLive && !isLoading && (
                <button className="faultline-nav-focus" onClick={forceRefresh} title="Refresh market data" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 3, color: "#8A9AB0", borderRadius: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1.5 5A3.5 3.5 0 1 0 5 1.5M1.5 5V2.5M1.5 5H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}

              {authUser ? (
                <div style={{ position: "relative" }}>
                  <button className="faultline-nav-focus" onClick={() => setUserMenuOpen(open => !open)} aria-expanded={userMenuOpen} aria-haspopup="menu" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 20, cursor: "pointer", color: "#9CA3AF" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg, rgba(0,229,255,0.45), rgba(0,102,255,0.3))", border: "1px solid rgba(0,229,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={10} style={{ color: "#00E5FF" }} /></div>
                    {!isMobile && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.08em", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser.name?.split(" ")[0] ?? "USER"}</span>}
                    <ChevronDown size={10} aria-hidden="true" />
                  </button>
                  {userMenuOpen && <>
                    <button aria-label="Close account menu" onClick={() => setUserMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90, border: "none", background: "transparent", cursor: "default" }} />
                    <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 100, background: "rgba(10,12,18,0.98)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: 8, minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}>
                      <div style={{ padding: "8px 10px 12px", borderBottom: "1px solid rgba(255,255,255,0.11)", marginBottom: 6 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#F0F6FF", fontWeight: 600 }}>{authUser.name ?? "FAULTLINE USER"}</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8A9AB0", marginTop: 2 }}>{authUser.email ?? ""}</div></div>
                      <AccountMenuButton onClick={() => { navigate("/app/account"); setUserMenuOpen(false); }} icon={<User size={12} />} label="MY ACCOUNT" />
                      {isAdmin && <AccountMenuButton onClick={() => { navigate("/app/admin"); setUserMenuOpen(false); }} icon={<Crosshair size={12} />} label="OWNER PORTAL" tone="#FFAA00" />}
                      <AccountMenuButton onClick={() => { logout(); setUserMenuOpen(false); }} icon={<LogOut size={12} />} label="SIGN OUT" />
                    </div>
                  </>}
                </div>
              ) : (
                <a className="faultline-nav-focus" href={getLoginUrl()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "rgba(0,229,255,0.14)", border: "1px solid rgba(0,229,255,0.38)", borderRadius: 20, color: "#00E5FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textDecoration: "none" }}><LogIn size={11} /> {!isMobile && "SIGN IN"}</a>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex" aria-label="The Five Questions" style={{ alignItems: "stretch", padding: "0 12px", overflowX: "auto", scrollbarWidth: "none" }}>
            {NAVIGATION_HIERARCHY.primary.items.map(item => {
              const Icon = PRIMARY_ICON_BY_ID[item.id] ?? Activity;
              const active = isActive(item);
              const accent = item.accent ?? "#00E5FF";
              return (
                <button key={item.id} className="faultline-nav-focus" onClick={() => handleNavigate(item.path)} aria-current={active ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: active ? `${accent}16` : "transparent", border: "none", borderBottom: active ? `2px solid ${accent}` : "2px solid transparent", color: active ? accent : "#A8B8CC", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: active ? 700 : 500, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                  <Icon size={13} aria-hidden="true" />{item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <UniversalTickerBar />
        {isRefreshing && <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, background: "rgba(0,229,255,0.08)", animation: "data-refresh-flash 0.8s ease-out forwards" }} />}

        <main style={{ flex: 1 }} className="pb-[calc(65px+env(safe-area-inset-bottom,0px))] lg:pb-0">
          <MarketContextStrip />
          {children}
        </main>

        <nav className="flex lg:hidden" aria-label="The Five Questions" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10, 12, 16, 0.98)", borderTop: "1px solid rgba(0, 212, 255, 0.16)", backdropFilter: "blur(16px)", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)", overflow: "hidden" }}>
          {NAVIGATION_HIERARCHY.primary.items.map(item => {
            const Icon = PRIMARY_ICON_BY_ID[item.id] ?? Activity;
            const active = isActive(item);
            const accent = item.accent ?? "#00E5FF";
            return (
              <button key={item.id} className="faultline-nav-focus" onClick={() => handleNavigate(item.path)} aria-label={item.label} aria-current={active ? "page" : undefined} style={{ flex: "1 1 20%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "7px 2px", gap: 3, background: "transparent", border: "none", borderTop: active ? `2px solid ${accent}` : "2px solid transparent", color: active ? accent : "#8B9BB4", cursor: "pointer", overflow: "hidden" }}>
                <Icon size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "clamp(8px, 2.5vw, 10px)", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <CommandSearch isOpen={cmdOpen} onClose={closeCmd} />
        {/* PLATO remains available through its intended right-side conversational interface, not navigation. */}
        <AshaIntroModal />
        <AshaPanel />
        <style>{`.faultline-nav-focus:focus-visible { outline: 2px solid #00E5FF; outline-offset: 2px; }`}</style>
      </div>
    </DrawerProvider>
  );
}

function AccountMenuButton({ onClick, icon, label, tone = "#9CA3AF" }: { onClick: () => void; icon: ReactNode; label: string; tone?: string }) {
  return <button role="menuitem" className="faultline-nav-focus" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: "transparent", border: "none", borderRadius: 6, color: tone, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textAlign: "left" }}>{icon}{label}</button>;
}
