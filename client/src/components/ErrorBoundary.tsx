import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When true, renders a compact inline error card instead of full-page overlay */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="flex flex-col items-center justify-center p-8 gap-4 text-center">
            <AlertTriangle size={32} className="text-destructive" />
            <p className="text-sm text-muted-foreground">
              This section encountered an error.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                "bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={14} />
              Try again
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
export { ErrorBoundary };

// ── Section-level boundary with FAULTLINE styling ─────────────
interface SectionProps {
  children: ReactNode;
  label?: string;
}

class SectionBoundaryInner extends Component<SectionProps, State> {
  constructor(props: SectionProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[SectionErrorBoundary] ${this.props.label ?? "Section"} failed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? "This section";
      return (
        <div style={{
          background: "rgba(255,107,107,0.04)",
          border: "1px solid rgba(255,107,107,0.15)",
          borderRadius: "6px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}>
          <AlertTriangle size={16} style={{ color: "#FF6B6B", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              fontWeight: 700,
              color: "#FF6B6B",
              letterSpacing: "0.08em",
              marginBottom: "4px",
            }}>
              {label.toUpperCase()} TEMPORARILY UNAVAILABLE
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "10px",
              color: "#6B7280",
              lineHeight: 1.5,
            }}>
              This subsystem encountered an error and was isolated. All other sections continue to function normally.
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                marginTop: "10px",
                padding: "4px 12px",
                background: "rgba(255,107,107,0.08)",
                border: "1px solid rgba(255,107,107,0.25)",
                borderRadius: "4px",
                color: "#FF6B6B",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "10px",
                cursor: "pointer",
                letterSpacing: "0.06em",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <RotateCcw size={10} />
              RETRY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SectionErrorBoundary({ children, label }: SectionProps) {
  return (
    <SectionBoundaryInner label={label}>
      {children}
    </SectionBoundaryInner>
  );
}

// ── Full-page boundary (used at App.tsx level) ─────────────────
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
