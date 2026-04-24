import { useState } from "react";
import { Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const activityLevels = [
  { value: "1.2", label: "Stillasittande", desc: "Kontorsjobb, lite rörelse" },
  { value: "1.375", label: "Lätt aktiv", desc: "Promenader, lätt vardagsrörelse" },
  { value: "1.55", label: "Måttligt aktiv", desc: "Rörligt jobb eller aktiv vardag" },
  { value: "1.725", label: "Mycket aktiv", desc: "Fysiskt krävande jobb" },
];

const trainingLevels = [
  { value: "0", label: "Ingen träning", desc: "0 pass/vecka" },
  { value: "200", label: "Lätt träning", desc: "1–2 pass/vecka" },
  { value: "350", label: "Regelbunden träning", desc: "3–4 pass/vecka" },
  { value: "500", label: "Intensiv träning", desc: "5–6 pass/vecka" },
  { value: "650", label: "Elit/dubbla pass", desc: "6–7+ pass/vecka" },
];

const goals = [
  { value: "-500", label: "Gå ner i vikt", desc: "−500 kcal/dag", macro: "cut" },
  { value: "-250", label: "Lätt nedgång", desc: "−250 kcal/dag", macro: "cut" },
  { value: "0", label: "Behålla vikt", desc: "±0 kcal", macro: "maintain" },
  { value: "250", label: "Lätt uppgång", desc: "+250 kcal/dag", macro: "bulk" },
  { value: "500", label: "Bygga muskler", desc: "+500 kcal/dag", macro: "bulk" },
] as const;

// Macro splits per goal type (protein%, carbs%, fat%)
const macroSplits: Record<string, { protein: number; carbs: number; fat: number; label: string }> = {
  cut:      { protein: 40, carbs: 30, fat: 30, label: "Viktminskning" },
  maintain: { protein: 30, carbs: 40, fat: 30, label: "Underhåll" },
  bulk:     { protein: 30, carbs: 45, fat: 25, label: "Muskeluppbyggnad" },
};

const CalorieCalculator = () => {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState("1.375");
  const [training, setTraining] = useState("350");
  const [goal, setGoal] = useState("0");
  const [result, setResult] = useState<{ bmr: number; tdee: number; target: number; macroType: string } | null>(null);

  const calculate = () => {
    const a = parseFloat(age);
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!a || !w || !h) return;

    // Mifflin-St Jeor
    const bmr = gender === "male"
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;

    const activityFactor = parseFloat(activity);
    const trainingExtra = parseFloat(training);
    const goalAdj = parseFloat(goal);
    const selectedGoal = goals.find((g) => g.value === goal);
    const macroType = selectedGoal?.macro ?? "maintain";

    // TDEE = BMR × activity factor + weekly training average per day
    const tdee = bmr * activityFactor + trainingExtra / 7 * activityFactor;
    const target = tdee + goalAdj;

    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.round(target), macroType });
  };

  return (
    <div className="border border-border rounded-lg bg-secondary overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary transition-colors"
      >
        <Flame className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">Kalorikalkylator</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "Stäng" : "Öppna"}
        </span>
      </button>

      {open && (
        <div className="p-4 border-t border-border space-y-3">
          {/* Gender */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={gender === "male" ? "default" : "outline"}
              className="flex-1 text-xs"
              onClick={() => setGender("male")}
            >
              Man
            </Button>
            <Button
              size="sm"
              variant={gender === "female" ? "default" : "outline"}
              className="flex-1 text-xs"
              onClick={() => setGender("female")}
            >
              Kvinna
            </Button>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Ålder</Label>
              <Input type="number" placeholder="25" value={age} onChange={(e) => setAge(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Vikt (kg)</Label>
              <Input type="number" placeholder="80" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Längd (cm)</Label>
              <Input type="number" placeholder="178" value={height} onChange={(e) => setHeight(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {/* Activity */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Vardagsaktivitet</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {activityLevels.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">
                    {l.label} – <span className="text-muted-foreground">{l.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Training */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Träningsnivå</Label>
            <Select value={training} onValueChange={setTraining}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {trainingLevels.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">
                    {l.label} – <span className="text-muted-foreground">{l.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Goal */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Mål</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.value} value={g.value} className="text-xs">
                    {g.label} – <span className="text-muted-foreground">{g.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" className="w-full text-xs" onClick={calculate}>Beräkna</Button>

          {result && (() => {
            const split = macroSplits[result.macroType];
            const proteinG = Math.round((result.target * split.protein / 100) / 4);
            const carbsG = Math.round((result.target * split.carbs / 100) / 4);
            const fatG = Math.round((result.target * split.fat / 100) / 9);
            return (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">BMR</p>
                    <p className="text-sm font-bold">{result.bmr}</p>
                    <p className="text-[10px] text-muted-foreground">kcal</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">TDEE</p>
                    <p className="text-sm font-bold">{result.tdee}</p>
                    <p className="text-[10px] text-muted-foreground">kcal</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 border border-primary/30 p-2 text-center">
                    <p className="text-[10px] text-primary">Mål</p>
                    <p className="text-sm font-bold text-primary">{result.target}</p>
                    <p className="text-[10px] text-primary">kcal</p>
                  </div>
                </div>

                {/* Macros */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Makrofördelning – {split.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs font-bold text-red-400">{proteinG}g</p>
                      <p className="text-[10px] text-muted-foreground">Protein</p>
                      <p className="text-[10px] text-muted-foreground">{split.protein}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-amber-400">{carbsG}g</p>
                      <p className="text-[10px] text-muted-foreground">Kolhydrater</p>
                      <p className="text-[10px] text-muted-foreground">{split.carbs}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-emerald-400">{fatG}g</p>
                      <p className="text-[10px] text-muted-foreground">Fett</p>
                      <p className="text-[10px] text-muted-foreground">{split.fat}%</p>
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="bg-red-400" style={{ width: `${split.protein}%` }} />
                    <div className="bg-amber-400" style={{ width: `${split.carbs}%` }} />
                    <div className="bg-emerald-400" style={{ width: `${split.fat}%` }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CalorieCalculator;
