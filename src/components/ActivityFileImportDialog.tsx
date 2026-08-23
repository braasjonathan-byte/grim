import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ElevationProfile from "@/components/ElevationProfile";
import {
  IMPORT_EXERCISE_OPTIONS,
  parseActivityFile,
  type ParsedActivity,
} from "@/lib/activityFileParser";
import { buildWorkoutFromAiExercises, type AiExercise } from "@/lib/aiWorkoutImport";

export interface ImportedWorkout {
  name: string;
  details: string;
  tempo: string | null;
  loggedWeights: Record<string, string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (workout: ImportedWorkout) => void;
  /** Förparsad aktivitet (t.ex. delad från Garmin/Strava via Android-delning). */
  initialActivity?: ParsedActivity | null;
}

const fieldCls =
  "w-full bg-secondary text-foreground text-sm p-2 rounded-lg border-none outline-none focus:ring-1 focus:ring-primary";

const secToHms = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const hmsToMin = (v: string): number | null => {
  const parts = v.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 1) return parts[0];
  return null;
};

/**
 * Importerar ett avslutat pass från en GPX-/TCX-/FIT-fil (Garmin Connect,
 * Strava, Zwift m.fl.) och sparar det med samma datastruktur som ett vanligt
 * loggat konditionspass.
 */
export default function ActivityFileImportDialog({ open, onClose, onConfirm, initialActivity }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [activity, setActivity] = useState<ParsedActivity | null>(null);
  const [exercise, setExercise] = useState("Löpning");
  const [name, setName] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [pulse, setPulse] = useState("");
  const [elevation, setElevation] = useState("");
  const [watt, setWatt] = useState("");

  const applyActivity = (a: ParsedActivity) => {
    setActivity(a);
    setExercise(a.exerciseName);
    setName(a.title?.trim() || a.exerciseName);
    setDistance(a.distanceKm ? (Math.round(a.distanceKm * 100) / 100).toString() : "");
    setDuration(a.durationSec ? secToHms(a.durationSec) : "");
    setPulse(a.avgHeartRate ? String(Math.round(a.avgHeartRate)) : "");
    setElevation(a.elevationGainM ? String(Math.round(a.elevationGainM)) : "");
    setWatt(a.avgWatt ? String(Math.round(a.avgWatt)) : "");
  };

  useEffect(() => {
    if (open && initialActivity) applyActivity(initialActivity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialActivity]);

  if (!open) return null;

  const reset = () => {
    setActivity(null);
    setParsing(false);
    setName("");
    setDistance("");
    setDuration("");
    setPulse("");
    setElevation("");
    setWatt("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      applyActivity(await parseActivityFile(file));
    } catch (e) {
      toast({
        title: "Kunde inte läsa filen",
        description: e instanceof Error ? e.message : "Välj en .gpx-, .tcx- eller .fit-fil.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const buildResult = (): ImportedWorkout | null => {
    const minutes = hmsToMin(duration);
    const km = distance ? parseFloat(distance.replace(",", ".")) : null;
    const ex: AiExercise = {
      type: "cardio",
      name: exercise,
      duration_min: minutes ?? undefined,
      distance_km: km && Number.isFinite(km) ? km : undefined,
      pulse: pulse ? parseInt(pulse, 10) : undefined,
      elevation_gain_m: elevation ? parseInt(elevation, 10) : undefined,
      watt: watt ? parseInt(watt, 10) : undefined,
    };
    const built = buildWorkoutFromAiExercises([ex]);
    if (!built.details.trim()) return null;
    return {
      name: name.trim() || exercise,
      details: built.details,
      tempo: null,
      loggedWeights: built.loggedWeights,
    };
  };

  const preview = activity ? buildResult() : null;
  const elevations = (activity?.points ?? [])
    .map((p) => p.ele)
    .filter((e): e is number => typeof e === "number");

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl bg-card p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <FileUp className="h-4 w-4 text-primary" /> Importera pass från fil
          </h3>
          <button onClick={close} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Stäng">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Välj en .gpx-, .tcx- eller .fit-fil exporterad från Garmin Connect, Strava, Zwift m.fl.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".gpx,.tcx,.fit,application/gpx+xml,application/vnd.garmin.tcx+xml,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 py-2.5 text-xs text-primary transition-colors hover:border-primary disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" /> {activity ? "Välj en annan fil" : "Välj fil"}
        </button>

        {parsing && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Läser filen...
          </div>
        )}

        {activity && !parsing && (
          <div className="animate-fade-in space-y-2.5">
            <div className="rounded-lg bg-secondary/40 px-2.5 py-2 text-[10px] text-muted-foreground">
              {activity.fileName} · {activity.format.toUpperCase()}
              {activity.rawType ? ` · ${activity.rawType}` : ""}
              {activity.startTime ? ` · ${activity.startTime.toLocaleDateString("sv-SE")}` : ""}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Övning</label>
              <select value={exercise} onChange={(e) => setExercise(e.target.value)} className={fieldCls}>
                {Array.from(new Set([exercise, ...IMPORT_EXERCISE_OPTIONS])).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Passnamn</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Distans (km)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tid (t:mm:ss)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Snittpuls</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Höjdökning (m)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Effekt (W)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={watt}
                  onChange={(e) => setWatt(e.target.value)}
                  className={fieldCls}
                />
              </div>
            </div>

            {elevations.length > 1 && (
              <ElevationProfile
                elevations={elevations}
                distanceKm={parseFloat(distance.replace(",", ".")) || 0}
                height={70}
              />
            )}

            {preview && (
              <pre className="whitespace-pre-wrap rounded-lg bg-secondary/30 p-2 font-mono text-[10px] text-muted-foreground">
                {preview.details}
              </pre>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const result = buildResult();
                  if (!result) {
                    toast({ title: "Fyll i minst tid eller distans", variant: "destructive" });
                    return;
                  }
                  onConfirm(result);
                  reset();
                }}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Importera pass
              </button>
              <button onClick={close} className="rounded-lg bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
