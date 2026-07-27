/**
 * ExperienceContext — manages the user's platform experience mode.
 *
 * Two modes:
 *  - 'guided'  : Five-question intelligence flow (NOW / WHY / OUTLOOK / WATCH / ACT)
 *  - 'tools'   : Direct tool access (Tools & Features home + 12-category nav)
 *
 * Persistence:
 *  1. localStorage (immediate, survives refresh, works before auth)
 *  2. DB via dailyBrief.setExperience (synced on change, loaded on auth)
 *
 * The DB value wins on first authenticated load. After that, local state is
 * the source of truth and is synced to DB on every change.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";

export type ExperienceMode = "guided" | "tools";

const LS_KEY = "faultline_experience_mode";

function readLocalStorage(): ExperienceMode {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "guided" || v === "tools") return v;
  } catch { /* ignore */ }
  return "guided";
}

function writeLocalStorage(mode: ExperienceMode) {
  try { localStorage.setItem(LS_KEY, mode); } catch { /* ignore */ }
}

interface ExperienceContextValue {
  experience: ExperienceMode;
  setExperience: (mode: ExperienceMode) => void;
  isGuided: boolean;
  isTools: boolean;
  isLoading: boolean;
}

const ExperienceContext = createContext<ExperienceContextValue>({
  experience: "guided",
  setExperience: () => {},
  isGuided: true,
  isTools: false,
  isLoading: false,
});

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [experience, setExperienceState] = useState<ExperienceMode>(readLocalStorage);
  const [dbSynced, setDbSynced] = useState(false);

  // Load from DB once authenticated
  const { data: dbPref, isLoading: dbLoading } = trpc.dailyBrief.getExperience.useQuery(
    undefined,
    { enabled: !!user && !authLoading, staleTime: 5 * 60 * 1000 }
  );

  // Once DB value arrives, it wins (first authenticated load)
  useEffect(() => {
    if (dbPref && !dbSynced) {
      const mode = dbPref.experienceMode as ExperienceMode;
      setExperienceState(mode);
      writeLocalStorage(mode);
      setDbSynced(true);
    }
  }, [dbPref, dbSynced]);

  const setExperienceMutation = trpc.dailyBrief.setExperience.useMutation();

  const setExperience = useCallback((mode: ExperienceMode) => {
    setExperienceState(mode);
    writeLocalStorage(mode);
    if (user) {
      setExperienceMutation.mutate({ experienceMode: mode });
    }
  }, [user, setExperienceMutation]);

  const isLoading = authLoading || (!!user && dbLoading && !dbSynced);

  return (
    <ExperienceContext.Provider value={{
      experience,
      setExperience,
      isGuided: experience === "guided",
      isTools: experience === "tools",
      isLoading,
    }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  return useContext(ExperienceContext);
}
