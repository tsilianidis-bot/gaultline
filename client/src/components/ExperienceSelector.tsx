/**
 * ExperienceSelector — two-button toggle between Guided Intelligence and Tools & Features.
 *
 * Designed to sit at the top of the left nav drawer.
 * Uses the ExperienceContext for state management.
 */

import { useExperience } from "@/contexts/ExperienceContext";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ExperienceSelectorProps {
  onSelect?: () => void;
}

export function ExperienceSelector({ onSelect }: ExperienceSelectorProps) {
  const { experience, setExperience, isLoading } = useExperience();

  function handleSelect(mode: "guided" | "tools") {
    setExperience(mode);
    onSelect?.();
  }

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase mb-2 px-1">
        Experience
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted/40 p-1">
        <button
          onClick={() => handleSelect("guided")}
          disabled={isLoading}
          className={cn(
            "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-all duration-150",
            experience === "guided"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <span className="text-[11px] font-semibold leading-tight tracking-wide">
            GUIDED
          </span>
          <span className="text-[9px] leading-tight opacity-70">
            Intelligence
          </span>
        </button>
        <button
          onClick={() => handleSelect("tools")}
          disabled={isLoading}
          className={cn(
            "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-all duration-150",
            experience === "tools"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <span className="text-[11px] font-semibold leading-tight tracking-wide">
            TOOLS
          </span>
          <span className="text-[9px] leading-tight opacity-70">
            & Features
          </span>
        </button>
      </div>
      {experience === "tools" && (
        <div className="mt-2 px-1">
          <Link
            href="/app/tools"
            onClick={onSelect}
            className="block text-[10px] text-primary/70 hover:text-primary transition-colors"
          >
            ← Tools Home
          </Link>
        </div>
      )}
    </div>
  );
}
