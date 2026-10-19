/* ============================================================
   FAULTLINE — consolidated navigation drawer
   One customer hierarchy: Five Questions, Intelligence Dashboards,
   Trading Tools, Daily Brief, and minimal More.
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useLocation } from "wouter";
import {
  Activity, BarChart3, Bell, Bitcoin, BookOpen, Brain, Briefcase, ChevronDown,
  Crosshair, FileText, FlaskConical, Globe, GraduationCap, Gauge, HelpCircle,
  History, Map, Menu, MessageSquare, Newspaper, Radio, RotateCcw, Search,
  Settings, Shield, Sparkles, Target, Telescope, TrendingUp, User, Users, X, Zap,
} from "lucide-react";
import { useDrawer } from "@/contexts/DrawerContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  ADMIN_NAVIGATION_SECTION,
  NAVIGATION_HIERARCHY,
  getSearchNavigationItems,
  isNavigationItemActive,
  sectionHasActiveItem,
  type NavigationIconName,
  type NavigationItem,
  type NavigationSection,
} from "@shared/navigationHierarchy";

const DRAWER_ID = "faultline-navigation-drawer";
const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ICONS: Record<NavigationIconName, ElementType> = {
  activity: Activity,
  brain: Brain,
  network: Brain,
  telescope: Telescope,
  bell: Bell,
  crosshair: Crosshair,
  gauge: Gauge,
  "bar-chart": BarChart3,
  history: History,
  rotate: RotateCcw,
  newspaper: Newspaper,
  radio: Radio,
  bitcoin: Bitcoin,
  sparkles: Sparkles,
  target: Target,
  search: Search,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  "book-open": BookOpen,
  "file-text": FileText,
  user: User,
  help: HelpCircle,
  "graduation-cap": GraduationCap,
  map: Map,
  shield: Shield,
  users: Users,
  settings: Settings,
  "message-square": MessageSquare,
  zap: Zap,
  globe: Globe,
  flask: FlaskConical,
};

interface LeftNavDrawerProps {
  breachCount?: number;
}

export default function LeftNavDrawer({ breachCount = 0 }: LeftNavDrawerProps) {
  const [location, navigate] = useLocation();
  const { leftOpen, toggleLeft, closeLeft } = useDrawer();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [NAVIGATION_HIERARCHY.intelligence.id]: false,
    [NAVIGATION_HIERARCHY.trading.id]: false,
    [NAVIGATION_HIERARCHY.more.id]: false,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => {
    closeLeft();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [closeLeft]);

  const openOrCloseDrawer = useCallback(() => {
    if (leftOpen) closeDrawer();
    else toggleLeft();
  }, [leftOpen, closeDrawer, toggleLeft]);

  // Cmd/Ctrl+B remains an accessible shortcut without putting hidden content in tab order.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        openOrCloseDrawer();
      }
      // Command search owns its own focus; do not leave two modal traps open.
      if (leftOpen && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        closeLeft();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openOrCloseDrawer, leftOpen, closeLeft]);

  // Opening a group for its active child makes deep routes legible without assigning
  // their active state to a Five Questions parent.
  useEffect(() => {
    const expandableSections = [NAVIGATION_HIERARCHY.intelligence, NAVIGATION_HIERARCHY.trading, NAVIGATION_HIERARCHY.more];
    setExpanded(current => {
      let changed = false;
      const next = { ...current };
      expandableSections.forEach(section => {
        if (sectionHasActiveItem(section, location) && !next[section.id]) {
          next[section.id] = true;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [location]);

  // Focus is placed in the search field and held within the visible dialog.
  useEffect(() => {
    if (!leftOpen) {
      setSearch("");
      return;
    }
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [leftOpen, closeDrawer]);

  const allSearchItems = useMemo(() => getSearchNavigationItems(isAdmin), [isAdmin]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return null;
    return allSearchItems.filter(item => [item.label, item.description, item.path, item.id, ...item.keywords]
      .some(value => value.toLowerCase().includes(query)));
  }, [allSearchItems, search]);

  const isActive = useCallback((item: NavigationItem) => isNavigationItemActive(item, location), [location]);
  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    closeDrawer();
  }, [navigate, closeDrawer]);
  const toggleSection = useCallback((id: string) => setExpanded(current => ({ ...current, [id]: !current[id] })), []);

  return (
    <>
      <button
        ref={triggerRef}
        className="faultline-nav-focus"
        onClick={openOrCloseDrawer}
        aria-label={leftOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={leftOpen}
        aria-controls={DRAWER_ID}
        style={{
          position: "fixed", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 200,
          background: "#10151F", border: "1px solid rgba(0,229,255,0.35)", borderLeft: "none",
          borderRadius: "0 8px 8px 0", padding: "12px 7px", cursor: "pointer", display: "flex",
          flexDirection: "column", alignItems: "center", gap: 6, boxShadow: "2px 0 18px rgba(0,0,0,0.42)",
          color: "#A8B8CC",
        }}
      >
        <Menu size={16} aria-hidden="true" />
        <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700, textTransform: "uppercase" }}>NAV</span>
      </button>

      {leftOpen && <>
        <button aria-label="Close navigation" onClick={closeDrawer} style={{ position: "fixed", inset: 0, zIndex: 12000, border: "none", background: "rgba(0,0,0,0.64)", backdropFilter: "blur(2px)", cursor: "default" }} />
        <div
          ref={drawerRef}
          id={DRAWER_ID}
          role="dialog"
          aria-modal="true"
          aria-label="FAULTLINE navigation"
          style={{
            position: "fixed", top: 0, left: 0, bottom: 0, width: "min(350px, calc(100vw - 24px))", zIndex: 12010,
            background: "#0B0F16", borderRight: "1px solid rgba(0,229,255,0.22)", boxShadow: "4px 0 34px rgba(0,0,0,0.52)",
            display: "flex", flexDirection: "column", color: "#E6EDF6", overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.22em", color: "#F0F6FF", fontWeight: 700 }}>FAULTLINE</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: "#6F8199", marginTop: 3 }}>MARKET INTELLIGENCE</div>
            </div>
            <button className="faultline-nav-focus" onClick={closeDrawer} aria-label="Close navigation" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#A8B8CC", padding: 5, borderRadius: 4 }}><X size={18} /></button>
          </div>

          <div style={{ padding: "12px 14px 8px", flexShrink: 0 }}>
            <label htmlFor="faultline-navigation-search" className="sr-only">Search navigation</label>
            <div className="faultline-nav-search" style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "8px 10px" }}>
              <Search size={14} color="#71829B" aria-hidden="true" />
              <input ref={searchRef} id="faultline-navigation-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search navigation" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#F0F6FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.04em" }} />
              {search && <button className="faultline-nav-focus" onClick={() => setSearch("")} aria-label="Clear navigation search" style={{ background: "transparent", border: "none", color: "#71829B", cursor: "pointer", padding: 1 }}><X size={14} /></button>}
            </div>
          </div>

          <nav aria-label="Product navigation" style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 0 20px" }}>
            {filteredItems ? (
              <SearchResults items={filteredItems} isActive={isActive} onNavigate={handleNavigate} breachCount={breachCount} />
            ) : (
              <>
                <SectionLabel section={NAVIGATION_HIERARCHY.primary} prominent />
                {NAVIGATION_HIERARCHY.primary.items.map(item => <NavRow key={item.id} item={item} active={isActive(item)} onNavigate={handleNavigate} />)}

                <ExpandableSection section={NAVIGATION_HIERARCHY.intelligence} expanded={expanded[NAVIGATION_HIERARCHY.intelligence.id]} onToggle={toggleSection} isActive={isActive} onNavigate={handleNavigate} />
                <ExpandableSection section={NAVIGATION_HIERARCHY.trading} expanded={expanded[NAVIGATION_HIERARCHY.trading.id]} onToggle={toggleSection} isActive={isActive} onNavigate={handleNavigate} />

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 12, paddingTop: 10 }}>
                  <NavRow item={NAVIGATION_HIERARCHY.dailyBrief.items[0]} active={isActive(NAVIGATION_HIERARCHY.dailyBrief.items[0])} onNavigate={handleNavigate} emphasis />
                </div>

                <ExpandableSection section={NAVIGATION_HIERARCHY.more} expanded={expanded[NAVIGATION_HIERARCHY.more.id]} onToggle={toggleSection} isActive={isActive} onNavigate={handleNavigate} />

                {isAdmin && <div style={{ borderTop: "1px solid rgba(255,170,0,0.2)", marginTop: 12, paddingTop: 10 }}>
                  <SectionLabel section={ADMIN_NAVIGATION_SECTION} tone="#FFAA00" />
                  {ADMIN_NAVIGATION_SECTION.items.map(item => <NavRow key={item.id} item={item} active={isActive(item)} onNavigate={handleNavigate} tone="#FFAA00" />)}
                </div>}
              </>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 16, padding: "12px 14px 0" }}>
              {authUser ? <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#71829B", padding: "4px 2px" }}>{authUser.name ?? authUser.email ?? "User"}</div> : <a className="faultline-nav-focus" href={getLoginUrl()} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 12px", borderRadius: 6, background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.28)", color: "#00E5FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.1em", textDecoration: "none", fontWeight: 600 }}>SIGN IN</a>}
            </div>
          </nav>

          <div style={{ padding: "9px 16px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#71829B" }}><span>⌘B navigation</span><span>⌘K search</span></div>
        </div>
      </>}

      <style>{`.faultline-nav-focus:focus-visible, .faultline-nav-search:focus-within { outline: 2px solid #00E5FF; outline-offset: 2px; } #${DRAWER_ID} nav .faultline-nav-focus:not([aria-current="page"]):hover { background: rgba(0,229,255,0.07) !important; color: #F0F6FF !important; }`}</style>
    </>
  );
}

function SectionLabel({ section, prominent = false, tone = "#71829B" }: { section: NavigationSection; prominent?: boolean; tone?: string }) {
  return <div style={{ padding: "8px 16px 5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: prominent ? 10 : 9, letterSpacing: "0.18em", color: prominent ? "#00E5FF" : tone, fontWeight: prominent ? 700 : 600, textTransform: "uppercase" }}>
    {section.label}
  </div>;
}

function ExpandableSection({ section, expanded, onToggle, isActive, onNavigate }: { section: NavigationSection; expanded: boolean; onToggle: (id: string) => void; isActive: (item: NavigationItem) => boolean; onNavigate: (path: string) => void }) {
  const controlId = `faultline-nav-section-${section.id}`;
  const hasActiveItem = section.items.some(isActive);
  return <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 12, paddingTop: 6 }}>
    <button className="faultline-nav-focus" onClick={() => onToggle(section.id)} aria-expanded={expanded} aria-controls={controlId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 16px 6px", background: "transparent", border: "none", color: hasActiveItem ? "#00E5FF" : "#A8B8CC", cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.16em", fontWeight: 700 }}>{section.label}</span>
      <ChevronDown size={15} aria-hidden="true" style={{ transform: expanded ? "rotate(180deg)" : "none", flexShrink: 0 }} />
    </button>
    <div id={controlId} hidden={!expanded}>{expanded && section.items.map(item => <NavRow key={item.id} item={item} active={isActive(item)} onNavigate={onNavigate} />)}</div>
  </div>;
}

function SearchResults({ items, isActive, onNavigate, breachCount }: { items: readonly NavigationItem[]; isActive: (item: NavigationItem) => boolean; onNavigate: (path: string) => void; breachCount: number }) {
  return <div>
    <div style={{ padding: "8px 16px 5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "#71829B" }}>RESULTS</div>
    {items.length ? items.map(item => <NavRow key={item.id} item={item} active={isActive(item)} onNavigate={onNavigate} breachCount={item.id === "watchlist" ? breachCount : 0} />) : <div style={{ padding: "14px 16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#71829B" }}>No matching destinations</div>}
  </div>;
}

function NavRow({ item, active, onNavigate, breachCount = 0, emphasis = false, tone = "#00E5FF" }: { item: NavigationItem; active: boolean; onNavigate: (path: string) => void; breachCount?: number; emphasis?: boolean; tone?: string }) {
  const Icon = ICONS[item.icon];
  return <button className="faultline-nav-focus" onClick={() => onNavigate(item.path)} aria-current={active ? "page" : undefined} title={item.description} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: emphasis ? "10px 16px" : "9px 16px", background: active ? `${tone}16` : "transparent", border: "none", borderLeft: active ? `3px solid ${tone}` : "3px solid transparent", color: active ? "#F0F6FF" : "#A8B8CC", cursor: "pointer", textAlign: "left" }}>
    <Icon size={15} color={active || emphasis ? tone : "#71829B"} aria-hidden="true" style={{ flexShrink: 0 }} />
    <span style={{ flex: 1, minWidth: 0, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.04em", fontWeight: active || emphasis ? 600 : 400 }}>{item.label}</span>
    {breachCount > 0 && <span style={{ background: "#FF2D55", color: "#fff", borderRadius: 8, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", padding: "0 5px", lineHeight: "16px", minWidth: 16, textAlign: "center" }}>{breachCount}</span>}
  </button>;
}
