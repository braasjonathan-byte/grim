import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRecoveryEmailStatus, type RecoveryEmailStatus } from "@/lib/recoveryEmail";

/**
 * Decides whether the blocking "Lägg till din e-post" screen should show.
 *
 * - Checked at boot / whenever the signed-in user changes. A confirmed
 *   "missing" at boot opens the gate immediately (it is derived from the
 *   server, so it survives reloads until an address is saved).
 * - Offline or failed lookups never block. We re-check when the device comes
 *   back online or the app resumes. If that late check finds no e-mail, the gate
 *   waits until the next time the app is brought to the foreground, so a user
 *   who started a session offline (e.g. mid-workout at the gym) isn't
 *   interrupted while actively using the app.
 */
export function useRecoveryEmailGate(userId: string | null | undefined) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<RecoveryEmailStatus>("unknown");
  const pendingRef = useRef(false);
  const seqRef = useRef(0);
  const statusRef = useRef<RecoveryEmailStatus>("unknown");

  const check = useCallback(async (uid: string, atBoot: boolean) => {
    const seq = ++seqRef.current;
    const result = await fetchRecoveryEmailStatus(supabase, uid);
    if (seq !== seqRef.current) return;
    statusRef.current = result;
    setStatus(result);
    if (result === "present") {
      pendingRef.current = false;
      setOpen(false);
    } else if (result === "missing") {
      if (atBoot) setOpen(true);
      else pendingRef.current = true;
    }
  }, []);

  useEffect(() => {
    setOpen(false);
    pendingRef.current = false;
    statusRef.current = "unknown";
    setStatus("unknown");
    if (!userId) {
      seqRef.current++;
      return;
    }
    const uid = userId;
    void check(uid, true);

    const recheckIfUnknown = () => {
      if (statusRef.current === "unknown") void check(uid, false);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (pendingRef.current) {
        pendingRef.current = false;
        setOpen(true);
        return;
      }
      recheckIfUnknown();
    };
    window.addEventListener("online", recheckIfUnknown);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", recheckIfUnknown);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, check]);

  const markSaved = useCallback(() => {
    pendingRef.current = false;
    statusRef.current = "present";
    setStatus("present");
    setOpen(false);
  }, []);

  return { open, status, markSaved };
}
