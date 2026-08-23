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
        const result = await SendIntent.checkSendIntentReceived();
        const url = (result as { url?: string })?.url;
        const title = (result as { title?: string })?.title ?? "aktivitet";
        if (!url) return;
        const resolved = decodeURIComponent(url);
        const name = isSupportedActivityFile(title) ? title : resolved.split("/").pop() || title;
        if (!isSupportedActivityFile(name)) return;

        const response = await fetch(resolved);
        const blob = await response.blob();
        emit(await parseActivityFile(new File([blob], name)));
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
