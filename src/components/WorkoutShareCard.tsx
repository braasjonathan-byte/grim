import { useRef, useState, useEffect } from "react";
import { X, Download, Share2, Dumbbell, Footprints, Flame } from "lucide-react";
import html2canvas from "html2canvas";

interface WorkoutShareCardProps {
  sessionName: string;
  day: string;
  week: number;
  details: string;
  tempo?: string | null;
  loggedTempo?: string | null;
  loggedPulse?: number | null;
  loggedDistanceKm?: number | null;
  loggedWeights?: Record<string, any> | null;
  nickname: string;
  onClose: () => void;
}

const WorkoutShareCard = ({
  sessionName,
  day,
  week,
  details,
  tempo,
  loggedTempo,
  loggedPulse,
  loggedDistanceKm,
  loggedWeights,
  nickname,
  onClose,
}: WorkoutShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // Parse exercises from details
  const exercises = details
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Count completed sets
  const completedSets = (() => {
    let total = 0;
    if (!loggedWeights) return 0;
    for (const [key, val] of Object.entries(loggedWeights)) {
      if (key.startsWith("__sets__") && typeof val === "string") {
        total += val.split("").filter((c) => c === "1").length;
      }
    }
    return total;
  })();

  // Extract total volume (kg × reps)
  const totalVolume = (() => {
    if (!loggedWeights) return 0;
    let vol = 0;
    for (const [key, val] of Object.entries(loggedWeights)) {
      if (key.startsWith("__setdata__")) {
        try {
          const data = typeof val === "string" ? JSON.parse(val) : val;
          if (Array.isArray(data)) {
            const setsKey = key.replace("__setdata__", "__sets__");
            const setsStr = (loggedWeights[setsKey] as string) || "";
            data.forEach((s: any, i: number) => {
              if (setsStr[i] === "1") {
                const kg = parseFloat(s.kg) || 0;
                const reps = parseInt(s.reps) || 0;
                vol += kg * reps;
              }
            });
          }
        } catch {}
      }
    }
    return Math.round(vol);
  })();

  const isRunning =
    sessionName.toLowerCase().includes("löpning") ||
    sessionName.toLowerCase().includes("jogg") ||
    sessionName.toLowerCase().includes("långpass") ||
    sessionName.toLowerCase().includes("tröskel");

  const formatDay = (d: string) => {
    try {
      const dateMatch = d.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const date = new Date(dateMatch[1]);
        return date.toLocaleDateString("sv-SE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch {}
    return d.replace(/_[a-z0-9]+$/i, "");
  };

  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
          setGenerating(false);
        }, "image/png");
      });
    } catch {
      setGenerating(false);
      return null;
    }
  };

  const handleDownload = async () => {
    const blob = await generateImage();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grim-${sessionName.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const blob = await generateImage();
    if (!blob) return;
    const file = new File([blob], `grim-workout.png`, { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `${sessionName} ✅`,
          text: `${nickname} slutförde ${sessionName}! 💪`,
          files: [file],
        });
      } catch {}
    } else {
      // Fallback: download
      handleDownload();
    }
  };

  // Summary stats for exercises (non-conditioning)
  const exerciseSummaries = exercises
    .map((line) => {
      const match = line.match(/^(.+?)\s*—\s*(.+)$/);
      if (!match) return null;
      const name = match[1].trim();
      const info = match[2].trim();

      // Check if conditioning
      if (info.includes("min") || info.includes("/km")) {
        return { name, info, type: "cardio" as const };
      }

      // Strength: get logged set data
      const setDataKey = `__setdata__${name}`;
      const setsKey = `__sets__${name}`;
      if (loggedWeights?.[setDataKey]) {
        try {
          const data =
            typeof loggedWeights[setDataKey] === "string"
              ? JSON.parse(loggedWeights[setDataKey])
              : loggedWeights[setDataKey];
          const setsStr = (loggedWeights[setsKey] as string) || "";
          const completedData = (data as any[]).filter(
            (_: any, i: number) => setsStr[i] === "1"
          );
          if (completedData.length > 0) {
            const maxKg = Math.max(
              ...completedData.map((s: any) => parseFloat(s.kg) || 0)
            );
            return {
              name,
              info: `${completedData.length} set — ${maxKg > 0 ? `${maxKg} kg` : info}`,
              type: "strength" as const,
            };
          }
        } catch {}
      }

      return { name, info, type: "strength" as const };
    })
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 space-y-4 animate-fade-in">
        {/* The card itself */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
            padding: "24px",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #00d2ff, #3a7bd5)" }}
            >
              {isRunning ? (
                <Footprints className="w-5 h-5 text-white" />
              ) : (
                <Dumbbell className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3
                className="font-bold text-base leading-tight"
                style={{ color: "#fff" }}
              >
                {sessionName}
              </h3>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {week > 0 ? `Vecka ${week} · ${day}` : formatDay(day)} · {nickname}
              </p>
            </div>
            <div className="ml-auto">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#fff",
                }}
              >
                ✅ Avklarat
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mb-5">
            {isRunning && loggedDistanceKm && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {loggedDistanceKm}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  km
                </p>
              </div>
            )}
            {isRunning && loggedTempo && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {loggedTempo}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  min/km
                </p>
              </div>
            )}
            {isRunning && loggedPulse && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {loggedPulse}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  bpm
                </p>
              </div>
            )}
            {!isRunning && completedSets > 0 && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {completedSets}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  set
                </p>
              </div>
            )}
            {!isRunning && totalVolume > 0 && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {totalVolume >= 1000
                    ? `${(totalVolume / 1000).toFixed(1)}k`
                    : totalVolume}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  kg volym
                </p>
              </div>
            )}
            {!isRunning && exercises.length > 0 && (
              <div
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-2xl font-bold" style={{ color: "#fff" }}>
                  {exercises.length}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>
                  övningar
                </p>
              </div>
            )}
          </div>

          {/* Exercise list */}
          {exerciseSummaries.length > 0 && (
            <div
              className="rounded-xl p-3 space-y-2 mb-4"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              {exerciseSummaries.slice(0, 6).map((ex, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span
                    className="text-xs font-medium truncate mr-2"
                    style={{ color: "#e2e8f0", maxWidth: "60%" }}
                  >
                    {ex!.name}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "#94a3b8" }}
                  >
                    {ex!.info}
                  </span>
                </div>
              ))}
              {exerciseSummaries.length > 6 && (
                <p className="text-[10px] text-center" style={{ color: "#64748b" }}>
                  +{exerciseSummaries.length - 6} fler övningar
                </p>
              )}
            </div>
          )}

          {/* Footer / branding */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
              <span
                className="text-[11px] font-bold tracking-wide"
                style={{ color: "#94a3b8" }}
              >
                GRIM
              </span>
            </div>
            <span className="text-[10px]" style={{ color: "#475569" }}>
              grim.lovable.app
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Stäng
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            className="flex-1 py-3 bg-card text-card-foreground border border-border font-semibold rounded-lg hover:bg-accent transition-colors text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Ladda ner
          </button>
          <button
            onClick={handleShare}
            disabled={generating}
            className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" /> Dela
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkoutShareCard;
