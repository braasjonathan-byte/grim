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
    case "Rygg": return ["upperBack", "lats", "lowerBack"];
    case "Ben": return ["quads", "hamstrings", "calves"];
    case "Rumpa": return ["glutes"];
    case "Axlar": return ["frontDelts", "rearDelts"];
    case "Armar": return ["biceps", "triceps", "forearms"];
    case "Core": return ["abs", "obliques"];
    case "Helkropp": return ["chest", "upperBack", "lats", "quads", "hamstrings", "calves", "frontDelts", "biceps", "abs"];
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
  chest: "Bröst",
  upperBack: "Övre rygg",
  lats: "Latissimus",
  lowerBack: "Nedre rygg",
  frontDelts: "Främre axlar",
  rearDelts: "Bakre axlar",
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

const ACTIVE_COLOR = "#ef4444";
const INACTIVE_COLOR = "#e8e8e8";
const OUTLINE_COLOR = "#999";
const ACTIVE_OUTLINE = "#b91c1c";

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
      if (customExercises) {
        for (const ce of customExercises) {
          customMap[ce.name.toLowerCase()] = mapGroupToRegions(ce.muscle_group);
        }
      }

      const planMap = new Map<string, string>();
      if (plans) {
        for (const p of plans) planMap.set(`${p.week}-${p.day}`, p.details);
      }

      const regions = new Set<string>();
      if (completions) {
        for (const c of completions) {
          if (!c.done) continue;
          const details = planMap.get(`${c.week}-${c.day}`);
          if (details) {
            for (const name of extractExerciseNames(details)) {
              const lower = name.toLowerCase();
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] ||
                findPartialMatch(lower, MUSCLE_GROUP_MAP) || findPartialMatch(lower, customMap);
              if (mapped) mapped.forEach(r => regions.add(r));
            }
          }
          if (c.logged_weights && typeof c.logged_weights === "object") {
            for (const key of Object.keys(c.logged_weights as Record<string, any>)) {
              if (key.startsWith("__")) continue;
              const lower = key.toLowerCase();
              const mapped = MUSCLE_GROUP_MAP[lower] || customMap[lower] ||
                findPartialMatch(lower, MUSCLE_GROUP_MAP) || findPartialMatch(lower, customMap);
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

  const trainedList = useMemo(() =>
    Array.from(trainedRegions).map(r => REGION_LABELS[r] || r), [trainedRegions]);

  if (loading) return null;

  const f = (region: string) => trainedRegions.has(region) ? ACTIVE_COLOR : INACTIVE_COLOR;
  const s = (region: string) => trainedRegions.has(region) ? ACTIVE_OUTLINE : OUTLINE_COLOR;
  const sw = 0.6;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold">Tränade muskler (senaste 7 dagarna)</h3>
      </div>

      <div className="flex gap-2 items-start">
        {/* FRONT VIEW */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">Framsida</p>
          <svg viewBox="0 0 220 460" className="w-full max-w-[150px]">
            {/* Head */}
            <ellipse cx="110" cy="32" rx="22" ry="27" fill="#f5deb3" stroke="#bbb" strokeWidth={0.5} />
            {/* Neck */}
            <rect x="101" y="57" width="18" height="16" rx="5" fill="#f5deb3" stroke="#bbb" strokeWidth={0.4} />

            {/* Traps */}
            <path d="M88 65 Q110 58 132 65 L128 73 Q110 68 92 73Z" fill={f("upperBack")} stroke={s("upperBack")} strokeWidth={sw} />

            {/* Front Delts */}
            <path d="M68 78 Q58 76 52 85 Q50 95 56 102 L72 96 Q75 86 68 78Z" fill={f("frontDelts")} stroke={s("frontDelts")} strokeWidth={sw} />
            <path d="M152 78 Q162 76 168 85 Q170 95 164 102 L148 96 Q145 86 152 78Z" fill={f("frontDelts")} stroke={s("frontDelts")} strokeWidth={sw} />

            {/* Chest - Pec Major left */}
            <path d="M72 78 Q90 72 108 76 L108 102 Q95 108 78 104 Q70 98 72 78Z" fill={f("chest")} stroke={s("chest")} strokeWidth={sw} />
            {/* Chest - Pec Major right */}
            <path d="M112 76 Q130 72 148 78 Q150 98 142 104 Q125 108 112 102Z" fill={f("chest")} stroke={s("chest")} strokeWidth={sw} />

            {/* Abs - Rectus Abdominis segments */}
            <rect x="95" y="108" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="112" y="108" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="95" y="123" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="112" y="123" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="95" y="138" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="112" y="138" width="13" height="12" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="96" y="153" width="12" height="10" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />
            <rect x="112" y="153" width="12" height="10" rx="2" fill={f("abs")} stroke={s("abs")} strokeWidth={sw} />

            {/* Obliques */}
            <path d="M80 106 L94 108 L94 162 L82 158 Q76 135 80 106Z" fill={f("obliques")} stroke={s("obliques")} strokeWidth={sw} />
            <path d="M140 106 L126 108 L126 162 L138 158 Q144 135 140 106Z" fill={f("obliques")} stroke={s("obliques")} strokeWidth={sw} />

            {/* Biceps */}
            <path d="M52 105 Q44 104 42 118 Q40 136 44 150 Q48 154 54 152 Q58 140 58 125 Q58 110 52 105Z" fill={f("biceps")} stroke={s("biceps")} strokeWidth={sw} />
            <path d="M168 105 Q176 104 178 118 Q180 136 176 150 Q172 154 166 152 Q162 140 162 125 Q162 110 168 105Z" fill={f("biceps")} stroke={s("biceps")} strokeWidth={sw} />

            {/* Forearms */}
            <path d="M42 155 Q36 156 34 175 Q33 195 36 210 Q40 214 46 212 Q50 195 48 175 Q46 160 42 155Z" fill={f("forearms")} stroke={s("forearms")} strokeWidth={sw} />
            <path d="M178 155 Q184 156 186 175 Q187 195 184 210 Q180 214 174 212 Q170 195 172 175 Q174 160 178 155Z" fill={f("forearms")} stroke={s("forearms")} strokeWidth={sw} />

            {/* Hands */}
            <ellipse cx="36" cy="222" rx="7" ry="10" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
            <ellipse cx="184" cy="222" rx="7" ry="10" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />

            {/* Hip area */}
            <path d="M84 164 Q110 170 136 164 L134 178 Q110 182 86 178Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />

            {/* Quads - Vastus Lateralis + Rectus Femoris + Vastus Medialis */}
            {/* Left quad outer */}
            <path d="M80 180 Q74 182 72 210 Q70 240 74 268 Q78 278 84 276 L84 180Z" fill={f("quads")} stroke={s("quads")} strokeWidth={sw} />
            {/* Left quad inner */}
            <path d="M84 180 L100 182 Q102 220 100 260 Q96 274 90 276 L84 276Z" fill={f("quads")} stroke={s("quads")} strokeWidth={sw} />
            {/* Right quad outer */}
            <path d="M140 180 Q146 182 148 210 Q150 240 146 268 Q142 278 136 276 L136 180Z" fill={f("quads")} stroke={s("quads")} strokeWidth={sw} />
            {/* Right quad inner */}
            <path d="M136 180 L120 182 Q118 220 120 260 Q124 274 130 276 L136 276Z" fill={f("quads")} stroke={s("quads")} strokeWidth={sw} />

            {/* Kneecaps */}
            <ellipse cx="86" cy="284" rx="12" ry="8" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
            <ellipse cx="134" cy="284" rx="12" ry="8" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />

            {/* Calves - Tibialis */}
            <path d="M78 294 Q72 296 72 325 Q73 355 78 370 Q82 374 88 370 Q92 350 90 320 Q88 300 78 294Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />
            <path d="M142 294 Q148 296 148 325 Q147 355 142 370 Q138 374 132 370 Q128 350 130 320 Q132 300 142 294Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />

            {/* Shin area */}
            <path d="M90 296 Q96 298 96 325 Q95 355 92 368 L88 370 Q90 350 90 320Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />
            <path d="M130 296 Q124 298 124 325 Q125 355 128 368 L132 370 Q130 350 130 320Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />

            {/* Feet */}
            <path d="M72 374 Q70 382 72 388 Q80 392 92 390 Q96 386 94 378 L88 372Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
            <path d="M148 374 Q150 382 148 388 Q140 392 128 390 Q124 386 126 378 L132 372Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
          </svg>
        </div>

        {/* BACK VIEW */}
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium">Baksida</p>
          <svg viewBox="0 0 220 460" className="w-full max-w-[150px]">
            {/* Head */}
            <ellipse cx="110" cy="32" rx="22" ry="27" fill="#f5deb3" stroke="#bbb" strokeWidth={0.5} />
            {/* Neck */}
            <rect x="101" y="57" width="18" height="16" rx="5" fill="#f5deb3" stroke="#bbb" strokeWidth={0.4} />

            {/* Traps */}
            <path d="M82 65 Q110 55 138 65 L134 80 Q110 72 86 80Z" fill={f("upperBack")} stroke={s("upperBack")} strokeWidth={sw} />

            {/* Rear Delts */}
            <path d="M68 78 Q56 76 50 86 Q48 96 54 104 L70 98 Q73 88 68 78Z" fill={f("rearDelts")} stroke={s("rearDelts")} strokeWidth={sw} />
            <path d="M152 78 Q164 76 170 86 Q172 96 166 104 L150 98 Q147 88 152 78Z" fill={f("rearDelts")} stroke={s("rearDelts")} strokeWidth={sw} />

            {/* Upper Back / Rhomboids */}
            <path d="M86 80 Q110 74 134 80 L132 105 Q110 100 88 105Z" fill={f("upperBack")} stroke={s("upperBack")} strokeWidth={sw} />

            {/* Lats */}
            <path d="M72 90 L86 85 L88 105 Q85 130 82 145 L72 140 Q65 118 72 90Z" fill={f("lats")} stroke={s("lats")} strokeWidth={sw} />
            <path d="M148 90 L134 85 L132 105 Q135 130 138 145 L148 140 Q155 118 148 90Z" fill={f("lats")} stroke={s("lats")} strokeWidth={sw} />

            {/* Lower Back / Erectors */}
            <path d="M92 108 Q110 102 128 108 L126 155 Q110 160 94 155Z" fill={f("lowerBack")} stroke={s("lowerBack")} strokeWidth={sw} />

            {/* Triceps */}
            <path d="M54 106 Q46 108 44 122 Q42 140 46 154 Q50 158 56 155 Q60 142 60 128 Q60 114 54 106Z" fill={f("triceps")} stroke={s("triceps")} strokeWidth={sw} />
            <path d="M166 106 Q174 108 176 122 Q178 140 174 154 Q170 158 164 155 Q160 142 160 128 Q160 114 166 106Z" fill={f("triceps")} stroke={s("triceps")} strokeWidth={sw} />

            {/* Forearms (back) */}
            <path d="M44 158 Q38 160 36 178 Q35 198 38 214 Q42 218 48 215 Q52 198 50 178 Q48 164 44 158Z" fill={f("forearms")} stroke={s("forearms")} strokeWidth={sw} />
            <path d="M176 158 Q182 160 184 178 Q185 198 182 214 Q178 218 172 215 Q168 198 170 178 Q172 164 176 158Z" fill={f("forearms")} stroke={s("forearms")} strokeWidth={sw} />

            {/* Hands */}
            <ellipse cx="38" cy="224" rx="7" ry="10" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
            <ellipse cx="182" cy="224" rx="7" ry="10" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />

            {/* Glutes */}
            <path d="M82 158 Q78 162 76 178 Q78 192 88 194 Q98 196 108 188 L108 164 Q96 158 82 158Z" fill={f("glutes")} stroke={s("glutes")} strokeWidth={sw} />
            <path d="M138 158 Q142 162 144 178 Q142 192 132 194 Q122 196 112 188 L112 164 Q124 158 138 158Z" fill={f("glutes")} stroke={s("glutes")} strokeWidth={sw} />

            {/* Hamstrings */}
            <path d="M76 196 Q72 200 70 225 Q68 255 72 275 Q78 282 86 280 Q92 270 92 240 Q92 210 88 196Z" fill={f("hamstrings")} stroke={s("hamstrings")} strokeWidth={sw} />
            <path d="M100 190 L92 196 Q92 225 94 255 Q96 272 100 278 Q106 280 108 272 L108 190Z" fill={f("hamstrings")} stroke={s("hamstrings")} strokeWidth={sw} />
            <path d="M144 196 Q148 200 150 225 Q152 255 148 275 Q142 282 134 280 Q128 270 128 240 Q128 210 132 196Z" fill={f("hamstrings")} stroke={s("hamstrings")} strokeWidth={sw} />
            <path d="M120 190 L128 196 Q128 225 126 255 Q124 272 120 278 Q114 280 112 272 L112 190Z" fill={f("hamstrings")} stroke={s("hamstrings")} strokeWidth={sw} />

            {/* Back of knee */}
            <ellipse cx="86" cy="286" rx="12" ry="6" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />
            <ellipse cx="134" cy="286" rx="12" ry="6" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />

            {/* Calves - Gastrocnemius */}
            <path d="M74 292 Q68 296 68 318 Q70 345 76 360 Q80 364 86 362 Q90 346 88 320 Q86 300 80 292Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />
            <path d="M88 292 Q94 296 94 318 Q93 340 90 360 L86 362 Q88 345 88 320Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />
            <path d="M146 292 Q152 296 152 318 Q150 345 144 360 Q140 364 134 362 Q130 346 132 320 Q134 300 140 292Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />
            <path d="M132 292 Q126 296 126 318 Q127 340 130 360 L134 362 Q132 345 132 320Z" fill={f("calves")} stroke={s("calves")} strokeWidth={sw} />

            {/* Achilles / lower leg */}
            <path d="M78 364 Q80 375 82 382 Q86 384 88 380 Q86 370 84 364Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />
            <path d="M142 364 Q140 375 138 382 Q134 384 132 380 Q134 370 136 364Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.2} />

            {/* Feet */}
            <path d="M72 384 Q70 390 72 396 Q80 400 92 398 Q96 394 94 386 L88 382Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
            <path d="M148 384 Q150 390 148 396 Q140 400 128 398 Q124 394 126 386 L132 382Z" fill="#f5deb3" stroke="#bbb" strokeWidth={0.3} />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 justify-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ background: ACTIVE_COLOR }} />
          <span>Tränad</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm border border-border" style={{ background: INACTIVE_COLOR }} />
          <span>Ej tränad</span>
        </div>
      </div>

      {/* Trained muscle tags */}
      {trainedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {trainedList.map(label => (
            <span key={label} className="bg-destructive/15 text-destructive text-[10px] font-medium px-2 py-0.5 rounded-full">
              {label}
            </span>
          ))}
        </div>
      )}
      {trainedList.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Inga muskler tränade senaste 7 dagarna</p>
      )}
    </div>
  );
};

export default MuscleMap;
