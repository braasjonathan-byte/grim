import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Activity } from "lucide-react";
import muscleAnatomy from "@/assets/muscle-anatomy.png";

interface MuscleMapProps {
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

// SVG overlay regions mapped to positions on the anatomy image
// Image is 1400x900 approx, front figure ~left half, back figure ~right half
// Coordinates are in percentage of image dimensions

// Front view muscle overlay paths (percentages mapped to ~700x900 left half)
// Using SVG viewBox 0 0 500 1000 for front, 0 0 500 1000 for back
const FRONT_OVERLAYS: { region: string; d: string }[] = [
  // Delts left
  { region: "delts", d: "M95,175 Q65,165 50,195 Q45,225 60,245 L100,230 Q108,200 95,175Z" },
  // Delts right
  { region: "delts", d: "M305,175 Q335,165 350,195 Q355,225 340,245 L300,230 Q292,200 305,175Z" },
  // Chest left
  { region: "chest", d: "M105,190 Q150,175 200,185 L200,250 Q170,270 130,260 Q100,248 95,225 Q95,205 105,190Z" },
  // Chest right
  { region: "chest", d: "M295,190 Q250,175 200,185 L200,250 Q230,270 270,260 Q300,248 305,225 Q305,205 295,190Z" },
  // Abs
  { region: "abs", d: "M170,260 L200,255 L200,400 L175,405 Q168,340 170,260Z" },
  { region: "abs", d: "M230,260 L200,255 L200,400 L225,405 Q232,340 230,260Z" },
  // Obliques
  { region: "obliques", d: "M130,255 L168,262 Q166,340 172,405 L140,400 Q125,330 130,255Z" },
  { region: "obliques", d: "M270,255 L232,262 Q234,340 228,405 L260,400 Q275,330 270,255Z" },
  // Biceps left
  { region: "biceps", d: "M75,250 Q55,260 45,295 Q40,340 50,370 Q62,385 75,375 Q88,350 88,315 Q88,270 75,250Z" },
  // Biceps right
  { region: "biceps", d: "M325,250 Q345,260 355,295 Q360,340 350,370 Q338,385 325,375 Q312,350 312,315 Q312,270 325,250Z" },
  // Forearms left
  { region: "forearms", d: "M48,380 Q30,395 22,435 Q18,480 25,520 Q35,540 50,530 Q62,505 58,465 Q55,420 48,380Z" },
  // Forearms right
  { region: "forearms", d: "M352,380 Q370,395 378,435 Q382,480 375,520 Q365,540 350,530 Q338,505 342,465 Q345,420 352,380Z" },
  // Quads left outer
  { region: "quads", d: "M140,415 Q120,425 110,470 Q105,530 110,590 Q120,620 140,615 L150,415Z" },
  // Quads left inner
  { region: "quads", d: "M155,415 L195,410 Q198,500 196,580 Q192,615 180,620 L150,620 Q152,520 155,415Z" },
  // Quads right outer
  { region: "quads", d: "M260,415 Q280,425 290,470 Q295,530 290,590 Q280,620 260,615 L250,415Z" },
  // Quads right inner
  { region: "quads", d: "M245,415 L205,410 Q202,500 204,580 Q208,615 220,620 L250,620 Q248,520 245,415Z" },
  // Calves left
  { region: "calves", d: "M115,650 Q100,665 95,710 Q92,760 98,810 Q108,830 125,825 Q140,800 138,750 Q135,695 115,650Z" },
  // Calves right
  { region: "calves", d: "M285,650 Q300,665 305,710 Q308,760 302,810 Q292,830 275,825 Q260,800 262,750 Q265,695 285,650Z" },
];

const BACK_OVERLAYS: { region: string; d: string }[] = [
  // Traps upper
  { region: "traps", d: "M150,145 Q120,130 95,155 L105,190 Q130,175 150,170Z" },
  { region: "traps", d: "M250,145 Q280,130 305,155 L295,190 Q270,175 250,170Z" },
  // Traps mid
  { region: "traps", d: "M150,170 Q200,160 250,170 L245,210 Q200,200 155,210Z" },
  // Rear delts
  { region: "delts", d: "M90,155 Q60,165 48,200 Q45,230 58,250 L100,235 Q108,200 90,155Z" },
  { region: "delts", d: "M310,155 Q340,165 352,200 Q355,230 342,250 L300,235 Q292,200 310,155Z" },
  // Lats left
  { region: "lats", d: "M100,225 L125,235 Q135,290 140,350 L120,370 Q100,310 100,225Z" },
  // Lats right
  { region: "lats", d: "M300,225 L275,235 Q265,290 260,350 L280,370 Q300,310 300,225Z" },
  // Lower back
  { region: "lowerBack", d: "M155,215 L175,210 Q180,280 180,360 L175,385 L155,380 Q150,300 155,215Z" },
  { region: "lowerBack", d: "M245,215 L225,210 Q220,280 220,360 L225,385 L245,380 Q250,300 245,215Z" },
  // Triceps left
  { region: "triceps", d: "M60,248 Q40,260 35,300 Q32,345 40,375 Q52,390 68,380 Q82,360 82,325 Q82,275 60,248Z" },
  // Triceps right
  { region: "triceps", d: "M340,248 Q360,260 365,300 Q368,345 360,375 Q348,390 332,380 Q318,360 318,325 Q318,275 340,248Z" },
  // Forearms
  { region: "forearms", d: "M38,385 Q20,400 15,445 Q12,490 18,535 Q28,555 45,545 Q58,520 55,475 Q52,430 38,385Z" },
  { region: "forearms", d: "M362,385 Q380,400 385,445 Q388,490 382,535 Q372,555 355,545 Q342,520 345,475 Q348,430 362,385Z" },
  // Glutes
  { region: "glutes", d: "M130,380 Q110,395 105,430 Q108,470 130,485 Q160,498 200,480 L200,385 Q165,375 130,380Z" },
  { region: "glutes", d: "M270,380 Q290,395 295,430 Q292,470 270,485 Q240,498 200,480 L200,385 Q235,375 270,380Z" },
  // Hamstrings left
  { region: "hamstrings", d: "M105,490 Q90,505 85,550 Q82,600 88,650 Q100,670 120,665 Q138,645 140,600 Q140,540 125,490Z" },
  { region: "hamstrings", d: "M155,485 L130,492 Q135,560 140,620 Q145,660 155,668 Q170,672 200,658 L200,485Z" },
  // Hamstrings right
  { region: "hamstrings", d: "M295,490 Q310,505 315,550 Q318,600 312,650 Q300,670 280,665 Q262,645 260,600 Q260,540 275,490Z" },
  { region: "hamstrings", d: "M245,485 L270,492 Q265,560 260,620 Q255,660 245,668 Q230,672 200,658 L200,485Z" },
  // Calves left
  { region: "calves", d: "M95,690 Q78,705 74,750 Q72,800 80,850 Q92,870 110,865 Q128,845 126,795 Q124,740 95,690Z" },
  // Calves right
  { region: "calves", d: "M305,690 Q322,705 326,750 Q328,800 320,850 Q308,870 290,865 Q272,845 274,795 Q276,740 305,690Z" },
];

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

  const renderOverlays = (overlays: { region: string; d: string }[], prefix: string) => (
    <>
      {overlays.map(({ region, d }, i) => {
        const isTrained = trainedRegions.has(region);
        if (!isTrained) return null;
        return (
          <path
            key={`${prefix}-${region}-${i}`}
            d={d}
            fill="rgba(220, 38, 38, 0.45)"
            stroke="rgba(220, 38, 38, 0.6)"
            strokeWidth={1}
            style={{ mixBlendMode: "multiply" }}
          />
        );
      })}
    </>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
      </div>

      <div className="relative w-full">
        <img
          src={muscleAnatomy}
          alt="Anatomisk muskelkarta"
          className="w-full h-auto"
          draggable={false}
        />
        {/* Front overlay */}
        <svg
          viewBox="0 0 400 1000"
          className="absolute inset-0 w-1/2 h-full"
          preserveAspectRatio="none"
          style={{ left: 0 }}
        >
          {renderOverlays(FRONT_OVERLAYS, "f")}
        </svg>
        {/* Back overlay */}
        <svg
          viewBox="0 0 400 1000"
          className="absolute inset-0 w-1/2 h-full"
          preserveAspectRatio="none"
          style={{ left: "50%" }}
        >
          {renderOverlays(BACK_OVERLAYS, "b")}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm bg-destructive/60" />
          <span className="font-medium">Tränad</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-border bg-muted" />
          <span className="font-medium">Ej tränad</span>
        </div>
      </div>

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
