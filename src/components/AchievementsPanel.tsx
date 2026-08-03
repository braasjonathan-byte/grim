import { ChevronRight, Trophy } from "lucide-react";
import { ACHIEVEMENTS, getUnlockedAchievements } from "@/lib/achievements";

interface AchievementsPanelProps {
  unlockedIds: string[];
  unlockedAt?: Record<string, string>;
  compact?: boolean;
  onOpen?: () => void;
}

const AchievementsPanel = ({ unlockedIds, unlockedAt = {}, compact = false, onOpen }: AchievementsPanelProps) => {
  const unlockedSet = new Set(unlockedIds);
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).length;
  const total = ACHIEVEMENTS.length;
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  const preview = getUnlockedAchievements(unlockedIds)
    .sort((a, b) => {
      const ta = new Date(unlockedAt[a.id] ?? 0).getTime();
      const tb = new Date(unlockedAt[b.id] ?? 0).getTime();
      return tb - ta;
    })
    .slice(0, compact ? 5 : 6);

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`Achievements: ${unlockedCount} av ${total} upplåsta`}
      className="w-full text-left border border-border bg-secondary p-3 space-y-2 transition-colors enabled:hover:bg-accent disabled:cursor-default"
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-warning shrink-0" />
        <h3 className="text-sm font-black flex-1">Achievements</h3>
        <span className="text-xs text-muted-foreground font-mono">{unlockedCount}/{total}</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="h-2 flex-1 bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{pct}%</span>
      </div>

      {preview.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {preview.map((a) => (
            <span key={a.id} className="text-lg leading-none" title={a.title}>{a.emoji}</span>
          ))}
        </div>
      )}

      {onOpen && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{unlockedCount === 0 ? "Inga achievements upplåsta ännu" : "Tryck för att se alla badges"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}
    </button>
  );
};

export default AchievementsPanel;
