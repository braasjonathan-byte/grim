import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Dumbbell, X } from "lucide-react";

interface FriendProfileViewProps {
  friendUserId: string;
  nickname: string;
  onClose: () => void;
}

const FriendProfileView = ({ friendUserId, nickname, onClose }: FriendProfileViewProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalWorkouts: 0, bestPR: "", prWeight: 0 });

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const [{ data: leaderboard }, { data: prData }] = await Promise.all([
        supabase.rpc("get_leaderboard", { filter_year: now.getFullYear() }),
        supabase.from("workout_completions").select("logged_weights").eq("user_id", friendUserId).eq("done", true).not("logged_weights", "is", null),
      ]);

      const friendEntry = leaderboard?.find((e: any) => e.user_id === friendUserId);
      const totalWorkouts = friendEntry?.done_count || 0;

      let bestExercise = "";
      let bestWeight = 0;
      if (prData) {
        (prData as any[]).forEach((row) => {
          const weights = row.logged_weights;
          if (weights && typeof weights === "object") {
            Object.entries(weights).forEach(([exercise, weight]) => {
              const w = typeof weight === "number" ? weight : 0;
              if (w > bestWeight) {
                bestWeight = w;
                bestExercise = exercise;
              }
            });
          }
        });
      }

      setStats({ totalWorkouts, bestPR: bestExercise, prWeight: bestWeight });
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
          <h3 className="text-sm font-bold">{nickname}</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-xl p-3 text-center">
              <Dumbbell className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-lg font-bold">{stats.totalWorkouts}</p>
              <p className="text-[10px] text-muted-foreground">Träningspass</p>
            </div>
            <div className="bg-secondary rounded-xl p-3 text-center">
              <Trophy className="w-4 h-4 text-primary mx-auto mb-1" />
              {stats.bestPR ? (
                <>
                  <p className="text-lg font-bold">{stats.prWeight} kg</p>
                  <p className="text-[10px] text-muted-foreground truncate">{stats.bestPR}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold">—</p>
                  <p className="text-[10px] text-muted-foreground">Bästa PB</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FriendProfileView;
