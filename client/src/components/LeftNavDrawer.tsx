/* ============================================================
   LeftNavDrawer — High-contrast navigation drawer
   Design: "The intelligence remains dark. The controls become light."
   - Warm ivory/stone edge tab — always visible
   - Slides in from left on tap/click
   - Dark charcoal text on light stone surface
   - 4-group hierarchy: Primary / Market Intelligence / Personal / System
   - Active state: amber left indicator + stronger weight
   - Global search at top
   - Keyboard: Cmd+B toggles
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Menu, X, Search, ChevronRight,
  Activity, Brain, Command, LayoutDashboard, BookOpen, Gauge, FileText,
  Eye, Shield, Users, TrendingDown, RotateCcw, Bitcoin, BarChart3,
  Search as SearchIcon, Sparkles, Radio, Telescope, Crosshair, Target, TrendingUp,
  BellRing, Bell, Briefcase, BookOpen as JournalIcon,
  History, User, Settings, HelpCircle, Newspaper,
  BarChart2, Zap, Trophy, FlaskConical, BrainCircuit,
  Clock, Layers, Map, AlertTriangle,
  Flame, Plane, Grid3X3, Beaker, BookMarked, FlaskRound,
  LineChart, Cpu, MessageSquare, Send, PieChart,
  Library, GraduationCap, Scale, Globe,
} from "lucide-react";
import { useDrawer } from "@/contexts/DrawerContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { CANONICAL_DESTINATIONS, CANONICAL_DESTINATION_BY_ID, EXPERT_WORKSPACES, PERSISTENT_UTILITIES } from "@shared/routeRegistry";
import { getRouteIcon } from "@/lib/routeIcons";

// ── Navigation structure per spec ────────────────────────────
// PRIMARY: most-used destinations
// MARKET INTELLIGENCE: analytical workspaces
// PERSONAL: user-specific tools
// SYSTEM: account, settings, help

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "MARKET QUESTIONS",
    items: CANONICAL_DESTINATIONS.map(destination => ({
      id: destination.id,
      label: destination.label,
      icon: getRouteIcon(destination.icon),
      path: destination.path,
    })),
  },
  {
    label: "UTILITIES",
    items: PERSISTENT_UTILITIES.flatMap(utility => utility.path ? [{
      id: utility.id,
      label: utility.label,
      icon: getRouteIcon(utility.icon),
      path: utility.path,
    }] : []),
  },
  {
    label: "EXPERT WORKSPACES",
    items: EXPERT_WORKSPACES.map(workspace => ({
      id: workspace.id,
      label: workspace.label,
      icon: getRouteIcon(workspace.icon),
      path: workspace.path,
    })),
  },
  {
    label: "RESOURCES",
    items: [
      { id: "blog", label: "Blog", icon: Newspaper, path: "/blog" },
      { id: "glossary", label: "Glossary", icon: GraduationCap, path: "/app/glossary" },
      { id: "track-record", label: "Track Record", icon: Trophy, path: "/app/track-record" },
      { id: "methodology", label: "Methodology", icon: Scale, path: "/methodology" },
    ],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { id: "admin-portal",     label: "Owner Portal",            icon: Shield,        path: "/app/admin" },
  { id: "analytics",        label: "Site Analytics",          icon: BarChart2,     path: "/app/analytics" },
  { id: "admin-blog",       label: "Blog Manager",            icon: Newspaper,     path: "/app/admin/blog" },
  { id: "x-posts",          label: "X Posts",                 icon: Zap,           path: "/app/x-posts" },
  { id: "x-post-queue",     label: "X Post Queue",            icon: Send,          path: "/app/x-post-queue" },
  { id: "engineering",      label: "Engineering Diagnostics", icon: FlaskConical,  path: "/app/admin/engineering" },
  { id: "chat-inbox",       label: "ASHA Intelligence",       icon: BrainCircuit,  path: "/app/asha-intelligence" },
  { id: "seo-optimizer",    label: "SEO Optimizer",           icon: Globe,         path: "/app/seo-optimizer" },
  { id: "admin-users",      label: "User Management",         icon: Users,         path: "/app/admin/users" },
  { id: "admin-publishing", label: "Publishing",              icon: Library,       path: "/app/admin/publishing" },
  { id: "conv-intel",       label: "Conversation Intel",      icon: MessageSquare, path: "/app/admin/conversation-intelligence" },
  { id: "fmos-health",      label: "FMOS Health",             icon: Cpu,           path: "/app/fmos-health" },
  { id: "intel-validation", label: "Intel Validation",        icon: LineChart,     path: "/app/intelligence-validation" },
];

// ── Searchable flat list ──────────────────────────────────────
const ALL_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap(g => g.items),
  ...ADMIN_ITEMS,
];

// ── Colours ───────────────────────────────────────────────────
const DRAWER_BG    = "#F5F2EE";   // warm ivory
const DRAWER_BORDER = "#E2DDD7";  // soft stone border
const TEXT_PRIMARY  = "#1A1A1A";  // near-black charcoal
const TEXT_SECONDARY = "#5A5A5A"; // medium charcoal
const TEXT_MUTED    = "#8A8A8A";  // muted for group labels
const ACTIVE_ACCENT = "#B8860B";  // restrained gold/amber
const ACTIVE_BG     = "#EDE8DF";  // warm active row bg
const TAB_BG        = "#EDE8DF";  // edge tab background
const SEARCH_BG     = "#FFFFFF";  // white search field

interface LeftNavDrawerProps {
  breachCount?: number;
}

export default function LeftNavDrawer({ breachCount = 0 }: LeftNavDrawerProps) {
  const [location, navigate] = useLocation();
  const { leftOpen, toggleLeft, closeLeft } = useDrawer();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleLeft();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleLeft]);

  // Focus search when drawer opens
  useEffect(() => {
    if (leftOpen) {
      setTimeout(() => searchRef.current?.focus(), 150);
    } else {
      setSearch("");
    }
  }, [leftOpen]);

  // Tap-outside close
  useEffect(() => {
    if (!leftOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        closeLeft();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [leftOpen, closeLeft]);

  const isActive = useCallback((path: string) => {
    if (path === CANONICAL_DESTINATION_BY_ID.now.path) {
      return location === "/app" || location.startsWith(CANONICAL_DESTINATION_BY_ID.now.path);
    }
    return location.startsWith(path);
  }, [location]);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    closeLeft();
  }, [navigate, closeLeft]);

  // Filter items by search
  const filteredItems = search.trim()
    ? ALL_ITEMS.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.path.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  // Groups to render (with admin if applicable)
  const groups: NavGroup[] = [
    ...NAV_GROUPS,
    ...(isAdmin ? [{ label: "OWNER PORTAL", items: ADMIN_ITEMS }] : []),
  ];

  return (
    <>
      {/* ── Edge tab — always visible ── */}
      <button
        onClick={toggleLeft}
        aria-label="Open navigation"
        style={{
          position: "fixed",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 200,
          background: TAB_BG,
          border: `1px solid ${DRAWER_BORDER}`,
          borderLeft: "none",
          borderRadius: "0 8px 8px 0",
          padding: "14px 8px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          boxShadow: "2px 0 12px rgba(0,0,0,0.18)",
          transition: "all 0.18s cubic-bezier(0.23,1,0.32,1)",
          opacity: leftOpen ? 0 : 1,
          pointerEvents: leftOpen ? "none" : "auto",
          userSelect: "none",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "#E8E2D8";
          (e.currentTarget as HTMLElement).style.boxShadow = "3px 0 16px rgba(0,0,0,0.22)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = TAB_BG;
          (e.currentTarget as HTMLElement).style.boxShadow = "2px 0 12px rgba(0,0,0,0.18)";
        }}
      >
        <Menu size={16} color={TEXT_PRIMARY} />
        <span style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          color: TEXT_SECONDARY,
          fontWeight: 600,
          textTransform: "uppercase",
        }}>NAV</span>
      </button>

      {/* ── Backdrop ── */}
      {leftOpen && (
        <div
          onClick={closeLeft}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 210,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(2px)",
            animation: "fade-in-backdrop 0.2s ease",
          }}
        />
      )}

      {/* ── Drawer panel ── */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(320px, 88vw)",
          zIndex: 220,
          background: DRAWER_BG,
          borderRight: `1px solid ${DRAWER_BORDER}`,
          boxShadow: "4px 0 32px rgba(0,0,0,0.28)",
          display: "flex",
          flexDirection: "column",
          transform: leftOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.26s cubic-bezier(0.23,1,0.32,1)",
          willChange: "transform",
          overflowY: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 16px 12px",
          borderBottom: `1px solid ${DRAWER_BORDER}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: TEXT_SECONDARY,
            fontWeight: 700,
            textTransform: "uppercase",
          }}>
            FAULTLINE
          </span>
          <button
            onClick={closeLeft}
            aria-label="Close navigation"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: TEXT_SECONDARY,
              padding: 4,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              transition: "color 0.12s ease",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT_PRIMARY)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_SECONDARY)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 14px 8px", flexShrink: 0 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: SEARCH_BG,
            border: `1px solid ${DRAWER_BORDER}`,
            borderRadius: 8,
            padding: "8px 12px",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <Search size={14} color={TEXT_MUTED} />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pages, features…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                color: TEXT_PRIMARY,
                letterSpacing: "0.04em",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: TEXT_MUTED, padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 24px" }}>
          {filteredItems ? (
            /* Search results */
            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.2em",
                color: TEXT_MUTED,
                textTransform: "uppercase",
                padding: "8px 16px 4px",
              }}>
                RESULTS
              </div>
              {filteredItems.length === 0 ? (
                <div style={{ padding: "16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: TEXT_MUTED }}>
                  No matches found
                </div>
              ) : filteredItems.map(item => (
                <NavRow
                  key={item.id}
                  item={item}
                  active={isActive(item.path)}
                  onNavigate={handleNavigate}
                  breachCount={item.id === "watchlist" ? breachCount : 0}
                />
              ))}
            </div>
          ) : (
            /* Grouped nav */
            groups.map((group, gi) => (
              <div key={group.label} style={{ marginTop: gi === 0 ? 4 : 16 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.2em",
                  color: group.label === "OWNER PORTAL" ? "#B8860B" : TEXT_MUTED,
                  textTransform: "uppercase",
                  padding: "6px 16px 4px",
                  borderTop: gi > 0 ? `1px solid ${DRAWER_BORDER}` : undefined,
                  paddingTop: gi > 0 ? 14 : 6,
                }}>
                  {group.label}
                </div>
                {group.items.map(item => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={isActive(item.path)}
                    onNavigate={handleNavigate}
                    breachCount={item.id === "watchlist" ? breachCount : 0}
                  />
                ))}
              </div>
            ))
          )}

          {/* Sign in / out */}
          <div style={{ borderTop: `1px solid ${DRAWER_BORDER}`, marginTop: 16, padding: "12px 14px 0" }}>
            {authUser ? (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                color: TEXT_SECONDARY,
                padding: "4px 2px",
              }}>
                {authUser.name ?? authUser.email ?? "User"}
              </div>
            ) : (
              <a
                href={getLoginUrl()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "rgba(184,134,11,0.1)",
                  border: "1px solid rgba(184,134,11,0.3)",
                  color: ACTIVE_ACCENT,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                SIGN IN
              </a>
            )}
          </div>
        </div>

        {/* Keyboard hint */}
        <div style={{
          padding: "8px 16px 12px",
          borderTop: `1px solid ${DRAWER_BORDER}`,
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: TEXT_MUTED }}>
            ⌘B to toggle
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", color: TEXT_MUTED }}>
            ⌘K to search
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-backdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── NavRow sub-component ──────────────────────────────────────
function NavRow({
  item,
  active,
  onNavigate,
  breachCount = 0,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: (path: string) => void;
  breachCount?: number;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "9px 16px",
        background: active ? ACTIVE_BG : "transparent",
        border: "none",
        borderLeft: active ? `3px solid ${ACTIVE_ACCENT}` : "3px solid transparent",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.12s cubic-bezier(0.23,1,0.32,1)",
        position: "relative",
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "#EDE8DF";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      <Icon
        size={15}
        color={active ? ACTIVE_ACCENT : TEXT_SECONDARY}
        style={{ flexShrink: 0 }}
      />
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12px",
        letterSpacing: "0.06em",
        color: active ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontWeight: active ? 600 : 400,
        flex: 1,
      }}>
        {item.label}
      </span>
      {breachCount > 0 && (
        <span style={{
          background: "#FF2D55",
          color: "#fff",
          borderRadius: 8,
          fontSize: "10px",
          fontFamily: "'IBM Plex Mono', monospace",
          padding: "0 5px",
          lineHeight: "16px",
          minWidth: 16,
          textAlign: "center",
          display: "inline-block",
        }}>
          {breachCount}
        </span>
      )}
    </button>
  );
}
