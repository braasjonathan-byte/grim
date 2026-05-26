import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ACTIVITY_LABEL, ActivityLevel, GOAL_LABEL, GoalType, calcBMR, calcTDEE, distributeMacros } from "@/lib/nutritionCalc";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onSaved: () => void;
}

export default function NutritionGoalsDialog({ open, onOpenChange, userId, onSaved }: Props) {
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [kcal, setKcal] = useState("2000");
  const [protein, setProtein] = useState("100");
  const [fat, setFat] = useState("70");
  const [carbs, setCarbs] = useState("250");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("age,weight_kg,height_cm,gender").eq("user_id", userId).maybeSingle();
      if (prof) {
        if (prof.age) setAge(String(prof.age));
        if (prof.weight_kg) setWeight(String(prof.weight_kg));
        if ((prof as any).height_cm) setHeight(String((prof as any).height_cm));
        if (prof.gender === "female" || prof.gender === "male") setGender(prof.gender);
      }
      const { data: g } = await supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle();
      if (g) {
        setKcal(String(g.daily_kcal)); setProtein(String(g.protein_g));
        setFat(String(g.fat_g)); setCarbs(String(g.carbs_g));
        setActivity(g.activity_level as ActivityLevel); setGoal(g.goal_type as GoalType);
      }
    })();
  }, [open, userId]);

  function computeMacros(silent = false) {
    const a = parseInt(age) || 0, w = parseFloat(weight) || 0, h = parseFloat(height) || 0;
    if (!a || !w || !h) {
      if (!silent) toast({ title: "Fyll i ålder, vikt och längd", variant: "destructive" });
      return;
    }
    const bmr = calcBMR(w, h, a, gender);
    const tdee = calcTDEE(bmr, activity);
    const m = distributeMacros(tdee, w, goal);
    setKcal(String(m.kcal)); setProtein(String(m.protein_g));
    setFat(String(m.fat_g)); setCarbs(String(m.carbs_g));
  }

  // Auto-räkna makros när mål, aktivitet, kön eller kroppsdata ändras
  useEffect(() => {
    if (!open) return;
    if (goal === "custom") return;
    computeMacros(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, activity, gender, age, weight, height]);

  async function save() {
    setSaving(true);
    const a = parseInt(age) || null, w = parseFloat(weight) || null, h = parseFloat(height) || null;
    if (a || w || h) {
      await supabase.from("profiles").update({ age: a, weight_kg: w, height_cm: h, gender } as any).eq("user_id", userId);
    }
    const { error } = await supabase.from("nutrition_goals").upsert({
      user_id: userId,
      daily_kcal: parseInt(kcal) || 2000,
      protein_g: parseInt(protein) || 100,
      fat_g: parseInt(fat) || 70,
      carbs_g: parseInt(carbs) || 250,
      activity_level: activity,
      goal_type: goal,
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mål sparade" });
    onSaved(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif">Mina kostmål</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs font-medium">Ålder</label><Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none" /></div>
            <div><label className="text-xs font-medium">Vikt (kg)</label><Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" pattern="[0-9.,]*" className="rounded-none" /></div>
            <div><label className="text-xs font-medium">Längd (cm)</label><Input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none" /></div>
          </div>
          <div>
            <label className="text-xs font-medium">Kön</label>
            <div className="flex gap-1">
              <button onClick={() => setGender("male")} className={`flex-1 py-2 text-xs font-medium border ${gender === "male" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>Man</button>
              <button onClick={() => setGender("female")} className={`flex-1 py-2 text-xs font-medium border ${gender === "female" ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>Kvinna</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Aktivitetsnivå</label>
            <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className="w-full border border-input bg-background px-2 py-2 text-sm">
              {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((k) => <option key={k} value={k}>{ACTIVITY_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Mål</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value as GoalType)} className="w-full border border-input bg-background px-2 py-2 text-sm">
              {(Object.keys(GOAL_LABEL) as GoalType[]).map((k) => <option key={k} value={k}>{GOAL_LABEL[k]}</option>)}
            </select>
          </div>
          <button onClick={recalc} className="w-full py-2 border border-primary text-primary text-sm font-bold">Räkna ut mina makros</button>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[10px] font-medium">Kcal</label><Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none text-sm" /></div>
            <div><label className="text-[10px] font-medium">Protein g</label><Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none text-sm" /></div>
            <div><label className="text-[10px] font-medium">Fett g</label><Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none text-sm" /></div>
            <div><label className="text-[10px] font-medium">Kh g</label><Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="numeric" pattern="[0-9]*" className="rounded-none text-sm" /></div>
          </div>
          <button disabled={saving} onClick={save} className="w-full py-3 bg-primary text-primary-foreground font-bold disabled:opacity-50">{saving ? "Sparar…" : "Spara"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
