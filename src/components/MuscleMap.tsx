import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Activity, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

// Trained = red, untrained = light anatomical gray
const TRAINED = "#dc2626";
const TRAINED_DARK = "#991b1b";
const TRAINED_LIGHT = "#fca5a5";
const BASE = "#e8e5e3";
const BASE_DARK = "#c4c0bc";
const BASE_LIGHT = "#f2f0ee";
const OUTLINE = "#b0aaa4";
const SKIN = "#e8ddd0";
const SKIN_LIGHT = "#f0e6d8";
const SKIN_DARK = "#c4b5a2";

interface MP { region: string; d: string; fibers?: string[] }

const frontPaths: MP[] = [
  // Deltoids
  { region: "delts", d: "M68,82 Q56,78 48,90 Q44,100 50,110 L66,104 Q72,92 68,82Z", fibers: ["M54,86 Q52,96 52,106","M58,84 Q56,94 56,104"] },
  { region: "delts", d: "M132,82 Q144,78 152,90 Q156,100 150,110 L134,104 Q128,92 132,82Z", fibers: ["M146,86 Q148,96 148,106","M142,84 Q144,94 144,104"] },
  // Chest
  { region: "chest", d: "M70,84 Q90,78 100,82 L100,108 Q92,116 78,112 Q66,106 64,96 Q64,88 70,84Z",
    fibers: ["M68,90 Q84,88 98,92","M70,96 Q84,94 98,98","M74,102 Q86,100 98,104","M78,108 Q88,106 98,108"] },
  { region: "chest", d: "M130,84 Q110,78 100,82 L100,108 Q108,116 122,112 Q134,106 136,96 Q136,88 130,84Z",
    fibers: ["M132,90 Q116,88 102,92","M130,96 Q116,94 102,98","M126,102 Q114,100 102,104","M122,108 Q112,106 102,108"] },
  // Abs (six blocks)
  { region: "abs", d: "M90,112 L100,110 L100,124 L90,126Z" },
  { region: "abs", d: "M100,110 L110,112 L110,126 L100,124Z" },
  { region: "abs", d: "M89,128 L100,126 L100,140 L89,142Z" },
  { region: "abs", d: "M100,126 L111,128 L111,142 L100,140Z" },
  { region: "abs", d: "M88,144 L100,142 L100,156 L88,158Z" },
  { region: "abs", d: "M100,142 L112,144 L112,158 L100,156Z" },
  { region: "abs", d: "M88,160 L100,158 L100,168 L89,170Z" },
  { region: "abs", d: "M100,158 L112,160 L111,170 L100,168Z" },
  // Obliques
  { region: "obliques", d: "M76,110 L88,112 L87,170 L78,168 Q72,142 76,110Z",
    fibers: ["M78,118 Q84,122 86,126","M76,130 Q82,134 86,138","M76,146 Q82,150 86,154","M78,160 Q82,164 86,166"] },
  { region: "obliques", d: "M124,110 L112,112 L113,170 L122,168 Q128,142 124,110Z",
    fibers: ["M122,118 Q116,122 114,126","M124,130 Q118,134 114,138","M124,146 Q118,150 114,154","M122,160 Q118,164 114,166"] },
  // Biceps
  { region: "biceps", d: "M54,112 Q46,116 42,130 Q40,148 44,160 Q50,166 56,162 Q62,150 62,136 Q62,120 54,112Z",
    fibers: ["M48,120 Q46,138 48,155","M52,118 Q50,136 52,153"] },
  { region: "biceps", d: "M146,112 Q154,116 158,130 Q160,148 156,160 Q150,166 144,162 Q138,150 138,136 Q138,120 146,112Z",
    fibers: ["M152,120 Q154,138 152,155","M148,118 Q150,136 148,153"] },
  // Forearms
  { region: "forearms", d: "M42,164 Q34,170 30,188 Q28,208 32,224 Q38,230 46,226 Q52,212 50,192 Q48,174 42,164Z" },
  { region: "forearms", d: "M158,164 Q166,170 170,188 Q172,208 168,224 Q162,230 154,226 Q148,212 150,192 Q152,174 158,164Z" },
  // Quads
  { region: "quads", d: "M78,178 Q70,182 66,200 Q62,224 64,248 Q68,260 76,258 L80,178Z",
    fibers: ["M70,188 Q68,212 68,244","M74,186 Q72,210 74,242"] },
  { region: "quads", d: "M82,178 L92,176 Q94,210 94,240 Q92,256 88,258 L80,258 Q80,220 82,178Z" },
  { region: "quads", d: "M94,176 Q100,178 102,198 Q102,230 100,250 Q96,260 90,258 Q94,244 94,220 Q94,194 94,176Z" },
  { region: "quads", d: "M122,178 Q130,182 134,200 Q138,224 136,248 Q132,260 124,258 L120,178Z",
    fibers: ["M130,188 Q132,212 132,244","M126,186 Q128,210 126,242"] },
  { region: "quads", d: "M118,178 L108,176 Q106,210 106,240 Q108,256 112,258 L120,258 Q120,220 118,178Z" },
  { region: "quads", d: "M106,176 Q100,178 98,198 Q98,230 100,250 Q104,260 110,258 Q106,244 106,220 Q106,194 106,176Z" },
  // Calves front
  { region: "calves", d: "M68,274 Q62,280 60,300 Q58,322 62,342 Q68,348 76,344 Q82,326 80,302 Q78,282 68,274Z",
    fibers: ["M64,284 Q62,308 64,336","M70,280 Q68,304 70,332"] },
  { region: "calves", d: "M132,274 Q138,280 140,300 Q142,322 138,342 Q132,348 124,344 Q118,326 120,302 Q122,282 132,274Z",
    fibers: ["M136,284 Q138,308 136,336","M130,280 Q132,304 130,332"] },
];

const backPaths: MP[] = [
  // Traps
  { region: "traps", d: "M86,70 Q68,66 58,78 L62,90 Q74,82 86,80Z", fibers: ["M72,72 Q68,80 64,86"] },
  { region: "traps", d: "M114,70 Q132,66 142,78 L138,90 Q126,82 114,80Z", fibers: ["M128,72 Q132,80 136,86"] },
  { region: "traps", d: "M86,80 Q100,76 114,80 L112,98 Q100,94 88,98Z",
    fibers: ["M92,82 Q100,80 108,82","M92,88 Q100,86 108,88"] },
  { region: "traps", d: "M66,88 L88,96 L86,112 Q78,118 66,114 Q60,106 66,88Z" },
  { region: "traps", d: "M134,88 L112,96 L114,112 Q122,118 134,114 Q140,106 134,88Z" },
  // Rear Delts
  { region: "delts", d: "M56,78 Q44,82 40,94 Q38,104 46,112 L62,106 Q66,92 56,78Z",
    fibers: ["M48,86 Q46,96 48,108","M52,84 Q50,94 52,106"] },
  { region: "delts", d: "M144,78 Q156,82 160,94 Q162,104 154,112 L138,106 Q134,92 144,78Z",
    fibers: ["M152,86 Q154,96 152,108","M148,84 Q150,94 148,106"] },
  // Lats
  { region: "lats", d: "M60,108 L70,112 Q74,132 76,152 L68,160 Q58,140 60,108Z",
    fibers: ["M64,114 Q70,130 72,148","M62,110 Q68,126 70,144"] },
  { region: "lats", d: "M140,108 L130,112 Q126,132 124,152 L132,160 Q142,140 140,108Z",
    fibers: ["M136,114 Q130,130 128,148","M138,110 Q132,126 130,144"] },
  // Lower Back
  { region: "lowerBack", d: "M88,100 L96,98 Q98,120 98,150 L96,166 L88,164 Q86,140 88,100Z" },
  { region: "lowerBack", d: "M112,100 L104,98 Q102,120 102,150 L104,166 L112,164 Q114,140 112,100Z" },
  // Triceps
  { region: "triceps", d: "M48,112 Q38,118 36,134 Q34,152 38,164 Q44,170 52,166 Q58,154 58,138 Q58,122 48,112Z",
    fibers: ["M42,120 Q40,138 42,160","M46,118 Q44,136 46,158","M50,116 Q48,134 50,156"] },
  { region: "triceps", d: "M152,112 Q162,118 164,134 Q166,152 162,164 Q156,170 148,166 Q142,154 142,138 Q142,122 152,112Z",
    fibers: ["M158,120 Q160,138 158,160","M154,118 Q156,136 154,158","M150,116 Q152,134 150,156"] },
  // Forearms
  { region: "forearms", d: "M36,168 Q28,174 26,192 Q24,212 28,228 Q34,234 42,230 Q48,216 46,196 Q44,178 36,168Z" },
  { region: "forearms", d: "M164,168 Q172,174 174,192 Q176,212 172,228 Q166,234 158,230 Q152,216 154,196 Q156,178 164,168Z" },
  // Glutes
  { region: "glutes", d: "M78,164 Q70,170 66,186 Q66,202 78,208 Q90,214 100,204 L100,168 Q90,162 78,164Z",
    fibers: ["M72,174 Q78,188 84,202","M76,170 Q82,184 86,198"] },
  { region: "glutes", d: "M122,164 Q130,170 134,186 Q134,202 122,208 Q110,214 100,204 L100,168 Q110,162 122,164Z",
    fibers: ["M128,174 Q122,188 116,202","M124,170 Q118,184 114,198"] },
  // Hamstrings
  { region: "hamstrings", d: "M64,210 Q58,216 54,238 Q52,262 56,280 Q64,290 72,286 Q80,272 80,246 Q78,222 70,210Z",
    fibers: ["M60,218 Q58,244 60,276","M66,216 Q64,242 66,274"] },
  { region: "hamstrings", d: "M88,206 L76,212 Q78,240 80,264 Q82,282 86,288 Q92,290 100,282 L100,206Z",
    fibers: ["M82,214 Q80,242 82,274","M88,210 Q86,238 88,270"] },
  { region: "hamstrings", d: "M136,210 Q142,216 146,238 Q148,262 144,280 Q136,290 128,286 Q120,272 120,246 Q122,222 130,210Z",
    fibers: ["M140,218 Q142,244 140,276","M134,216 Q136,242 134,274"] },
  { region: "hamstrings", d: "M112,206 L124,212 Q122,240 120,264 Q118,282 114,288 Q108,290 100,282 L100,206Z",
    fibers: ["M118,214 Q120,242 118,274","M112,210 Q114,238 112,270"] },
  // Calves rear
  { region: "calves", d: "M60,296 Q52,302 50,322 Q50,346 56,364 Q62,370 70,366 Q76,350 74,326 Q72,306 60,296Z",
    fibers: ["M56,306 Q54,328 56,356","M62,302 Q60,324 62,352"] },
  { region: "calves", d: "M74,298 Q80,302 82,320 Q82,342 78,360 L70,366 Q74,348 74,326Z" },
  { region: "calves", d: "M140,296 Q148,302 150,322 Q150,346 144,364 Q138,370 130,366 Q124,350 126,326 Q128,306 140,296Z",
    fibers: ["M144,306 Q146,328 144,356","M138,302 Q140,324 138,352"] },
  { region: "calves", d: "M126,298 Q120,302 118,320 Q118,342 122,360 L130,366 Q126,348 126,326Z" },
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

  const REGION_TO_MUSCLE_GROUP: Record<string, string[]> = {
    chest: ["Bröst"], traps: ["Rygg"], lats: ["Rygg"], lowerBack: ["Rygg"],
    delts: ["Axlar"], biceps: ["Armar"], triceps: ["Armar"], forearms: ["Armar"],
    abs: ["Core"], obliques: ["Core"], quads: ["Ben"], hamstrings: ["Ben"],
    glutes: ["Rumpa"], calves: ["Ben"],
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

  const untrainedRegions = useMemo(() => {
    const allRegions = Object.keys(REGION_LABELS);
    return allRegions.filter(r => !trainedRegions.has(r));
  }, [trainedRegions]);

  if (loading) return null;

  const mf = (r: string) => trainedRegions.has(r) ? TRAINED : BASE;
  const ms = (r: string) => trainedRegions.has(r) ? TRAINED_DARK : BASE_DARK;
  const mfl = (r: string) => trainedRegions.has(r) ? TRAINED_LIGHT : BASE_LIGHT;
  const ol = (r: string) => trainedRegions.has(r) ? TRAINED_DARK : OUTLINE;

  const renderPaths = (paths: MP[], prefix: string) => (
    <>
      {paths.map(({ region, d, fibers }, i) => {
        const id = `${prefix}-${region}-${i}`;
        return (
          <g key={id}>
            <defs>
              <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={mfl(region)} />
                <stop offset="50%" stopColor={mf(region)} />
                <stop offset="100%" stopColor={ms(region)} />
              </linearGradient>
            </defs>
            <path d={d} fill={`url(#g-${id})`} stroke={ol(region)} strokeWidth={0.5} strokeLinejoin="round" filter="url(#shadow)" />
            {fibers?.map((fd, fi) => (
              <path key={fi} d={fd} fill="none" stroke={ol(region)} strokeWidth={0.25} opacity={0.3} />
            ))}
          </g>
        );
      })}
    </>
  );

  const svgDefs = (
    <defs>
      <filter id="shadow"><feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodOpacity="0.15" /></filter>
      <radialGradient id="skinG" cx="50%" cy="30%">
        <stop offset="0%" stopColor={SKIN_LIGHT} />
        <stop offset="100%" stopColor={SKIN} />
      </radialGradient>
    </defs>
  );

  const head = (
    <g>
      <ellipse cx="100" cy="30" rx="18" ry="22" fill="url(#skinG)" stroke={SKIN_DARK} strokeWidth={0.4} />
      <ellipse cx="81" cy="30" rx="4" ry="7" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="119" cy="30" rx="4" ry="7" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M90,50 L86,66 Q100,70 114,66 L110,50" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
    </g>
  );

  const body = (
    <g>
      <path d="M80,170 Q100,178 120,170 L118,186 Q100,190 82,186Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="82" cy="266" rx="10" ry="6" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="118" cy="266" rx="10" ry="6" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="72" cy="360" rx="10" ry="4" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="128" cy="360" rx="10" ry="4" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M62,364 Q58,372 62,380 Q70,386 84,384 Q88,378 86,368Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M138,364 Q142,372 138,380 Q130,386 116,384 Q112,378 114,368Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M28,230 Q24,236 26,244 Q30,250 36,248 Q40,242 38,234 Q36,228 28,230Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M172,230 Q176,236 174,244 Q170,250 164,248 Q160,242 162,234 Q164,228 172,230Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
    </g>
  );

  const bodyBack = (
    <g>
      <path d="M62,290 Q74,298 86,292" fill="none" stroke={SKIN_DARK} strokeWidth={0.3} opacity={0.3} />
      <path d="M138,290 Q126,298 114,292" fill="none" stroke={SKIN_DARK} strokeWidth={0.3} opacity={0.3} />
      <ellipse cx="70" cy="378" rx="10" ry="4" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <ellipse cx="130" cy="378" rx="10" ry="4" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M60,382 Q56,388 60,396 Q68,400 82,398 Q86,392 84,384Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M140,382 Q144,388 140,396 Q132,400 118,398 Q114,392 116,384Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M24,234 Q20,240 22,248 Q26,254 32,252 Q36,246 34,238 Q32,232 24,234Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
      <path d="M176,234 Q180,240 178,248 Q174,254 168,252 Q164,246 166,238 Q168,232 176,234Z" fill={SKIN} stroke={SKIN_DARK} strokeWidth={0.3} />
    </g>
  );

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="flex gap-1 items-start justify-center">
            <div className="flex-1 flex flex-col items-center">
              <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">Framsida</p>
              <svg viewBox="0 0 200 400" className="w-full max-w-[155px]">
                {svgDefs}
                {head}
                {renderPaths(frontPaths, "f")}
                {body}
                <line x1="100" y1="110" x2="100" y2="170" stroke={ol("abs")} strokeWidth={0.3} opacity={0.3} />
              </svg>
            </div>
            <div className="flex-1 flex flex-col items-center">
              <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">Baksida</p>
              <svg viewBox="0 0 200 400" className="w-full max-w-[155px]">
                {svgDefs}
                {head}
                {renderPaths(backPaths, "b")}
                {bodyBack}
                <line x1="100" y1="64" x2="100" y2="168" stroke={SKIN_DARK} strokeWidth={0.4} opacity={0.3} />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-center text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm" style={{ background: TRAINED }} />
              <span className="font-medium">Tränad</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm border border-border" style={{ background: BASE }} />
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

          {/* Untrained muscles with exercise suggestions */}
          {untrainedRegions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ej tränade – förslag på övningar</p>
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
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MuscleMap;
