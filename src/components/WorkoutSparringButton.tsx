import { useState } from "react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { notifyWorkoutsChanged } from "@/lib/workoutHistory";
import { toast } from "sonner";

export default function WorkoutSparringButton({ postId, friendId, week, day }: { postId?: string; friendId?: string; week?: number; day?: string }) {
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let id = postId;
      if (!id && friendId && week !== undefined && day) {
        const { data, error } = await supabase.from("social_posts").select("id").eq("user_id", friendId).eq("workout_week", week).eq("workout_day", day).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        id = data?.id;
      }
      if (!id) { toast.error("Kompisen behöver först dela passet i Social."); return; }
      const { data, error } = await supabase.rpc("create_workout_sparring", { _post_id: id });
      if (error || !data) throw error ?? new Error("Missing saved workout");
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) sessionStorage.setItem(`grim_sparring_open_${auth.user.id}`, JSON.stringify({ id: data }));
      notifyWorkoutsChanged();
      window.dispatchEvent(new CustomEvent("grim:set-tab", { detail: "workout" }));
      toast.success("Ditt pass är skapat med kompisens facit. Ingen notis har skickats.");
    } catch { toast.error("Passet kunde inte skapas. Kontrollera anslutningen och att vänpasset fortfarande är delat."); }
    finally { setBusy(false); }
  };
  return <Button variant="outline" size="sm" disabled={busy} onClick={start} className="min-h-11"><Swords className="h-4 w-4" />{busy ? "Skapar…" : "Utmana passet"}</Button>;
}