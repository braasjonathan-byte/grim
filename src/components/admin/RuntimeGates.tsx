import { useAppSettings } from "@/lib/appSettings";
import { needsForceUpdate } from "@/lib/featureFlags";
import { APP_VERSION } from "@/lib/version";
import { updateApp } from "@/lib/appUpdate";

/** Blocks members during maintenance or when their bundle is older than the admin limit. Admins pass through. */
export default function RuntimeGates({ isAdmin }: { isAdmin: boolean }) {
  const settings = useAppSettings();
  const updateRequired = needsForceUpdate(APP_VERSION, settings.force_update_after);
  const message = settings.maintenance_mode
    ? (settings.maintenance_message.trim() || "Grim är tillfälligt stängd för underhåll. Försök igen om en stund.")
    : (settings.force_update_message.trim() || "Det finns en ny version. Ladda om appen för att fortsätta.");

  if (!isAdmin && (settings.maintenance_mode || updateRequired)) {
    return (
      <div className="fixed inset-0 z-[190] bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-black font-serif">{settings.maintenance_mode ? "Underhåll" : "Uppdatera Grim"}</p>
        <p className="text-sm text-muted-foreground max-w-xs whitespace-pre-line">{message}</p>
        {!settings.maintenance_mode && (
          <button onClick={() => void updateApp()} className="px-6 py-3 bg-primary text-primary-foreground font-bold text-sm">
            Ladda om
          </button>
        )}
      </div>
    );
  }

  if (isAdmin && (settings.maintenance_mode || updateRequired)) {
    return (
      <p className="mx-3 mt-2 rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
        {settings.maintenance_mode ? "Underhållsläge är på. Bara admin kommer in." : "Omladdning krävs för äldre versioner. Du som admin släpps förbi."}
      </p>
    );
  }

  return null;
}
