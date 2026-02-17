import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, CheckCircle, XCircle, Flame, Footprints } from "lucide-react";
import WeightProgressionChart from "@/components/WeightProgressionChart";
import PersonalRecords from "@/components/PersonalRecords";
import TrainingCalendar from "@/components/TrainingCalendar";
import Leaderboard from "@/components/Leaderboard";

interface WorkoutStatsProps {
  userId: string;
}

interface CompletionRecord {
  week: number;
  day: string;
  done: boolean;
  skipped: boolean;
  updated_at: string;
  logged_distance_km: number | null;
  logged_tempo: string | null;
}

type View = "week" | "month" | "year";

const motivationalQuotes = [
  "Framgång kommer till den som aldrig ger upp 💪",
  "En dag i taget – du blir starkare varje pass 🔥",
  "Det enda dåliga passet är det som inte blev av 🏋️",
  "Du tävlar bara mot dig själv – och du vinner 🥇",
  "Disciplin slår motivation varje dag 💯",
  "Svett idag, stolthet imorgon 🌟",
  "Små steg varje dag leder till stora resultat 📈",
  "Din kropp klarar mer än du tror 🚀",
  "Ge inte upp – du är närmare än du tror ⭐",
  "Varje rep räknas – fortsätt kämpa 🏆",
  "Styrka byggs inte på komfort utan på motstånd 💎",
  "Du skapar den bästa versionen av dig själv 🌱",
  "Det handlar inte om perfektion – det handlar om framsteg ✨",
  "Idag är en bra dag att bli bättre 🎯",
  "Konsistens är nyckeln till allt 🔑",
  "Res dig upp, visa upp, ge allt 🙌",
  "Smärtan du känner idag är styrkan du får imorgon 🦾",
  "Tro på processen – resultaten kommer 🌊",
  "Du ångrar aldrig ett genomfört pass 😤",
  "Champions tränar även när de inte känner för det 👑",
  "En timme träning är 4% av din dag – inga ursäkter 🕐",
  "Ditt framtida jag kommer tacka dig 🙏",
  "Starkare än igår, svagare än imorgon 📊",
  "Hårt arbete lönar sig alltid i längden 🏅",
  "Fokusera på framsteg, inte perfektion 🎖️",
  "Du har kommit för långt för att ge upp nu 🛤️",
  "Varje dag är en ny chans att bli bättre 🌅",
  "Gör det svåra tills det svåra blir lätt 💫",
  "Du är starkare än dina ursäkter 🧠",
  "Sista repet är det som räknas mest 🔥",
  "Träna som ett djur, återhämta som en proffs 🐺",
];

const DailyQuoteCard = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const quote = motivationalQuotes[dayOfYear % motivationalQuotes.length];
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center flex flex-col items-center justify-center">
      <Flame className="w-5 h-5 text-primary mx-auto mb-1" />
      <p className="text-[11px] font-medium leading-tight">{quote}</p>
    </div>
  );
};

const WorkoutStats = ({ userId }: WorkoutStatsProps) => {
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const [view, setView] = useState<View>("week");

  const [plansWithExercises, setPlansWithExercises] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      supabase
        .from("workout_completions")
        .select("week, day, done, skipped, updated_at, logged_distance_km, logged_tempo")
        .eq("user_id", userId),
      supabase
        .from("workout_plans")
        .select("week, day, details")
        .eq("user_id", userId),
    ]).then(([{ data: compData }, { data: planData }]) => {
      if (compData) setCompletions(compData as CompletionRecord[]);
      if (planData) {
        setPlansWithExercises(new Set(
          planData
            .filter((p) => p.details && p.details.trim() !== "")
            .map((p) => `${p.week}-${p.day}`)
        ));
      }
    });
  }, [userId]);

  const hasExercise = (c: CompletionRecord) => plansWithExercises.has(`${c.week}-${c.day}`);

  const stats = useMemo(() => {
    const getWeekNumber = (d: Date) => {
      const onejan = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    };

    type Bucket = { label: string; done: number; skipped: number; total: number; distanceKm: number };
    const buckets = new Map<string, Bucket>();

    for (const c of completions) {
      const date = new Date(c.updated_at);
      let key: string;
      let label: string;

      if (view === "week") {
        const wn = getWeekNumber(date);
        const yr = date.getFullYear();
        key = `${yr}-W${wn}`;
        label = `V${wn} ${yr}`;
      } else if (view === "month") {
        const m = date.getMonth();
        const yr = date.getFullYear();
        key = `${yr}-${String(m + 1).padStart(2, "0")}`;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
        label = `${monthNames[m]} ${yr}`;
      } else {
        const yr = date.getFullYear();
        key = `${yr}`;
        label = `${yr}`;
      }

      if (!buckets.has(key)) {
        buckets.set(key, { label, done: 0, skipped: 0, total: 0, distanceKm: 0 });
      }
      const b = buckets.get(key)!;
      b.total++;
      if (c.done) b.done++;
      if (c.skipped) b.skipped++;
      if (c.logged_distance_km && c.done) {
        b.distanceKm += Number(c.logged_distance_km);
      }
    }

    return Array.from(buckets.values()).reverse();
  }, [completions, view]);

  const totalDone = completions.filter((c) => c.done && hasExercise(c)).length;
  const totalSkipped = completions.filter((c) => c.skipped).length;
  const totalDistanceKm = completions
    .filter((c) => c.done && c.logged_distance_km)
    .reduce((sum, c) => sum + Number(c.logged_distance_km), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-black tracking-tight">Sammanfattning</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <CheckCircle className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-black">{totalDone}</p>
          <p className="text-[10px] text-muted-foreground">Genomförda</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-black">{totalSkipped}</p>
          <p className="text-[10px] text-muted-foreground">Missade</p>
        </div>
        <DailyQuoteCard />
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Footprints className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-black">{Math.round(totalDistanceKm * 10) / 10}</p>
          <p className="text-[10px] text-muted-foreground">km sprungit</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {([["week", "Vecka"], ["month", "Månad"], ["year", "År"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats list */}
      {stats.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Ingen data ännu</p>
      ) : (
        <div className="space-y-2">
          {stats.map((b) => {
            const pctDone = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
            const pctSkipped = b.total > 0 ? Math.round((b.skipped / b.total) * 100) : 0;
            return (
              <div key={b.label} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{b.label}</span>
                  <div className="flex items-center gap-2">
                    {b.distanceKm > 0 && (
                      <span className="text-xs text-warning font-mono flex items-center gap-0.5">
                        <Footprints className="w-3 h-3" />
                        {Math.round(b.distanceKm * 10) / 10} km
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {b.done} ✓ · {b.skipped} ✗
                    </span>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden flex">
                  <div
                    className="h-full bg-success transition-all duration-300"
                    style={{ width: `${pctDone}%` }}
                  />
                  <div
                    className="h-full bg-destructive transition-all duration-300"
                    style={{ width: `${pctSkipped}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard */}
      <Leaderboard userId={userId} />

      {/* Weight progression chart */}
      <WeightProgressionChart userId={userId} />

      {/* Personal records */}
      <PersonalRecords userId={userId} />

      {/* Training calendar */}
      <TrainingCalendar userId={userId} />
    </div>
  );
};

export default WorkoutStats;