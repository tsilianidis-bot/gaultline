/* ============================================================
   FAULTLINE — Share Report Button Component
   Reusable share button for intelligence pages.
   Premium/Founding/Admin only.
   ============================================================ */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Share2, Copy, Check, Lock, ExternalLink, Clock } from "lucide-react";

export type ReportType =
  | "stock_intelligence"
  | "crypto_intelligence"
  | "market_preflight"
  | "diagnostic_ai"
  | "daily_report";

interface ShareReportButtonProps {
  reportType: ReportType;
  subject: string;
  /** Safe public snapshot — must NOT contain private user data or sensitive API keys */
  snapshotData: Record<string, unknown>;
  className?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}

export function ShareReportButton({
  reportType,
  subject,
  snapshotData,
  className = "",
  size = "sm",
  variant = "outline",
}: ShareReportButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>("30");

  const isPremium = user && (
    ["premium", "founding"].includes(user.accessTier ?? "") || user.role === "admin"
  );

  const createMut = trpc.sharedReports.create.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/r/${data.publicShareId}`;
      setShareUrl(url);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create share link");
    },
  });

  const handleOpen = () => {
    if (!isPremium) {
      toast.error("Share links require Premium or Founding access");
      return;
    }
    setOpen(true);
    setShareUrl(null);
    setCopied(false);
  };

  const handleCreate = () => {
    const days = parseInt(expiresInDays, 10);
    createMut.mutate({
      reportType,
      subject,
      snapshotJson: JSON.stringify(snapshotData),
      expiresInDays: isNaN(days) || days <= 0 ? undefined : days,
    });
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={handleOpen}
        className={`gap-1.5 ${className}`}
        title={isPremium ? "Share this report" : "Premium feature — upgrade to share"}
      >
        {isPremium ? (
          <Share2 className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        Share
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-400" />
              Share Report
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Create a public read-only link for <strong className="text-zinc-200">{subject}</strong>.
              Recipients do not need a FAULTLINE account.
            </DialogDescription>
          </DialogHeader>

          {!shareUrl ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs">Expires after (days)</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={expiresInDays}
                    onChange={e => setExpiresInDays(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 h-8 text-sm"
                    placeholder="30"
                  />
                  <span className="text-zinc-500 text-xs whitespace-nowrap">days (blank = never)</span>
                </div>
              </div>

              <div className="bg-zinc-800/60 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
                <p className="text-zinc-300 font-medium">What gets shared:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Report type: <span className="text-zinc-200">{reportType.replace(/_/g, " ")}</span></li>
                  <li>Subject: <span className="text-zinc-200">{subject}</span></li>
                  <li>Snapshot of current data (no private account info)</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="flex-1 border-zinc-700"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={createMut.isPending}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                >
                  {createMut.isPending ? "Creating…" : "Create Link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                Share link created successfully
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs">Share URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 text-xs h-8 font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="border-zinc-700 shrink-0 h-8 px-3"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareUrl, "_blank")}
                  className="flex-1 border-zinc-700 gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
              </div>

              <p className="text-xs text-zinc-600 text-center">
                Manage all your share links in Account → Shared Reports
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ShareReportButton;
