/* ============================================================
   DrawerContext — shared state for left nav drawer, right action
   drawer, and ASHA orb coordination.

   Rules:
   - Only one panel may be open at a time (opening one closes the other)
   - Summoning ASHA closes both panels
   - closeAll() is called by AshaPanel before ascension begins
   ============================================================ */
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface DrawerContextValue {
  leftOpen: boolean;
  rightOpen: boolean;
  openLeft: () => void;
  openRight: () => void;
  closeLeft: () => void;
  closeRight: () => void;
  closeAll: () => void;
  toggleLeft: () => void;
  toggleRight: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const openLeft = useCallback(() => {
    setRightOpen(false);
    setLeftOpen(true);
  }, []);

  const openRight = useCallback(() => {
    setLeftOpen(false);
    setRightOpen(true);
  }, []);

  const closeLeft = useCallback(() => setLeftOpen(false), []);
  const closeRight = useCallback(() => setRightOpen(false), []);

  const closeAll = useCallback(() => {
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  const toggleLeft = useCallback(() => {
    if (leftOpen) {
      setLeftOpen(false);
    } else {
      setRightOpen(false);
      setLeftOpen(true);
    }
  }, [leftOpen]);

  const toggleRight = useCallback(() => {
    if (rightOpen) {
      setRightOpen(false);
    } else {
      setLeftOpen(false);
      setRightOpen(true);
    }
  }, [rightOpen]);

  return (
    <DrawerContext.Provider value={{
      leftOpen, rightOpen,
      openLeft, openRight,
      closeLeft, closeRight,
      closeAll,
      toggleLeft, toggleRight,
    }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be used within DrawerProvider");
  return ctx;
}
