import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekProgressFromCache } from "@/lib/cloudSync";
import { getWeekDays } from "@/data/workoutData";
import type { Profile } from "@/data/workoutData";

interface WeekSelectorProps {
  weeks: number[];
  currentWeek: number;
  onSelect: (w: number) => void;
  profile: Profile;
}

const WeekSelector = ({ weeks, currentWeek, onSelect, profile }: WeekSelectorProps) => {
  const idx = weeks.indexOf(currentWeek);
  const days = getWeekDays(profile, currentWeek);
  const progress = getWeekProgressFromCache(profile, currentWeek, days);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => idx > 0 && onSelect(weeks[idx - 1])}
          disabled={idx <= 0}
          className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight">
            Vecka {currentWeek}
          </h2>
          <p className="text-sm text-muted-foreground">av {weeks.length} veckor</p>
        </div>

        <button
          onClick={() => idx < weeks.length - 1 && onSelect(weeks[idx + 1])}
          disabled={idx >= weeks.length - 1}
          className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {progress}% avklarat
      </p>
    </div>
  );
};

export default WeekSelector;
