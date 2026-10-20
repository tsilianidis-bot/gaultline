import { useMemo, useState } from "react";
import {
  Copy,
  Link2,
  Plus,
  ShieldAlert,
  TimerReset,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Status = "active" | "redeemed" | "expired" | "revoked";
const statusStyle: Record<Status, string> = {
  active: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
  redeemed: "text-emerald-200 border-emerald-300/30 bg-emerald-300/10",
  expired: "text-slate-300 border-slate-500/40 bg-slate-500/10",
  revoked: "text-red-200 border-red-300/30 bg-red-300/10",
};
const format = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

/** A direct, owner-only operational control; raw links exist only in local UI state once. */
export default function AdminVipInvitations() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("");
  const [newLink, setNewLink] = useState<string | null>(null);
  const invitations = trpc.vipInvitation.adminList.useQuery(undefined, {
    enabled: user?.role === "admin",
    retry: false,
  });
  const create = trpc.vipInvitation.adminCreate.useMutation({
    onSuccess: data => {
      setNewLink(data.link);
      setLabel("");
      utils.vipInvitation.adminList.invalidate();
      toast.success(
        "Private invitation created. Copy it now; it cannot be recovered later."
      );
    },
    onError: error => toast.error(error.message),
  });
  const revoke = trpc.vipInvitation.adminRevoke.useMutation({
    onSuccess: () => {
      utils.vipInvitation.adminList.invalidate();
      toast.success("Invitation revoked.");
    },
    onError: error => toast.error(error.message),
  });
  const expire = trpc.vipInvitation.adminExpireUnused.useMutation({
    onSuccess: () => {
      utils.vipInvitation.adminList.invalidate();
      toast.success("Unused invitation expired.");
    },
    onError: error => toast.error(error.message),
  });
  const rows = useMemo(() => invitations.data ?? [], [invitations.data]);

  if (loading)
    return (
      <main className="p-8 font-mono text-xs text-slate-500">
        AUTHENTICATING…
      </main>
    );
  if (user?.role !== "admin")
    return (
      <main className="p-8 text-slate-300">
        <div className="max-w-md rounded-xl border border-red-400/20 bg-red-400/5 p-6">
          <ShieldAlert className="mb-3 text-red-300" />
          <h1 className="font-['Rajdhani'] text-2xl">OWNER ACCESS REQUIRED</h1>
          <p className="mt-2 text-sm text-slate-400">
            Invitation controls are restricted to the FAULTLINE owner.
          </p>
        </div>
      </main>
    );

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Private Messenger link copied.");
    } catch {
      toast.error(
        "Copy failed. Select the link manually; do not share it publicly."
      );
    }
  };
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 text-white space-y-6">
      <header>
        <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-300">
          OWNER CONTROL · ISSUE #111
        </p>
        <h1 className="font-['Rajdhani'] text-3xl tracking-wide">
          VIP GUEST INVITATIONS
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Create a private, single-use Messenger link. It expires after seven
          days if unused. Redemption grants a separate 30-day member
          entitlement; no checkout, billing, or public registration setting
          changes.
        </p>
      </header>
      <section className="rounded-xl border border-cyan-300/15 bg-slate-950/40 p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={label}
            onChange={event => setLabel(event.target.value)}
            maxLength={120}
            placeholder="Optional recipient label — never included in the link"
            className="border-slate-700 bg-slate-900"
          />
          <Button
            disabled={create.isPending}
            onClick={() => create.mutate({ label: label.trim() || undefined })}
            className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"
          >
            <Plus size={16} className="mr-2" />
            CREATE INVITATION
          </Button>
        </div>
        {newLink && (
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-4">
            <p className="text-xs text-amber-100">
              Copy this private link now. The token is never stored and cannot
              be displayed again.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="min-w-0 flex-1 break-all rounded bg-black/40 p-3 text-xs text-cyan-100">
                {newLink}
              </code>
              <Button
                variant="outline"
                onClick={() => copy(newLink)}
                className="border-cyan-300/30 text-cyan-100"
              >
                <Copy size={15} className="mr-2" />
                COPY FOR MESSENGER
              </Button>
            </div>
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950/60 px-5 py-4 text-xs font-mono tracking-widest text-slate-400">
          RECENT INVITATIONS — RAW TOKENS ARE NEVER RETAINED
        </div>
        <div className="divide-y divide-slate-800">
          {invitations.isLoading && (
            <p className="p-5 text-sm text-slate-500">Loading invitations…</p>
          )}
          {!invitations.isLoading && rows.length === 0 && (
            <p className="p-5 text-sm text-slate-500">
              No private invitations have been created.
            </p>
          )}
          {rows.map(row => (
            <article
              key={row.id}
              className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">
                    {row.label || `Invitation #${row.id}`}
                  </strong>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${statusStyle[row.status as Status]}`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Created {format(row.createdAt)} · Link expiry{" "}
                  {format(row.expiresAt)}
                </p>
                {row.redeemedAt && (
                  <p className="mt-1 text-xs text-slate-500">
                    Redeemed {format(row.redeemedAt)}
                    {row.redeemedByEmail ? ` by ${row.redeemedByEmail}` : ""}
                    {row.entitlementExpiresAt
                      ? ` · Member access through ${format(row.entitlementExpiresAt)}`
                      : ""}
                  </p>
                )}
              </div>
              {row.status === "active" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => expire.mutate({ invitationId: row.id })}
                    className="border-slate-600 text-slate-200"
                  >
                    <TimerReset size={14} className="mr-1" />
                    EXPIRE
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revoke.mutate({ invitationId: row.id })}
                    className="border-red-300/30 text-red-200"
                  >
                    <XCircle size={14} className="mr-1" />
                    REVOKE
                  </Button>
                </div>
              )}
              {row.status === "redeemed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => revoke.mutate({ invitationId: row.id })}
                  className="self-start border-red-300/30 text-red-200"
                >
                  <XCircle size={14} className="mr-1" />
                  REVOKE ACCESS
                </Button>
              )}
            </article>
          ))}
        </div>
      </section>
      <p className="flex items-center gap-2 text-xs text-slate-600">
        <Link2 size={14} /> Do not paste invitation links into public posts,
        analytics fields, or shared documents.
      </p>
    </main>
  );
}
