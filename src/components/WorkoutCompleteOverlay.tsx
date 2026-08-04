import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfettiBurst from "@/components/ConfettiBurst";
import { formatVolumeKg, formatDurationMin, formatCardioDistance, formatCardioPace, type WorkoutSummary } from "@/lib/workoutSummary";
import { hapticLight } from "@/lib/haptics";
import { buildSurpriseReward, type SurpriseReward } from "@/lib/surpriseRewards";

interface WorkoutCompleteOverlayProps {
  open: boolean;
  title?: string;
  summary: WorkoutSummary | null;
  userId?: string;
  onClose: () => void;
}

/**
 * Short "Bra jobbat!" celebration shown right after a workout is completed,
 * with a summary of sets, volume, exercises and any personal records.
 */
const WorkoutCompleteOverlay = ({ open, title, summary, userId, onClose }: WorkoutCompleteOverlayProps) => {
  const [surprise, setSurprise] = useState<SurpriseReward | null>(null);

  useEffect(() => {
    if (open) hapticLight();
  }, [open]);

  // Random but genuine "surprise" reward, revealed a beat after the summary
  useEffect(() => {
    if (!open) {
      setSurprise(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    buildSurpriseReward(userId || "", summary).then((reward) => {
      if (cancelled || !reward) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        setSurprise(reward);
        hapticLight();
      }, 900);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  if (!open) return null;

  const cardio = summary?.cardio ?? null;
  const hasStrength = (summary?.sets ?? 0) > 0 || (summary?.volumeKg ?? 0) > 0;
  const timeStat = { label: "Tid", value: summary?.durationMin ? formatDurationMin(summary.durationMin) : "–" };

  let stats: Array<{ label: string; value: string }>;
  if (cardio && !hasStrength) {
    // Rent konditionspass
    const pace = formatCardioPace(cardio.minutes, cardio.distanceKm, cardio.primaryName);
    stats = [
      { label: "Distans", value: formatCardioDistance(cardio.distanceKm, cardio.primaryName) },
      { label: pace.label, value: pace.value },
      timeStat,
      { label: "Snittpuls", value: cardio.pulse ? `${cardio.pulse} bpm` : "–" },
    ];
  } else if (cardio && hasStrength) {
    // Blandat pass – set/övningar för styrkan, distans/tempo för konditionen
    const pace = formatCardioPace(cardio.minutes, cardio.distanceKm, cardio.primaryName);
    stats = [
      { label: "Set", value: String(summary?.sets ?? 0) },
      { label: "Övningar", value: String(summary?.exercises.length ?? 0) },
      { label: "Volym", value: summary?.volumeKg ? formatVolumeKg(summary.volumeKg) : "–" },
      { label: "Distans", value: formatCardioDistance(cardio.distanceKm, cardio.primaryName) },
      { label: pace.label, value: pace.value },
      timeStat,
    ];
  } else {
    stats = [
      { label: "Set", value: String(summary?.sets ?? 0) },
      { label: "Övningar", value: String(summary?.exercises.length ?? 0) },
      { label: "Volym", value: summary?.volumeKg ? formatVolumeKg(summary.volumeKg) : "–" },
      timeStat,
    ];
  }
  const prs = summary?.prExercises ?? [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-5 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Passet klart"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Stäng"
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-secondary flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative w-full max-w-sm text-center space-y-5 animate-scale-in">
        <ConfettiBurst count={22} className="top-10" />

        <div className="relative mx-auto h-20 w-20 rounded-full bg-success/15 text-success flex items-center justify-center celebration-glow">
          <Trophy className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Bra jobbat!</h2>
          <p className="text-sm text-muted-foreground">{title?.trim() ? title : "Passet är klarmarkerat"}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border/60 p-3">
              <p className="text-lg font-bold tabular-nums leading-tight">{s.value}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {prs.length > 0 && (
          <div className="rounded-2xl bg-warning/10 border border-warning/30 p-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              {prs.length === 1 ? "Nytt personligt rekord" : `${prs.length} nya personliga rekord`}
            </p>
            <p className="text-sm mt-1">{prs.join(", ")}</p>
          </div>
        )}

        {surprise && (
          <div className="relative rounded-2xl bg-primary/10 border border-primary/25 p-3.5 text-left animate-scale-in">
            {surprise.confetti && <ConfettiBurst count={16} className="top-0" />}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/15 flex items-center justify-center text-lg">
                {surprise.emoji}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{surprise.title}</p>
                <p className="text-sm mt-0.5 leading-snug">{surprise.text}</p>
                {typeof surprise.progress === "number" && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-primary/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.round(surprise.progress * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Button className="w-full" onClick={onClose}>
          Fortsätt
        </Button>
      </div>
    </div>
  );
};

export default WorkoutCompleteOverlay;
