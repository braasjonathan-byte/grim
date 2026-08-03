import { useMemo, useState } from "react";
import { ArrowLeft, Trophy, X } from "lucide-react";
import { ACHIEVEMENTS, type AchievementDefinition, type AchievementDifficulty } from "@/lib/achievements";

interface AchievementsViewProps {
  unlockedIds: string[];
  unlockedAt?: Record<string, string>;
  title?: string;
  onClose: () => void;
}

const DIFFICULTY_LABEL: Record<AchievementDifficulty, string> = {
  brons: "Brons",
  silver: "Silver",
  guld: "Guld",
  legend: "Legend",
};

const DIFFICULTIES: AchievementDifficulty[] = ["brons", "silver", "guld", "legend"];

type Filter = "all" | "unlocked" | "locked" | AchievementDifficulty;

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const AchievementsView = ({ unlockedIds, unlockedAt = {}, title = "Achievements", onClose }: AchievementsViewProps) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<AchievementDefinition | null>(null);

  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const perDifficulty = useMemo(() => DIFFICULTIES.map((d) => {
    const items = ACHIEVEMENTS.filter((a) => a.difficulty === d);
    return { difficulty: d, total: items.length, unlocked: items.filter((a) => unlockedSet.has(a.id)).length };
  }), [unlockedSet]);

  const isNew = (id: string) => {
    const ts = unlockedAt[id];
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return !isNaN(t) && Date.now() - t < NEW_WINDOW_MS;
  };

  const list = useMemo(() => ACHIEVEMENTS.filter((a) => {
    if (filter === "all") return true;
    if (filter === "unlocked") return unlockedSet.has(a.id);
    if (filter === "locked") return !unlockedSet.has(a.id);
    return a.difficulty === filter;
  }), [filter, unlockedSet]);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Alla" },
    { key: "unlocked", label: "Upplåsta" },
    { key: "locked", label: "Låsta" },
    ...DIFFICULTIES.map((d) => ({ key: d as Filter, label: DIFFICULTY_LABEL[d] })),
  ];

  const fmtDate = (ts?: string) => {
    if (!ts) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("sv-SE");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div
        className="flex items-center gap-2 border-b border-border px-3 py-3"
        style={{ paddingTop: "calc(var(--grim-header-safe-top, 0px) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tillbaka"
          className="p-2 -ml-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Trophy className="w-5 h-5 text-warning" />
        <h2 className="text-sm font-black flex-1 truncate">{title}</h2>
        <span className="text-xs font-mono text-muted-foreground">{unlockedCount}/{total}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ paddingBottom: "calc(var(--grim-bottom-safe, 0px) + 1.5rem)" }}>
        <div className="border border-border bg-secondary p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-black">{unlockedCount} av {total} upplåsta</p>
            <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2 w-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2 pt-1">
            {perDifficulty.map((d) => (
              <div key={d.difficulty} className="text-center">
                <p className="text-[10px] text-muted-foreground">{DIFFICULTY_LABEL[d.difficulty]}</p>
                <p className="text-xs font-black font-mono">{d.unlocked}/{d.total}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 text-xs font-black border transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {list.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a)}
                className={`relative border p-2 text-left min-h-[96px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  unlocked ? "border-border bg-secondary hover:bg-accent" : "border-border/50 bg-muted/30"
                }`}
              >
                {unlocked && isNew(a.id) && (
                  <span className="absolute top-1 right-1 px-1 py-0.5 text-[9px] font-black bg-warning text-warning-foreground animate-pulse">
                    NY!
                  </span>
                )}
                <span className={`text-2xl leading-none ${unlocked ? "" : "grayscale opacity-30"}`}>{a.emoji}</span>
                <p className={`text-[10px] font-black text-center leading-tight ${unlocked ? "" : "text-muted-foreground"}`}>
                  {a.title}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {unlocked ? (fmtDate(unlockedAt[a.id]) ?? DIFFICULTY_LABEL[a.difficulty]) : DIFFICULTY_LABEL[a.difficulty]}
                </p>
              </button>
            );
          })}
        </div>

        {list.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Inga achievements matchar filtret</p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm border border-border bg-card p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className={`text-3xl leading-none ${unlockedSet.has(selected.id) ? "" : "grayscale opacity-40"}`}>{selected.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black leading-tight">{selected.title}</p>
                <p className="text-[10px] text-muted-foreground">{DIFFICULTY_LABEL[selected.difficulty]}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Stäng" className="p-1 hover:bg-accent">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{selected.description}</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {unlockedSet.has(selected.id)
                ? `Upplåst ${fmtDate(unlockedAt[selected.id]) ?? ""}`.trim()
                : "Ej upplåst ännu"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementsView;
