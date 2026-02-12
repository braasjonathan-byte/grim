import { useState, useCallback } from "react";
import { Dumbbell } from "lucide-react";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import WeekSelector from "@/components/WeekSelector";
import WeekOverview from "@/components/WeekOverview";
import WorkoutCard from "@/components/WorkoutCard";
import OneRMCalculator from "@/components/OneRMCalculator";
import { getWeeks, getWeekDays } from "@/data/workoutData";
import type { Profile } from "@/data/workoutData";

const Index = () => {
  const [profile, setProfile] = useState<Profile>("J");
  const [currentWeek, setCurrentWeek] = useState(1);
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  const weeks = getWeeks(profile);
  const days = getWeekDays(profile, currentWeek);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-black tracking-tight">
              TRÄNING<span className="text-primary">.</span>
            </h1>
          </div>
          <ProfileSwitcher profile={profile} onSwitch={setProfile} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Week selector */}
        <WeekSelector
          weeks={weeks}
          currentWeek={currentWeek}
          onSelect={setCurrentWeek}
          profile={profile}
        />

        {/* Week overview grid */}
        <WeekOverview
          profile={profile}
          currentWeek={currentWeek}
          onSelect={setCurrentWeek}
        />

        {/* Workout cards */}
        <div className="space-y-2">
          {days.map((day) => (
            <WorkoutCard
              key={`${profile}-${day.week}-${day.day}`}
              workout={day}
              profile={profile}
              onUpdate={forceUpdate}
            />
          ))}
        </div>

        {/* 1RM Calculator */}
        <OneRMCalculator />
      </main>
    </div>
  );
};

export default Index;
