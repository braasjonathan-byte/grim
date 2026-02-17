import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Dumbbell, X } from "lucide-react";
import Avatar3D, { type AvatarConfig, type EquippedItems } from "./Avatar3D";

interface FriendProfileViewProps {
  friendUserId: string;
  nickname: string;
  onClose: () => void;
}

const DEFAULT_CONFIG: AvatarConfig = {
  body_height: "medium",
  body_fat: "medium",
  muscle_mass: "medium",
  skin_color: "#C68642",
  hair_style: "short",
  hair_color: "#3B2F2F",
};

const FriendProfileView = ({ friendUserId, nickname, onClose }: FriendProfileViewProps) => {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_CONFIG);
  const [equipped, setEquipped] = useState<EquippedItems>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalWorkouts: 0, bestPR: "", prWeight: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ data: cfg }, { data: eqItems }, { data: completions }, { data: prData }] = await Promise.all([
        supabase.from("avatar_config").select("*").eq("user_id", friendUserId).maybeSingle(),
        supabase.from("avatar_equipped_items").select("slot, item_id, avatar_shop_items(*)").eq("user_id", friendUserId),
        supabase.from("workout_completions").select("id").eq("user_id", friendUserId).eq("done", true),
        supabase.from("workout_completions").select("logged_weights").eq("user_id", friendUserId).eq("done", true).not("logged_weights", "is", null),
      ]);

      if (cfg) {
        setConfig({
          body_height: cfg.body_height,
          body_fat: cfg.body_fat,
          muscle_mass: cfg.muscle_mass,
          skin_color: cfg.skin_color,
          hair_style: cfg.hair_style,
          hair_color: cfg.hair_color,
        });
      }

      if (eqItems) {
        const eq: EquippedItems = {};
        (eqItems as any[]).forEach((e) => {
          const item = e.avatar_shop_items;
          if (item) (eq as any)[e.slot] = { style_data: item.style_data };
        });
        setEquipped(eq);
      }

      // Stats
      const totalWorkouts = completions?.length || 0;

      // Find best PR
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
          {/* Avatar */}
          <div className="flex justify-center bg-secondary/50 rounded-xl">
            <Avatar3D config={config} equipped={equipped} size={200} />
          </div>

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
