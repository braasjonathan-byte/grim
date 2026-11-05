import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, purgeAppCaches } from "@/lib/lazyRetry";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Rot-ErrorBoundary. Utan denna avmonterade React hela trädet vid ett
 * renderfel/misslyckad lazy-import och användaren fastnade på en tom skärm
 * (endast temabakgrunden, t.ex. «GRIM Huva») utan väg ut.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
    // Ett krasch i en återställd flik ska inte låsa varje uppstart.
    try { localStorage.removeItem("grim_active_tab"); } catch { /* ignore */ }
    void import("@/lib/crashlytics")
      .then((m: any) => m.recordError?.(error, { step: "AppErrorBoundary" }))
      .catch(() => undefined);
  }

  private reload = () => window.location.reload();

  private hardReload = async () => {
    await purgeAppCaches();
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-4 text-center">
          <h1 className="text-xl font-bold">Något gick fel</h1>
          <p className="text-sm text-muted-foreground">
            {chunk
              ? "En ny version av Grim har publicerats. Ladda om för att hämta den."
              : "Appen kunde inte starta. Försök ladda om."}
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={this.reload} className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold">
              Ladda om
            </button>
            <button onClick={() => void this.hardReload()} className="h-11 rounded-lg border border-border font-semibold">
              Rensa cache och ladda om
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/70 break-words font-mono">{String(error?.message || error).slice(0, 300)}</p>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
