import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import ShareWorkoutPromptDialog from "@/components/ShareWorkoutPromptDialog";
import { HEALTH_WORKOUT_IMPORTED_EVENT, type ImportedHealthSession } from "@/lib/healthWorkoutImport";
import { loadPrivacySettings, type PostVisibility } from "@/lib/socialPrivacy";
import { autoShareCompletion, previewWorkoutCaption } from "@/lib/workoutAutoShare";

/** Both import entry points use the exact slot that was actually saved. */
export default function HealthWorkoutSharing({ userId, nickname }: { userId: string; nickname?: string }) {
  const [queue, setQueue] = useState<ImportedHealthSession[]>([]);
  const [review, setReview] = useState<{ caption: string; visibility: PostVisibility } | null>(null);
  const seen = useRef(new Set<string>());
  const target = queue[0];
  const advance = () => { setReview(null); setQueue((rows) => rows.slice(1)); };

  useEffect(() => {
    const onImported = (event: Event) => {
      const session = (event as CustomEvent<ImportedHealthSession>).detail;
      if (!session || session.userId !== userId) return;
      const key = `${session.week}-${session.day}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      setQueue((rows) => [...rows, session]);
    };
    window.addEventListener(HEALTH_WORKOUT_IMPORTED_EVENT, onImported);
    return () => window.removeEventListener(HEALTH_WORKOUT_IMPORTED_EVENT, onImported);
  }, [userId]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        const settings = await loadPrivacySettings(userId);
        const caption = await previewWorkoutCaption(userId, target.week, target.day);
        if (cancelled) return;
        if (!caption) throw new Error("Kunde inte läsa passets sammanfattning");
        if (settings.auto_share_workouts === "always") {
          const saved = await autoShareCompletion(userId, target.week, target.day, caption, settings.default_post_visibility);
          if (cancelled) return;
          if (saved) {
            toast.success("Passet delades till Social");
            advance();
            return;
          }
          toast.error("Passet är registrerat, men kunde inte delas. Försök igen.");
        }
        setReview({ caption, visibility: settings.default_post_visibility });
      } catch {
        if (!cancelled) {
          toast.error("Passet är registrerat. Öppna passet i Träning för att dela det.");
          advance();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [target, userId]);

  if (!target || !review) return null;
  return <ShareWorkoutPromptDialog
    open initialCaption={review.caption} defaultVisibility={review.visibility} nickname={nickname}
    onSkip={advance}
    onConfirm={async (caption, _title, visibility) => {
      const saved = await autoShareCompletion(userId, target.week, target.day, caption, visibility);
      if (!saved) { toast.error("Kunde inte dela passet – försök igen."); return; }
      toast.success("Passet delades till Social");
      advance();
    }}
  />;
}