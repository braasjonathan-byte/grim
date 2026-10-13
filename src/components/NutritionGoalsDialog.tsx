import { toLocalDateKey } from "@/lib/dateUtils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ACTIVITY_LABEL, ActivityLevel, GOAL_LABEL, GoalType, calcBMR, calcTDEE, distributeMacros, kcalForWeeklyChange, macrosForWeeklyLoss } from "@/lib/nutritionCalc";
import { MICROS, type MicroKey } from "@/lib/micronutrients";
import { useToast } from "@/hooks/use-toast";
import { validateNumber, parseDecimal, macroKcal, kcalDeviation, formatDecimal } from "@/lib/inputValidation";
import ConfirmValueDialog, { FieldError } from "@/components/ConfirmValueDialog";

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
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [goal, setGoal] = useState<GoalType>("maintain");
  const [kcal, setKcal] = useState("2000");
  const [protein, setProtein] = useState("100");
  const [fat, setFat] = useState("70");
  const [carbs, setCarbs] = useState("250");
  const [fiber, setFiber] = useState("");
  const [water, setWater] = useState("2000");
  const [targetWeight, setTargetWeight] = useState("");
  const [weeklyLoss, setWeeklyLoss] = useState("");
  const [initialWeight, setInitialWeight] = useState<number | null>(null);
  const [micro, setMicro] = useState<Partial<Record<MicroKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [savedSnap, setSavedSnap] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const { toast } = useToast();

  const snapshot = () => JSON.stringify([age, weight, height, gender, activity, goal, kcal, protein, fat, carbs, fiber, water, targetWeight, weeklyLoss, micro]);
  const dirty = loaded && savedSnap !== null && snapshot() !== savedSnap;

  const errs = {
    age: validateNumber(age, "ageYears").error,
    weight: validateNumber(weight, "bodyWeightKg").error,
    height: validateNumber(height, "heightCm").error,
    kcal: validateNumber(kcal, "goalKcal").error,
    protein: validateNumber(protein, "goalProtein").error,
    fat: validateNumber(fat, "goalFat").error,
    carbs: validateNumber(carbs, "goalCarbs").error,
    fiber: validateNumber(fiber, "goalFiber").error,
    water: validateNumber(water, { min: 0, max: 10000, unit: "ml" }).error,
    targetWeight: validateNumber(targetWeight, "bodyWeightKg").error,
    weeklyLoss: validateNumber(weeklyLoss, { min: 0, max: 1.5, unit: "kg/vecka", optional: true }).error,
  };
  const microErrs = Object.fromEntries(
    MICROS.map((m) => [m.key, validateNumber(micro[m.key] ?? "", { min: 0, max: 100000, unit: m.unit, optional: true }).error]),
  ) as Record<MicroKey, string | null>;
  const hasErrors = Object.values(errs).some(Boolean) || Object.values(microErrs).some(Boolean);

  useEffect(() => {
    if (!open) { setLoaded(false); setSavedSnap(null); return; }
    (async () => {
      const { data: lastW } = await supabase.from("body_weight_logs").select("weight_kg").eq("user_id", userId).order("log_date", { ascending: false }).limit(1).maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("age,weight_kg,height_cm,gender").eq("user_id", userId).maybeSingle();
      if (prof) {
        if (prof.age) setAge(String(prof.age));
        const cw = lastW?.weight_kg ?? prof.weight_kg;
        if (cw) setWeight(formatDecimal(cw));
        setInitialWeight(cw != null ? Number(cw) : null);
        if ((prof as any).height_cm) setHeight(formatDecimal((prof as any).height_cm));
        if (prof.gender === "female" || prof.gender === "male") setGender(prof.gender);
      }
      const { data: g } = await supabase.from("nutrition_goals").select("*").eq("user_id", userId).maybeSingle();
      if (g) {
        setKcal(String(g.daily_kcal)); setProtein(String(g.protein_g));
        setFat(String(g.fat_g)); setCarbs(String(g.carbs_g));
        setFiber(g.fiber_g != null ? String(g.fiber_g) : ""); setWater(String(g.water_goal_ml ?? 2000));
        setTargetWeight(g.target_weight_kg != null ? formatDecimal(g.target_weight_kg) : "");
        setWeeklyLoss((g as any).weekly_loss_kg != null ? formatDecimal((g as any).weekly_loss_kg) : "");
        const mv: Partial<Record<MicroKey, string>> = {};
        for (const m of MICROS) { const v = (g as any)[m.key]; if (v != null) mv[m.key] = formatDecimal(v); }
        setMicro(mv);
        setActivity(g.activity_level as ActivityLevel); setGoal(g.goal_type as GoalType);
      }
      setLoaded(true);
    })();
  }, [open, userId]);

  // Kom ihåg läget som det såg ut när datan laddats, så vi kan varna för osparade ändringar
  useEffect(() => {
    if (loaded && savedSnap === null) setSavedSnap(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, savedSnap]);

  function computeMacros(silent = false) {
    const a = validateNumber(age, "ageYears"), w = validateNumber(weight, "bodyWeightKg"), h = validateNumber(height, "heightCm");
    if (!a.value || !w.value || !h.value) {
      if (!silent) toast({ title: "Fyll i ålder, vikt och längd", variant: "destructive" });
      return;
    }
    // Okänt kön: medelvärdet av Mifflin-St Jeor för man (+5) och kvinna (−161).
    const bmr = gender ? calcBMR(w.value, h.value, a.value, gender) : calcBMR(w.value, h.value, a.value, "male") - 83;
    const tdee = calcTDEE(bmr, activity);
    const wl = validateNumber(weeklyLoss, { min: 0, max: 1.5, unit: "kg/vecka", optional: true }).value;
    const m = wl && wl > 0 ? macrosForWeeklyLoss(tdee, w.value, wl) : distributeMacros(tdee, w.value, goal);
    setKcal(String(m.kcal)); setProtein(String(m.protein_g));
    setFat(String(m.fat_g)); setCarbs(String(m.carbs_g));
  }

  // Auto-räkna makros när mål, aktivitet, kön, kroppsdata eller veckomål ändras
  useEffect(() => {
    if (!open || !loaded) return;
    if (goal === "custom" && !parseDecimal(weeklyLoss)) return;
    computeMacros(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, goal, activity, gender, age, weight, height, weeklyLoss]);

  function requestSave() {
    if (hasErrors || !loaded) return;
    const k = parseDecimal(kcal), p = parseDecimal(protein), f = parseDecimal(fat), c = parseDecimal(carbs);
    if (kcalDeviation(k, p, c, f) > 0.1) {
      setConfirmMsg(`Makrona motsvarar ${Math.round(macroKcal(p, c, f))} kcal men målet är ${formatDecimal(k)} kcal.`);
      return;
    }
    void save();
  }

  async function save() {
    if (hasErrors || !loaded || saving) return;
    setSaving(true);
    const a = validateNumber(age, "ageYears").value;
    const w = validateNumber(weight, "bodyWeightKg").value;
    const h = validateNumber(height, "heightCm").value;
    if (a || w || h) {
      const { error: pErr } = await supabase.from("profiles").update({ age: a, weight_kg: w, height_cm: h, ...(gender ? { gender } : {}) } as any).eq("user_id", userId);
      if (pErr) { setSaving(false); toast({ title: "Kunde inte spara", description: pErr.message, variant: "destructive" }); return; }
    }
    // Varje ändrad vikt sparas som dagens vägning så att målviktsgrafen följer den.
    if (w && initialWeight != null && Math.abs(w - initialWeight) > 0.01 || (w && initialWeight == null)) {
      await supabase.from("body_weight_logs").upsert({ user_id: userId, log_date: toLocalDateKey(new Date()), weight_kg: w }, { onConflict: "user_id,log_date" });
      setInitialWeight(w);
    }
    const fib = validateNumber(fiber, "goalFiber").value;
    const { error } = await supabase.from("nutrition_goals").upsert({
      user_id: userId,
      daily_kcal: Math.round(parseDecimal(kcal)),
      protein_g: Math.round(parseDecimal(protein)),
      fat_g: Math.round(parseDecimal(fat)),
      carbs_g: Math.round(parseDecimal(carbs)),
      activity_level: activity,
      goal_type: goal,
      fiber_g: fib === null ? null : Math.round(fib),
      water_goal_ml: Math.round(parseDecimal(water)),
      target_weight_kg: validateNumber(targetWeight, "bodyWeightKg").value,
      weekly_loss_kg: validateNumber(weeklyLoss, { min: 0, max: 1.5, unit: "kg/vecka", optional: true }).value,
      ...Object.fromEntries(MICROS.map((m) => { const v = parseDecimal(micro[m.key] || ""); return [m.key, v > 0 ? v : null]; })),
    } as any, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Mål sparade" });
    onSaved(); onOpenChange(false);
  }

  const inp = "rounded-xl bg-muted/50 border-transparent";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle className="font-serif">Mina kostmål</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">Fyll i ålder, vikt och längd så räknas ditt dagliga behov (TDEE = vad kroppen gör av med en vanlig dag, inkl. aktivitet) ut automatiskt. kcal = energi. Makron: P = protein, F = fett, K = kolhydrater.</p>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs font-medium">Ålder</label><Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" aria-invalid={!!errs.age} className={inp} /><FieldError error={errs.age} /></div>
            <div><label className="text-xs font-medium">Vikt (kg)</label><Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" aria-invalid={!!errs.weight} className={inp} /><FieldError error={errs.weight} /></div>
            <div><label className="text-xs font-medium">Längd (cm)</label><Input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" aria-invalid={!!errs.height} className={inp} /><FieldError error={errs.height} /></div>
          </div>
          <div><label className="text-xs font-medium">Målvikt (kg, valfritt)</label><Input value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} inputMode="decimal" placeholder="t.ex. 75" aria-invalid={!!errs.targetWeight} className={inp} /><FieldError error={errs.targetWeight} /></div>
          <div>
            <label className="text-xs font-medium">Gå ner (kg/vecka, valfritt)</label>
            <Input value={weeklyLoss} onChange={(e) => setWeeklyLoss(e.target.value)} inputMode="decimal" placeholder="t.ex. 0,5" aria-invalid={!!errs.weeklyLoss} className={inp} />
            <FieldError error={errs.weeklyLoss} />
            {parseDecimal(weeklyLoss) > 0 && !errs.weeklyLoss && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Det ger ett underskott på ca {formatDecimal(Math.round((parseDecimal(weeklyLoss) * 7700) / 7))} kcal/dag → dagsmål {kcal || "–"} kcal.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium">Kön</label>
            {!gender && <p className="text-[11px] text-muted-foreground">Inget valt – vi räknar med ett medelvärde. Välj för exaktare mål.</p>}
            <div className="flex gap-1">
              <button onClick={() => setGender("male")} className={`flex-1 py-2 text-xs font-medium rounded-full transition-colors ${gender === "male" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>Man</button>
              <button onClick={() => setGender("female")} className={`flex-1 py-2 text-xs font-medium rounded-full transition-colors ${gender === "female" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>Kvinna</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Aktivitetsnivå</label>
            <select value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)} className="w-full input-soft">
              {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((k) => <option key={k} value={k}>{ACTIVITY_LABEL[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Mål</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value as GoalType)} className="w-full input-soft">
              {(Object.keys(GOAL_LABEL) as GoalType[]).map((k) => <option key={k} value={k}>{GOAL_LABEL[k]}</option>)}
            </select>
          </div>
          <button onClick={() => computeMacros(false)} className="w-full py-2 pill-btn-soft text-sm font-bold">Räkna ut mina makros</button>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[10px] font-medium">Kcal</label><Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" aria-invalid={!!errs.kcal} className={`${inp} text-sm`} /><FieldError error={errs.kcal} /></div>
            <div><label className="text-[10px] font-medium">Protein g</label><Input value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" aria-invalid={!!errs.protein} className={`${inp} text-sm`} /><FieldError error={errs.protein} /></div>
            <div><label className="text-[10px] font-medium">Fett g</label><Input value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" aria-invalid={!!errs.fat} className={`${inp} text-sm`} /><FieldError error={errs.fat} /></div>
            <div><label className="text-[10px] font-medium">Kolhydrat g</label><Input value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" aria-invalid={!!errs.carbs} className={`${inp} text-sm`} /><FieldError error={errs.carbs} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] font-medium">Fiber g (valfritt)</label><Input value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" placeholder="t.ex. 30" aria-invalid={!!errs.fiber} className={`${inp} text-sm`} /><FieldError error={errs.fiber} /></div>
            <div><label className="text-[10px] font-medium">Vattenmål ml</label><Input value={water} onChange={(e) => setWater(e.target.value)} inputMode="decimal" aria-invalid={!!errs.water} className={`${inp} text-sm`} /><FieldError error={errs.water} /></div>
          </div>
          <div className="pt-1">
            <p className="text-xs font-semibold">Mikronäringsämnen <span className="font-normal text-muted-foreground">(valfria dagsmål)</span></p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {MICROS.map((m) => (
                <div key={m.key}><label className="text-[10px] font-medium">{m.label} ({m.unit})</label>
                  <Input value={micro[m.key] ?? ""} onChange={(e) => setMicro((p) => ({ ...p, [m.key]: e.target.value }))} inputMode="decimal" aria-invalid={!!microErrs[m.key]} className={`${inp} text-sm`} /><FieldError error={microErrs[m.key]} /></div>
              ))}
            </div>
          </div>
          <button disabled={saving || hasErrors || !loaded} onClick={requestSave} className="w-full pill-btn-primary py-3 disabled:opacity-50">{!loaded ? "Laddar…" : saving ? "Sparar…" : "Spara"}</button>
        </div>
      </DialogContent>
      <ConfirmValueDialog message={confirmMsg} onConfirm={() => { setConfirmMsg(null); void save(); }} onCancel={() => setConfirmMsg(null)} />
    </Dialog>
  );
}
