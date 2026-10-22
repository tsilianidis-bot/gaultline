/*
 * ToolsHome — contextual directory for /app/tools.
 * It intentionally mirrors the consolidated navigation hierarchy instead of
 * creating another customer navigation system.
 */
import { useMemo, useState, type CSSProperties, type ElementType } from "react";
import { Link } from "wouter";
import {
  Activity, BarChart3, Bell, Bitcoin, BookOpen, Brain, Briefcase, Crosshair,
  FileText, Gauge, Globe, GraduationCap, HelpCircle, History, Map,
  Newspaper, Radio, RotateCcw, Search, Settings, Shield, Sparkles, Target,
  Telescope, TrendingUp, User,
} from "lucide-react";
import {
  CUSTOMER_NAVIGATION_SECTIONS,
  NAVIGATION_HIERARCHY,
  TOOLS_HOME_CONTEXTUAL_SECTION,
  type NavigationIconName,
  type NavigationItem,
  type NavigationSection,
} from "@shared/navigationHierarchy";

const BG = "#080A0F";
const SURFACE = "rgba(255,255,255,0.035)";
const SURFACE_HOVER = "rgba(0,212,255,0.07)";
const BORDER = "rgba(255,255,255,0.09)";
const ACCENT = "#00D4FF";
const TEXT_PRIMARY = "#F0F4FF";
const TEXT_SECONDARY = "#9AA9BD";
const TEXT_MUTED = "#63748C";
const MONO: CSSProperties = { fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" };
const SANS: CSSProperties = { fontFamily: "'IBM Plex Sans', sans-serif" };

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
  users: User,
  settings: Settings,
  "message-square": Activity,
  zap: Activity,
  globe: Globe,
  flask: Activity,
};

const DIRECTORY_SECTIONS: readonly NavigationSection[] = [...CUSTOMER_NAVIGATION_SECTIONS, TOOLS_HOME_CONTEXTUAL_SECTION];

function ToolCard({ item }: { item: NavigationItem }) {
  const Icon = ICONS[item.icon];
  const [hovered, setHovered] = useState(false);
  return <Link href={item.path} style={{ textDecoration: "none" }}>
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? SURFACE_HOVER : SURFACE, border: `1px solid ${hovered ? "rgba(0,212,255,0.3)" : BORDER}`, borderRadius: 9, padding: "14px 15px", minHeight: 114, cursor: "pointer", transition: "border-color 120ms ease, background 120ms ease", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={15} color={hovered ? ACCENT : TEXT_SECONDARY} aria-hidden="true" />
        <h2 style={{ ...MONO, fontSize: 11, fontWeight: 700, color: hovered ? TEXT_PRIMARY : TEXT_SECONDARY, letterSpacing: "0.04em", lineHeight: 1.35, margin: 0 }}>{item.label}</h2>
      </div>
      <p style={{ ...SANS, fontSize: 12, color: TEXT_MUTED, lineHeight: 1.45, margin: 0 }}>{item.description}</p>
    </article>
  </Link>;
}

function Section({ section, items }: { section: NavigationSection; items: readonly NavigationItem[] }) {
  if (!items.length) return null;
  return <section style={{ marginBottom: 34 }} aria-labelledby={`tools-directory-${section.id}`}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
      <h1 id={`tools-directory-${section.id}`} style={{ ...MONO, fontSize: 11, color: section.kind === "primary" ? ACCENT : TEXT_SECONDARY, fontWeight: 700, letterSpacing: "0.14em", margin: 0 }}>{section.label}</h1>
      {section.description && <span style={{ ...SANS, fontSize: 12, color: TEXT_MUTED }}>{section.description}</span>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
      {items.map(item => <ToolCard key={item.id} item={item} />)}
    </div>
  </section>;
}

export default function ToolsHome() {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredBySection = useMemo(() => DIRECTORY_SECTIONS.map(section => ({
    section,
    items: section.items.filter(item => !normalizedSearch || [item.label, item.description, item.path, ...item.keywords]
      .some(value => value.toLowerCase().includes(normalizedSearch))),
  })).filter(({ items }) => items.length), [normalizedSearch]);

  return <div style={{ minHeight: "100vh", background: BG, color: TEXT_PRIMARY, padding: "0 0 64px" }}>
    <header style={{ borderBottom: "1px solid rgba(0,212,255,0.12)", background: "linear-gradient(180deg, rgba(0,29,42,0.38), rgba(8,10,15,0))" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 24px 26px" }}>
        <div style={{ ...MONO, fontSize: 10, color: ACCENT, letterSpacing: "0.15em", marginBottom: 10 }}>FAULTLINE DIRECTORY</div>
        <h1 style={{ ...MONO, fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "0.06em", margin: "0 0 10px" }}>TOOLS & INTELLIGENCE</h1>
        <p style={{ ...SANS, fontSize: 14, color: TEXT_SECONDARY, maxWidth: 690, lineHeight: 1.65, margin: 0 }}>Direct, contextual access to the existing FAULTLINE modules. Primary navigation remains the Five Questions; this directory uses the same consolidated hierarchy.</p>
      </div>
    </header>

    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "10px 14px", marginBottom: 30, maxWidth: 620 }}>
        <Search size={16} color={TEXT_MUTED} aria-hidden="true" />
        <label htmlFor="tools-directory-search" className="sr-only">Search the FAULTLINE directory</label>
        <input id="tools-directory-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search intelligence, signals, or account tools" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: TEXT_PRIMARY, ...MONO, fontSize: 12, letterSpacing: "0.03em" }} />
        {search && <button onClick={() => setSearch("")} aria-label="Clear directory search" style={{ background: "transparent", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>}
      </div>

      {!normalizedSearch && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "12px 14px", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.13)", borderRadius: 8 }}>
        <Newspaper size={15} color={ACCENT} aria-hidden="true" />
        <Link href={NAVIGATION_HIERARCHY.dailyBrief.items[0].path} style={{ ...MONO, color: "#C8D8E8", fontSize: 11, letterSpacing: "0.06em", textDecoration: "none" }}>Open the DAILY BRIEF for current briefings, historical briefings, and intelligence-library links →</Link>
      </div>}

      {filteredBySection.length ? filteredBySection.map(({ section, items }) => <Section key={section.id} section={section} items={items} />) : <div style={{ padding: "56px 0", textAlign: "center", color: TEXT_MUTED }}><Search size={30} style={{ opacity: 0.35, marginBottom: 12 }} /><div style={{ ...MONO, fontSize: 12, letterSpacing: "0.1em" }}>NO MATCHING DESTINATIONS</div></div>}
    </main>

    <style>{`.faultline-nav-focus:focus-visible, #tools-directory-search:focus-visible { outline: 2px solid #00E5FF; outline-offset: 2px; }`}</style>
  </div>;
}
