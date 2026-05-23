import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Clock, Calendar, Mail, RefreshCw } from "lucide-react";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "never";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const {
    data: users,
    isLoading,
    error,
    refetch,
    isFetching,
  } = trpc.admin.getUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
    staleTime: 30_000,
  });

  // Redirect non-admins
  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      setLocation("/");
    }
    if (!loading && !user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading || (!user)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--color-electric)] font-mono text-sm animate-pulse">
          AUTHENTICATING…
        </div>
      </div>
    );
  }

  if (user.role !== "admin") return null;

  const adminCount = users?.filter((u) => u.role === "admin").length ?? 0;
  const userCount = users?.filter((u) => u.role === "user").length ?? 0;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[var(--color-electric)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-mono text-white">
              USER REGISTRY
            </h1>
            <p className="text-xs text-[var(--color-muted)] font-mono mt-0.5">
              ADMIN ACCESS — ALL REGISTERED ACCOUNTS
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 text-xs font-mono text-[var(--color-muted)] hover:text-white hover:border-[var(--color-electric)]/40 transition-all duration-150"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          REFRESH
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-[var(--color-electric)]" />
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {isLoading ? "—" : users?.length ?? 0}
              </div>
              <div className="text-xs text-[var(--color-muted)] font-mono">TOTAL USERS</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {isLoading ? "—" : adminCount}
              </div>
              <div className="text-xs text-[var(--color-muted)] font-mono">ADMINS</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/3 border-white/8">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {isLoading ? "—" : userCount}
              </div>
              <div className="text-xs text-[var(--color-muted)] font-mono">MEMBERS</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card className="bg-white/3 border-white/8">
        <CardHeader className="pb-3 border-b border-white/8">
          <CardTitle className="text-sm font-mono text-[var(--color-electric)] tracking-widest">
            REGISTERED ACCOUNTS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-[var(--color-electric)] font-mono text-sm animate-pulse">
                LOADING USER REGISTRY…
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-400 font-mono text-sm">
                ERROR: {error.message}
              </div>
            </div>
          ) : !users || users.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-[var(--color-muted)] font-mono text-sm">
                NO USERS FOUND
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/8 hover:bg-transparent">
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest w-12">#</TableHead>
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" /> NAME
                      </div>
                    </TableHead>
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" /> EMAIL
                      </div>
                    </TableHead>
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest">ROLE</TableHead>
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> JOINED
                      </div>
                    </TableHead>
                    <TableHead className="text-[var(--color-muted)] font-mono text-xs tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> LAST LOGIN
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow
                      key={u.id}
                      className="border-white/5 hover:bg-white/3 transition-colors duration-100"
                    >
                      <TableCell className="text-[var(--color-muted)] font-mono text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white text-sm">
                          {u.name ?? <span className="text-[var(--color-muted)] italic">Unknown</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[var(--color-muted)] text-sm font-mono">
                          {u.email ?? <span className="italic">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === "admin" ? (
                          <Badge className="bg-amber-400/15 text-amber-400 border-amber-400/30 font-mono text-xs">
                            ADMIN
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/25 font-mono text-xs">
                            MEMBER
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-[var(--color-muted)] text-xs font-mono">
                          {formatDate(u.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-mono">
                            {timeAgo(u.lastSignedIn)}
                          </span>
                          <span className="text-[var(--color-muted)] text-xs font-mono opacity-60">
                            {formatDate(u.lastSignedIn)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer note */}
      <p className="text-xs text-[var(--color-muted)] font-mono text-center opacity-50">
        ADMIN VIEW — DATA REFRESHES EVERY 30 SECONDS · VISIBLE TO ADMINS ONLY
      </p>
    </div>
  );
}
