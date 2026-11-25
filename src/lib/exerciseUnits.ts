import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin overrides for how an exercise is logged (reps / seconds / meters, bodyweight). */
export type ExerciseUnit = "reps" | "seconds" | "meters";
export interface UnitOverride {
  exercise_name: string;
  unit: ExerciseUnit | null;
  bodyweight: boolean | null;
  weighted_bodyweight: boolean | null;
}

export const DEFAULT_WEIGHTED_BW_EXERCISES = ["dips", "pull-ups", "pull ups", "pullups"];
export const DEFAULT_PURE_BODYWEIGHT_EXERCISES = [
  "box jumps", "burpees", "armhävningar", "push-ups", "push ups",
  "planka", "dead bug", "bird dog", "sit-ups", "sit ups",
  "mountain climbers", "jumping jacks", "jump squats", "pistol squats",
  "handstand", "muscle-ups", "muscle ups", "ring rows", "v-ups",
  "toes to bar", "knees to elbow",
];

export function resolveExerciseWeightMode(
  exerciseName: string,
  overrides: Map<string, UnitOverride>,
  options?: { defReps?: string; isCustomBodyweight?: boolean },
): { isBodyweight: boolean; isWeightedBw: boolean } {
  const lower = exerciseName.trim().toLowerCase();
  const ov = overrides.get(lower);
  const isWeightedBw =
    ov?.weighted_bodyweight != null
      ? ov.weighted_bodyweight
      : DEFAULT_WEIGHTED_BW_EXERCISES.some((bw) => lower.includes(bw)) || Boolean(options?.isCustomBodyweight);
  const isBodyweight = isWeightedBw
    ? false
    : (ov?.bodyweight ?? (DEFAULT_PURE_BODYWEIGHT_EXERCISES.some((bw) => lower.includes(bw)) || /max$/i.test(options?.defReps ?? "")));
  return { isBodyweight, isWeightedBw };
}

let cached: Map<string, UnitOverride> | null = null;
const listeners = new Set<(m: Map<string, UnitOverride>) => void>();

export async function loadUnitOverrides() {
  const { data } = await supabase.from("exercise_unit_overrides").select("exercise_name_lower, exercise_name, unit, bodyweight, weighted_bodyweight");
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
