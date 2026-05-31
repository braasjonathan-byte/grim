// Triathlon plan generator
// Produces a structured weekly schedule balancing swim/bike/run + optional strength

export type Level = "beginner" | "intermediate" | "advanced";
export type Discipline = "swim" | "bike" | "run" | "strength" | "rest";

export type BikeType = "road" | "mtb" | "gravel" | "tt" | "indoor" | "hybrid";

export interface TriathlonPlanInput {
  goalType: "duration" | "race_date";
  durationWeeks?: number;
  raceDate?: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  swimLevel: Level;
  bikeLevel: Level;
  runLevel: Level;
  bikeType?: BikeType;
  swimKmWeek: number;
  bikeKmWeek: number;
  runKmWeek: number;
  sessionsPerWeek: number; // 3-7
  longSessionDays: string[]; // ["Lör","Sön"]
  includeStrength: boolean;
  strengthSessions?: number; // 0-3 per week
}

export const bikeTypeLabel: Record<BikeType, string> = {
  road: "Landsväg",
  mtb: "MTB",
  gravel: "Gravel",
  tt: "Tempo/TT",
  indoor: "Inomhus/Trainer",
  hybrid: "Hybrid",
};

export interface GeneratedSession {
  week: number;
  day_of_week: string;
  session_date: string;
  discipline: Discipline;
  duration_min: number;
  distance_km: number;
  intensity: string;
  description: string;
  is_long_session: boolean;
}

const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"] as const;

const levelMultiplier: Record<Level, number> = {
  beginner: 0.6,
  intermediate: 1,
  advanced: 1.3,
};

// 4-week mesocycle volume multipliers (3 build + 1 recovery)
const mesoMultiplier = (weekInCycle: number) => {
  if (weekInCycle === 0) return 0.9;
  if (weekInCycle === 1) return 1.0;
  if (weekInCycle === 2) return 1.15;
  return 0.7; // recovery
};

// Speeds (km/h) for distance estimation
const speedKmh: Record<Discipline, number> = {
  swim: 2.4,
  bike: 28,
  run: 9,
  strength: 0,
  rest: 0,
};

const pad = (n: number) => String(n).padStart(2, "0");

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const diffDays = (a: string, b: string) => {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
};

const dayOfWeekIndex = (iso: string): number => {
  // 0 = Mon ... 6 = Sun
  const d = new Date(iso + "T00:00:00Z");
  const js = d.getUTCDay(); // 0 = Sun
  return (js + 6) % 7;
};

const intensityForKind = (kind: "easy" | "tempo" | "interval" | "long" | "recovery" | "strength") => {
  switch (kind) {
    case "easy": return "RPE 4 – lätt pulszon 2";
    case "tempo": return "RPE 6-7 – tempo zon 3";
    case "interval": return "RPE 8-9 – intervaller zon 4-5";
    case "long": return "RPE 4-5 – långpass zon 2";
    case "recovery": return "RPE 3 – återhämtning";
    case "strength": return "Måttlig vikt 3x10";
  }
};

const describeSession = (
  discipline: Discipline,
  kind: "easy" | "tempo" | "interval" | "long" | "recovery" | "strength",
  distanceKm: number,
  durationMin: number,
): string => {
  if (discipline === "rest") return "Vilodag – fokus återhämtning, sömn och näring.";
  if (discipline === "strength") {
    return "Helkroppsstyrka: knäböj, marklyft, push, drag, core. 3 set x 8-12 reps.";
  }
  const disciplineSv = discipline === "swim" ? "simning" : discipline === "bike" ? "cykling" : "löpning";
  if (kind === "long") return `Långpass ${disciplineSv} (~${distanceKm.toFixed(1)} km / ${durationMin} min). Håll jämn låg puls.`;
  if (kind === "tempo") return `Tempopass ${disciplineSv} (${durationMin} min). 10 min uppvärmning, ${Math.max(15, durationMin - 25)} min i tempo, 10 min nedjogg.`;
  if (kind === "interval") return `Intervaller ${disciplineSv}: 6-8 x 2-4 min hårt med 1-2 min vila. Totalt ${durationMin} min.`;
  if (kind === "recovery") return `Återhämtningspass ${disciplineSv} (${durationMin} min) – mycket lätt.`;
  return `Lätt ${disciplineSv} (${durationMin} min). Andas avslappnat.`;
};

export function computeDurationWeeks(input: TriathlonPlanInput): number {
  if (input.goalType === "race_date" && input.raceDate) {
    const days = diffDays(input.startDate, input.raceDate);
    return Math.max(4, Math.min(40, Math.ceil(days / 7)));
  }
  return Math.max(4, Math.min(40, input.durationWeeks ?? 12));
}

/** Build a 7-slot weekly template (one entry per weekday) */
function weeklyTemplate(input: TriathlonPlanInput): Array<{
  discipline: Discipline;
  kind: "easy" | "tempo" | "interval" | "long" | "recovery" | "strength";
}> {
  const sessions = Math.max(3, Math.min(7, input.sessionsPerWeek));
  const longDays = new Set(input.longSessionDays);
  const includeStrength = input.includeStrength;

  // Discipline rotation: swim, bike, run repeating
  const rotation: Discipline[] = ["swim", "bike", "run"];

  // Initialize all as rest
  const week: Array<{ discipline: Discipline; kind: any }> = DAYS.map(() => ({
    discipline: "rest",
    kind: "easy",
  }));

  // 1) Place long sessions on long days (alternating bike/run)
  const longSlots = DAYS.map((d, i) => ({ d, i })).filter(({ d }) => longDays.has(d));
  longSlots.forEach((slot, idx) => {
    const disc: Discipline = idx % 2 === 0 ? "bike" : "run";
    week[slot.i] = { discipline: disc, kind: "long" };
  });

  // 2) Distribute remaining sessions across non-long, non-adjacent days
  const longCount = longSlots.length;
  const remaining = Math.max(0, sessions - longCount);
  const candidateIdx = DAYS.map((_, i) => i).filter(i => !longDays.has(DAYS[i]));
  // Prefer spacing: pick every-other day
  const ordered = [...candidateIdx].sort((a, b) => {
    // Tue (1), Thu (3), Wed (2), Mon (0), Fri (4)
    const priority = [1, 3, 2, 0, 4, 5, 6];
    return priority.indexOf(a) - priority.indexOf(b);
  });

  let r = 0;
  for (let i = 0; i < remaining && i < ordered.length; i++) {
    const slot = ordered[i];
    const disc = rotation[r % rotation.length];
    r++;
    // Vary kind: every 3rd is interval, every 2nd is tempo, else easy
    const kind = i === 0 ? "interval" : i === 1 ? "tempo" : "easy";
    week[slot] = { discipline: disc, kind };
  }

  // 3) Strength: place N sessions on free non-long days, spaced apart
  const strengthCount = input.includeStrength
    ? Math.max(1, Math.min(3, input.strengthSessions ?? 1))
    : (input.strengthSessions ?? 0);
  if (strengthCount > 0) {
    const strengthPriority = [0, 2, 4, 1, 3, 5, 6]; // Mon, Wed, Fri, Tue, Thu, Sat, Sun
    let placed = 0;
    for (const idx of strengthPriority) {
      if (placed >= strengthCount) break;
      if (week[idx].discipline === "rest" && !longDays.has(DAYS[idx])) {
        week[idx] = { discipline: "strength", kind: "strength" };
        placed++;
      }
    }
  }

  return week;
}

export function computeWeeklySessionCount(input: TriathlonPlanInput): { cardio: number; strength: number; total: number } {
  const t = weeklyTemplate(input);
  let cardio = 0, strength = 0;
  t.forEach(s => {
    if (s.discipline === "strength") strength++;
    else if (s.discipline !== "rest") cardio++;
  });
  return { cardio, strength, total: cardio + strength };
}

export function generateSessions(input: TriathlonPlanInput): GeneratedSession[] {
  const totalWeeks = computeDurationWeeks(input);
  const template = weeklyTemplate(input);
  const out: GeneratedSession[] = [];

  // Per-discipline baseline weekly km, level-scaled
  const baseSwim = (input.swimKmWeek || 2) * levelMultiplier[input.swimLevel];
  const baseBike = (input.bikeKmWeek || 40) * levelMultiplier[input.bikeLevel];
  const baseRun = (input.runKmWeek || 15) * levelMultiplier[input.runLevel];

  // Find first Monday on/after start date
  const startDow = dayOfWeekIndex(input.startDate);
  const mondayOffset = -startDow;
  const mondayStart = addDays(input.startDate, mondayOffset);

  for (let w = 0; w < totalWeeks; w++) {
    const weekInCycle = w % 4;
    const isTaper = w === totalWeeks - 1 && totalWeeks >= 6;
    const volMul = isTaper ? 0.5 : mesoMultiplier(weekInCycle);

    // Count discipline sessions this week to split km
    const counts: Record<Discipline, number> = { swim: 0, bike: 0, run: 0, strength: 0, rest: 0 };
    template.forEach(t => counts[t.discipline]++);

    const weekSwimKm = baseSwim * volMul;
    const weekBikeKm = baseBike * volMul;
    const weekRunKm = baseRun * volMul;

    template.forEach((slot, dayIdx) => {
      const date = addDays(mondayStart, w * 7 + dayIdx);
      const dayName = DAYS[dayIdx];
      const { discipline, kind } = slot;

      if (discipline === "rest") {
        out.push({
          week: w + 1,
          day_of_week: dayName,
          session_date: date,
          discipline: "rest",
          duration_min: 0,
          distance_km: 0,
          intensity: "Vila",
          description: describeSession("rest", "easy", 0, 0),
          is_long_session: false,
        });
        return;
      }

      if (discipline === "strength") {
        out.push({
          week: w + 1,
          day_of_week: dayName,
          session_date: date,
          discipline: "strength",
          duration_min: 45,
          distance_km: 0,
          intensity: intensityForKind("strength"),
          description: describeSession("strength", "strength", 0, 45),
          is_long_session: false,
        });
        return;
      }

      const weekKm =
        discipline === "swim" ? weekSwimKm : discipline === "bike" ? weekBikeKm : weekRunKm;
      const cnt = counts[discipline] || 1;
      let distance = weekKm / cnt;
      // Long session gets 50% of weekly volume
      if (kind === "long" && cnt > 1) distance = weekKm * 0.5;

      // Minimum sensible distances
      const minDist = discipline === "swim" ? 0.5 : discipline === "bike" ? 8 : 3;
      distance = Math.max(minDist, distance);

      const durationMin = Math.max(20, Math.round((distance / speedKmh[discipline]) * 60));

      let desc = describeSession(discipline, kind, distance, durationMin);
      if (discipline === "bike" && input.bikeType) {
        desc = `[${bikeTypeLabel[input.bikeType]}] ${desc}`;
      }

      out.push({
        week: w + 1,
        day_of_week: dayName,
        session_date: date,
        discipline,
        duration_min: durationMin,
        distance_km: Math.round(distance * 10) / 10,
        intensity: intensityForKind(kind),
        description: desc,
        is_long_session: kind === "long",
      });
    });
  }

  return out;
}
