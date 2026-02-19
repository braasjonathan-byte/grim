import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Dumbbell, X, Star, User, CheckCircle, XCircle, Footprints } from "lucide-react";

interface FriendProfileViewProps {
  friendUserId: string;
  nickname: string;
  onClose: () => void;
}

interface StarredPR {
  exercise: string;
  weight: number;
}

interface FriendStats {
  totalDone: number;
  totalSkipped: number;
  totalDistanceKm: number;
}

const FriendProfileView = ({ friendUserId, nickname, onClose }: FriendProfileViewProps) => {
  const [loading, setLoading] = useState(true);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [starredPRs, setStarredPRs] = useState<StarredPR[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showFullAvatar, setShowFullAvatar] = useState(false);
  const [friendStats, setFriendStats] = useState<FriendStats>({ totalDone: 0, totalSkipped: 0, totalDistanceKm: 0 });

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const [{ data: leaderboard }, { data: starsData }, { data: completions }, { data: profileData }, { data: plansData }] = await Promise.all([
        supabase.rpc("get_leaderboard", { filter_year: now.getFullYear() }),
        supabase.from("pr_stars").select("exercise").eq("user_id", friendUserId),
        supabase.from("workout_completions").select("logged_weights, done, skipped, logged_distance_km, week, day").eq("user_id", friendUserId),
        supabase.from("profiles").select("avatar_url").eq("user_id", friendUserId).single(),
        supabase.from("workout_plans").select("week, day, details").eq("user_id", friendUserId),
      ]);

      const friendEntry = leaderboard?.find((e: any) => e.user_id === friendUserId);
      setAvatarUrl(profileData?.avatar_url || null);
      setTotalWorkouts(friendEntry?.done_count || 0);

      // Build set of plan slots with exercises
      const plansWithExercises = new Set(
        (plansData || []).filter((p) => p.details && p.details.trim() !== "").map((p) => `${p.week}-${p.day}`)
      );

      // Calculate stats
      const doneWithExercise = (completions || []).filter((c: any) => c.done && plansWithExercises.has(`${c.week}-${c.day}`)).length;
      const skipped = (completions || []).filter((c: any) => c.skipped).length;
      const distanceKm = (completions || [])
        .filter((c: any) => c.done && c.logged_distance_km)
        .reduce((sum: number, c: any) => sum + Number(c.logged_distance_km), 0);
      setFriendStats({ totalDone: doneWithExercise, totalSkipped: skipped, totalDistanceKm: Math.round(distanceKm * 10) / 10 });

      const starredExercises = new Set(starsData?.map((s) => s.exercise) || []);

      // Build PR map from completions
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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

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
             <h3 className="text-sm font-bold">{nickname}</h3>
           </div>
           <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
             <X className="w-4 h-4" />
           </button>
         </div>

         <div className="p-4 space-y-4">
           <div className="grid grid-cols-2 gap-2">
             <div className="bg-secondary rounded-xl p-3 text-center">
               <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
               <p className="text-lg font-bold">{friendStats.totalDone}</p>
                <p className="text-[10px] text-muted-foreground">Genomförda (totalt)</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <XCircle className="w-4 h-4 text-destructive mx-auto mb-1" />
                <p className="text-lg font-bold">{friendStats.totalSkipped}</p>
                <p className="text-[10px] text-muted-foreground">Missade (totalt)</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Dumbbell className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-lg font-bold">{totalWorkouts}</p>
                <p className="text-[10px] text-muted-foreground">Pass i år ({new Date().getFullYear()})</p>
              </div>
              <div className="bg-secondary rounded-xl p-3 text-center">
                <Footprints className="w-4 h-4 text-warning mx-auto mb-1" />
                <p className="text-lg font-bold">{friendStats.totalDistanceKm}</p>
                <p className="text-[10px] text-muted-foreground">km sprungit (totalt)</p>
             </div>
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
