import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Activity } from "lucide-react";

interface MuscleMapProps {
  userId: string;
}

// Map exercise names (lowercase) to muscle group keys used in the SVG
const MUSCLE_GROUP_MAP: Record<string, string[]> = {};

// Build map from exercise library
for (const ex of exerciseLibrary) {
  const key = ex.name.toLowerCase();
  const group = ex.muscleGroup;
  // Map Swedish muscle groups to SVG region keys
  const mapped = mapGroupToRegions(group);
  if (mapped.length > 0) MUSCLE_GROUP_MAP[key] = mapped;
}

function mapGroupToRegions(group: string): string[] {
  switch (group) {
    case "Bröst": return ["chest"];
    case "Rygg": return ["back"];
    case "Ben": return ["quads", "hamstrings", "calves"];
    case "Rumpa": return ["glutes"];
    case "Axlar": return ["shoulders"];
    case "Armar": return ["biceps", "triceps", "forearms"];
    case "Core": return ["abs", "obliques"];
    case "Helkropp": return ["chest", "back", "quads", "hamstrings", "calves", "shoulders", "biceps", "abs"];
    default: return [];
  }
}

function extractExerciseNames(details: string): string[] {
  const names: string[] = [];
  const lines = details.split("\n");
  for (const line of lines) {
    const trimmed = line.replace(/^[-•*]\s*/, "").trim();
    if (!trimmed || /^\d/.test(trimmed)) continue;
    // Extract exercise name (before any set/rep info like "3x10" or "—")
    const match = trimmed.match(/^([A-Za-zÅÄÖåäö\s\-()]+)/);
    if (match) {
      const name = match[1].trim().replace(/\s*—\s*$/, "");
      if (name.length > 2) names.push(name);
    }
  }
  return names;
}

const REGION_LABELS: Record<string, string> = {
  chest: "Bröst",
  back: "Rygg",
  shoulders: "Axlar",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Underarmar",
  abs: "Mage",
  obliques: "Sneda bukmuskler",
  quads: "Quadriceps",
  hamstrings: "Baksida lår",
  glutes: "Rumpa",
  calves: "Vader",
};

const MuscleMap = ({ userId }: MuscleMapProps) => {
  const [trainedRegions, setTrainedRegions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [{ data: completions }, { data: plans }, { data: customExercises }] = await Promise.all([
        supabase
          .from("workout_completions")
          .select("week, day, done, logged_weights")
          .eq("user_id", userId)
          .eq("done", true)
          .gte("updated_at", sevenDaysAgo.toISOString()),
        supabase
          .from("workout_plans")
          .select("week, day, details")
          .eq("user_id", userId),
        supabase
          .from("custom_exercises")
          .select("name, muscle_group"),
      ]);

      // Build a custom exercise map
      const customMap: Record<string, string[]> = {};
      if (customExercises) {
        for (const ce of customExercises) {
          customMap[ce.name.toLowerCase()] = mapGroupToRegions(ce.muscle_group);
        }
      }

      // Build plan details lookup
      const planMap = new Map<string, string>();
      if (plans) {
        for (const p of plans) {
          planMap.set(`${p.week}-${p.day}`, p.details);
        }
      }

      const regions = new Set<string>();

      if (completions) {
        for (const c of completions) {
          if (!c.done) continue;

          // Get exercises from plan details
          const details = planMap.get(`${c.week}-${c.day}`);
          if (details) {
            const exerciseNames = extractExerciseNames(details);
            for (const name of exerciseNames) {
              const lower = name.toLowerCase();
              // Check exact match first, then partial match
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] ||
                findPartialMatch(lower, MUSCLE_GROUP_MAP) ||
                findPartialMatch(lower, customMap);
              if (mapped) {
                for (const r of mapped) regions.add(r);
              }
            }
          }

          // Also check logged_weights keys for exercise names
          if (c.logged_weights && typeof c.logged_weights === "object") {
            for (const key of Object.keys(c.logged_weights as Record<string, any>)) {
              if (key.startsWith("__")) continue;
              const lower = key.toLowerCase();
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] ||
                findPartialMatch(lower, MUSCLE_GROUP_MAP) ||
                findPartialMatch(lower, customMap);
              if (mapped) {
                for (const r of mapped) regions.add(r);
              }
            }
          }
        }
      }

      setTrainedRegions(regions);
      setLoading(false);
    };
    load();
  }, [userId]);

  const trainedList = useMemo(() =>
    Array.from(trainedRegions).map(r => REGION_LABELS[r] || r),
    [trainedRegions]
  );

  if (loading) return null;

  const active = (region: string) => trainedRegions.has(region);
  const fill = (region: string) => active(region) ? "hsl(var(--primary))" : "hsl(var(--muted))";
  const opacity = (region: string) => active(region) ? 0.85 : 0.3;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
      </div>

      <div className="flex gap-4 items-start">
        {/* Front view */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1">Framsida</p>
          <svg viewBox="0 0 200 400" className="w-full max-w-[140px]">
            {/* Head */}
            <ellipse cx="100" cy="30" rx="20" ry="24" fill="hsl(var(--muted))" opacity="0.3" />
            {/* Neck */}
            <rect x="92" y="52" width="16" height="12" rx="4" fill="hsl(var(--muted))" opacity="0.3" />

            {/* Shoulders */}
            <ellipse cx="62" cy="78" rx="18" ry="12" fill={fill("shoulders")} opacity={opacity("shoulders")} />
            <ellipse cx="138" cy="78" rx="18" ry="12" fill={fill("shoulders")} opacity={opacity("shoulders")} />

            {/* Chest */}
            <path d="M72 75 Q100 70 128 75 Q130 95 100 100 Q70 95 72 75Z" fill={fill("chest")} opacity={opacity("chest")} />

            {/* Abs */}
            <rect x="82" y="102" width="36" height="50" rx="6" fill={fill("abs")} opacity={opacity("abs")} />

            {/* Obliques */}
            <path d="M76 102 L82 102 L82 152 L76 148 Q72 130 76 102Z" fill={fill("obliques")} opacity={opacity("obliques")} />
            <path d="M124 102 L118 102 L118 152 L124 148 Q128 130 124 102Z" fill={fill("obliques")} opacity={opacity("obliques")} />

            {/* Biceps */}
            <ellipse cx="52" cy="120" rx="10" ry="24" fill={fill("biceps")} opacity={opacity("biceps")} transform="rotate(-8 52 120)" />
            <ellipse cx="148" cy="120" rx="10" ry="24" fill={fill("biceps")} opacity={opacity("biceps")} transform="rotate(8 148 120)" />

            {/* Forearms */}
            <ellipse cx="46" cy="168" rx="8" ry="22" fill={fill("forearms")} opacity={opacity("forearms")} transform="rotate(-5 46 168)" />
            <ellipse cx="154" cy="168" rx="8" ry="22" fill={fill("forearms")} opacity={opacity("forearms")} transform="rotate(5 154 168)" />

            {/* Quads */}
            <ellipse cx="84" cy="210" rx="16" ry="48" fill={fill("quads")} opacity={opacity("quads")} />
            <ellipse cx="116" cy="210" rx="16" ry="48" fill={fill("quads")} opacity={opacity("quads")} />

            {/* Calves (front) */}
            <ellipse cx="82" cy="310" rx="11" ry="36" fill={fill("calves")} opacity={opacity("calves")} />
            <ellipse cx="118" cy="310" rx="11" ry="36" fill={fill("calves")} opacity={opacity("calves")} />

            {/* Knees hint */}
            <ellipse cx="84" cy="262" rx="10" ry="8" fill="hsl(var(--muted))" opacity="0.15" />
            <ellipse cx="116" cy="262" rx="10" ry="8" fill="hsl(var(--muted))" opacity="0.15" />

            {/* Feet */}
            <ellipse cx="82" cy="352" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.2" />
            <ellipse cx="118" cy="352" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.2" />
          </svg>
        </div>

        {/* Back view */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1">Baksida</p>
          <svg viewBox="0 0 200 400" className="w-full max-w-[140px]">
            {/* Head */}
            <ellipse cx="100" cy="30" rx="20" ry="24" fill="hsl(var(--muted))" opacity="0.3" />
            {/* Neck */}
            <rect x="92" y="52" width="16" height="12" rx="4" fill="hsl(var(--muted))" opacity="0.3" />

            {/* Shoulders (rear) */}
            <ellipse cx="62" cy="78" rx="18" ry="12" fill={fill("shoulders")} opacity={opacity("shoulders")} />
            <ellipse cx="138" cy="78" rx="18" ry="12" fill={fill("shoulders")} opacity={opacity("shoulders")} />

            {/* Back / Lats */}
            <path d="M72 75 Q100 70 128 75 Q135 110 128 145 Q100 155 72 145 Q65 110 72 75Z" fill={fill("back")} opacity={opacity("back")} />

            {/* Triceps */}
            <ellipse cx="50" cy="120" rx="10" ry="24" fill={fill("triceps")} opacity={opacity("triceps")} transform="rotate(-8 50 120)" />
            <ellipse cx="150" cy="120" rx="10" ry="24" fill={fill("triceps")} opacity={opacity("triceps")} transform="rotate(8 150 120)" />

            {/* Forearms (back) */}
            <ellipse cx="44" cy="168" rx="8" ry="22" fill={fill("forearms")} opacity={opacity("forearms")} transform="rotate(-5 44 168)" />
            <ellipse cx="156" cy="168" rx="8" ry="22" fill={fill("forearms")} opacity={opacity("forearms")} transform="rotate(5 156 168)" />

            {/* Glutes */}
            <ellipse cx="86" cy="165" rx="18" ry="16" fill={fill("glutes")} opacity={opacity("glutes")} />
            <ellipse cx="114" cy="165" rx="18" ry="16" fill={fill("glutes")} opacity={opacity("glutes")} />

            {/* Hamstrings */}
            <ellipse cx="84" cy="220" rx="15" ry="42" fill={fill("hamstrings")} opacity={opacity("hamstrings")} />
            <ellipse cx="116" cy="220" rx="15" ry="42" fill={fill("hamstrings")} opacity={opacity("hamstrings")} />

            {/* Calves (back) */}
            <ellipse cx="82" cy="310" rx="12" ry="36" fill={fill("calves")} opacity={opacity("calves")} />
            <ellipse cx="118" cy="310" rx="12" ry="36" fill={fill("calves")} opacity={opacity("calves")} />

            {/* Knees hint */}
            <ellipse cx="84" cy="265" rx="10" ry="8" fill="hsl(var(--muted))" opacity="0.15" />
            <ellipse cx="116" cy="265" rx="10" ry="8" fill="hsl(var(--muted))" opacity="0.15" />

            {/* Feet */}
            <ellipse cx="82" cy="352" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.2" />
            <ellipse cx="118" cy="352" rx="12" ry="6" fill="hsl(var(--muted))" opacity="0.2" />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5">
        {trainedList.length > 0 ? (
          trainedList.map(label => (
            <span key={label} className="bg-primary/15 text-primary text-[10px] font-medium px-2 py-0.5 rounded-full">
              {label}
            </span>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center w-full">Inga muskelgrupper tränade senaste 7 dagarna</p>
        )}
      </div>
    </div>
  );
};

function findPartialMatch(name: string, map: Record<string, string[]>): string[] | null {
  for (const [key, regions] of Object.entries(map)) {
    if (name.includes(key) || key.includes(name)) return regions;
  }
  return null;
}

export default MuscleMap;
