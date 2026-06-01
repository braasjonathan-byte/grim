import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Waves, Bike, Footprints, Dumbbell, Target, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { generateSessions, computeDurationWeeks, computeWeeklySessionCount, bikeTypeLabel, type TriathlonPlanInput, type Level, type BikeType, type GeneratedSession } from "@/lib/triathlonPlanner";
import { padWeeksTo7Days, type TemplatePlanDay } from "@/data/planTemplates";
import { toLocalDateKey } from "@/lib/dateUtils";


interface Props {
  userId: string;
  onCreated: () => void;
  onCancel?: () => void;
}

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Nybörjare" },
  { value: "intermediate", label: "Medel" },
  { value: "advanced", label: "Avancerad" },
];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const TriathlonWizard = ({ userId, onCreated, onCancel }: Props) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [goalType, setGoalType] = useState<"duration" | "race_date">("duration");
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [raceDate, setRaceDate] = useState<string>("");

  const [swimLevel, setSwimLevel] = useState<Level>("beginner");
  const [bikeLevel, setBikeLevel] = useState<Level>("beginner");
  const [runLevel, setRunLevel] = useState<Level>("beginner");
  const [bikeType, setBikeType] = useState<BikeType>("road");
  const [swimKm, setSwimKm] = useState(2);
  const [bikeKm, setBikeKm] = useState(40);
  const [runKm, setRunKm] = useState(15);

  const [sessionsPerWeek, setSessionsPerWeek] = useState(4);
  const [longDays, setLongDays] = useState<string[]>(["Lör", "Sön"]);
  const [strengthSessions, setStrengthSessions] = useState(0);
  const includeStrength = strengthSessions > 0;

  const toggleLongDay = (d: string) => {
    setLongDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const startDateObj = new Date();
      const startDate = todayIso();

      if (goalType === "race_date" && !raceDate) {
        toast.error("Välj ett måldatum");
        setSaving(false); return;
      }

      const input: TriathlonPlanInput = {
        goalType,
        durationWeeks: goalType === "duration" ? durationWeeks : undefined,
        raceDate: goalType === "race_date" ? raceDate : undefined,
        startDate,
        swimLevel, bikeLevel, runLevel,
        bikeType,
        swimKmWeek: swimKm, bikeKmWeek: bikeKm, runKmWeek: runKm,
        sessionsPerWeek,
        longSessionDays: longDays,
        includeStrength,
        strengthSessions,
      };

      const sessions = generateSessions(input);
      const planDays = triathlonSessionsToPlanDays(sessions);
      const padded = padWeeksTo7Days(planDays);

      // Clear any existing plan rows (week > 0) so the new plan starts fresh
      await supabase.from("workout_plans").delete().eq("user_id", userId).gt("week", 0);

      const startCreatedAt = toNoonUtcIsoLocal(startDateObj);
      const rows = padded.map(d => ({
        user_id: userId,
        week: d.week,
        day: d.day,
        session_name: d.session_name,
        details: d.details,
        tempo: d.tempo,
        created_at: startCreatedAt,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const { error: insErr } = await supabase.from("workout_plans").insert(rows.slice(i, i + 50));
        if (insErr) throw insErr;
      }

      const startDateStr = toLocalDateKey(startDateObj);
      await supabase.from("profiles")
        .update({ plan_start_calibrated: true, plan_start_date: startDateStr } as any)
        .eq("user_id", userId);

      toast.success("Triathlonplan skapad!");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Något gick fel");
    } finally {
      setSaving(false);
    }
  };


  const totalWeeks = computeDurationWeeks({
    goalType,
    durationWeeks,
    raceDate: raceDate || undefined,
    startDate: todayIso(),
    swimLevel, bikeLevel, runLevel,
    swimKmWeek: swimKm, bikeKmWeek: bikeKm, runKmWeek: runKm,
    sessionsPerWeek,
    longSessionDays: longDays,
    includeStrength,
    strengthSessions,
  });

  const weeklyCount = computeWeeklySessionCount({
    goalType,
    durationWeeks,
    raceDate: raceDate || undefined,
    startDate: todayIso(),
    swimLevel, bikeLevel, runLevel,
    swimKmWeek: swimKm, bikeKmWeek: bikeKm, runKmWeek: runKm,
    sessionsPerWeek,
    longSessionDays: longDays,
    includeStrength,
    strengthSessions,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Skapa Triathlonplan</h3>
          <p className="text-xs text-muted-foreground">Steg {step} av 4</p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
        )}
      </div>

      <div className="flex gap-1">
        {[1,2,3,4].map(n => (
          <div key={n} className={`flex-1 h-1 rounded-full ${n <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2"><Target className="w-4 h-4 text-primary"/><h4 className="font-semibold">Ditt mål</h4></div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setGoalType("duration")}
              className={`p-3 rounded-lg border text-sm font-semibold ${goalType === "duration" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}
            >Fast längd</button>
            <button
              onClick={() => setGoalType("race_date")}
              className={`p-3 rounded-lg border text-sm font-semibold ${goalType === "race_date" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary"}`}
            >Måldatum</button>
          </div>

          {goalType === "duration" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Längd: <span className="text-primary">{durationWeeks} veckor</span></label>
              <div className="flex gap-2 flex-wrap">
                {[4, 6, 8, 12].map(w => (
                  <button key={w} onClick={() => setDurationWeeks(w)} className={`px-3 py-2 rounded-lg text-sm font-semibold ${durationWeeks === w ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{w} v</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1"><CalendarDays className="w-4 h-4"/>Måldatum (tävling)</label>
              <Input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} min={todayIso()} />
              {raceDate && <p className="text-xs text-muted-foreground">≈ {totalWeeks} veckors plan</p>}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h4 className="font-semibold">Nuvarande nivå & volym</h4>
          {([
            { key: "swim", icon: Waves, label: "Simning", level: swimLevel, setLevel: setSwimLevel, km: swimKm, setKm: setSwimKm, unit: "km/v", max: 20 },
            { key: "bike", icon: Bike, label: "Cykling", level: bikeLevel, setLevel: setBikeLevel, km: bikeKm, setKm: setBikeKm, unit: "km/v", max: 300 },
            { key: "run", icon: Footprints, label: "Löpning", level: runLevel, setLevel: setRunLevel, km: runKm, setKm: setRunKm, unit: "km/v", max: 100 },
          ] as const).map(d => {
            const Icon = d.icon;
            return (
              <div key={d.key} className="p-3 rounded-lg border border-border bg-secondary space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm"><Icon className="w-4 h-4 text-primary"/>{d.label}</div>
                <div className="grid grid-cols-3 gap-1">
                  {LEVELS.map(l => (
                    <button key={l.value} onClick={() => d.setLevel(l.value)} className={`py-1.5 rounded text-xs font-semibold ${d.level === l.value ? "bg-primary text-primary-foreground" : "bg-background"}`}>{l.label}</button>
                  ))}
                </div>
                {d.key === "bike" && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Typ av cykling</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(Object.keys(bikeTypeLabel) as BikeType[]).map(bt => (
                        <button
                          key={bt}
                          onClick={() => setBikeType(bt)}
                          className={`py-1.5 rounded text-xs font-semibold ${bikeType === bt ? "bg-primary text-primary-foreground" : "bg-background"}`}
                        >{bikeTypeLabel[bt]}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">Volym: <span className="text-foreground font-semibold">{d.km} {d.unit}</span></label>
                  <Slider value={[d.km]} onValueChange={v => d.setKm(v[0])} min={0} max={d.max} step={d.key === "swim" ? 0.5 : 1} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h4 className="font-semibold">Tillgänglighet & styrka</h4>
          <div className="space-y-2">
            <label className="text-sm">Konditionspass per vecka: <span className="text-primary font-bold">{sessionsPerWeek}</span></label>
            <Slider value={[sessionsPerWeek]} onValueChange={v => setSessionsPerWeek(v[0])} min={3} max={7} step={1} />
          </div>
          <div className="space-y-2">
            <label className="text-sm">Dagar för långpass</label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleLongDay(d)} className={`py-2 text-xs font-semibold rounded ${longDays.includes(d) ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm flex items-center gap-1"><Dumbbell className="w-4 h-4 text-primary"/>Styrkepass per vecka</label>
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map(n => (
                <button key={n} onClick={() => setStrengthSessions(n)} className={`py-2 text-sm font-semibold rounded ${strengthSessions === n ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-primary bg-primary/10 text-sm">
            <div className="font-bold text-primary">Totalt {weeklyCount.total} pass/v</div>
            <div className="text-xs text-muted-foreground">{weeklyCount.cardio} kondition{weeklyCount.strength > 0 ? ` + ${weeklyCount.strength} styrka` : ""}</div>
            {weeklyCount.total < sessionsPerWeek + strengthSessions && (
              <div className="text-xs text-destructive mt-1">Färre dagar tillgängliga än önskat – minska långpassdagar eller pass/v.</div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h4 className="font-semibold">Sammanfattning</h4>
          <div className="p-3 rounded-lg border border-border bg-secondary text-sm space-y-1">
            <p><span className="text-muted-foreground">Mål:</span> {goalType === "duration" ? `${durationWeeks} veckor` : `Tävling ${raceDate || "—"} (${totalWeeks} v)`}</p>
            <p><span className="text-muted-foreground">Pass/v:</span> {weeklyCount.total} ({weeklyCount.cardio} kondition{weeklyCount.strength > 0 ? ` + ${weeklyCount.strength} styrka` : ""})</p>
            <p><span className="text-muted-foreground">Långpass:</span> {longDays.join(", ") || "—"}</p>
            <p><span className="text-muted-foreground">Nivåer:</span> Sim {swimLevel}, Cykel {bikeLevel} ({bikeTypeLabel[bikeType]}), Löp {runLevel}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="flex-1">
            <ChevronLeft className="w-4 h-4"/> Tillbaka
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={() => setStep(s => s + 1)} className="flex-1">
            Nästa <ChevronRight className="w-4 h-4"/>
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={saving} className="flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "Skapa plan"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TriathlonWizard;
