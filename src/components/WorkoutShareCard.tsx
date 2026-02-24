import { useRef, useState } from "react";
import { X, Download, Share2, Dumbbell, Footprints, Flame, Palette } from "lucide-react";
import html2canvas from "html2canvas";
import grimIcon from "@/assets/grim-icon.png";

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
      if (!match) return null;
      const name = match[1].trim();
      const info = match[2].trim();

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
          }}
        >
          {/* Header with logo */}
          <div className="flex items-center gap-3 mb-4">
            <img
              src={grimIcon}
              alt="Grim"
              style={{ width: 64, height: 64, borderRadius: 14 }}
              crossOrigin="anonymous"
            />
            <div style={{ flex: 1 }}>
              <h3
                className="font-bold text-base leading-tight"
                style={{ color: t.text }}
              >
                {sessionName}
              </h3>
              <p className="text-xs" style={{ color: t.subtext }}>
                {week > 0 ? `Vecka ${week} · ` : ""}{formatDay(day)} · {nickname}
              </p>
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ background: t.badgeBg, color: "#fff" }}
            >
              ✅ Avklarat
            </span>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 mb-4">
            {isRunning && loggedDistanceKm && (
              <StatBox label="km" value={String(loggedDistanceKm)} bg={t.statBg} text={t.text} muted={t.muted} />
            )}
            {isRunning && loggedTempo && (
              <StatBox label="min/km" value={loggedTempo} bg={t.statBg} text={t.text} muted={t.muted} />
            )}
            {isRunning && loggedPulse && (
              <StatBox label="bpm" value={String(loggedPulse)} bg={t.statBg} text={t.text} muted={t.muted} />
            )}
            {!isRunning && completedSets > 0 && (
              <StatBox label="set" value={String(completedSets)} bg={t.statBg} text={t.text} muted={t.muted} />
            )}
            {!isRunning && totalVolume > 0 && (
              <StatBox
                label="kg volym"
                value={totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(totalVolume)}
                bg={t.statBg} text={t.text} muted={t.muted}
              />
            )}
            {!isRunning && exercises.length > 0 && (
              <StatBox label="övningar" value={String(exercises.length)} bg={t.statBg} text={t.text} muted={t.muted} />
            )}
          </div>

          {/* Exercise details */}
          {exerciseSummaries.length > 0 && (
            <div
              className="rounded-xl p-3 space-y-2.5 mb-4"
              style={{ background: t.exerciseBg, border: `1px solid ${t.border}` }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: t.muted }}>
                {isRunning ? "Kondition" : "Övningar"}
              </p>
              {exerciseSummaries.map((ex, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-semibold truncate mr-2"
                      style={{ color: t.text, maxWidth: "65%" }}
                    >
                      {ex!.name}
                    </span>
                    {ex!.type === "cardio" && (
                      <span className="text-[10px] font-mono" style={{ color: t.subtext }}>
                        {ex!.info}
                      </span>
                    )}
                  </div>
                  {ex!.type === "strength" && ex!.sets.length > 0 && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: t.subtext }}>
                      {formatSets(ex!.sets)}
                    </p>
                  )}
                  {ex!.type === "strength" && ex!.sets.length === 0 && (
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: t.muted }}>
                      {ex!.info}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer / branding */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5" style={{ color: "#f97316" }} />
              <span
                className="text-[11px] font-bold tracking-widest"
                style={{ color: t.muted }}
              >
                GRIM
              </span>
            </div>
            <span className="text-base font-medium" style={{ color: t.muted }}>
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

const StatBox = ({ label, value, bg, text, muted }: { label: string; value: string; bg: string; text: string; muted: string }) => (
  <div className="flex-1 rounded-xl p-3 text-center" style={{ background: bg }}>
    <p className="text-2xl font-bold" style={{ color: text }}>{value}</p>
    <p className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>{label}</p>
  </div>
);

export default WorkoutShareCard;
