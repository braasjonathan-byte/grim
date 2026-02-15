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
  { value: "-500", label: "Gå ner i vikt", desc: "−500 kcal/dag" },
  { value: "-250", label: "Lätt nedgång", desc: "−250 kcal/dag" },
  { value: "0", label: "Behålla vikt", desc: "±0 kcal" },
  { value: "250", label: "Lätt uppgång", desc: "+250 kcal/dag" },
  { value: "500", label: "Bygga muskler", desc: "+500 kcal/dag" },
];

const CalorieCalculator = () => {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activity, setActivity] = useState("1.375");
  const [training, setTraining] = useState("350");
  const [goal, setGoal] = useState("0");
  const [result, setResult] = useState<{ bmr: number; tdee: number; target: number } | null>(null);

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

    // TDEE = BMR × activity factor + weekly training average per day
    const tdee = bmr * activityFactor + trainingExtra / 7 * activityFactor;
    const target = tdee + goalAdj;

    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), target: Math.round(target) });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Kalorikalkylator</span>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
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

          {result && (
            <div className="grid grid-cols-3 gap-2 pt-1">
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
          )}
        </div>
      )}
    </div>
  );
};

export default CalorieCalculator;
