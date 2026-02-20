import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Activity } from "lucide-react";
import muscleFront from "@/assets/muscle-front.png";
import muscleBack from "@/assets/muscle-back.png";

interface MuscleMapProps {
  userId: string;
}

function mapGroupToRegions(group: string): string[] {
  switch (group) {
    case "Bröst": return ["chest"];
    case "Rygg": return ["traps", "lats", "lowerBack"];
    case "Ben": return ["quads", "calves"];
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

// SVG overlay regions mapped to approximate positions on the anatomy images
// Front view muscle regions (percentage-based coordinates on the image)
const FRONT_REGIONS: Record<string, string> = {
  // Deltoids
  delts: "M 18 16, Q 14 17 12 20, Q 10 24 13 27, L 19 25, Q 21 20 18 16 Z M 82 16, Q 86 17 88 20, Q 90 24 87 27, L 81 25, Q 79 20 82 16 Z",
  // Chest / Pecs
  chest: "M 22 18, Q 38 16 50 17, Q 50 24 42 27, Q 30 28 22 25, Q 19 22 22 18 Z M 78 18, Q 62 16 50 17, Q 50 24 58 27, Q 70 28 78 25, Q 81 22 78 18 Z",
  // Biceps
  biceps: "M 12 27, Q 9 28 8 33, Q 7 38 9 42, Q 12 44 15 42, Q 17 38 17 33, Q 16 28 12 27 Z M 88 27, Q 91 28 92 33, Q 93 38 91 42, Q 88 44 85 42, Q 83 38 83 33, Q 84 28 88 27 Z",
  // Forearms
  forearms: "M 9 43, Q 6 45 5 52, Q 4 58 6 62, Q 9 64 12 62, Q 14 57 13 50, Q 12 44 9 43 Z M 91 43, Q 94 45 95 52, Q 96 58 94 62, Q 91 64 88 62, Q 86 57 87 50, Q 88 44 91 43 Z",
  // Abs
  abs: "M 40 28, L 50 27, L 50 42, L 40 43, Z M 50 27, L 60 28, L 60 43, L 50 42, Z",
  // Obliques
  obliques: "M 30 27, L 40 28, L 40 43, L 32 42, Q 28 36 30 27 Z M 70 27, L 60 28, L 60 43, L 68 42, Q 72 36 70 27 Z",
  // Quads
  quads: "M 30 47, Q 28 48 26 55, Q 24 64 26 72, Q 30 76 34 74, Q 38 68 38 58, Q 36 50 30 47 Z M 40 47, Q 44 48 46 55, Q 48 62 46 72, Q 42 76 38 74, Q 38 68 38 58, Q 38 50 40 47 Z M 70 47, Q 72 48 74 55, Q 76 64 74 72, Q 70 76 66 74, Q 62 68 62 58, Q 64 50 70 47 Z M 60 47, Q 56 48 54 55, Q 52 62 54 72, Q 58 76 62 74, Q 62 68 62 58, Q 62 50 60 47 Z",
  // Calves (front - tibialis)
  calves: "M 28 80, Q 26 82 25 87, Q 24 92 27 96, Q 30 97 33 95, Q 35 90 34 85, Q 32 81 28 80 Z M 72 80, Q 74 82 75 87, Q 76 92 73 96, Q 70 97 67 95, Q 65 90 66 85, Q 68 81 72 80 Z",
};

// Back view muscle regions
const BACK_REGIONS: Record<string, string> = {
  // Traps
  traps: "M 36 14, Q 50 12 64 14, L 62 22, Q 50 19 38 22, Z",
  // Rear delts
  delts: "M 20 16, Q 14 17 12 21, Q 10 25 14 28, L 22 25, Q 23 20 20 16 Z M 80 16, Q 86 17 88 21, Q 90 25 86 28, L 78 25, Q 77 20 80 16 Z",
  // Lats
  lats: "M 24 23, L 36 22, Q 38 30 36 38, L 28 40, Q 22 34 24 23 Z M 76 23, L 64 22, Q 62 30 64 38, L 72 40, Q 78 34 76 23 Z",
  // Lower back
  lowerBack: "M 38 30, Q 50 28 62 30, L 62 42, Q 50 44 38 42, Z",
  // Triceps
  triceps: "M 10 27, Q 7 30 6 36, Q 6 42 8 45, Q 12 46 15 44, Q 17 39 17 33, Q 16 28 10 27 Z M 90 27, Q 93 30 94 36, Q 94 42 92 45, Q 88 46 85 44, Q 83 39 83 33, Q 84 28 90 27 Z",
  // Forearms (back)
  forearms: "M 8 46, Q 5 48 4 54, Q 3 60 5 64, Q 8 66 11 64, Q 13 59 12 52, Q 11 47 8 46 Z M 92 46, Q 95 48 96 54, Q 97 60 95 64, Q 92 66 89 64, Q 87 59 88 52, Q 89 47 92 46 Z",
  // Glutes
  glutes: "M 32 44, Q 42 42 50 44, Q 50 52 44 56, Q 36 57 32 52, Q 30 48 32 44 Z M 68 44, Q 58 42 50 44, Q 50 52 56 56, Q 64 57 68 52, Q 70 48 68 44 Z",
  // Hamstrings
  hamstrings: "M 28 56, Q 26 58 24 65, Q 22 72 26 78, Q 30 80 34 78, Q 38 72 38 64, Q 36 58 32 56 Z M 42 54, Q 46 56 48 64, Q 48 72 46 78, Q 42 80 38 78, Q 38 72 38 64, Q 38 56 42 54 Z M 72 56, Q 74 58 76 65, Q 78 72 74 78, Q 70 80 66 78, Q 62 72 62 64, Q 64 58 68 56 Z M 58 54, Q 54 56 52 64, Q 52 72 54 78, Q 58 80 62 78, Q 62 72 62 64, Q 62 56 58 54 Z",
  // Calves (rear - gastrocnemius)
  calves: "M 26 82, Q 22 84 22 90, Q 22 96 26 98, Q 30 99 34 97, Q 36 92 35 87, Q 32 82 26 82 Z M 74 82, Q 78 84 78 90, Q 78 96 74 98, Q 70 99 66 97, Q 64 92 65 87, Q 68 82 74 82 Z",
};

const MuscleMap = ({ userId }: MuscleMapProps) => {
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

  const trainedList = useMemo(() => {
    const unique = new Set(Array.from(trainedRegions).map(r => REGION_LABELS[r] || r));
    return Array.from(unique);
  }, [trainedRegions]);

  if (loading) return null;

  const renderOverlay = (regions: Record<string, string>, viewBox: string) => (
    <svg viewBox={viewBox} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
      {Object.entries(regions).map(([region, path]) => (
        trainedRegions.has(region) && (
          <path
            key={region}
            d={path}
            fill="rgba(220, 38, 38, 0.45)"
            stroke="rgba(185, 28, 28, 0.6)"
            strokeWidth={0.3}
            style={{ mixBlendMode: "multiply" }}
          />
        )
      ))}
    </svg>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
      </div>

      <div className="flex gap-3 items-start justify-center">
        {/* Front view */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Framsida</p>
          <div className="relative w-[130px]">
            <img src={muscleFront} alt="Muskulatur framsida" className="w-full h-auto" />
            {renderOverlay(FRONT_REGIONS, "0 0 100 110")}
          </div>
        </div>

        {/* Back view */}
        <div className="flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Baksida</p>
          <div className="relative w-[130px]">
            <img src={muscleBack} alt="Muskulatur baksida" className="w-full h-auto" />
            {renderOverlay(BACK_REGIONS, "0 0 100 110")}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm" style={{ background: "rgba(220, 38, 38, 0.55)" }} />
          <span className="font-medium">Tränad</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-border" style={{ background: "#e5e5e5" }} />
          <span className="font-medium">Ej tränad</span>
        </div>
      </div>

      {/* Trained muscle tags */}
      {trainedList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {trainedList.map(label => (
            <span key={label} className="bg-destructive/15 text-destructive text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">Inga muskler tränade senaste 7 dagarna</p>
      )}
    </div>
  );
};

export default MuscleMap;
