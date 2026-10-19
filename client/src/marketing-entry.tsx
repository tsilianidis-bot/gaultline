import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CANONICAL_HOME } from "@shared/routeRegistry";
import { Redirect } from "wouter";
import { useAuth } from "./_core/hooks/useAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieConsent from "./components/CookieConsent";
import { ThemeProvider } from "./contexts/ThemeContext";
import MarketingSite from "./pages/MarketingSite";
import "./marketing-root.css";

/**
 * The public root deliberately has only the presentation providers it needs.
 * Product-only state (ticker, ASHA, experience and the product router) stays
 * behind the path-aware dynamic product entry in main.tsx.
 */
export default function MarketingEntry() {
  const { user } = useAuth();

  // Match the existing root behavior: marketing remains visible during the
  // session lookup, while an authenticated session is sent to canonical home.
  if (user) return <Redirect to={CANONICAL_HOME} />;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <MarketingSite />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
