import { useEffect, useState } from "react";
import { Heart, Square, Circle } from "lucide-react";
import {
  getHeartRateRecording,
  getHeartRateSnapshot,
  startHeartRateRecording,
  stopHeartRateRecording,
  subscribeHeartRate,
  type HeartRateRecording,
} from "@/lib/heartRate";

interface Props {
  /** Anropas när en inspelning stoppas, med snitt-, max- och lägsta puls. */
  onResult: (r: { avg: number; max: number; min: number }) => void;
}

/** Liten ruta för att spela in puls under ett pass och få snitt/max/lägsta. */
const HeartRateRecorder = ({ onResult }: Props) => {
  const [snap, setSnap] = useState(getHeartRateSnapshot());
  const [rec, setRec] = useState<HeartRateRecording>(getHeartRateRecording());

  useEffect(
    () =>
      subscribeHeartRate(() => {
        setSnap(getHeartRateSnapshot());
        setRec(getHeartRateRecording());
      }),
    []
  );

  const stop = () => {
    const r = stopHeartRateRecording();
    if (r.avg != null && r.max != null && r.min != null) {
      onResult({ avg: r.avg, max: r.max, min: r.min });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Heart className={`h-4 w-4 ${snap.connected ? "text-destructive" : "text-muted-foreground"}`} />
          <span className="font-bold tabular-nums">{snap.bpm ?? "–"}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">bpm</span>
        </div>
        {rec.recording ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); stop(); }}
            className="flex items-center gap-1.5 rounded-full bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold"
          >
            <Square className="h-3 w-3" /> Stoppa
          </button>
        ) : (
          <button
            type="button"
            disabled={!snap.connected}
            onClick={(e) => { e.stopPropagation(); startHeartRateRecording(); }}
            className="flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Circle className="h-3 w-3" fill="currentColor" /> Spela in puls
          </button>
        )}
      </div>

      {(rec.samples > 0 || rec.recording) && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Snitt", value: rec.avg },
            { label: "Max", value: rec.max },
            { label: "Lägsta", value: rec.min },
          ].map((x) => (
            <div key={x.label} className="rounded-lg bg-background py-1.5">
              <div className="text-sm font-bold tabular-nums">{x.value ?? "–"}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{x.label}</div>
            </div>
          ))}
        </div>
      )}

      {!snap.connected && (
        <p className="text-[10px] text-muted-foreground">
          Anslut din pulsmätare under Verktyg → Hjälpmedel för att spela in puls.
        </p>
      )}
      {rec.recording && (
        <p className="text-[10px] text-muted-foreground">Spelar in… stoppa när passet är klart.</p>
      )}
    </div>
  );
};

export default HeartRateRecorder;
