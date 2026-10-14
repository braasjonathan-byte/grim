import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { useUnitOverrides, loadUnitOverrides, type ExerciseUnit } from "@/lib/exerciseUnits";

const UNITS: { v: ExerciseUnit | ""; label: string }[] = [
  { v: "", label: "Automatiskt" }, { v: "reps", label: "Reps" }, { v: "seconds", label: "Sekunder" }, { v: "meters", label: "Meter" },
];
const BW: { v: string; label: string }[] = [{ v: "", label: "Automatiskt" }, { v: "true", label: "Kroppsvikt" }, { v: "false", label: "Med vikt" }];

export default function AdminExerciseUnits({ userId }: { userId: string }) {
  const ov = useUnitOverrides();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<ExerciseUnit | "">("");
  const [bw, setBw] = useState("");
  const names = useMemo(() => exerciseLibrary.map((e: any) => e.name as string), []);
  const matches = name.trim().length > 1 ? names.filter((n) => n.toLowerCase().includes(name.trim().toLowerCase())).slice(0, 6) : [];

  const pick = (n: string) => {
    setName(n);
    const o = ov.get(n.toLowerCase());
    setUnit(o?.unit ?? ""); setBw(o?.bodyweight == null ? "" : String(o.bodyweight));
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return toast.error("Skriv övningens namn");
    if (!unit && !bw) {
      await supabase.from("exercise_unit_overrides").delete().eq("exercise_name_lower", n.toLowerCase());
    } else {
      const { error } = await supabase.from("exercise_unit_overrides").upsert({
        exercise_name_lower: n.toLowerCase(), exercise_name: n, unit: unit || null, bodyweight: bw === "" ? null : bw === "true",
        updated_at: new Date().toISOString(), updated_by: userId,
      });
      if (error) return toast.error(error.message);
    }
    await loadUnitOverrides();
    toast.success("Sparat — gäller för alla i passen");
    setName(""); setUnit(""); setBw("");
  };

  const remove = async (lower: string) => {
    await supabase.from("exercise_unit_overrides").delete().eq("exercise_name_lower", lower);
    await loadUnitOverrides();
  };

  const sel = "w-full rounded-xl border border-input bg-background px-2 py-2 text-sm";
  return (
    <div className="space-y-2 text-sm">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Övning, t.ex. Planka" />
      {matches.length > 0 && !names.includes(name) && (
        <div className="flex flex-wrap gap-1">{matches.map((m) => <button key={m} onClick={() => pick(m)} className="rounded-full bg-muted px-2 py-0.5 text-xs">{m}</button>)}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">Loggas i
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} className={sel}>{UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}</select>
        </label>
        <label className="text-[11px] text-muted-foreground">Vikt
          <select value={bw} onChange={(e) => setBw(e.target.value)} className={sel}>{BW.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}</select>
        </label>
      </div>
      <Button size="sm" onClick={save}>Spara</Button>
      {ov.size > 0 && (
        <ul className="divide-y divide-border pt-2">
          {[...ov.entries()].map(([lower, o]) => (
            <li key={lower} className="flex items-center gap-2 py-1.5">
              <button className="flex-1 text-left" onClick={() => pick(o.exercise_name)}>
                {o.exercise_name}
                <span className="block text-[11px] text-muted-foreground">
                  {[UNITS.find((u) => u.v === (o.unit ?? ""))?.label, o.bodyweight == null ? null : o.bodyweight ? "Kroppsvikt" : "Med vikt"].filter(Boolean).join(" · ")}
                </span>
              </button>
              <button aria-label={`Ta bort ${o.exercise_name}`} onClick={() => remove(lower)} className="text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
