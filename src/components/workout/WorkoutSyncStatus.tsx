import { RefreshCw } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineSync";

/** Queue updates render this badge, not the entire exercise list. */
export default function WorkoutSyncStatus() {
  const { online, pending } = useOfflineStatus();
  if (online && pending === 0) return null;
  return (
    <div role="status"
      className={`pointer-events-none fixed left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-soft backdrop-blur ${online ? "bg-card/95 text-primary" : "bg-card/95 text-warning"}`}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${online ? "animate-spin" : ""}`} />
      <span>{online
        ? `Synkar ${pending} sparad${pending === 1 ? "" : "e"} loggning${pending === 1 ? "" : "ar"}…`
        : "Offline – du kan logga som vanligt. Allt sparas i mobilen och synkas när täckningen är tillbaka."}
      </span>
    </div>
  );
}