import { useRef, useState } from "react";
import { X, Download, Share2, Palette } from "lucide-react";
import grimIcon from "@/assets/grim-icon.png";
import { buildWorkoutCardSvg, type SvgStats, type SvgExercise } from "@/lib/buildWorkoutCardSvg";

type Theme = "colorful" | "light" | "dark";

const themes: Record<Theme, {
  bg: string;
  cardBg: string;
  text: string;
  subtext: string;
  muted: string;
  statBg: string;
  accent: string;
  badgeBg: string;
  exerciseBg: string;
  border: string;
  label: string;
}> = {
  colorful: {
    bg: "linear-gradient(145deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%)",
    cardBg: "rgba(255,255,255,0.08)",
    text: "#ffffff",
    subtext: "#c4b5fd",
    muted: "#a78bfa",
    statBg: "rgba(139,92,246,0.2)",
    accent: "linear-gradient(135deg, #8b5cf6, #ec4899)",
    badgeBg: "linear-gradient(135deg, #22c55e, #10b981)",
    exerciseBg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.3)",
    label: "Färgglatt",
  },
  light: {
    bg: "linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)",
    cardBg: "rgba(0,0,0,0.03)",
    text: "#0f172a",
    subtext: "#475569",
    muted: "#64748b",
    statBg: "rgba(0,0,0,0.05)",
    accent: "linear-gradient(135deg, #0f172a, #334155)",
    badgeBg: "linear-gradient(135deg, #22c55e, #16a34a)",
    exerciseBg: "rgba(0,0,0,0.03)",
    border: "rgba(0,0,0,0.1)",
    label: "Ljust",
  },
  dark: {
    bg: "linear-gradient(145deg, #0a0a0a 0%, #171717 50%, #1c1c1c 100%)",
    cardBg: "rgba(255,255,255,0.05)",
    text: "#ffffff",
    subtext: "#a1a1aa",
    muted: "#71717a",
    statBg: "rgba(255,255,255,0.06)",
    accent: "linear-gradient(135deg, #fafafa, #a1a1aa)",
    badgeBg: "linear-gradient(135deg, #22c55e, #16a34a)",
    exerciseBg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.1)",
    label: "Mörkt",
  },
};

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
  const [theme, setTheme] = useState<Theme>("colorful");

  const t = themes[theme];

  const exercises = details
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

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

  // Build detailed exercise summaries
  const exerciseSummaries = exercises
    .map((line) => {
      const match = line.match(/^(.+?)\s*—\s*(.+)$/);
      const name = match ? match[1].trim() : line;
      const info = match ? match[2].trim() : "";

      if (info.includes("min") || info.includes("/km")) {
        return { name, info, type: "cardio" as const, sets: [] as { kg: string; reps: string }[] };
      }

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
            return {
              name,
              info,
              type: "strength" as const,
              sets: completedData.map((s: any) => ({
                kg: String(parseFloat(s.kg) || 0),
                reps: String(parseInt(s.reps) || 0),
              })),
            };
          }
        } catch {}
      }

      return { name, info, type: "strength" as const, sets: [] as { kg: string; reps: string }[] };
    })
    .filter(Boolean);

  // Stats
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
                vol += (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0);
              }
            });
          }
        } catch {}
      }
    }
    return Math.round(vol);
  })();

  const loadImageAsBase64 = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });

  const generateImage = async (): Promise<Blob | null> => {
    setGenerating(true);
    try {
      const logoBase64 = await loadImageAsBase64(grimIcon);
      const subtitle = `${week > 0 ? `Vecka ${week} · ` : ""}${formatDay(day)} · ${nickname}`;

      const svgStats: SvgStats[] = [];
      if (isRunning && loggedDistanceKm) svgStats.push({ label: "km", value: String(loggedDistanceKm) });
      if (isRunning && loggedTempo) svgStats.push({ label: "min/km", value: loggedTempo });
      if (isRunning && loggedPulse) svgStats.push({ label: "bpm", value: String(loggedPulse) });
      if (!isRunning && completedSets > 0) svgStats.push({ label: "set", value: String(completedSets) });
      if (!isRunning && totalVolume > 0) svgStats.push({ label: "kg volym", value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(totalVolume) });
      if (!isRunning && exercises.length > 0) svgStats.push({ label: "övningar", value: String(exercises.length) });

      const svgExercises: SvgExercise[] = exerciseSummaries.map((ex) => ({
        name: ex!.name,
        detail:
          ex!.type === "cardio"
            ? ex!.info
            : ex!.sets.length > 0
              ? formatSets(ex!.sets) || ""
              : ex!.info,
      }));

      const svgStr = buildWorkoutCardSvg({
        sessionName,
        subtitle,
        stats: svgStats,
        exercises: svgExercises,
        isRunning,
        logoBase64,
        theme: t,
      });

      // SVG → Canvas → PNG
      const scale = 3;
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = 360 * scale;
      canvas.height = 640 * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          setGenerating(false);
          resolve(blob);
        }, "image/png");
      });
    } catch (e) {
      console.error("SVG render error:", e);
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
      handleDownload();
    }
  };

  const formatSets = (sets: { kg: string; reps: string }[]) => {
    if (sets.length === 0) return null;
    // Group identical sets
    const groups: { kg: string; reps: string; count: number }[] = [];
    sets.forEach((s) => {
      const last = groups[groups.length - 1];
      if (last && last.kg === s.kg && last.reps === s.reps) {
        last.count++;
      } else {
        groups.push({ ...s, count: 1 });
      }
    });
    return groups
      .map((g) => `${g.count}×${g.reps} @ ${g.kg}kg`)
      .join(", ");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 space-y-3 animate-fade-in">
        {/* Theme selector */}
        <div className="flex items-center justify-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          {(Object.keys(themes) as Theme[]).map((key) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                theme === key
                  ? "bg-primary text-primary-foreground scale-105"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {themes[key].label}
            </button>
          ))}
        </div>

        {/* The card */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden"
          style={{
            background: t.bg,
            padding: "24px",
            fontFamily: "'Space Grotesk', sans-serif",
            width: "100%",
            boxSizing: "border-box",
            aspectRatio: "9 / 16",
            position: "relative",
          }}
        >
          {/* Header with logo */}
          <div style={{ marginBottom: "16px", display: "table", width: "100%" }}>
            <div style={{ display: "table-cell", width: "64px", verticalAlign: "top" }}>
              <img
                src={grimIcon}
                alt="Grim"
                style={{ width: 64, height: 64, borderRadius: 14 }}
                crossOrigin="anonymous"
              />
            </div>
            <div style={{ display: "table-cell", verticalAlign: "middle", paddingLeft: "12px" }}>
              <div
                style={{ color: t.text, fontWeight: 700, fontSize: "16px", lineHeight: "1.25", margin: 0 }}
              >
                {sessionName}
              </div>
              <div style={{ color: t.subtext, fontSize: "12px", marginTop: "2px" }}>
                {week > 0 ? `Vecka ${week} · ` : ""}{formatDay(day)} · {nickname}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ marginTop: "8px", marginBottom: "16px", display: "table", width: "100%", tableLayout: "fixed", borderSpacing: "8px 0" }}>
            {(() => {
              const stats: { label: string; value: string }[] = [];
              if (isRunning && loggedDistanceKm) stats.push({ label: "km", value: String(loggedDistanceKm) });
              if (isRunning && loggedTempo) stats.push({ label: "min/km", value: loggedTempo });
              if (isRunning && loggedPulse) stats.push({ label: "bpm", value: String(loggedPulse) });
              if (!isRunning && completedSets > 0) stats.push({ label: "set", value: String(completedSets) });
              if (!isRunning && totalVolume > 0) stats.push({ label: "kg volym", value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(totalVolume) });
              if (!isRunning && exercises.length > 0) stats.push({ label: "övningar", value: String(exercises.length) });
              return stats.map((s, i) => (
                <div key={i} style={{ display: "table-cell", borderRadius: "12px", padding: "14px 4px", textAlign: "center", background: t.statBg, verticalAlign: "middle" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: t.text, lineHeight: "1.2", textAlign: "center" }}>{s.value}</div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: t.muted, marginTop: "4px", textAlign: "center" }}>{s.label}</div>
                </div>
              ));
            })()}
          </div>

          {/* Exercise details */}
          {exerciseSummaries.length > 0 && (
            <div
              style={{
                background: t.exerciseBg,
                border: `1px solid ${t.border}`,
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: t.muted, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                {isRunning ? "Kondition" : "Övningar"}
              </div>
              {exerciseSummaries.map((ex, i) => (
                <div key={i} style={{ marginBottom: i < exerciseSummaries.length - 1 ? "10px" : "0" }}>
                  {ex!.type === "cardio" ? (
                    <div style={{ display: "table", width: "100%" }}>
                      <div style={{ display: "table-cell", color: t.text, fontSize: "12px", fontWeight: 600 }}>
                        {ex!.name}
                      </div>
                      <div style={{ display: "table-cell", color: t.subtext, fontSize: "10px", fontFamily: "monospace", textAlign: "right", whiteSpace: "nowrap" }}>
                        {ex!.info}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}>
                        {ex!.name}
                      </div>
                      {ex!.sets.length > 0 ? (
                        <div style={{ color: t.subtext, fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>
                          {formatSets(ex!.sets)}
                        </div>
                      ) : (
                        <div style={{ color: t.muted, fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>
                          {ex!.info}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Avklarat badge - using table for reliable centering in html2canvas */}
          <div style={{ display: "table", width: "100%", marginBottom: "16px" }}>
            <div style={{ display: "table-cell", textAlign: "center" }}>
              <div
                style={{
                  display: "inline-block",
                  background: t.badgeBg,
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "8px 20px",
                  borderRadius: "9999px",
                  lineHeight: "1.4",
                }}
              >
                ✅ Avklarat
              </div>
            </div>
          </div>

          {/* Footer / branding */}
          <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px", display: "table", width: "calc(100% - 48px)" }}>
            <div style={{ display: "table-cell", color: t.muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textAlign: "left" }}>
              🔥 GRIM
            </div>
            <div style={{ display: "table-cell", color: t.muted, fontSize: "12px", fontWeight: 500, textAlign: "right" }}>
              Ladda ner → grim.lovable.app
            </div>
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
