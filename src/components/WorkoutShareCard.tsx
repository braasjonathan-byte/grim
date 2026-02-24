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

  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: cardRef.current.scrollWidth,
        windowHeight: cardRef.current.scrollHeight,
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
            width: "100%",
            boxSizing: "border-box",
            aspectRatio: "9 / 16",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: 1 }}>
          {/* Header with logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <img
              src={grimIcon}
              alt="Grim"
              style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0 }}
              crossOrigin="anonymous"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{ color: t.text, fontWeight: 700, fontSize: "16px", lineHeight: "1.25", margin: 0 }}
              >
                {sessionName}
              </h3>
              <p style={{ color: t.subtext, fontSize: "12px", margin: "2px 0 0 0" }}>
                {week > 0 ? `Vecka ${week} · ` : ""}{formatDay(day)} · {nickname}
              </p>
            </div>
            <span
              style={{
                background: t.badgeBg,
                color: "#fff",
                fontSize: "12px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "9999px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: "1",
              }}
            >
              ✅ Avklarat
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
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
              style={{
                background: t.exerciseBg,
                border: `1px solid ${t.border}`,
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <p style={{ color: t.muted, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
                {isRunning ? "Kondition" : "Övningar"}
              </p>
              {exerciseSummaries.map((ex, i) => (
                <div key={i} style={{ marginBottom: i < exerciseSummaries.length - 1 ? "10px" : 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                    <span
                      style={{ color: t.text, fontSize: "12px", fontWeight: 600 }}
                    >
                      {ex!.name}
                    </span>
                    {ex!.type === "cardio" && (
                      <span style={{ color: t.subtext, fontSize: "10px", fontFamily: "monospace" }}>
                        {ex!.info}
                      </span>
                    )}
                  </div>
                  {ex!.type === "strength" && ex!.sets.length > 0 && (
                    <p style={{ color: t.subtext, fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>
                      {formatSets(ex!.sets)}
                    </p>
                  )}
                  {ex!.type === "strength" && ex!.sets.length === 0 && (
                    <p style={{ color: t.muted, fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>
                      {ex!.info}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          </div>

          {/* Footer / branding */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Flame style={{ width: "14px", height: "14px", color: "#f97316" }} />
              <span
                style={{ color: t.muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}
              >
                GRIM
              </span>
            </div>
            <span style={{ color: t.muted, fontSize: "12px", fontWeight: 500 }}>
              Ladda ner → grim.lovable.app
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
  <div style={{ flex: 1, borderRadius: "12px", padding: "14px 8px", textAlign: "center", background: bg }}>
    <div style={{ fontSize: "24px", fontWeight: 700, color: text, lineHeight: "1", textAlign: "center", width: "100%" }}>{value}</div>
    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: muted, marginTop: "6px", textAlign: "center", width: "100%" }}>{label}</div>
  </div>
);

export default WorkoutShareCard;
