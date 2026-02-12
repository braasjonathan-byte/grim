import { useState, useCallback, useEffect } from "react";
import { Dumbbell, LogOut } from "lucide-react";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import WeekSelector from "@/components/WeekSelector";
import WeekOverview from "@/components/WeekOverview";
import WorkoutCard from "@/components/WorkoutCard";
import OneRMCalculator from "@/components/OneRMCalculator";
import PinScreen from "@/components/PinScreen";
import { getWeeks, getWeekDays } from "@/data/workoutData";
import { fetchCompletions, setCachedCompletions } from "@/lib/cloudSync";
import type { Profile } from "@/data/workoutData";

const Index = () => {
  const [profile, setProfile] = useState<Profile | null>(() => {
    // Check if any profile is still unlocked
    if (localStorage.getItem("pin-J") === "unlocked") return "J";
    if (localStorage.getItem("pin-W") === "unlocked") return "W";
    return null;
  });
  const [currentWeek, setCurrentWeek] = useState(1);
  const [, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  // Sync completions from cloud when profile changes
  useEffect(() => {
    if (!profile) return;
    setSyncing(true);
    fetchCompletions(profile).then((data) => {
      setCachedCompletions(profile, data);
      setSyncing(false);
      forceUpdate();
    });
  }, [profile, forceUpdate]);

  const handleUnlock = (p: Profile) => {
    setProfile(p);
  };

  const handleLogout = () => {
    localStorage.removeItem("pin-J");
    localStorage.removeItem("pin-W");
    setProfile(null);
  };

  const handleSwitchProfile = (p: Profile) => {
    // Check if the other profile is unlocked
    if (localStorage.getItem(`pin-${p}`) === "unlocked") {
      setProfile(p);
    } else {
      // Need to enter PIN for the other profile
      localStorage.removeItem(`pin-${profile}`);
      setProfile(null);
      // Small delay then auto-select
      setTimeout(() => {
        const pinScreen = document.querySelector(`[data-profile="${p}"]`);
        if (pinScreen) (pinScreen as HTMLButtonElement).click();
      }, 100);
    }
  };

  if (!profile) {
    return <PinScreen onUnlock={handleUnlock} />;
  }

  const weeks = getWeeks(profile);
  const days = getWeekDays(profile, currentWeek);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-black tracking-tight">
              TRÄNING<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ProfileSwitcher profile={profile} onSwitch={handleSwitchProfile} />
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Logga ut"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        {syncing && (
          <div className="text-center text-xs text-muted-foreground animate-pulse">
            Synkar...
          </div>
        )}

        <WeekSelector
          weeks={weeks}
          currentWeek={currentWeek}
          onSelect={setCurrentWeek}
          profile={profile}
        />

        <WeekOverview
          profile={profile}
          currentWeek={currentWeek}
          onSelect={setCurrentWeek}
          weeks={weeks}
        />

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

        <OneRMCalculator />
      </main>
    </div>
  );
};

export default Index;
