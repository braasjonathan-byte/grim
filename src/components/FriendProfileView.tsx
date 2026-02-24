import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Star, User, CheckCircle, XCircle, Footprints, Weight, Instagram, Music, ExternalLink, Crown } from "lucide-react";

interface FriendProfileViewProps {
  friendUserId: string;
  nickname: string;
  onClose: () => void;
}

interface StarredPR {
  exercise: string;
  weight: number;
}

type TimePeriod = "year" | "month" | "week";

interface CompletionRow {
  logged_weights: any;
  done: boolean;
  skipped: boolean;
  logged_distance_km: number | null;
  logged_tempo: string | null;
  logged_pulse: number | null;
  week: number;
  day: string;
  updated_at: string;
}

const weightComparisons: { maxTons: number; text: string }[] = [
  { maxTons: 0.5, text: "en grand piano 🎹" },
  { maxTons: 1, text: "en liten häst 🐴" },
  { maxTons: 1.5, text: "en flodhäst 🦛" },
  { maxTons: 2, text: "en Fiat 500 🚗" },
  { maxTons: 3, text: "en noshörning 🦏" },
  { maxTons: 5, text: "en afrikansk elefant 🐘" },
  { maxTons: 8, text: "en T-Rex 🦖" },
  { maxTons: 12, text: "en skolbuss 🚌" },
  { maxTons: 20, text: "en lastbil 🚛" },
  { maxTons: 30, text: "en stridsvagn 🪖" },
  { maxTons: 50, text: "en spermaval 🐋" },
  { maxTons: 80, text: "en blåval 🐳" },
  { maxTons: 120, text: "ett Boeing 737 ✈️" },
  { maxTons: 200, text: "Frihetsgudinnan 🗽" },
  { maxTons: 500, text: "ett lyxkryssningsfartyg ⛴️" },
  { maxTons: 1000, text: "Eiffeltornet 🗼" },
  { maxTons: 5000, text: "ett rymdfärjeprogram 🚀" },
  { maxTons: 50000, text: "Titanic 🚢" },
  { maxTons: Infinity, text: "en asteroid 🌑" },
];

const getWeightComparison = (tons: number): string => {
  if (tons <= 0) return "";
  const match = weightComparisons.find((w) => tons <= w.maxTons);
  return match ? match.text : weightComparisons[weightComparisons.length - 1].text;
};

const calcTotalLiftedKg = (completions: CompletionRow[]): number => {
  let total = 0;
  for (const row of completions) {
    if (!row.done || !row.logged_weights || typeof row.logged_weights !== "object") continue;
    const weights = row.logged_weights as Record<string, any>;
    for (const [key, value] of Object.entries(weights)) {
      if (key.startsWith("__setdata__")) {
        let sets: { kg?: string | number; reps?: string | number }[] = [];
        if (typeof value === "string") {
          try { sets = JSON.parse(value); } catch { continue; }
        } else if (Array.isArray(value)) {
          sets = value;
        }
        for (const s of sets) {
          const kg = Number(s.kg) || 0;
          const reps = Number(s.reps) || 0;
          total += kg * reps;
        }
      }
    }
  }
  return total;
};

const getMonday = (date: Date) => {
  const d2 = new Date(date);
  const day = d2.getDay() || 7;
  d2.setDate(d2.getDate() - day + 1);
  d2.setHours(0, 0, 0, 0);
  return d2;
};

const DAY_OFFSETS: Record<string, number> = { "Mån": 0, "Tis": 1, "Ons": 2, "Tors": 3, "Fre": 4, "Lör": 5, "Sön": 6 };

const getWorkoutCalendarDate = (planWeek: number, dayName: string, planStartDate: Date): Date => {
  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);
  const dayOffset = DAY_OFFSETS[dayName] ?? 0;
  const date = new Date(start);
  date.setDate(date.getDate() + (planWeek - 1) * 7 + dayOffset);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getCurrentPlanWeek = (planStartDate: Date): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(planStartDate);
  start.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.floor(daysSinceStart / 7) + 1;
};

const isStandaloneSession = (c: { week: number; day: string }) => c.week === 0;

const getStandaloneDate = (day: string): Date | null => {
  const match = day.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const d = new Date(match[1] + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
};

const filterByPeriod = (completions: CompletionRow[], period: TimePeriod, planStartDate: Date | null): CompletionRow[] => {
  if (!planStartDate) return completions;
  const now = new Date();
  const currentMonday = getMonday(now);
  const endOfWeek = new Date(currentMonday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  if (period === "week") {
    return completions.filter((c) => {
      if (isStandaloneSession(c)) {
        const d = getStandaloneDate(c.day);
        return d ? d >= currentMonday && d < endOfWeek : false;
      }
      const d = getWorkoutCalendarDate(c.week, c.day, planStartDate);
      return d >= currentMonday && d < endOfWeek;
    });
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  startOfYear.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

  return completions.filter((c) => {
    const d = isStandaloneSession(c) ? getStandaloneDate(c.day) : getWorkoutCalendarDate(c.week, c.day, planStartDate);
    if (!d) return false;
    if (period === "year") return d >= startOfYear && d < endOfYear;
    return d >= startOfMonth && d < endOfMonth;
  });
};

const periodLabels: Record<TimePeriod, string> = { year: "i år", month: "denna månad", week: "Denna Veckan" };

interface SocialData {
  instagram: string | null;
  tiktok: string | null;
  snapchat: string | null;
  spotify_anthem_url: string | null;
  spotify_anthem_name: string | null;
}

const FriendProfileView = ({ friendUserId, nickname, onClose }: FriendProfileViewProps) => {
  const [loading, setLoading] = useState(true);
  const [starredPRs, setStarredPRs] = useState<StarredPR[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showFullAvatar, setShowFullAvatar] = useState(false);
  const [allCompletions, setAllCompletions] = useState<CompletionRow[]>([]);
  const [plansWithExercises, setPlansWithExercises] = useState<Set<string>>(new Set());
  const [planDetailsMap, setPlanDetailsMap] = useState<Map<string, string>>(new Map());
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [planStartDate, setPlanStartDate] = useState<Date | null>(null);
  const [social, setSocial] = useState<SocialData>({ instagram: null, tiktok: null, snapchat: null, spotify_anthem_url: null, spotify_anthem_name: null });
  const [isHonorary, setIsHonorary] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: starsData }, { data: completions }, { data: profileData }, { data: plansData }] = await Promise.all([
        supabase.from("pr_stars").select("exercise").eq("user_id", friendUserId),
        supabase.from("workout_completions").select("logged_weights, done, skipped, logged_distance_km, logged_tempo, logged_pulse, week, day, updated_at").eq("user_id", friendUserId),
        supabase.from("profiles").select("avatar_url, instagram, tiktok, snapchat, spotify_anthem_url, spotify_anthem_name, is_honorary").eq("user_id", friendUserId).single(),
        supabase.from("workout_plans").select("week, day, details, created_at").eq("user_id", friendUserId),
      ]);

      setAvatarUrl(profileData?.avatar_url || null);
      setIsHonorary(profileData?.is_honorary ?? false);
      const pd = profileData as any;
      setSocial({
        instagram: pd?.instagram || null,
        tiktok: pd?.tiktok || null,
        snapchat: pd?.snapchat || null,
        spotify_anthem_url: pd?.spotify_anthem_url || null,
        spotify_anthem_name: pd?.spotify_anthem_name || null,
      });

      // Determine plan start date from earliest created_at
      if (plansData && plansData.length > 0) {
        const earliest = plansData.reduce((min, p) => {
          const d = new Date((p as any).created_at);
          return d < min ? d : min;
        }, new Date((plansData[0] as any).created_at));
        setPlanStartDate(getMonday(earliest));
      }

      const withExercises = (plansData || []).filter((p) => p.details && p.details.trim() !== "");
      const exerciseSet = new Set(withExercises.map((p) => `${p.week}-${p.day}`));
      setPlansWithExercises(exerciseSet);
      const detailsMap = new Map<string, string>();
      for (const p of withExercises) {
        detailsMap.set(`${p.week}-${p.day}`, p.details);
      }
      setPlanDetailsMap(detailsMap);
      setAllCompletions((completions || []) as CompletionRow[]);

      const starredExercises = new Set(starsData?.map((s) => s.exercise) || []);

      const prMap = new Map<string, number>();
      if (completions) {
        for (const row of completions as any[]) {
          const weights = row.logged_weights;
          if (weights && typeof weights === "object") {
            for (const [exercise, weight] of Object.entries(weights)) {
              if (exercise.startsWith("__")) continue;
              const w = typeof weight === "number" ? weight : 0;
              if (w > 0 && starredExercises.has(exercise)) {
                const existing = prMap.get(exercise) || 0;
                if (w > existing) prMap.set(exercise, w);
              }
            }
          }
        }
      }

      const prs: StarredPR[] = [];
      for (const [exercise, weight] of prMap) {
        prs.push({ exercise, weight });
      }
      prs.sort((a, b) => b.weight - a.weight);

      setStarredPRs(prs);
      setLoading(false);
    };
    load();
  }, [friendUserId]);

  const filtered = useMemo(() => filterByPeriod(allCompletions, period, planStartDate), [allCompletions, period, planStartDate]);

  const hasLoggedData = (c: CompletionRow) => {
    if (c.logged_distance_km || c.logged_tempo || c.logged_pulse) return true;
    const weights = (c as any).logged_weights as Record<string, any> | null;
    if (weights && typeof weights === "object") {
      return Object.keys(weights).some(k => k.startsWith("__sets__") || k.startsWith("__setdata__") || k.startsWith("__cond__"));
    }
    return false;
  };

  const stats = useMemo(() => {
    const done = filtered.filter((c) => c.done && (hasLoggedData(c) || plansWithExercises.has(`${c.week}-${c.day}`))).length;
    const skipped = filtered.filter((c) => c.skipped).length;
    let distanceKm = 0;
    for (const c of filtered) {
      if (!c.done) continue;
      if (c.logged_distance_km) {
        distanceKm += Number(c.logged_distance_km);
      }
      const weights = (c as any).logged_weights as Record<string, any> | null;
      if (weights && typeof weights === "object") {
        for (const [key, value] of Object.entries(weights)) {
          if (key.startsWith("__cond__")) {
            try {
              const data = typeof value === "string" ? JSON.parse(value) : value;
              if (data?.dist && !c.logged_distance_km) {
                distanceKm += parseFloat(String(data.dist).replace(",", ".")) || 0;
              }
            } catch {}
          }
        }
      }
    }
    const liftedKg = calcTotalLiftedKg(filtered);
    const liftedTons = Math.round((liftedKg / 1000) * 10) / 10;
    return { done, skipped, distanceKm: Math.round(distanceKm * 10) / 10, liftedTons };
  }, [filtered, plansWithExercises]);

  const cyclePeriod = () => {
    const order: TimePeriod[] = ["year", "month", "week"];
    setPeriod(order[(order.indexOf(period) + 1) % order.length]);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const periodLabel = periodLabels[period];

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 z-[70] max-w-sm mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
         <div className="flex items-center justify-between p-4 border-b border-border">
           <div className="flex items-center gap-3">
             <button
               onClick={() => avatarUrl && setShowFullAvatar(true)}
               className={`w-10 h-10 rounded-full bg-secondary border-2 border-border overflow-hidden flex items-center justify-center shrink-0 ${avatarUrl ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
             >
               {avatarUrl ? (
                 <img src={avatarUrl} alt={nickname} className="w-full h-full object-cover" />
               ) : (
                 <User className="w-5 h-5 text-muted-foreground" />
               )}
             </button>
              <div>
                <h3 className="text-sm font-bold">{nickname}</h3>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${isHonorary ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>
                  {isHonorary ? <Crown className="w-3 h-3" /> : null}
                  {isHonorary ? "Hedersmedlem" : "Medlem"}
                </span>
              </div>
            </div>
           <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
             <X className="w-4 h-4" />
           </button>
         </div>

         <div className="p-4 space-y-4">
           <div className="grid grid-cols-2 gap-2">
             <button onClick={cyclePeriod} className="bg-secondary rounded-xl p-3 text-center active:scale-95 transition-transform">
               <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
               <p className="text-lg font-bold">{stats.done}</p>
               <p className="text-[10px] text-muted-foreground">Genomförda ({periodLabel})</p>
             </button>
             <button onClick={cyclePeriod} className="bg-secondary rounded-xl p-3 text-center active:scale-95 transition-transform">
               <XCircle className="w-4 h-4 text-destructive mx-auto mb-1" />
               <p className="text-lg font-bold">{stats.skipped}</p>
               <p className="text-[10px] text-muted-foreground">Missade ({periodLabel})</p>
             </button>
             <button onClick={cyclePeriod} className="bg-secondary rounded-xl p-3 text-center active:scale-95 transition-transform">
                <Weight className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.liftedTons} <span className="text-xs font-normal text-muted-foreground">ton</span></p>
                <p className="text-[10px] text-muted-foreground">Lyft ({periodLabel})</p>
                {stats.liftedTons > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">≈ {getWeightComparison(stats.liftedTons)}</p>
                )}
              </button>
             <button onClick={cyclePeriod} className="bg-secondary rounded-xl p-3 text-center active:scale-95 transition-transform">
               <Footprints className="w-4 h-4 text-warning mx-auto mb-1" />
               <p className="text-lg font-bold">{stats.distanceKm}</p>
               <p className="text-[10px] text-muted-foreground">km sprungit ({periodLabel})</p>
             </button>
           </div>

          {starredPRs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                <span className="text-xs font-semibold text-muted-foreground">Stjärnmärkta PB</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {starredPRs.map((pr) => (
                  <div key={pr.exercise} className="bg-secondary rounded-lg p-2.5 text-center">
                    <p className="text-lg font-black">{pr.weight} <span className="text-xs font-normal text-muted-foreground">kg</span></p>
                    <p className="text-[10px] text-muted-foreground truncate">{pr.exercise}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {starredPRs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Inga stjärnmärkta PB ännu</p>
          )}

          {/* Social links & anthem */}
          {(social.instagram || social.tiktok || social.snapchat || social.spotify_anthem_name) && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                {social.instagram && (
                  <a
                    href={social.instagram.startsWith("http") ? social.instagram : `https://www.instagram.com/${social.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-secondary rounded-lg px-2.5 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
                  >
                    <Instagram className="w-3.5 h-3.5 text-pink-500" />
                    <span>{social.instagram}</span>
                  </a>
                )}
                {social.tiktok && (
                  <a
                    href={social.tiktok.startsWith("http") ? social.tiktok : `https://www.tiktok.com/@${social.tiktok.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-secondary rounded-lg px-2.5 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.84a8.27 8.27 0 0 0 4.76 1.5V6.84a4.84 4.84 0 0 1-1-.15z"/></svg>
                    <span>{social.tiktok}</span>
                  </a>
                )}
                {social.snapchat && (
                  <a
                    href={social.snapchat.startsWith("http") ? social.snapchat : `https://www.snapchat.com/add/${social.snapchat.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-secondary rounded-lg px-2.5 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12.2 2c-2.6 0-4.5 1.3-5.3 3.6-.3.8-.3 1.7-.3 3v.7c-.5 0-1.2-.2-1.7.1-.4.2-.7.7-.5 1.2.2.5.6.7 1 .8.3.1.7.1 1 .2-.2.7-.7 1.4-1.2 2-.7.8-1.6 1.3-2.5 1.6-.4.1-.8.5-.7 1 .1.5.4.8.9 1 1.2.4 2.3.5 3 1.1.3.2.4.5.7.8.3.4.9.7 1.5.6.5 0 1-.2 1.6-.3.8-.2 1.7-.3 2.6.1.9.4 1.7 1.1 2.9 1.1 1.1 0 1.9-.7 2.8-1.1.9-.4 1.8-.3 2.6-.1.6.1 1.1.3 1.6.3.6 0 1.2-.2 1.5-.6.3-.3.4-.6.7-.8.7-.6 1.9-.7 3-1.1.5-.2.8-.5.9-1 .1-.5-.3-.9-.7-1-1-.3-1.8-.8-2.5-1.6-.5-.6-1-1.3-1.2-2 .4-.1.7-.1 1-.2.4-.1.8-.3 1-.8.2-.5-.1-1-.5-1.2-.5-.3-1.2-.1-1.7-.1v-.7c0-1.3 0-2.2-.3-3C16.7 3.3 14.8 2 12.2 2z"/></svg>
                    <span>{social.snapchat}</span>
                  </a>
                )}
              </div>

              {social.spotify_anthem_name && (
                <div className="bg-secondary rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-muted-foreground">Anthem</p>
                      {social.spotify_anthem_url ? (
                        <a
                          href={social.spotify_anthem_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold truncate block hover:underline flex items-center gap-1"
                        >
                          {social.spotify_anthem_name}
                          <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                        </a>
                      ) : (
                        <p className="text-xs font-semibold truncate">{social.spotify_anthem_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen avatar overlay */}
      {showFullAvatar && avatarUrl && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setShowFullAvatar(false)}
        >
          <button
            onClick={() => setShowFullAvatar(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={avatarUrl}
            alt={nickname}
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default FriendProfileView;
