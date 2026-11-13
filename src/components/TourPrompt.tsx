import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Apple, Dumbbell, Layers, X } from "lucide-react";
import { useDialogTurn } from "@/lib/dialogQueue";
import { getModules, setModules } from "@/lib/modules";
import { firstTask, saveFirstFocus, type FirstFocus } from "@/lib/firstStart";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TourPromptProps { userId: string; onNavigate: (tab: "workout" | "nutrition") => void }
const choices = [
  { key: "training" as const, label: "Träning", icon: Dumbbell },
  { key: "nutrition" as const, label: "Kost", icon: Apple },
  { key: "both" as const, label: "Båda", icon: Layers },
];

export default function TourPrompt({ userId, onNavigate }: TourPromptProps) {
  const [wanted, setWanted] = useState(false);
  const myTurn = useDialogTurn("tour", wanted);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<FirstFocus | null>(null);
  const [stage, setStage] = useState<"focus" | "task">("focus");
  useEffect(() => {
    let cancelled = false;
    supabase.from("profiles").select("tour_prompted").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (!cancelled && !error && data && !data.tour_prompted) setWanted(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const finish = async (task?: "workout" | "nutrition") => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ tour_prompted: true }).eq("user_id", userId).select("user_id").single();
      if (error) throw error;
      if (focus) {
        saveFirstFocus(userId, focus);
        // A nutrition first task must remain reachable even on a previously customized device.
        if (focus !== "training") setModules({ ...getModules(), nutrition: true });
      }
      localStorage.setItem("grim_workout_tutorial_seen_v1", "1");
      window.dispatchEvent(new CustomEvent("grim:tour-prompted"));
      setWanted(false);
      if (task) {
        if (task === "nutrition") sessionStorage.setItem("grim_nutrition_action", "food");
        onNavigate(task);
      }
    } catch {
      toast.error("Ditt val kunde inte sparas. Försök igen.");
    } finally { setBusy(false); }
  };
  if (!wanted || !myTurn) return null;
  return <div className="fixed inset-0 z-[160] bg-background/80 backdrop-blur-sm flex items-end justify-center px-4 pb-24 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="first-start-title">
    <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 relative max-h-[75dvh] overflow-y-auto">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2" aria-label="Stäng välkomstfrågan" disabled={busy} onClick={() => void finish()}><X className="h-4 w-4" /></Button>
      <h3 id="first-start-title" className="text-lg font-semibold pr-8 mb-2">{stage === "focus" ? "Välkommen till Grim" : "Din första registrering"}</h3>
      {stage === "focus" ? <>
        <p className="text-sm text-muted-foreground mb-4">Vad vill du börja med?</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Börja med">
          {choices.map(choice => <Button key={choice.key} role="radio" aria-checked={focus === choice.key} variant={focus === choice.key ? "default" : "outline"} disabled={busy} className="h-20 flex-col gap-2" onClick={() => setFocus(choice.key)}><choice.icon className="h-5 w-5" />{choice.label}</Button>)}
        </div>
        <Button className="w-full mt-4" disabled={!focus || busy} onClick={() => setStage("task")}>Fortsätt</Button>
      </> : <>
        <div className="space-y-2 mt-4">
          {focus !== "nutrition" && <Button className="w-full min-h-12" disabled={busy} onClick={() => void finish(firstTask(focus ?? "training"))}><Dumbbell className="h-4 w-4" />Registrera ett pass</Button>}
          {focus !== "training" && <Button className="w-full min-h-12" variant={focus === "both" ? "secondary" : "default"} disabled={busy} onClick={() => void finish("nutrition")}><Apple className="h-4 w-4" />Registrera en måltid</Button>}
        </div>
        <Button variant="ghost" className="w-full mt-2" disabled={busy} onClick={() => setStage("focus")}>Tillbaka</Button>
      </>}
      <Button variant="ghost" className="w-full mt-1" disabled={busy} onClick={() => void finish()}>{busy ? "Sparar…" : "Inte nu"}</Button>
    </div>
  </div>;
}
