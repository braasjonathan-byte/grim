import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin overrides for how an exercise is logged (reps / seconds / meters, bodyweight). */
export type ExerciseUnit = "reps" | "seconds" | "meters";
export interface UnitOverride { exercise_name: string; unit: ExerciseUnit | null; bodyweight: boolean | null }

let cached: Map<string, UnitOverride> | null = null;
const listeners = new Set<(m: Map<string, UnitOverride>) => void>();

export async function loadUnitOverrides() {
  const { data } = await supabase.from("exercise_unit_overrides").select("exercise_name_lower, exercise_name, unit, bodyweight");
  cached = new Map((data || []).map((r: any) => [r.exercise_name_lower, r as UnitOverride]));
  listeners.forEach((l) => l(cached!));
  return cached;
}

export function useUnitOverrides(): Map<string, UnitOverride> {
  const [m, setM] = useState<Map<string, UnitOverride>>(cached ?? new Map());
  useEffect(() => {
    let alive = true;
    const l = (v: Map<string, UnitOverride>) => alive && setM(v);
    listeners.add(l);
    if (cached) setM(cached); else loadUnitOverrides().catch(() => {});
    return () => { alive = false; listeners.delete(l); };
  }, []);
  return m;
}
