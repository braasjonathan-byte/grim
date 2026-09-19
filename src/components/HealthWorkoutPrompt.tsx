import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  hasHealthPermissions,
  isHealthSupported,
  readHealthWorkouts,
  type HealthWorkout,
} from "@/lib/healthSync";
import { findImportedHealthWorkouts, healthWorkoutDayKey, importHealthWorkouts } from "@/lib/healthWorkoutImport";

const DISMISS_KEY = "grim_health_prompt_dismissed";

const loadDismissed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const saveDismissed = (keys: Set<string>) => {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...keys].slice(-200)));
  } catch {
    /* ignore */
  }
};

const DEMO_WORKOUT: HealthWorkout = {
  key: "samsung-health-preview",
  start: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  end: new Date().toISOString(),
  type: "running",
  label: "Löpning",
  source: "Samsung Health",
  minutes: 42,
  distanceKm: 7.12,
  calories: 486,
  steps: 8_421,
  avgHeartRate: 151,
  maxHeartRate: 174,
};

/** Frågar vid appstart om nya pass från hälsoappen ska registreras i Grim. */
const HealthWorkoutPrompt = ({ userId, preview = false }: { userId: string; preview?: boolean }) => {
  const [pending, setPending] = useState<HealthWorkout[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (preview) {
      setPending([DEMO_WORKOUT]);
      setOpen(true);
      return;
    }
    if (!userId || !isHealthSupported()) return;
    let cancelled = false;
    (async () => {
      try {
        if (!(await hasHealthPermissions())) return;
        const list = await readHealthWorkouts(7);
        if (cancelled || list.length === 0) return;
        const imported = await findImportedHealthWorkouts(userId, list);
        const dismissed = loadDismissed();
        const fresh = list.filter(
          (w) => !imported.has(healthWorkoutDayKey(w)) && !dismissed.has(healthWorkoutDayKey(w)),
        );
        if (cancelled || fresh.length === 0) return;
        setPending(fresh);
        setOpen(true);
      } catch {
        /* tyst – hälsodata är frivilligt */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, preview]);

  const dismiss = useCallback(() => {
    if (preview) {
      setOpen(false);
      return;
    }
    const dismissed = loadDismissed();
    pending.forEach((w) => dismissed.add(healthWorkoutDayKey(w)));
    saveDismissed(dismissed);
    setOpen(false);
  }, [pending, preview]);

  const confirm = useCallback(async () => {
    if (preview) {
      toast.success("Passet registrerat i Grim");
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await importHealthWorkouts(userId, pending);
      toast.success(
        res.imported === 1 ? "Passet registrerat i Grim" : `${res.imported} pass registrerade i Grim`,
      );
      const dismissed = loadDismissed();
      pending.forEach((w) => dismissed.add(healthWorkoutDayKey(w)));
      saveDismissed(dismissed);
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Kunde inte registrera passet");
    } finally {
      setSaving(false);
    }
  }, [userId, pending, preview]);

  if (pending.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {pending.length === 1 ? "Nytt pass hittat" : `${pending.length} nya pass hittade`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>Samsung Health har synkat ett nytt pass. Vill du registrera det i Grim?</p>
              <ul className="space-y-1 text-sm">
                {pending.slice(0, 5).map((w) => {
                  const info = [
                    w.minutes ? `${Math.round(w.minutes)} min` : null,
                    w.distanceKm ? `${w.distanceKm} km` : null,
                    w.calories ? `${w.calories} kcal` : null,
                    w.avgHeartRate ? `${w.avgHeartRate} bpm i snitt` : null,
                  ].filter(Boolean);
                  return (
                    <li key={healthWorkoutDayKey(w)}>
                      <span className="font-medium text-foreground">{w.label}</span>{" "}
                      {new Date(w.start).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                       {info.length > 0 && ` · ${info.join(" · ")}`}
                       <span className="mt-1 block text-xs text-muted-foreground">Källa: {w.source}</span>
                    </li>
                  );
                })}
                {pending.length > 5 && <li>+ {pending.length - 5} till</li>}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Nej tack</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrera
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default HealthWorkoutPrompt;
