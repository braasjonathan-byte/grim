import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, Share2, Palette, Send, Copy, Image as ImageIcon, Trash2 } from "lucide-react";
import grimIcon from "@/assets/grim-icon.webp";
import {
  buildWorkoutCardSvg,
  SHARE_CARD_THEMES,
  CARD_W,
  CARD_H,
  type SvgStats,
  type SvgExercise,
  type ShareCardVariant,
  type SportKey,
} from "@/lib/buildWorkoutCardSvg";
import { pickImage } from "@/lib/pickImage";
import WorkoutPostThread from "./WorkoutPostThread";

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
  ownerUserId?: string;
  viewerUserId?: string;
  onClose: () => void;
  onChatShare?: () => void;
  onCopyToDate?: () => void;
  onSaveWorkout?: () => void;
}

/** Sport identity: short label per workout type, consistent with app terminology. */
const SPORT_RULES: { re: RegExp; label: string; key: SportKey }[] = [
  { re: /(löpning|jogg|långpass|tröskel|intervall\s*löp|terräng)/i, label: "Löpning", key: "run" },
  { re: /(cykel|cykling|spinning)/i, label: "Cykling", key: "bike" },
  { re: /(sim|simning|crawl)/i, label: "Simning", key: "swim" },
  { re: /(rodd|roddmaskin)/i, label: "Rodd", key: "row" },
  { re: /(skidor|skidåkning|längdskidor)/i, label: "Skidor", key: "ski" },
  { re: /(gång|promenad|vandring)/i, label: "Gång", key: "walk" },
  { re: /(triathlon|duathlon)/i, label: "Triathlon", key: "triathlon" },
  { re: /(yoga|mobilitet|rörlighet|stretch)/i, label: "Rörlighet", key: "mobility" },
  { re: /(hiit|cirkel|crossfit|kondition)/i, label: "Kondition", key: "cardio" },
];


const CARDIO_LABELS = new Set([
  "Löpning",
  "Cykling",
  "Simning",
  "Rodd",
  "Skidor",
  "Gång",
  "Triathlon",
  "Kondition",
]);

const WorkoutShareCard = ({
  sessionName,
  day,
  week,
  details,
  loggedTempo,
  loggedPulse,
  loggedDistanceKm,
  loggedWeights,
  nickname,
  ownerUserId,
  viewerUserId,
  onClose,
  onChatShare,
  onCopyToDate,
  onSaveWorkout,
}: WorkoutShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [variant, setVariant] = useState<ShareCardVariant>("light");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string>("");

  const handlePickPhoto = async () => {
    const picked = await pickImage({ source: "prompt", quality: 80 });
    if (!picked) return;
    setUserPhoto(picked.dataUrl);
  };

  const exercises = details
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sport = useMemo(() => {
    const hit = SPORT_RULES.find((r) => r.re.test(sessionName) || r.re.test(details));
    return hit ?? { label: "Styrka", key: "strength" as SportKey };
  }, [sessionName, details]);
  const sportLabel = sport.label;
  const sportKey = sport.key;

  const isRunning = CARDIO_LABELS.has(sportLabel);

  const formatDay = (d: string) => {
    try {
      const dateMatch = d.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const date = new Date(dateMatch[1]);
        return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
      }
    } catch {}
    return d.replace(/_[a-z0-9]+$/i, "");
  };

  const formatSets = (sets: { kg: string; reps: string }[]) => {
    if (sets.length === 0) return null;
    const groups: { kg: string; reps: string; count: number }[] = [];
    sets.forEach((s) => {
      const last = groups[groups.length - 1];
      if (last && last.kg === s.kg && last.reps === s.reps) last.count++;
      else groups.push({ ...s, count: 1 });
    });
    return groups.map((g) => `${g.count}×${g.reps} @ ${g.kg}kg`).join(", ");
  };

  // Build detailed exercise summaries
  const exerciseSummaries = exercises.map((line) => {
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
        const completedData = (data as any[]).filter((_: any, i: number) => setsStr[i] === "1");
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
  });

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
              if (setsStr[i] === "1") vol += (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0);
            });
          }
        } catch {}
      }
    }
    return Math.round(vol);
  })();

  const stats: SvgStats[] = useMemo(() => {
    const out: SvgStats[] = [];
    if (isRunning) {
      if (loggedDistanceKm) out.push({ label: "Distans", value: `${loggedDistanceKm} km` });
      if (loggedTempo) out.push({ label: "Tempo", value: loggedTempo });
      if (loggedPulse) out.push({ label: "Snittpuls", value: `${loggedPulse} bpm` });
    }
    if (completedSets > 0) out.push({ label: "Set", value: String(completedSets) });
    if (totalVolume > 0)
      out.push({
        label: "Volym",
        value: totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k kg` : `${totalVolume} kg`,
      });
    if (out.length < 4 && exercises.length > 0 && !isRunning)
      out.push({ label: "Övningar", value: String(exercises.length) });
    return out.slice(0, 4);
  }, [isRunning, loggedDistanceKm, loggedTempo, loggedPulse, completedSets, totalVolume, exercises.length]);

  const svgExercises: SvgExercise[] = exerciseSummaries.map((ex) => ({
    name: ex.name,
    detail: ex.type === "cardio" ? ex.info : ex.sets.length > 0 ? formatSets(ex.sets) || "" : ex.info,
  }));

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

  useEffect(() => {
    loadImageAsBase64(grimIcon).then(setLogoBase64).catch(() => setLogoBase64(""));
  }, []);

  const metaLine = `${week > 0 ? `Vecka ${week} · ` : ""}${formatDay(day)}`;

  const svgMarkup = useMemo(
    () =>
      buildWorkoutCardSvg({
        sessionName,
        metaLine,
        nickname,
        sportLabel,
        stats,
        exercises: svgExercises,
        isRunning,
        logoBase64,
        variant,
        userPhotoBase64: userPhoto || undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionName, metaLine, nickname, sportLabel, stats, JSON.stringify(svgExercises), isRunning, logoBase64, variant, userPhoto]
  );

  const generateImage = async (): Promise<Blob | null> => {
    setGenerating(true);
    try {
      const logo = logoBase64 || (await loadImageAsBase64(grimIcon));
      const svgStr = buildWorkoutCardSvg({
        sessionName,
        metaLine,
        nickname,
        sportLabel,
        stats,
        exercises: svgExercises,
        isRunning,
        logoBase64: logo,
        variant,
        userPhotoBase64: userPhoto || undefined,
      });

      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = CARD_W;
      canvas.height = CARD_H;
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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto space-y-3 animate-fade-in">
        {/* Theme selector */}
        <div className="flex items-center justify-center gap-2">
          <Palette className="w-4 h-4 text-muted-foreground" />
          {(Object.keys(SHARE_CARD_THEMES) as ShareCardVariant[]).map((key) => (
            <button
              key={key}
              onClick={() => setVariant(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                variant === key
                  ? "bg-primary text-primary-foreground scale-105"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {SHARE_CARD_THEMES[key].label}
            </button>
          ))}
        </div>

        {/* Photo picker */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePickPhoto}
            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {userPhoto ? "Byt foto" : "Lägg till foto"}
          </button>
          {userPhoto && (
            <button
              onClick={() => setUserPhoto(null)}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-secondary text-secondary-foreground hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Ta bort
            </button>
          )}
        </div>

        {/* Live preview — identical markup to the exported PNG */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden shadow-soft [&>svg]:block [&>svg]:w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        {/* Friend reactions on the auto-shared post */}
        {ownerUserId && viewerUserId && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <div className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
              Vänner · 🔥 & kommentarer
            </div>
            <WorkoutPostThread userId={ownerUserId} viewerId={viewerUserId} week={week} day={day} />
          </div>
        )}

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
        {onChatShare && (
          <button
            onClick={onChatShare}
            className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-lg hover:bg-accent/80 transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" /> Dela via chatt
          </button>
        )}
        {onCopyToDate && (
          <button
            onClick={onCopyToDate}
            className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <Copy className="w-4 h-4" /> Kopiera till datum
          </button>
        )}
        {onSaveWorkout && (
          <button
            onClick={onSaveWorkout}
            className="w-full py-3 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Spara pass
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkoutShareCard;
