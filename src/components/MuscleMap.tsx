import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exerciseLibrary } from "@/data/exerciseLibrary";
import { Activity } from "lucide-react";

interface MuscleMapProps {
  userId: string;
}

function mapGroupToRegions(group: string): string[] {
  switch (group) {
    case "Bröst": return ["chest"];
    case "Rygg": return ["traps", "lats", "lowerBack"];
    case "Ben": return ["quads", "hamstrings", "calves"];
    case "Rumpa": return ["glutes"];
    case "Axlar": return ["delts"];
    case "Armar": return ["biceps", "triceps", "forearms"];
    case "Core": return ["abs", "obliques"];
    case "Helkropp": return ["chest", "traps", "lats", "quads", "hamstrings", "calves", "delts", "biceps", "abs"];
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

  const trainedList = useMemo(() => Array.from(trainedRegions).map(r => REGION_LABELS[r] || r), [trainedRegions]);

  if (loading) return null;

  const ac = "#dc2626"; // active color - red
  const ic = "#d4d4d4"; // inactive color - light gray
  const ao = "#991b1b"; // active outline
  const io = "#a3a3a3"; // inactive outline
  const skin = "#e8c9a0";
  const skinStroke = "#c9a87c";
  const sw = 0.7;

  const fc = (r: string) => trainedRegions.has(r) ? ac : ic;
  const sc = (r: string) => trainedRegions.has(r) ? ao : io;

  // Muscle fiber lines for realism
  const fibers = (region: string, paths: string[]) => {
    if (!trainedRegions.has(region)) return null;
    return paths.map((d, i) => (
      <path key={i} d={d} fill="none" stroke="#b91c1c" strokeWidth={0.3} opacity={0.4} />
    ));
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
      </div>

      <div className="flex gap-1 items-start">
        {/* ===== FRONT VIEW ===== */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">Framsida</p>
          <svg viewBox="0 0 200 440" className="w-full max-w-[155px]">
            <defs>
              <radialGradient id="skinGrad" cx="50%" cy="30%"><stop offset="0%" stopColor="#f0d4a8"/><stop offset="100%" stopColor={skin}/></radialGradient>
              <radialGradient id="activeGrad" cx="40%" cy="30%"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#b91c1c"/></radialGradient>
              <filter id="muscleShadow"><feDropShadow dx="0" dy="0.5" stdDeviation="0.5" floodOpacity="0.15"/></filter>
            </defs>

            {/* Head */}
            <ellipse cx="100" cy="28" rx="18" ry="22" fill="url(#skinGrad)" stroke={skinStroke} strokeWidth={0.5}/>
            {/* Ears */}
            <ellipse cx="81" cy="28" rx="4" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>
            <ellipse cx="119" cy="28" rx="4" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>

            {/* Neck - Sternocleidomastoid */}
            <path d="M90 48 L86 62 Q100 66 114 62 L110 48" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <path d="M92 50 L88 62" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>
            <path d="M108 50 L112 62" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>

            {/* Trapezius (front/top portion) */}
            <path d="M86 62 Q78 60 66 68 L68 74 Q78 68 88 66Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M114 62 Q122 60 134 68 L132 74 Q122 68 112 66Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Deltoids - anterior */}
            <path d="M64 68 Q52 70 48 82 Q46 92 50 100 Q54 104 60 100 L66 88 Q70 76 64 68Z" fill={fc("delts")} stroke={sc("delts")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M136 68 Q148 70 152 82 Q154 92 150 100 Q146 104 140 100 L134 88 Q130 76 136 68Z" fill={fc("delts")} stroke={sc("delts")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("delts", [
              "M56 76 Q54 84 52 92", "M58 74 Q56 82 54 90",
              "M144 76 Q146 84 148 92", "M142 74 Q144 82 146 90",
            ])}

            {/* Pectoralis Major - Left */}
            <path d="M68 72 Q88 66 100 70 L100 98 Q92 106 78 102 Q68 96 64 86 Q62 78 68 72Z" fill={fc("chest")} stroke={sc("chest")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Pectoralis Major - Right */}
            <path d="M132 72 Q112 66 100 70 L100 98 Q108 106 122 102 Q132 96 136 86 Q138 78 132 72Z" fill={fc("chest")} stroke={sc("chest")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("chest", [
              "M72 78 Q86 76 98 80", "M70 84 Q84 82 98 86",
              "M74 90 Q86 88 98 92", "M78 96 Q88 94 98 96",
              "M128 78 Q114 76 102 80", "M130 84 Q116 82 102 86",
              "M126 90 Q114 88 102 92", "M122 96 Q112 94 102 96",
            ])}

            {/* Serratus Anterior */}
            <path d="M66 92 L72 100 L70 108 L64 102Z" fill={fc("obliques")} stroke={sc("obliques")} strokeWidth={0.4} opacity={0.7}/>
            <path d="M134 92 L128 100 L130 108 L136 102Z" fill={fc("obliques")} stroke={sc("obliques")} strokeWidth={0.4} opacity={0.7}/>

            {/* Rectus Abdominis (6-pack) */}
            <path d="M90 104 L100 102 L100 118 L90 120Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} rx="2" filter="url(#muscleShadow)"/>
            <path d="M100 102 L110 104 L110 120 L100 118Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M89 122 L100 120 L100 136 L89 138Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M100 120 L111 122 L111 138 L100 136Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M88 140 L100 138 L100 154 L88 156Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M100 138 L112 140 L112 156 L100 154Z" fill={fc("abs")} stroke={sc("abs")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Linea alba (center line) */}
            <line x1="100" y1="100" x2="100" y2="160" stroke={sc("abs")} strokeWidth={0.4} opacity={0.5}/>

            {/* External Obliques */}
            <path d="M76 100 L88 104 L87 158 L78 156 Q70 140 72 118 Q74 106 76 100Z" fill={fc("obliques")} stroke={sc("obliques")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M124 100 L112 104 L113 158 L122 156 Q130 140 128 118 Q126 106 124 100Z" fill={fc("obliques")} stroke={sc("obliques")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("obliques", [
              "M78 108 L86 112", "M76 118 L86 124", "M76 130 L86 136", "M76 142 L86 148",
              "M122 108 L114 112", "M124 118 L114 124", "M124 130 L114 136", "M124 142 L114 148",
            ])}

            {/* Biceps Brachii */}
            <path d="M56 100 Q48 102 44 116 Q42 132 44 146 Q48 152 54 150 Q60 142 60 126 Q60 110 56 100Z" fill={fc("biceps")} stroke={sc("biceps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M144 100 Q152 102 156 116 Q158 132 156 146 Q152 152 146 150 Q140 142 140 126 Q140 110 144 100Z" fill={fc("biceps")} stroke={sc("biceps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Bicep peak detail */}
            {fibers("biceps", [
              "M50 110 Q48 124 48 140", "M52 108 Q50 122 50 138",
              "M150 110 Q152 124 152 140", "M148 108 Q150 122 150 138",
            ])}

            {/* Brachioradialis + Forearm flexors */}
            <path d="M44 152 Q38 156 34 172 Q32 192 34 208 Q38 216 44 214 Q50 200 48 180 Q46 162 44 152Z" fill={fc("forearms")} stroke={sc("forearms")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M156 152 Q162 156 166 172 Q168 192 166 208 Q162 216 156 214 Q150 200 152 180 Q154 162 156 152Z" fill={fc("forearms")} stroke={sc("forearms")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Forearm detail */}
            <path d="M48 154 Q44 158 42 170 Q40 186 42 200 Q44 204 46 202" fill="none" stroke={sc("forearms")} strokeWidth={0.3} opacity={0.4}/>
            <path d="M152 154 Q156 158 158 170 Q160 186 158 200 Q156 204 154 202" fill="none" stroke={sc("forearms")} strokeWidth={0.3} opacity={0.4}/>

            {/* Hands */}
            <path d="M32 216 Q28 220 28 228 Q30 236 36 238 Q42 236 44 228 Q44 220 40 216Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <path d="M168 216 Q172 220 172 228 Q170 236 164 238 Q158 236 156 228 Q156 220 160 216Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>

            {/* Hip / Inguinal area */}
            <path d="M80 158 Q100 166 120 158 L118 176 Q100 180 82 176Z" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>

            {/* Rectus Femoris (center quad) */}
            <path d="M82 178 L92 176 Q94 210 94 244 Q92 262 88 268 L80 266 Q76 248 76 220 Q78 196 82 178Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M118 178 L108 176 Q106 210 106 244 Q108 262 112 268 L120 266 Q124 248 124 220 Q122 196 118 178Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Vastus Lateralis (outer quad) */}
            <path d="M76 180 L82 178 Q78 200 76 224 L72 248 Q70 262 72 270 L66 266 Q64 248 64 224 Q66 198 76 180Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M124 180 L118 178 Q122 200 124 224 L128 248 Q130 262 128 270 L134 266 Q136 248 136 224 Q134 198 124 180Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Vastus Medialis (inner quad / teardrop) */}
            <path d="M92 176 Q98 178 100 200 Q100 240 98 260 Q94 272 90 270 L88 268 Q94 250 94 230 Q94 200 92 176Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M108 176 Q102 178 100 200 Q100 240 102 260 Q106 272 110 270 L112 268 Q106 250 106 230 Q106 200 108 176Z" fill={fc("quads")} stroke={sc("quads")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {fibers("quads", [
              "M78 190 Q78 220 76 250", "M84 186 Q84 216 84 246",
              "M122 190 Q122 220 124 250", "M116 186 Q116 216 116 246",
            ])}

            {/* Patella / Kneecap */}
            <ellipse cx="82" cy="276" rx="10" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <ellipse cx="118" cy="276" rx="10" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>

            {/* Tibialis Anterior */}
            <path d="M78 286 Q72 290 70 310 Q68 335 72 358 Q76 366 82 364 Q86 348 84 320 Q82 296 78 286Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M122 286 Q128 290 130 310 Q132 335 128 358 Q124 366 118 364 Q114 348 116 320 Q118 296 122 286Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Peroneus / outer calf front */}
            <path d="M68 290 Q64 295 62 315 Q62 340 66 358 Q68 362 72 360" fill="none" stroke={sc("calves")} strokeWidth={0.5} opacity={0.4}/>
            <path d="M132 290 Q136 295 138 315 Q138 340 134 358 Q132 362 128 360" fill="none" stroke={sc("calves")} strokeWidth={0.5} opacity={0.4}/>

            {/* Shin bone line */}
            <path d="M86 286 Q90 290 90 320 Q88 350 86 362" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>
            <path d="M114 286 Q110 290 110 320 Q112 350 114 362" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>

            {/* Ankle */}
            <ellipse cx="78" cy="368" rx="12" ry="5" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>
            <ellipse cx="122" cy="368" rx="12" ry="5" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>

            {/* Feet */}
            <path d="M66 372 Q62 378 64 386 Q70 392 86 390 Q92 386 90 376 L82 370Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <path d="M134 372 Q138 378 136 386 Q130 392 114 390 Q108 386 110 376 L118 370Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
          </svg>
        </div>

        {/* ===== BACK VIEW ===== */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wider">Baksida</p>
          <svg viewBox="0 0 200 440" className="w-full max-w-[155px]">
            <defs>
              <radialGradient id="skinGradB" cx="50%" cy="30%"><stop offset="0%" stopColor="#f0d4a8"/><stop offset="100%" stopColor={skin}/></radialGradient>
            </defs>

            {/* Head */}
            <ellipse cx="100" cy="28" rx="18" ry="22" fill="url(#skinGradB)" stroke={skinStroke} strokeWidth={0.5}/>
            <ellipse cx="81" cy="28" rx="4" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>
            <ellipse cx="119" cy="28" rx="4" ry="7" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>

            {/* Neck */}
            <path d="M90 48 L86 62 Q100 66 114 62 L110 48" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>

            {/* Trapezius - Full */}
            <path d="M86 58 Q70 56 58 66 L60 78 Q72 72 86 68Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M114 58 Q130 56 142 66 L140 78 Q128 72 114 68Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Mid traps */}
            <path d="M86 68 Q100 64 114 68 L112 88 Q100 84 88 88Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("traps", [
              "M90 66 L80 72", "M92 70 L82 76", "M110 66 L120 72", "M108 70 L118 76",
              "M94 72 Q100 70 106 72", "M94 78 Q100 76 106 78",
            ])}

            {/* Rear Deltoids */}
            <path d="M58 66 Q48 70 44 82 Q42 92 48 100 L62 94 Q66 80 58 66Z" fill={fc("delts")} stroke={sc("delts")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M142 66 Q152 70 156 82 Q158 92 152 100 L138 94 Q134 80 142 66Z" fill={fc("delts")} stroke={sc("delts")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("delts", ["M52 74 Q50 84 50 94", "M148 74 Q150 84 150 94"])}

            {/* Infraspinatus / Teres Major */}
            <path d="M68 80 L88 88 L86 102 Q78 108 68 104 Q62 96 68 80Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M132 80 L112 88 L114 102 Q122 108 132 104 Q138 96 132 80Z" fill={fc("traps")} stroke={sc("traps")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Latissimus Dorsi */}
            <path d="M64 98 L68 80 Q66 96 64 98Z" fill="none"/>
            <path d="M62 96 L72 102 Q76 120 78 140 L72 148 Q64 132 62 112Z" fill={fc("lats")} stroke={sc("lats")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M138 96 L128 102 Q124 120 122 140 L128 148 Q136 132 138 112Z" fill={fc("lats")} stroke={sc("lats")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("lats", [
              "M66 104 Q72 116 74 132", "M68 100 Q74 112 76 128",
              "M134 104 Q128 116 126 132", "M132 100 Q126 112 124 128",
            ])}

            {/* Erector Spinae / Lower Back */}
            <path d="M88 90 L96 88 Q98 110 98 140 L96 156 L88 154 Q86 130 88 90Z" fill={fc("lowerBack")} stroke={sc("lowerBack")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M112 90 L104 88 Q102 110 102 140 L104 156 L112 154 Q114 130 112 90Z" fill={fc("lowerBack")} stroke={sc("lowerBack")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Spine line */}
            <line x1="100" y1="62" x2="100" y2="158" stroke={skinStroke} strokeWidth={0.5} opacity={0.4}/>

            {/* Triceps */}
            <path d="M50 98 Q42 102 40 118 Q38 136 42 150 Q46 156 52 153 Q58 142 58 126 Q58 108 50 98Z" fill={fc("triceps")} stroke={sc("triceps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M150 98 Q158 102 160 118 Q162 136 158 150 Q154 156 148 153 Q142 142 142 126 Q142 108 150 98Z" fill={fc("triceps")} stroke={sc("triceps")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Tricep heads */}
            {fibers("triceps", [
              "M46 106 Q44 122 44 140", "M48 104 Q46 120 46 138",
              "M154 106 Q156 122 156 140", "M152 104 Q154 120 154 138",
              "M50 108 Q48 124 48 142",
              "M150 108 Q152 124 152 142",
            ])}

            {/* Forearms (back - extensors) */}
            <path d="M40 154 Q34 158 32 176 Q30 196 32 212 Q36 220 42 218 Q48 202 46 182 Q44 164 40 154Z" fill={fc("forearms")} stroke={sc("forearms")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M160 154 Q166 158 168 176 Q170 196 168 212 Q164 220 158 218 Q152 202 154 182 Q156 164 160 154Z" fill={fc("forearms")} stroke={sc("forearms")} strokeWidth={sw} filter="url(#muscleShadow)"/>

            {/* Hands */}
            <path d="M30 220 Q26 224 26 232 Q28 240 34 242 Q40 240 42 232 Q42 224 38 220Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <path d="M170 220 Q174 224 174 232 Q172 240 166 242 Q160 240 158 232 Q158 224 162 220Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>

            {/* Gluteus Maximus */}
            <path d="M78 154 Q72 158 70 172 Q70 186 78 192 Q88 198 100 190 L98 158 Q90 152 78 154Z" fill={fc("glutes")} stroke={sc("glutes")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M122 154 Q128 158 130 172 Q130 186 122 192 Q112 198 100 190 L102 158 Q110 152 122 154Z" fill={fc("glutes")} stroke={sc("glutes")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Glute detail lines */}
            {fibers("glutes", [
              "M76 164 Q82 176 86 188", "M80 160 Q86 172 88 184",
              "M124 164 Q118 176 114 188", "M120 160 Q114 172 112 184",
            ])}

            {/* Hamstrings - Biceps Femoris (outer) */}
            <path d="M70 194 Q64 200 62 225 Q62 252 66 270 Q72 280 78 276 Q82 262 82 235 Q80 210 76 194Z" fill={fc("hamstrings")} stroke={sc("hamstrings")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M130 194 Q136 200 138 225 Q138 252 134 270 Q128 280 122 276 Q118 262 118 235 Q120 210 124 194Z" fill={fc("hamstrings")} stroke={sc("hamstrings")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Hamstrings - Semitendinosus (inner) */}
            <path d="M92 192 L82 196 Q82 225 84 255 Q86 272 90 278 Q96 280 100 272 L100 192Z" fill={fc("hamstrings")} stroke={sc("hamstrings")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M108 192 L118 196 Q118 225 116 255 Q114 272 110 278 Q104 280 100 272 L100 192Z" fill={fc("hamstrings")} stroke={sc("hamstrings")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {fibers("hamstrings", [
              "M68 204 Q66 232 68 262", "M74 200 Q74 228 76 258",
              "M132 204 Q134 232 132 262", "M126 200 Q126 228 124 258",
              "M88 200 Q86 230 88 260", "M112 200 Q114 230 112 260",
            ])}

            {/* Back of knee */}
            <path d="M72 278 Q82 286 92 280" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>
            <path d="M128 278 Q118 286 108 280" fill="none" stroke={skinStroke} strokeWidth={0.3} opacity={0.3}/>

            {/* Gastrocnemius (calf) - medial head */}
            <path d="M78 284 Q70 290 68 312 Q68 336 74 356 Q78 362 84 358 Q88 340 86 316 Q84 296 78 284Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            <path d="M122 284 Q130 290 132 312 Q132 336 126 356 Q122 362 116 358 Q112 340 114 316 Q116 296 122 284Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} filter="url(#muscleShadow)"/>
            {/* Gastrocnemius - lateral head */}
            <path d="M86 286 Q92 290 94 310 Q94 334 90 354 L84 358 Q86 340 86 316Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} opacity={0.85}/>
            <path d="M114 286 Q108 290 106 310 Q106 334 110 354 L116 358 Q114 340 114 316Z" fill={fc("calves")} stroke={sc("calves")} strokeWidth={sw} opacity={0.85}/>
            {fibers("calves", [
              "M74 296 Q72 318 74 346", "M78 292 Q76 314 78 342",
              "M126 296 Q128 318 126 346", "M122 292 Q124 314 122 342",
            ])}

            {/* Achilles tendon */}
            <path d="M80 360 Q80 370 80 376" fill="none" stroke={skinStroke} strokeWidth={0.5} opacity={0.4}/>
            <path d="M120 360 Q120 370 120 376" fill="none" stroke={skinStroke} strokeWidth={0.5} opacity={0.4}/>

            {/* Ankle */}
            <ellipse cx="80" cy="372" rx="12" ry="5" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>
            <ellipse cx="120" cy="372" rx="12" ry="5" fill={skin} stroke={skinStroke} strokeWidth={0.3}/>

            {/* Feet */}
            <path d="M68 376 Q64 382 66 390 Q72 396 88 394 Q94 390 92 380 L84 374Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
            <path d="M132 376 Q136 382 134 390 Q128 396 112 394 Q106 390 108 380 L116 374Z" fill={skin} stroke={skinStroke} strokeWidth={0.4}/>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center text-[10px] text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{ background: ac }} />
          <span className="font-medium">Tränad</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-sm border border-border shadow-sm" style={{ background: ic }} />
          <span className="font-medium">Ej tränad</span>
        </div>
      </div>

      {/* Muscle tags */}
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
