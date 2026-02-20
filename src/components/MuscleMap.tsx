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

// Single SVG overlay covering entire image (viewBox matches image aspect ~1400x860)
// Front figure centered around x=285, back figure around x=1115
const ALL_OVERLAYS: { region: string; d: string }[] = [
  // ===== FRONT VIEW (left figure, center ~285) =====
  // Delts left
  { region: "delts", d: "M195,195 Q170,185 155,210 Q150,235 165,255 L200,240 Q208,215 195,195Z" },
  // Delts right
  { region: "delts", d: "M375,195 Q400,185 415,210 Q420,235 405,255 L370,240 Q362,215 375,195Z" },
  // Chest left
  { region: "chest", d: "M205,205 Q240,192 285,200 L285,260 Q260,278 225,268 Q200,258 195,238 Q195,218 205,205Z" },
  // Chest right
  { region: "chest", d: "M365,205 Q330,192 285,200 L285,260 Q310,278 345,268 Q370,258 375,238 Q375,218 365,205Z" },
  // Abs left
  { region: "abs", d: "M255,270 L285,265 L285,400 L258,405 Q250,340 255,270Z" },
  // Abs right
  { region: "abs", d: "M315,270 L285,265 L285,400 L312,405 Q320,340 315,270Z" },
  // Obliques left
  { region: "obliques", d: "M225,265 L252,272 Q250,340 256,405 L232,400 Q218,335 225,265Z" },
  // Obliques right
  { region: "obliques", d: "M345,265 L318,272 Q320,340 314,405 L338,400 Q352,335 345,265Z" },
  // Biceps left
  { region: "biceps", d: "M168,258 Q148,268 140,300 Q136,340 145,370 Q155,385 168,375 Q180,355 180,320 Q180,280 168,258Z" },
  // Biceps right
  { region: "biceps", d: "M402,258 Q422,268 430,300 Q434,340 425,370 Q415,385 402,375 Q390,355 390,320 Q390,280 402,258Z" },
  // Forearms left
  { region: "forearms", d: "M142,380 Q125,395 118,430 Q114,470 120,510 Q130,528 145,520 Q158,500 154,460 Q150,415 142,380Z" },
  // Forearms right
  { region: "forearms", d: "M428,380 Q445,395 452,430 Q456,470 450,510 Q440,528 425,520 Q412,500 416,460 Q420,415 428,380Z" },
  // Quads left
  { region: "quads", d: "M230,420 Q210,430 200,475 Q195,535 202,595 Q215,625 240,620 Q265,610 270,570 Q275,510 265,460 Q258,425 240,420Z" },
  // Quads right
  { region: "quads", d: "M340,420 Q360,430 370,475 Q375,535 368,595 Q355,625 330,620 Q305,610 300,570 Q295,510 305,460 Q312,425 330,420Z" },
  // Calves left
  { region: "calves", d: "M215,660 Q198,678 194,720 Q190,768 198,815 Q210,838 228,832 Q245,812 242,762 Q238,708 215,660Z" },
  // Calves right
  { region: "calves", d: "M355,660 Q372,678 376,720 Q380,768 372,815 Q360,838 342,832 Q325,812 328,762 Q332,708 355,660Z" },

  // ===== BACK VIEW (right figure, center ~1115) =====
  // Traps upper left
  { region: "traps", d: "M1040,170 Q1010,155 985,175 L998,210 Q1020,195 1040,190Z" },
  // Traps upper right
  { region: "traps", d: "M1190,170 Q1220,155 1245,175 L1232,210 Q1210,195 1190,190Z" },
  // Traps mid
  { region: "traps", d: "M1040,188 Q1115,178 1190,188 L1185,225 Q1115,215 1045,225Z" },
  // Rear delts left
  { region: "delts", d: "M982,178 Q952,188 940,218 Q936,245 952,265 L990,248 Q998,218 982,178Z" },
  // Rear delts right
  { region: "delts", d: "M1248,178 Q1278,188 1290,218 Q1294,245 1278,265 L1240,248 Q1232,218 1248,178Z" },
  // Lats left
  { region: "lats", d: "M990,240 L1020,250 Q1030,310 1035,370 L1012,385 Q992,325 990,240Z" },
  // Lats right
  { region: "lats", d: "M1240,240 L1210,250 Q1200,310 1195,370 L1218,385 Q1238,325 1240,240Z" },
  // Lower back left
  { region: "lowerBack", d: "M1048,228 L1070,222 Q1075,300 1075,375 L1068,398 L1048,392 Q1045,310 1048,228Z" },
  // Lower back right
  { region: "lowerBack", d: "M1182,228 L1160,222 Q1155,300 1155,375 L1162,398 L1182,392 Q1185,310 1182,228Z" },
  // Triceps left
  { region: "triceps", d: "M955,262 Q932,275 928,315 Q925,355 935,385 Q948,400 965,390 Q980,370 980,335 Q980,290 955,262Z" },
  // Triceps right
  { region: "triceps", d: "M1275,262 Q1298,275 1302,315 Q1305,355 1295,385 Q1282,400 1265,390 Q1250,370 1250,335 Q1250,290 1275,262Z" },
  // Forearms left
  { region: "forearms", d: "M932,395 Q912,410 905,450 Q900,495 908,540 Q920,558 938,548 Q952,525 948,480 Q945,430 932,395Z" },
  // Forearms right
  { region: "forearms", d: "M1298,395 Q1318,410 1325,450 Q1330,495 1322,540 Q1310,558 1292,548 Q1278,525 1282,480 Q1285,430 1298,395Z" },
  // Glutes left
  { region: "glutes", d: "M1025,395 Q1002,412 998,448 Q1000,488 1025,505 Q1055,518 1115,498 L1115,400 Q1065,388 1025,395Z" },
  // Glutes right
  { region: "glutes", d: "M1205,395 Q1228,412 1232,448 Q1230,488 1205,505 Q1175,518 1115,498 L1115,400 Q1165,388 1205,395Z" },
  // Hamstrings left outer
  { region: "hamstrings", d: "M1000,510 Q982,528 978,572 Q975,625 982,670 Q995,692 1018,685 Q1038,668 1040,620 Q1040,560 1020,510Z" },
  // Hamstrings left inner
  { region: "hamstrings", d: "M1050,505 L1025,512 Q1035,580 1040,640 Q1045,678 1058,685 Q1075,690 1115,675 L1115,505Z" },
  // Hamstrings right outer
  { region: "hamstrings", d: "M1230,510 Q1248,528 1252,572 Q1255,625 1248,670 Q1235,692 1212,685 Q1192,668 1190,620 Q1190,560 1210,510Z" },
  // Hamstrings right inner
  { region: "hamstrings", d: "M1180,505 L1205,512 Q1195,580 1190,640 Q1185,678 1172,685 Q1155,690 1115,675 L1115,505Z" },
  // Calves left
  { region: "calves", d: "M992,710 Q972,728 968,772 Q965,822 975,868 Q988,890 1008,882 Q1028,862 1025,810 Q1022,755 992,710Z" },
  // Calves right
  { region: "calves", d: "M1238,710 Q1258,728 1262,772 Q1265,822 1255,868 Q1242,890 1222,882 Q1202,862 1205,810 Q1208,755 1238,710Z" },
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
        <svg
          viewBox="0 0 1430 920"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {renderOverlays(ALL_OVERLAYS, "all")}
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
