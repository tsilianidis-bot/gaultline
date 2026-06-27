import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Activity, Users, Eye, MousePointer, Globe, Monitor, Smartphone,
  Tablet, TrendingUp, Clock, ArrowUpRight, BarChart2, RefreshCw,
  Map, Link2, Zap, Target, AlertCircle, UserCheck, UserPlus, Repeat,
  MapPin, Building2,
} from "lucide-react";

// ── Colour palette ────────────────────────────────────────────────────────────
const CYAN   = "#00D4FF";
const GOLD   = "#F59E0B";
const GREEN  = "#22C55E";
const RED    = "#EF4444";
const PURPLE = "#A855F7";
const COLORS = [CYAN, GOLD, GREEN, PURPLE, RED, "#F97316", "#EC4899", "#14B8A6"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(secs: number) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function fmtPath(path: string) {
  const labels: Record<string, string> = {
    "/": "Home (Marketing)",
    "/app/dashboard": "Dashboard",
    "/app/signals": "Signals",
    "/app/situation-room": "Situation Room",
    "/app/insider-intelligence": "Insider Intel",
    "/app/pressure-index": "Pressure Index",
    "/app/track-record": "Track Record",
    "/app/watchlist": "Watchlist",
    "/app/account": "Account",
    "/app/seo-optimizer": "SEO Optimizer",
    "/blog": "Blog",
    "/pressure-index": "Pressure Index (Public)",
    "/track-record": "Track Record (Public)",
  };
  return labels[path] ?? path;
}

function countryFlag(code: string | null) {
  if (!code || code === "XX") return "🌐";
  try {
    const upper = code.toUpperCase();
    const p1 = 0x1F1E6 - 65 + upper.charCodeAt(0);
    const p2 = 0x1F1E6 - 65 + upper.charCodeAt(1);
    return String.fromCodePoint(p1, p2);
  } catch { return "🌐"; }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = CYAN }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card className="bg-zinc-900/60 border-zinc-800">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-bold" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg" style={{ background: `${color}18` }}>
            <Icon size={20} style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
      <AlertCircle size={32} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1 opacity-60">Data will appear here once visitors arrive after publishing.</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState("overview");

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && user && (user as any).role !== "admin") {
      navigate("/app/dashboard");
    }
  }, [user, authLoading, navigate]);

  // Analytics data is not real-time — 5 min staleTime prevents unnecessary refetches on tab focus
  const CACHE = { enabled: !!user, staleTime: 5 * 60 * 1000 } as const;
  const overviewQ        = trpc.analytics.getOverview.useQuery({ days }, CACHE);
  const topPagesQ        = trpc.analytics.getTopPages.useQuery({ days, limit: 20 }, CACHE);
  const devicesQ         = trpc.analytics.getDevices.useQuery({ days }, CACHE);
  const countriesQ       = trpc.analytics.getCountries.useQuery({ days, limit: 20 }, CACHE);
  const referrersQ       = trpc.analytics.getReferrers.useQuery({ days, limit: 20 }, CACHE);
  const eventsQ          = trpc.analytics.getEvents.useQuery({ days, limit: 30 }, CACHE);
  const timeSeriesQ      = trpc.analytics.getTimeSeries.useQuery({ days: Math.min(days, 90) }, CACHE);
  const sessionsQ        = trpc.analytics.getSessions.useQuery({ limit: 50, offset: 0 }, CACHE);
  const campaignsQ       = trpc.analytics.getCampaigns.useQuery({ days }, CACHE);
  const visitorStatsQ    = trpc.analytics.getVisitorStats.useQuery({ days }, CACHE);
  const visitorProfilesQ = trpc.analytics.getVisitorProfiles.useQuery({ limit: 50, offset: 0 }, CACHE);
  const countriesCitiesQ = trpc.analytics.getCountriesWithCities.useQuery({ limit: 20 }, CACHE);

  const refetchAll = useCallback(() => {
    overviewQ.refetch(); topPagesQ.refetch(); devicesQ.refetch();
    countriesQ.refetch(); referrersQ.refetch(); eventsQ.refetch();
    timeSeriesQ.refetch(); sessionsQ.refetch(); campaignsQ.refetch();
    visitorStatsQ.refetch(); visitorProfilesQ.refetch(); countriesCitiesQ.refetch();
  }, []);

  const ov = overviewQ.data;
  const ts = timeSeriesQ.data;

  // Merge time series for chart
  type ChartPoint = { date: string; views: number; sessions: number };
  const chartData: ChartPoint[] = (() => {
    if (!ts) return [];
    const map = new globalThis.Map() as globalThis.Map<string, ChartPoint>;
    ts.pageViews.forEach((r: { date: string; views: number }) => map.set(r.date, { date: r.date, views: Number(r.views), sessions: 0 }));
    ts.sessions.forEach((r: { date: string; sessions: number }) => {
      const existing = map.get(r.date);
      if (existing) existing.sessions = Number(r.sessions);
      else map.set(r.date, { date: r.date, views: 0, sessions: Number(r.sessions) });
    });
    return Array.from(map.values()).sort((a: ChartPoint, b: ChartPoint) => a.date.localeCompare(b.date));
  })();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-sm tracking-widest">LOADING ANALYTICS...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <BarChart2 size={20} className="text-cyan-400" />
          <h1 className="text-lg font-bold tracking-wider">SITE ANALYTICS</h1>
          <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">ADMIN</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700 text-sm h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refetchAll} className="h-8 border-zinc-700 text-zinc-400 hover:text-white">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* Overview KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Eye}        label="Page Views"    value={ov?.pageViews?.toLocaleString() ?? "—"}   color={CYAN}   />
          <StatCard icon={Users}      label="Sessions"      value={ov?.sessions?.toLocaleString() ?? "—"}    color={GOLD}   />
          <StatCard icon={Activity}   label="Events"        value={ov?.events?.toLocaleString() ?? "—"}      color={GREEN}  />
          <StatCard icon={TrendingUp} label="Bounce Rate"   value={ov ? `${ov.bounceRate}%` : "—"}           color={ov?.bounceRate && ov.bounceRate > 70 ? RED : GREEN} sub="lower is better" />
          <StatCard icon={Clock}      label="Avg Duration"  value={ov ? fmtDuration(ov.avgDurationSecs) : "—"} color={PURPLE} />
          <StatCard icon={Target}     label="Period"        value={`${days}d`}                               color={GOLD}   sub="selected window" />
        </div>

        {/* Traffic Time Series */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
              <TrendingUp size={16} className="text-cyan-400" /> TRAFFIC OVER TIME
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState message="No traffic data yet for this period." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                  <Line type="monotone" dataKey="views"    stroke={CYAN}  strokeWidth={2} dot={false} name="Page Views" />
                  <Line type="monotone" dataKey="sessions" stroke={GOLD}  strokeWidth={2} dot={false} name="Sessions" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 h-9 p-1 flex-wrap gap-y-1">
            <TabsTrigger value="overview"    className="text-xs data-[state=active]:bg-zinc-700">Pages</TabsTrigger>
            <TabsTrigger value="visitors"    className="text-xs data-[state=active]:bg-zinc-700">Sessions</TabsTrigger>
            <TabsTrigger value="intelligence" className="text-xs data-[state=active]:bg-cyan-800 data-[state=active]:text-cyan-200">Visitor Intel</TabsTrigger>
            <TabsTrigger value="devices"     className="text-xs data-[state=active]:bg-zinc-700">Devices</TabsTrigger>
            <TabsTrigger value="geo"         className="text-xs data-[state=active]:bg-zinc-700">Geography</TabsTrigger>
            <TabsTrigger value="sources"     className="text-xs data-[state=active]:bg-zinc-700">Sources</TabsTrigger>
            <TabsTrigger value="events"      className="text-xs data-[state=active]:bg-zinc-700">Feature Usage</TabsTrigger>
            <TabsTrigger value="campaigns"   className="text-xs data-[state=active]:bg-zinc-700">Campaigns</TabsTrigger>
          </TabsList>

          {/* ── Top Pages ── */}
          <TabsContent value="overview">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Eye size={16} className="text-cyan-400" /> TOP PAGES
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!topPagesQ.data || topPagesQ.data.length === 0 ? (
                  <EmptyState message="No page view data yet." />
                ) : (
                  <>
                    <div className="mb-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topPagesQ.data.slice(0, 10).map(r => ({ name: fmtPath(r.path), views: Number(r.views) }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={160} />
                          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="views" fill={CYAN} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-zinc-500 text-xs">Page</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-right">Views</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-right">Unique Sessions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPagesQ.data.map((row, i) => (
                          <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/30">
                            <TableCell className="text-sm font-mono text-zinc-300">{fmtPath(row.path)}<span className="text-zinc-600 ml-2 text-xs">{row.path}</span></TableCell>
                            <TableCell className="text-right text-cyan-400 font-bold">{Number(row.views).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-zinc-400">{Number(row.uniqueSessions).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Recent Visitor Sessions ── */}
          <TabsContent value="visitors">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Users size={16} className="text-gold-400" style={{ color: GOLD }} /> RECENT VISITOR SESSIONS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!sessionsQ.data || sessionsQ.data.length === 0 ? (
                  <EmptyState message="No visitor sessions recorded yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-500 text-xs">Time</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Entry Page</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Exit Page</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-center">Pages</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-center">Duration</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Country</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Device</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Browser</TableHead>
                        <TableHead className="text-zinc-500 text-xs">OS</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Referrer</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-center">Bounce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionsQ.data.map((s) => (
                        <TableRow key={s.id} className="border-zinc-800/50 hover:bg-zinc-800/30 text-xs">
                          <TableCell className="text-zinc-400 whitespace-nowrap">
                            {new Date(s.startedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-zinc-300 max-w-[140px] truncate">{fmtPath(s.entryPage ?? "")}</TableCell>
                          <TableCell className="text-zinc-400 max-w-[140px] truncate">{fmtPath(s.exitPage ?? "")}</TableCell>
                          <TableCell className="text-center text-cyan-400 font-bold">{s.pageCount}</TableCell>
                          <TableCell className="text-center text-zinc-300">{fmtDuration(s.durationSecs)}</TableCell>
                          <TableCell className="text-center">{countryFlag(s.country)} {s.country ?? "—"}</TableCell>
                          <TableCell className="text-zinc-400 capitalize">{s.deviceType ?? "—"}</TableCell>
                          <TableCell className="text-zinc-400">{s.browser ?? "—"}</TableCell>
                          <TableCell className="text-zinc-400">{s.os ?? "—"}</TableCell>
                          <TableCell className="text-zinc-500 max-w-[120px] truncate">{s.referrer ? new URL(s.referrer).hostname : "Direct"}</TableCell>
                          <TableCell className="text-center">
                            {s.isBounce ? <Badge variant="outline" className="text-xs border-red-800 text-red-400">Bounce</Badge> : <Badge variant="outline" className="text-xs border-green-800 text-green-400">Engaged</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Visitor Intelligence ── */}
          <TabsContent value="intelligence">
            <div className="space-y-4">
              {/* KPI row */}
              {visitorStatsQ.data && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard icon={Users}     label="Total Unique"    value={visitorStatsQ.data.totalUniqueVisitors.toLocaleString()} color={CYAN} sub="all-time visitors" />
                  <StatCard icon={UserPlus}  label="New Visitors"    value={visitorStatsQ.data.newVisitors.toLocaleString()} color={GREEN} sub={`last ${days}d`} />
                  <StatCard icon={Repeat}    label="Returning"       value={visitorStatsQ.data.returningVisitors.toLocaleString()} color={GOLD} sub={`last ${days}d`} />
                  <StatCard icon={UserCheck} label="Converted"       value={visitorStatsQ.data.converted.toLocaleString()} color={PURPLE} sub="signed up" />
                  <StatCard icon={TrendingUp} label="Avg Visits"     value={visitorStatsQ.data.avgVisitsPerVisitor} color={CYAN} sub="per visitor" />
                  <StatCard icon={Activity}  label="Active in Period" value={visitorStatsQ.data.activeInPeriod.toLocaleString()} color={GREEN} sub={`last ${days}d`} />
                </div>
              )}

              {/* New vs Returning donut + Countries with cities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* New vs Returning */}
                <Card className="bg-zinc-900/60 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold tracking-wider text-zinc-400 flex items-center gap-2">
                      <UserPlus size={14} className="text-cyan-400" /> NEW VS RETURNING
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!visitorStatsQ.data ? (
                      <EmptyState message="No visitor data yet." />
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: "New", value: visitorStatsQ.data.newVisitors },
                                { name: "Returning", value: visitorStatsQ.data.returningVisitors },
                              ]}
                              cx="50%" cy="50%" outerRadius={80} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}>
                              <Cell fill={GREEN} />
                              <Cell fill={GOLD} />
                            </Pie>
                            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-around mt-2 text-sm">
                          <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: GREEN }}>{visitorStatsQ.data.newVisitors.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">New</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: GOLD }}>{visitorStatsQ.data.returningVisitors.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">Returning</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold" style={{ color: PURPLE }}>{visitorStatsQ.data.converted.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">Converted</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Countries with city drill-down */}
                <Card className="bg-zinc-900/60 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold tracking-wider text-zinc-400 flex items-center gap-2">
                      <MapPin size={14} className="text-cyan-400" /> TOP COUNTRIES (VISITOR PROFILES)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-72 overflow-y-auto">
                    {!countriesCitiesQ.data?.countries?.length ? (
                      <EmptyState message="No geo data yet. Visitors need to arrive after publishing." />
                    ) : (
                      <div className="space-y-1">
                        {countriesCitiesQ.data.countries.map((c, i) => {
                          const total = countriesCitiesQ.data!.countries.reduce((s, r) => s + Number(r.visitors), 0);
                          const pct = total > 0 ? ((Number(c.visitors) / total) * 100).toFixed(1) : "0";
                          const citiesForCountry = countriesCitiesQ.data!.cities
                            .filter(ci => ci.country === c.country)
                            .slice(0, 3);
                          return (
                            <div key={i} className="py-1.5 border-b border-zinc-800/50 last:border-0">
                              <div className="flex items-center gap-3">
                                <span className="text-lg w-8">{countryFlag(c.country)}</span>
                                <span className="text-zinc-200 text-sm flex-1 font-medium">{c.countryName || c.country || "Unknown"}</span>
                                <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: CYAN }} />
                                </div>
                                <span className="text-cyan-400 font-bold text-sm w-8 text-right">{Number(c.visitors)}</span>
                                <span className="text-zinc-500 text-xs w-10 text-right">{pct}%</span>
                              </div>
                              {citiesForCountry.length > 0 && (
                                <div className="ml-11 mt-1 flex flex-wrap gap-1">
                                  {citiesForCountry.map((ci, j) => (
                                    <span key={j} className="text-xs text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full">
                                      <Building2 size={9} className="inline mr-1" />{ci.city || "—"}{ci.region ? `, ${ci.region}` : ""} ({Number(ci.visitors)})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Visitor profiles table */}
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                    <Users size={16} className="text-cyan-400" /> VISITOR PROFILES — WHO CAME & HOW MANY TIMES
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!visitorProfilesQ.data?.visitors?.length ? (
                    <EmptyState message="No visitor profiles yet. Profiles are built from the stable visitor ID stored in each browser." />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-zinc-500 text-xs">Location</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-center">Visits</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-center">Pages</TableHead>
                          <TableHead className="text-zinc-500 text-xs">Device</TableHead>
                          <TableHead className="text-zinc-500 text-xs">Browser / OS</TableHead>
                          <TableHead className="text-zinc-500 text-xs">First Source</TableHead>
                          <TableHead className="text-zinc-500 text-xs">First Seen</TableHead>
                          <TableHead className="text-zinc-500 text-xs">Last Seen</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-center">Converted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitorProfilesQ.data.visitors.map((v) => (
                          <TableRow key={v.id} className="border-zinc-800/50 hover:bg-zinc-800/30 text-xs">
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className="text-base">{countryFlag(v.country)}</span>
                                <div>
                                  <p className="text-zinc-200 font-medium">{v.city || v.countryName || v.country || "—"}</p>
                                  {v.city && <p className="text-zinc-500 text-xs">{v.countryName || v.country}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-cyan-400 font-bold text-sm">{v.visitCount}</span>
                            </TableCell>
                            <TableCell className="text-center text-zinc-300">{v.totalPages}</TableCell>
                            <TableCell className="text-zinc-400 capitalize">{v.deviceType ?? "—"}</TableCell>
                            <TableCell className="text-zinc-400">{v.browser ?? "—"} / {v.os ?? "—"}</TableCell>
                            <TableCell className="text-zinc-500 max-w-[120px] truncate">
                              {v.firstUtmSource ? (
                                <Badge variant="outline" className="text-xs border-green-800 text-green-400">{v.firstUtmSource}</Badge>
                              ) : v.firstReferrer ? (
                                (() => { try { return new URL(v.firstReferrer).hostname; } catch { return "Direct"; } })()
                              ) : "Direct"}
                            </TableCell>
                            <TableCell className="text-zinc-500 whitespace-nowrap">{new Date(v.firstSeenAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-zinc-400 whitespace-nowrap">{new Date(v.lastSeenAt).toLocaleDateString()}</TableCell>
                            <TableCell className="text-center">
                              {v.converted ? (
                                <Badge variant="outline" className="text-xs border-green-800 text-green-400">Yes</Badge>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Devices ── */}
          <TabsContent value="devices">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Device Type */}
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wider text-zinc-400 flex items-center gap-2">
                    <Monitor size={14} className="text-cyan-400" /> DEVICE TYPE
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!devicesQ.data?.devices?.length ? <EmptyState message="No data yet." /> : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={devicesQ.data.devices.map(d => ({ name: d.deviceType ?? "unknown", value: Number(d.count) }))}
                            cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}>
                            {devicesQ.data.devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      {devicesQ.data.devices.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-zinc-800/50 last:border-0">
                          <span className="flex items-center gap-2">
                            {d.deviceType === "mobile" ? <Smartphone size={12} /> : d.deviceType === "tablet" ? <Tablet size={12} /> : <Monitor size={12} />}
                            <span className="capitalize text-zinc-300">{d.deviceType ?? "Unknown"}</span>
                          </span>
                          <span style={{ color: COLORS[i % COLORS.length] }} className="font-bold">{Number(d.count).toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Browser */}
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wider text-zinc-400">BROWSER</CardTitle>
                </CardHeader>
                <CardContent>
                  {!devicesQ.data?.browsers?.length ? <EmptyState message="No data yet." /> : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={devicesQ.data.browsers.map(b => ({ name: b.browser ?? "Other", count: Number(b.count) }))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} />
                          <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                          <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      {devicesQ.data.browsers.map((b, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-zinc-800/50 last:border-0">
                          <span className="text-zinc-300">{b.browser ?? "Other"}</span>
                          <span className="text-amber-400 font-bold">{Number(b.count).toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* OS */}
              <Card className="bg-zinc-900/60 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold tracking-wider text-zinc-400">OPERATING SYSTEM</CardTitle>
                </CardHeader>
                <CardContent>
                  {!devicesQ.data?.os?.length ? <EmptyState message="No data yet." /> : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={devicesQ.data.os.map(o => ({ name: o.os ?? "Other", value: Number(o.count) }))}
                            cx="50%" cy="50%" outerRadius={70} dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {devicesQ.data.os.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      {devicesQ.data.os.map((o, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-zinc-800/50 last:border-0">
                          <span className="text-zinc-300">{o.os ?? "Other"}</span>
                          <span style={{ color: COLORS[i % COLORS.length] }} className="font-bold">{Number(o.count).toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Geography ── */}
          <TabsContent value="geo">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Globe size={16} className="text-cyan-400" /> VISITORS BY COUNTRY
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!countriesQ.data || countriesQ.data.length === 0 ? (
                  <EmptyState message="No geographic data yet." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={countriesQ.data.slice(0, 15).map(c => ({ name: c.country ?? "XX", count: Number(c.count) }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} width={40} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                        <Bar dataKey="count" fill={CYAN} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="space-y-1">
                      {countriesQ.data.map((c, i) => {
                        const total = countriesQ.data!.reduce((s, r) => s + Number(r.count), 0);
                        const pct = total > 0 ? ((Number(c.count) / total) * 100).toFixed(1) : "0";
                        return (
                          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-800/50 last:border-0">
                            <span className="text-lg w-8">{countryFlag(c.country)}</span>
                            <span className="text-zinc-300 text-sm flex-1">{c.country ?? "Unknown"}</span>
                            <div className="w-24 bg-zinc-800 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: CYAN }} />
                            </div>
                            <span className="text-cyan-400 font-bold text-sm w-10 text-right">{Number(c.count)}</span>
                            <span className="text-zinc-500 text-xs w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Traffic Sources ── */}
          <TabsContent value="sources">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Link2 size={16} className="text-cyan-400" /> TRAFFIC SOURCES & REFERRERS
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!referrersQ.data || referrersQ.data.length === 0 ? (
                  <EmptyState message="No referrer data yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-500 text-xs">Source</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Sessions</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const total = referrersQ.data!.reduce((s, r) => s + Number(r.count), 0);
                        return referrersQ.data!.map((r, i) => {
                          const pct = total > 0 ? ((Number(r.count) / total) * 100).toFixed(1) : "0";
                          let source = "Direct / None";
                          try { if (r.referrer) source = new URL(r.referrer).hostname; } catch {}
                          return (
                            <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/30">
                              <TableCell className="text-zinc-300 text-sm flex items-center gap-2">
                                <ArrowUpRight size={12} className="text-cyan-400" /> {source}
                              </TableCell>
                              <TableCell className="text-right text-cyan-400 font-bold">{Number(r.count).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: CYAN }} />
                                  </div>
                                  <span className="text-zinc-400 text-xs w-10">{pct}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Feature Usage Events ── */}
          <TabsContent value="events">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" /> FEATURE USAGE — WHAT VISITORS DID
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!eventsQ.data || eventsQ.data.length === 0 ? (
                  <EmptyState message="No feature events recorded yet." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={eventsQ.data.slice(0, 12).map(e => ({ name: e.eventName.replace(/_/g, " "), count: Number(e.count) }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} width={160} />
                        <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                        <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-zinc-500 text-xs">Event / Feature</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-right">Total Fires</TableHead>
                          <TableHead className="text-zinc-500 text-xs text-right">Unique Sessions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventsQ.data.map((e, i) => (
                          <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/30">
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-2">
                                <MousePointer size={12} className="text-amber-400" />
                                <span className="text-zinc-300 capitalize">{e.eventName.replace(/_/g, " ")}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-amber-400 font-bold">{Number(e.count).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-zinc-400">{Number(e.uniqueSessions).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── UTM Campaigns ── */}
          <TabsContent value="campaigns">
            <Card className="bg-zinc-900/60 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
                  <Target size={16} className="text-green-400" /> UTM CAMPAIGN PERFORMANCE
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!campaignsQ.data || campaignsQ.data.length === 0 ? (
                  <EmptyState message="No UTM campaign data yet. Add ?utm_source=tiktok&utm_medium=social&utm_campaign=launch to your links." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-500 text-xs">Source</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Medium</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Campaign</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Sessions</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Avg Duration</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Bounce Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignsQ.data.map((c, i) => (
                        <TableRow key={i} className="border-zinc-800/50 hover:bg-zinc-800/30">
                          <TableCell className="text-green-400 font-medium text-sm">{c.utmSource ?? "—"}</TableCell>
                          <TableCell className="text-zinc-300 text-sm">{c.utmMedium ?? "—"}</TableCell>
                          <TableCell className="text-zinc-400 text-sm">{c.utmCampaign ?? "—"}</TableCell>
                          <TableCell className="text-right text-cyan-400 font-bold">{Number(c.sessions).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-zinc-300">{fmtDuration(Math.round(Number(c.avgDuration) || 0))}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className={`text-xs ${Number(c.bounceRate) > 70 ? "border-red-800 text-red-400" : "border-green-800 text-green-400"}`}>
                              {Number(c.bounceRate).toFixed(0)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Built Features Reference */}
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-wider text-zinc-300 flex items-center gap-2">
              <BarChart2 size={16} className="text-purple-400" /> PLATFORM FEATURES BUILT — REFERENCE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: "FAULTLINE Pressure Index", path: "/app/dashboard", status: "live", color: CYAN },
                { name: "Signals Engine", path: "/app/signals", status: "live", color: CYAN },
                { name: "Situation Room", path: "/app/situation-room", status: "live", color: CYAN },
                { name: "Insider Intelligence", path: "/app/insider-intelligence", status: "live", color: CYAN },
                { name: "Market Preflight", path: "/app/dashboard", status: "live", color: CYAN },
                { name: "Track Record", path: "/app/track-record", status: "live", color: CYAN },
                { name: "Watchlist", path: "/app/watchlist", status: "live", color: CYAN },
                { name: "Crypto Intelligence", path: "/app/dashboard", status: "live", color: CYAN },
                { name: "Diagnostic AI", path: "/app/dashboard", status: "live", color: CYAN },
                { name: "SEO Optimizer", path: "/app/seo-optimizer", status: "live", color: GREEN },
                { name: "Blog / Content", path: "/blog", status: "live", color: GREEN },
                { name: "X / Twitter Auto-Post", path: "/app/account", status: "live", color: GREEN },
                { name: "Stripe Payments", path: "/app/account", status: "live", color: GREEN },
                { name: "GA4 Analytics", path: "/", status: "live", color: GREEN },
                { name: "Site Analytics Dashboard", path: "/app/analytics", status: "live", color: GREEN },
                { name: "Mobile Landing Page", path: "/", status: "live", color: GREEN },
                { name: "TikTok Promo Video", path: "/", status: "live", color: GREEN },
                { name: "SEO Auto-Fix", path: "/app/seo-optimizer", status: "live", color: GREEN },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{f.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{f.path}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-green-800 text-green-400 flex-shrink-0">LIVE</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
