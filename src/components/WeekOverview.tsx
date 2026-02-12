import { getWeekProgressFromCache } from "@/lib/cloudSync";
import type { Profile } from "@/data/workoutData";
import { getWeekDays } from "@/data/workoutData";

interface WeekOverviewProps {
  profile: Profile;
  currentWeek: number;
  onSelect: (w: number) => void;
  weeks: number[];
}

const WeekOverview = ({ profile, currentWeek, onSelect, weeks }: WeekOverviewProps) => {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {weeks.map((w) => {
        const days = getWeekDays(profile, w);
        const progress = getWeekProgressFromCache(profile, w, days);
        const isCurrent = w === currentWeek;
        return (
          <button
            key={w}
            onClick={() => onSelect(w)}
            className={`relative flex flex-col items-center p-2 rounded-md text-xs transition-all ${
              isCurrent
                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "bg-secondary text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="font-bold">V{w}</span>
            {progress > 0 && (
              <div className="w-full mt-1 h-0.5 bg-background/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isCurrent ? "bg-primary-foreground" : "bg-primary"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default WeekOverview;
