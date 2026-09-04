/**
 * Tar emot träningsfiler (.gpx/.tcx/.fit) som delas till Grim från andra appar
 * (Garmin Connect, Strava, Zwift...) via Androids delningsmeny, och skickar dem
 * vidare till importdialogen i appen.
 */
import { Capacitor } from "@capacitor/core";
import { isSupportedActivityFile, parseActivityFile, type ParsedActivity } from "@/lib/activityFileParser";

export type { ParsedActivity };

type Listener = (activity: ParsedActivity) => void;

const listeners = new Set<Listener>();
let pending: ParsedActivity | null = null;

/** Aktivitet som delats in innan importvyn hunnit montera. */
export function pendingSharedActivity(): ParsedActivity | null {
  return pending;
}

export function subscribeSharedActivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Skickar en parsad aktivitet till importdialogen och öppnar Träning-fliken. */
export function emitSharedActivity(activity: ParsedActivity) {
  pending = activity;
  window.dispatchEvent(new CustomEvent("grim:set-tab", { detail: "workout" }));
  listeners.forEach((l) => l(activity));
}

const emit = emitSharedActivity;

let started = false;

/**
 * Startar lyssnaren för delade filer. Anropas en gång vid appstart.
 * No-op i webbläsaren – delnings-intents finns bara i Android-appen.
 */
export async function initSharedActivityListener(): Promise<void> {
  if (started || !Capacitor.isNativePlatform()) return;
  started = true;

  try {
    const { SendIntent } = await import("send-intent");

    const handle = async () => {
      try {
        const result = (await SendIntent.checkSendIntentReceived()) as {
          url?: string;
          title?: string;
          description?: string;
          additionalItems?: Array<{ url?: string; title?: string }>;
        };
        const url = result?.url;
        const title = result?.title ?? "aktivitet";

        if (url) {
          const resolved = decodeURIComponent(url);
          const name = isSupportedActivityFile(title) ? title : resolved.split("/").pop() || title;
          if (isSupportedActivityFile(name)) {
            const response = await fetch(resolved);
            const blob = await response.blob();
            emit(await parseActivityFile(new File([blob], name)));
            return;
          }
        }

        // Delad text/länk (t.ex. "Dela till Grim" från Strava-appen)
        const sharedText = [url, result?.title, result?.description]
          .filter(Boolean)
          .join(" ");
        if (/strava/i.test(sharedText)) {
          await importSharedStravaLink(sharedText);
        }
      } catch (err) {
        console.warn("[sharedActivity] kunde inte läsa delad fil", err);
      }
    };

    window.addEventListener("sendIntentReceived", () => void handle());
    await handle();
  } catch (err) {
    console.warn("[sharedActivity] send-intent ej tillgängligt", err);
  }
}

/**
 * Hämtar det delade Strava-passet via användarens Strava-koppling och
 * skickar det vidare till importdialogen som en vanlig aktivitet.
 */
export async function importSharedStravaLink(sharedText: string): Promise<boolean> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { mapActivityType } = await import("@/lib/activityFileParser");
    const { data, error } = await supabase.functions.invoke("strava-sync", {
      body: { mode: "shared_link", sharedText },
    });
    if (error || !data?.activity) {
      console.warn("[sharedActivity] Strava-import misslyckades", error);
      window.dispatchEvent(
        new CustomEvent("grim:toast", {
          detail: {
            title: "Kunde inte hämta passet från Strava",
            description: "Kontrollera att ditt Strava-konto är kopplat i Grim.",
            variant: "destructive",
          },
        }),
      );
      return false;
    }

    const a = data.activity;
    emit({
      rawType: a.rawType ?? null,
      exerciseName: mapActivityType(a.rawType),
      title: a.title ?? null,
      startTime: a.startTime ? new Date(a.startTime) : null,
      durationSec: a.durationSec ?? null,
      distanceKm: a.distanceKm ?? null,
      elevationGainM: a.elevationGainM ?? null,
      elevationLossM: null,
      avgHeartRate: a.avgHeartRate ?? null,
      maxHeartRate: a.maxHeartRate ?? null,
      avgWatt: a.avgWatt ?? null,
      calories: a.calories ?? null,
      points: [],
      format: "gpx",
      fileName: `strava-${a.stravaActivityId ?? "pass"}`,
    });
    return true;
  } catch (err) {
    console.warn("[sharedActivity] Strava-import fel", err);
    return false;
  }
}

