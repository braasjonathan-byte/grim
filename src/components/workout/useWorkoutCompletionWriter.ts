import { useCallback, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queueOfflineUpsert, dequeueOfflineUpsert } from "@/hooks/useOfflineSync";
import { patchOfflineWorkoutCache } from "@/lib/offlineWorkoutCache";
import { countCheckmarks, detectDestructiveWrite, getKnownCheckmarkCount, rememberCheckmarkCount, logDestructiveWrite } from "@/lib/completionGuard";
import type { Completion } from "./types";

interface Options {
  userId: string;
  setCompletions: Dispatch<SetStateAction<Record<string, Completion>>>;
  triggerSave: () => void;
}

/** One persistence path for set fields, checks, RPE and cardio logs. */
export function useWorkoutCompletionWriter({ userId, setCompletions, triggerSave }: Options) {
  // Safe upsert that always preserves ALL existing fields to prevent data loss
  const safeUpsertCompletion = useCallback(async (
    week: number,
    day: string,
    updates: Partial<Completion & { logged_weights: Record<string, any> | null }>
  ) => {
    const entryKey = `${week}-${day}`;

    // Build payload from current state synchronously using a promise that resolves inside setState
    const payload = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const merged = {
          week,
          day,
          done: prevComp.done || false,
          skipped: prevComp.skipped || false,
          user_comment: prevComp.user_comment || "",
          logged_tempo: prevComp.logged_tempo ?? null,
          logged_pulse: prevComp.logged_pulse ?? null,
          logged_distance_km: prevComp.logged_distance_km ?? null,
          logged_weights: prevComp.logged_weights ?? null,
          ...updates,
        };

        resolve(merged);

        return {
          ...prev,
          [entryKey]: merged as any,
        };
      });
    });

    const upsertData = {
        user_id: userId,
        week,
        day,
        done: payload.done,
        skipped: payload.skipped,
        user_comment: payload.user_comment,
        logged_tempo: payload.logged_tempo,
        logged_pulse: payload.logged_pulse,
        logged_distance_km: payload.logged_distance_km,
        logged_weights: payload.logged_weights,
      };

    // Safety net: never let a write silently remove more than one checkmark
    // compared to what we know is already stored in the backend.
    const nextCount = countCheckmarks(payload.logged_weights, !!payload.done);
    const destructive = detectDestructiveWrite(getKnownCheckmarkCount(userId, week, day), nextCount);
    if (destructive && !(typeof navigator !== "undefined" && navigator.onLine === false)) {
      const { data: serverRow } = await supabase
        .from("workout_completions")
        .select("done, logged_weights")
        .eq("user_id", userId)
        .eq("week", week)
        .eq("day", day)
        .maybeSingle();
      const serverCount = serverRow
        ? countCheckmarks((serverRow as any).logged_weights, !!(serverRow as any).done)
        : 0;
      if (nextCount < serverCount - 1) {
        logDestructiveWrite("safeUpsertCompletion", userId, week, day, { previousCount: serverCount, nextCount }, true);
        // Restore the authoritative backend state into the UI instead of saving.
        if (serverRow) {
          setCompletions((prev: Record<string, any>) => ({
            ...prev,
            [entryKey]: { ...prev[entryKey], ...(serverRow as any), week, day },
          }));
        }
        rememberCheckmarkCount(userId, week, day, serverCount);
        toast.error("Sparningen stoppades – den skulle ha raderat loggad träningsdata. Data laddades om.");
        return;
      }
      logDestructiveWrite("safeUpsertCompletion", userId, week, day, { previousCount: serverCount, nextCount }, false);
    }

    // Queue to localStorage first so data survives if the page is killed before network completes
    queueOfflineUpsert("workout_completions", upsertData as any, "user_id,week,day");
    // Mirror into the offline snapshot so a reload without coverage still shows it
    patchOfflineWorkoutCache(userId, upsertData as any);

    // Offline: lita på kön (synkas när nät finns) i stället för att vänta på ett anrop som timeoutar.
    const { error } = (typeof navigator !== "undefined" && navigator.onLine === false)
      ? { error: { message: "offline" } as any }
      : await supabase.from("workout_completions").upsert(
          upsertData as any,
          { onConflict: "user_id,week,day" }
        );

    // If network save succeeded, remove the queued fallback so it can never be replayed later
    if (!error) {
      rememberCheckmarkCount(userId, week, day, nextCount);
      dequeueOfflineUpsert("workout_completions", { user_id: userId, week, day });
    }

    // Notify friends when a workout is marked done (server dedups per user+week+day)
    if (payload.done === true) {
      try {
        const { notifyFriendsOfCompletion } = await import("@/hooks/usePushNotifications");
        const [{ data: plans }, { data: prof }] = await Promise.all([
          supabase.from("workout_plans").select("session_name").eq("user_id", userId).eq("week", week).eq("day", day),
          supabase.from("profiles").select("plan_start_date").eq("user_id", userId).maybeSingle(),
        ]);
        const sessionName = (plans || []).map((p: any) => p.session_name).filter(Boolean).join(" + ");
        void notifyFriendsOfCompletion(day, week, sessionName, (prof as any)?.plan_start_date ?? null);
      } catch (e) {
        console.warn("notifyFriendsOfCompletion failed", e);
      }
    }
    triggerSave();
  }, [userId, setCompletions, triggerSave]);

  const updateCompletionWeights = useCallback(async (
    week: number,
    day: string,
    updater: (current: Record<string, any>) => Record<string, any>
  ) => {
    const entryKey = `${week}-${day}`;

    // Compute the new weights using current state via promise
    const nextWeights = await new Promise<Record<string, any>>((resolve) => {
      setCompletions((prev: Record<string, any>) => {
        const prevComp = prev[entryKey] || {};
        const currentWeights = (prevComp.logged_weights || {}) as Record<string, any>;
        resolve(updater(currentWeights));
        return prev; // Don't update yet - safeUpsertCompletion will do it
      });
    });

    await safeUpsertCompletion(week, day, { logged_weights: nextWeights });
  }, [setCompletions, safeUpsertCompletion]);

  return { safeUpsertCompletion, updateCompletionWeights };
}
