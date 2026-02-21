import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Dumbbell, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UntrainedMusclesProps {
  userId: string;
}

function mapGroupToRegions(group: string): string[] {
  switch (group) {
    case "Bröst": return ["chest"];
    case "Rygg": return ["traps", "lats", "lowerBack"];
    case "Ben": return ["quads", "calves", "hamstrings"];
    case "Rumpa": return ["glutes"];
    case "Axlar": return ["delts"];
    case "Armar": return ["biceps", "triceps", "forearms"];
    case "Core": return ["abs", "obliques"];
    case "Helkropp": return ["chest", "traps", "lats", "quads", "calves", "delts", "biceps", "abs"];
    default: return [];
  }
}

const MUSCLE_GROUP_MAP: Record<string, string[]> = {};
for (const ex of exerciseLibrary) {
  MUSCLE_GROUP_MAP[ex.name.toLowerCase()] = mapGroupToRegions(ex.muscleGroup);
}
// Knäböj tränar även rumpa
MUSCLE_GROUP_MAP["knäböj"] = ["quads", "calves", "hamstrings", "glutes"];
MUSCLE_GROUP_MAP["böj"] = ["quads", "calves", "hamstrings", "glutes"];

function extractExerciseNames(details: string): string[] {
  const names: string[] = [];
  for (const line of details.split("\n")) {
    const trimmed = line.replace(/^[-•*]\s*/, "").trim();
    if (!trimmed || /^\d/.test(trimmed)) continue;
    const match = trimmed.match(/^([A-Za-zÅÄÖåäö\s\-()]+)/);
    if (match) {
      const name = match[1].trim().replace(/\s*—\s*$/, "");
      if (name.length > 2) names.push(name);
    }
  }
  return names;
}

function findPartialMatch(name: string, map: Record<string, string[]>): string[] | null {
  for (const [key, regions] of Object.entries(map)) {
    if (name.includes(key) || key.includes(name)) return regions;
  }
  return null;
}

const REGION_LABELS: Record<string, string> = {
  chest: "Bröst", traps: "Trapezius", lats: "Latissimus", lowerBack: "Nedre rygg",
  delts: "Axlar", biceps: "Biceps", triceps: "Triceps", forearms: "Underarmar",
  abs: "Mage", obliques: "Sneda bukmuskler", quads: "Quadriceps",
  hamstrings: "Baksida lår", glutes: "Rumpa", calves: "Vader",
};

const REGION_EXERCISES: Record<string, string[]> = {
  chest: ["Bänkpress", "Hantlar Flyes", "Armhävningar"],
  traps: ["Shrugs", "Face Pulls"],
  lats: ["Latsdrag", "Chins", "Kabelrodd"],
  lowerBack: ["Hyperextension", "Marklyft"],
  delts: ["Axelpress", "Sidolyft", "Reverse Fly"],
  biceps: ["Bicepscurl", "Hammarcurl"],
  triceps: ["Triceps Pushdown", "Skallkross"],
  forearms: ["Hammarcurl", "Handledscurl"],
  abs: ["Planka", "Hängande Benlyft", "Ab Wheel"],
  obliques: ["Russian Twist", "Sidoplanka", "Bålrotation"],
  quads: ["Knäböj", "Benpress", "Benextension"],
  hamstrings: ["Bencurl", "Rumänsk Marklyft"],
  glutes: ["Hip Thrust Maskin", "Glute Bridge", "Cable Kickback"],
  calves: ["Vadpress"],
};

const UntrainedMuscles = ({ userId }: UntrainedMusclesProps) => {
  const [trainedRegions, setTrainedRegions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const [{ data: completions }, { data: plans }, { data: customExercises }] = await Promise.all([
        supabase.from("workout_completions").select("week, day, done, logged_weights")
          .eq("user_id", userId).eq("done", true).gte("updated_at", sevenDaysAgo.toISOString()),
        supabase.from("workout_plans").select("week, day, details").eq("user_id", userId),
        supabase.from("custom_exercises").select("name, muscle_group"),
      ]);
      const customMap: Record<string, string[]> = {};
      if (customExercises) for (const ce of customExercises) customMap[ce.name.toLowerCase()] = mapGroupToRegions(ce.muscle_group);
      const planMap = new Map<string, string>();
      if (plans) for (const p of plans) planMap.set(`${p.week}-${p.day}`, p.details);
      const regions = new Set<string>();
      if (completions) {
        for (const c of completions) {
          if (!c.done) continue;
          const details = planMap.get(`${c.week}-${c.day}`);
          if (details) {
            for (const name of extractExerciseNames(details)) {
              const lower = name.toLowerCase();
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] || findPartialMatch(lower, MUSCLE_GROUP_MAP) || findPartialMatch(lower, customMap);
              if (mapped) mapped.forEach(r => regions.add(r));
            }
          }
          if (c.logged_weights && typeof c.logged_weights === "object") {
            for (const key of Object.keys(c.logged_weights as Record<string, any>)) {
              if (key.startsWith("__")) continue;
              const lower = key.toLowerCase();
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] || findPartialMatch(lower, MUSCLE_GROUP_MAP) || findPartialMatch(lower, customMap);
              if (mapped) mapped.forEach(r => regions.add(r));
            }
          }
        }
      }
      setTrainedRegions(regions);
      setLoading(false);
    };
    load();
  }, [userId]);

  const untrainedRegions = useMemo(() => {
    const allRegions = Object.keys(REGION_LABELS);
    return allRegions.filter(r => !trainedRegions.has(r));
  }, [trainedRegions]);

  if (loading || untrainedRegions.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold">Ej tränade muskler (7 dagar)</h3>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="space-y-1.5">
            {untrainedRegions.map(region => (
              <div key={region} className="bg-secondary/50 rounded-md px-3 py-2">
                <p className="text-xs font-bold text-foreground">{REGION_LABELS[region]}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(REGION_EXERCISES[region] || []).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default UntrainedMuscles;
