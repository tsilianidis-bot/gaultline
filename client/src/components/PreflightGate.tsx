/**
 * FAULTLINE — PreflightGate
 * First-experience layer: shows the Market Preflight modal before the user
 * can interact with the dashboard for the first time each day.
 *
 * Rules:
 * - Only shown to authenticated users
 * - Only shown if preflightPromptMode !== "off"
 * - Only shown if lastPreflightCompletedAt is null OR > 24h ago
 * - Dismissed by completing the preflight OR by clicking "Skip for now"
 * - Completion stores a UTC timestamp via awareness.completePreflightSession
 * - Dismissal (skip) is stored in sessionStorage so it only fires once per tab
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MarketPreflightModal } from "@/components/MarketPreflight";
import { useEngine } from "@/contexts/EngineContext";

const SESSION_KEY = "faultline_preflight_gate_dismissed";

export default function PreflightGate() {
  const { user } = useAuth();
  const { output } = useEngine();
  const regimeLabel = output?.regime?.label ?? "Unknown";

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Fetch preflight status (needs preflight or not)
  const { data: statusData, isLoading: statusLoading } = trpc.awareness.getPreflightStatus.useQuery(
    undefined,
    { enabled: !!user, staleTime: 60_000 }
  );

  // Fetch preflight mode preference
  const { data: modeData, isLoading: modeLoading } = trpc.awareness.getPreflightMode.useQuery(
    undefined,
    { enabled: !!user, staleTime: 60_000 }
  );

  const completeSession = trpc.awareness.completePreflightSession.useMutation();
  const utils = trpc.useUtils();

  // Decide whether to open the gate
  useEffect(() => {
    if (!user) return;
    if (statusLoading || modeLoading) return;
    if (dismissed) return;

    // Check session-level dismissal (skip lasts for the current tab session only)
    const sessionDismissed = sessionStorage.getItem(SESSION_KEY);
    if (sessionDismissed) return;

    const mode = modeData?.mode ?? "full_guidance";
    if (mode === "off") return;

    if (statusData?.needsPreflight) {
      // Small delay so the dashboard shell renders first
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user, statusData, modeData, statusLoading, modeLoading, dismissed]);

  const handleClose = () => {
    // "Skip for now" — dismiss for this session only
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
    setOpen(false);
  };

  const handleComplete = async () => {
    try {
      await completeSession.mutateAsync();
      await utils.awareness.getPreflightStatus.invalidate();
      await utils.awareness.getScore.invalidate();
    } catch {
      // Silently continue — don't block the user
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
    setOpen(false);
  };

  if (!user || !open) return null;

  return (
    <MarketPreflightModal
      open={open}
      onClose={handleClose}
      onComplete={handleComplete}
      currentPage="dashboard"
      regimeLabel={regimeLabel}
      isGateMode
    />
  );
}
