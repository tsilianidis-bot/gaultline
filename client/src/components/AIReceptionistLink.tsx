/**
 * AIReceptionistLink — reusable click-to-call component for the FAULTLINE AI Receptionist.
 * Renders a tel: href that fires a GA4 analytics event on click.
 *
 * Usage:
 *   <AIReceptionistLink variant="button" location="header" />
 *   <AIReceptionistLink variant="inline" location="pricing" />
 *   <AIReceptionistLink variant="tap-to-call" location="mobile_nav" />
 */
import { Phone } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

export const AI_RECEPTIONIST_PHONE = "+14407457384";
export const AI_RECEPTIONIST_DISPLAY = "+1 (440) 745-7384";
export const AI_RECEPTIONIST_TEL = `tel:${AI_RECEPTIONIST_PHONE}`;

interface AIReceptionistLinkProps {
  /** Visual style of the link */
  variant?: "button" | "inline" | "tap-to-call" | "icon-only";
  /** Where on the site this is placed — passed to analytics */
  location: string;
  /** Optional override for the label text */
  label?: string;
  className?: string;
}

export default function AIReceptionistLink({
  variant = "button",
  location,
  label,
  className = "",
}: AIReceptionistLinkProps) {
  function handleClick() {
    trackEvent("receptionist_call_clicked", { location });
  }

  if (variant === "tap-to-call") {
    return (
      <a
        href={AI_RECEPTIONIST_TEL}
        onClick={handleClick}
        className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-sm font-semibold tracking-wider hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-200 active:scale-[0.97] ${className}`}
        aria-label="Call FAULTLINE AI Receptionist"
      >
        <Phone className="w-4 h-4 shrink-0" />
        <span>{label ?? "Call FAULTLINE AI"}</span>
      </a>
    );
  }

  if (variant === "icon-only") {
    return (
      <a
        href={AI_RECEPTIONIST_TEL}
        onClick={handleClick}
        title={`Call AI Receptionist — ${AI_RECEPTIONIST_DISPLAY}`}
        className={`flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors ${className}`}
        aria-label="Call AI Receptionist"
      >
        <Phone className="w-4 h-4" />
      </a>
    );
  }

  if (variant === "inline") {
    return (
      <a
        href={AI_RECEPTIONIST_TEL}
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors font-mono text-sm ${className}`}
        aria-label={`Call AI Receptionist at ${AI_RECEPTIONIST_DISPLAY}`}
      >
        <Phone className="w-3.5 h-3.5 shrink-0" />
        <span>{label ?? AI_RECEPTIONIST_DISPLAY}</span>
      </a>
    );
  }

  // default: "button"
  return (
    <a
      href={AI_RECEPTIONIST_TEL}
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-mono text-xs font-semibold tracking-wider hover:bg-cyan-500/20 hover:border-cyan-400/60 transition-all duration-200 active:scale-[0.97] whitespace-nowrap ${className}`}
      aria-label={`Call AI Receptionist at ${AI_RECEPTIONIST_DISPLAY}`}
    >
      <Phone className="w-3.5 h-3.5 shrink-0" />
      <span>{label ?? "Call AI Receptionist"}</span>
    </a>
  );
}
