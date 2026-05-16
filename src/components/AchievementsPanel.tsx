import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { ACHIEVEMENTS, getUnlockedAchievements } from "@/lib/achievements";

interface AchievementsPanelProps {
  unlockedIds: string[];
  compact?: boolean;
}

const difficultyLabel: Record<string, string> = {
  brons: "Brons",
  silver: "Silver",
  guld: "Guld",
  legend: "Legend",
};

const COLLAPSED_COUNT = 2;

const AchievementsPanel = ({ unlockedIds, compact = false }: AchievementsPanelProps) => {
  const unlocked = getUnlockedAchievements(unlockedIds);
  const [expanded, setExpanded] = useState(false);

  const base = compact ? unlocked.slice(0, 8) : unlocked;
  const shown = expanded ? base : base.slice(0, COLLAPSED_COUNT);
  const canExpand = base.length > COLLAPSED_COUNT;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          <h3 className="text-sm font-black">Achievements</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{unlocked.length}/{ACHIEVEMENTS.length}</span>
      </div>

      {unlocked.length === 0 ? (
        <div className="border border-border bg-secondary p-3 text-center">
          <p className="text-xs text-muted-foreground">Inga achievements upplåsta ännu</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {shown.map((achievement) => (
              <div key={achievement.id} className="border border-border bg-secondary p-2.5 min-h-[84px]">
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{achievement.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-black leading-tight">{achievement.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{difficultyLabel[achievement.difficulty]}</p>
                  </div>
                </div>
                {!compact && <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{achievement.description}</p>}
              </div>
            ))}
          </div>

          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border border-border bg-secondary p-2 flex items-center justify-center gap-1 text-xs font-black hover:bg-accent transition-colors"
            >
              {expanded ? "Visa färre" : `Visa alla (${base.length})`}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default AchievementsPanel;
