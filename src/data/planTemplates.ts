export interface FitnessProfile {
  max_distance_km: number | null;
  time_10km_min: number | null;
  experience_level: string | null;
  training_days_per_week: number | null;
}

export type PlanCategory = "styrka" | "löpning" | "cykling" | "simning" | "kampsport" | "kroppsvikt" | "kombination";

export const planCategoryLabels: Record<PlanCategory, string> = {
  styrka: "🏋️ Styrka",
  löpning: "🏃 Löpning",
  cykling: "🚴 Cykling",
  simning: "🏊 Simning",
  kampsport: "🥊 Kampsport",
  kroppsvikt: "🏠 Kroppsvikt",
  kombination: "💪 Kombination",
};

export interface TemplatePlan {
  name: string;
  description: string;
  weeks: number;
  category: PlanCategory;
  /** Which 1RM lifts this program needs. Empty = RPE-based / no calc needed */
  requiredLifts: string[];
  /** Function that generates days given 1RM values and optional fitness profile */
  generateDays?: (rms: Record<string, number>, profile?: FitnessProfile) => TemplatePlanDay[];
  days?: TemplatePlanDay[];
  /** Function that generates days from fitness profile only (no 1RM needed) */
  generateFromProfile?: (profile: FitnessProfile) => TemplatePlanDay[];
}

export interface TemplatePlanDay {
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string;
}

const round = (v: number, step = 2.5) => Math.round(v / step) * step;
const pct = (rm: number, p: number) => round(rm * p);

const ALL_DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

/** Ensure every week has exactly 7 days. Missing days get an empty "Vila" entry. Vila sessions get details cleared. */
export const padWeeksTo7Days = (days: TemplatePlanDay[]): TemplatePlanDay[] => {
  const weeks = new Map<number, Map<string, TemplatePlanDay>>();
  for (const d of days) {
    if (!weeks.has(d.week)) weeks.set(d.week, new Map());
    weeks.get(d.week)!.set(d.day, d);
  }
  const result: TemplatePlanDay[] = [];
  const sortedWeeks = Array.from(weeks.keys()).sort((a, b) => a - b);
  for (const w of sortedWeeks) {
    const weekMap = weeks.get(w)!;
    for (const dayName of ALL_DAYS) {
      const entry = weekMap.get(dayName) || { week: w, day: dayName, session_name: "", details: "", tempo: "" };
      // Clear details for vila/rest sessions so they don't count as workouts
      if (entry.session_name.toLowerCase().includes("vila")) {
        entry.details = "";
      }
      result.push(entry);
    }
  }
  return result;
};

// Helper to generate repeating weekly structure across N weeks
const generateWeeks = (
  weekCount: number,
  dayTemplates: Omit<TemplatePlanDay, "week">[]
): TemplatePlanDay[] => {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= weekCount; w++) {
    for (const d of dayTemplates) {
      days.push({ week: w, ...d });
    }
  }
  return days;
};

// ─── Helper: Calculate pace from 10km time (with weekly improvement) ─────────
const calcPaceForWeek = (time10km: number | null, week: number, totalWeeks: number): { easy: string; threshold: string; long: string } => {
  // Gradually improve pace: ~2-3% faster over the program
  const improvementFactor = 1 - (week - 1) * (0.025 / totalWeeks);
  const baseTime = time10km || 55; // default 55 min for 10km
  const adjustedTime = baseTime * improvementFactor;
  const pacePerKm = adjustedTime / 10;
  const easyPace = pacePerKm + 1.0;
  const thresholdPace = pacePerKm - 0.3;
  const longPace = pacePerKm + 1.2;
  const fmt = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}`;
  const range = (p: number, delta = 0.15) => `${fmt(p - delta)}–${fmt(p + delta)}`;
  return { easy: range(easyPace), threshold: range(thresholdPace), long: range(longPace) };
};

// ─── Helper: Scale distance based on max distance ────────────────────────────
const scaleDistance = (targetKm: number, maxDist: number | null): number => {
  if (!maxDist) return targetKm;
  // Scale proportionally: if user max is 10km and plan says 20km, scale to 10km
  // Use a ratio that caps at the user's max and gradually builds
  const ratio = Math.min(1, maxDist / 20); // 20km is the plan's max
  return Math.max(3, Math.round(targetKm * ratio));
};

// ─── Helper: Adjust RPE based on experience ──────────────────────────────────
const rpeAdjust = (baseRpe: number, experience: string | null): number => {
  if (experience === "nybörjare") return Math.max(5, baseRpe - 1);
  if (experience === "avancerad") return Math.min(10, baseRpe + 0.5);
  return baseRpe;
};

// ─── Original J/W plan (RPE-based, adapts to profile) ───────────────────────
function generateOriginalPlan(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;

  // Base long run distances for weeks 1-12 (progressive with deload)
  const longRunKm = [14, 15, 16, 17, 14, 18, 18, 19, 20, 16, 14, 10];

  const weekPlans: TemplatePlanDay[] = [];
  for (let w = 1; w <= 12; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 12);
    const dist = scaleDistance(longRunKm[w - 1], profile.max_distance_km);
    const isDeload = w === 5 || w >= 10;

    // Progressive RPE: start at base, increase ~0.15 per non-deload week
    const weekRpeBoost = isDeload ? 0 : Math.min(1.5, (w - 1) * 0.15);
    const rpe = (base: number) => Math.min(9.5, rpeAdjust(base + weekRpeBoost, exp)).toFixed(1).replace(".0", "");

    // Progressive sets/reps for strength
    const benchSets = isDeload ? 3 : Math.min(6, 4 + Math.floor((w - 1) / 3));
    const benchReps = isDeload ? 3 : w <= 4 ? 5 : w <= 8 ? 3 : 2;
    const squatSets = isDeload ? 3 : Math.min(5, 3 + Math.floor((w - 1) / 3));
    const squatReps = isDeload ? 3 : w <= 4 ? 3 : w <= 8 ? 2 : 1;

    // Progressive threshold intervals
    const thresholdSets = isDeload ? 2 : Math.min(6, 3 + Math.floor((w - 1) / 2));
    const thresholdMin = isDeload ? 10 : w <= 3 ? 10 : w <= 6 ? 8 : w <= 9 ? 6 : 5;
    const thresholdRest = thresholdMin >= 8 ? "2 min joggvila" : "90 s joggvila";

    weekPlans.push(
      { week: w, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
      {
        week: w, day: "Tis", session_name: "Styrka överkropp + lätt ben",
        details: isDeload
          ? `Deload: Bänk 3×3 @ RPE ${rpe(5.5)}; Lätta böj 2×5 @ RPE ${rpe(5)}; Rörlighet`
          : `Bänk ${benchSets}×${benchReps} @ RPE ${rpe(7)}; Lätta böj 3×5 @ RPE ${rpe(6)}; Rodd/Chins ${Math.min(4, 3 + Math.floor(w / 4))}×8; Axelpress 3×${Math.max(4, 8 - Math.floor(w / 3))}`,
        tempo: "RPE enligt text",
      },
      { week: w, day: "Ons", session_name: "Återhämtning / lätt cykel", details: `${20 + Math.min(15, w)}–${30 + Math.min(10, w)} min cykel + rörlighet 10 min`, tempo: "—" },
      {
        week: w, day: "Tors", session_name: "Tröskellöpning",
        details: isDeload
          ? `Uppvärmning — 10 min\n2×12 min i tröskeltempo (2 min joggvila)\nNedvarvning — 10 min`
          : `Uppvärmning — 10 min\n${thresholdSets}×${thresholdMin} min i tröskeltempo (${thresholdRest})\nNedvarvning — 10 min`,
        tempo: pace.threshold,
      },
      {
        week: w, day: "Fre", session_name: "Vila eller lätt jogg",
        details: isDeload ? `Löpning — 18 min` : `Löpning — ${25 + Math.min(8, w)} min`,
        tempo: pace.easy,
      },
      {
        week: w, day: "Lör", session_name: "Tung styrka ben + mark",
        details: isDeload
          ? `Deload: Böj 3×3 @ RPE ${rpe(5.5)}; Mark 3×2 @ RPE ${rpe(5.5)}; Bål 3×10`
          : `Böj ${squatSets}×${squatReps} @ RPE ${rpe(7)}; Mark ${Math.min(5, 3 + Math.floor(w / 3))}×${squatReps} @ RPE ${rpe(7)}; ${w <= 6 ? `Frontböj 3×3 @ RPE ${rpe(6)}` : `Enbensarbete 3×8`}`,
        tempo: "RPE enligt text",
      },
      { week: w, day: "Sön", session_name: "Långpass", details: `Löpning — ${dist} km`, tempo: pace.long },
    );
  }
  return weekPlans;
}

// ─── Wendler 5/3/1 (4-week cycles × 3 = 12 weeks) ──────────────────────────
function generate531(rms: Record<string, number>): TemplatePlanDay[] {
  const tm = (lift: string) => rms[lift] * 0.9; // Training max = 90% of 1RM
  const days: TemplatePlanDay[] = [];

  // 3 cycles of 4 weeks
  for (let cycle = 0; cycle < 3; cycle++) {
    const base = cycle * 4;
    const bump = cycle * 5; // +5kg per cycle for upper, conceptually

    // Week 1: 5/5/5+
    const w1 = base + 1;
    days.push(
      { week: w1, day: "Mån", session_name: "Militärpress – 5/5/5+", details: `Militärpress: 5×${pct(tm("press"), 0.65)}kg, 5×${pct(tm("press"), 0.75)}kg, 5+×${pct(tm("press"), 0.85)}kg; Chins 5×10; Sidolyft 3×15`, tempo: "65/75/85% av TM" },
      { week: w1, day: "Tis", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w1, day: "Ons", session_name: "Marklyft – 5/5/5+", details: `Marklyft: 5×${pct(tm("marklyft"), 0.65)}kg, 5×${pct(tm("marklyft"), 0.75)}kg, 5+×${pct(tm("marklyft"), 0.85)}kg; Benpress 5×10; Hängande benlyft 3×12`, tempo: "65/75/85% av TM" },
      { week: w1, day: "Tors", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w1, day: "Fre", session_name: "Bänkpress – 5/5/5+", details: `Bänkpress: 5×${pct(tm("bänk"), 0.65)}kg, 5×${pct(tm("bänk"), 0.75)}kg, 5+×${pct(tm("bänk"), 0.85)}kg; Rodd 5×10; Triceps pushdown 3×12`, tempo: "65/75/85% av TM" },
      { week: w1, day: "Lör", session_name: "Knäböj – 5/5/5+", details: `Knäböj: 5×${pct(tm("knäböj"), 0.65)}kg, 5×${pct(tm("knäböj"), 0.75)}kg, 5+×${pct(tm("knäböj"), 0.85)}kg; Rumänsk marklyft 5×10; Planka 3×60s`, tempo: "65/75/85% av TM" },
    );

    // Week 2: 3/3/3+
    const w2 = base + 2;
    days.push(
      { week: w2, day: "Mån", session_name: "Militärpress – 3/3/3+", details: `Militärpress: 3×${pct(tm("press"), 0.70)}kg, 3×${pct(tm("press"), 0.80)}kg, 3+×${pct(tm("press"), 0.90)}kg; Chins 5×10; Sidolyft 3×15`, tempo: "70/80/90% av TM" },
      { week: w2, day: "Tis", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w2, day: "Ons", session_name: "Marklyft – 3/3/3+", details: `Marklyft: 3×${pct(tm("marklyft"), 0.70)}kg, 3×${pct(tm("marklyft"), 0.80)}kg, 3+×${pct(tm("marklyft"), 0.90)}kg; Benpress 5×10; Hängande benlyft 3×12`, tempo: "70/80/90% av TM" },
      { week: w2, day: "Tors", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w2, day: "Fre", session_name: "Bänkpress – 3/3/3+", details: `Bänkpress: 3×${pct(tm("bänk"), 0.70)}kg, 3×${pct(tm("bänk"), 0.80)}kg, 3+×${pct(tm("bänk"), 0.90)}kg; Rodd 5×10; Triceps pushdown 3×12`, tempo: "70/80/90% av TM" },
      { week: w2, day: "Lör", session_name: "Knäböj – 3/3/3+", details: `Knäböj: 3×${pct(tm("knäböj"), 0.70)}kg, 3×${pct(tm("knäböj"), 0.80)}kg, 3+×${pct(tm("knäböj"), 0.90)}kg; Rumänsk marklyft 5×10; Planka 3×60s`, tempo: "70/80/90% av TM" },
    );

    // Week 3: 5/3/1+
    const w3 = base + 3;
    days.push(
      { week: w3, day: "Mån", session_name: "Militärpress – 5/3/1+", details: `Militärpress: 5×${pct(tm("press"), 0.75)}kg, 3×${pct(tm("press"), 0.85)}kg, 1+×${pct(tm("press"), 0.95)}kg; Chins 5×10; Sidolyft 3×15`, tempo: "75/85/95% av TM" },
      { week: w3, day: "Tis", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w3, day: "Ons", session_name: "Marklyft – 5/3/1+", details: `Marklyft: 5×${pct(tm("marklyft"), 0.75)}kg, 3×${pct(tm("marklyft"), 0.85)}kg, 1+×${pct(tm("marklyft"), 0.95)}kg; Benpress 5×10; Hängande benlyft 3×12`, tempo: "75/85/95% av TM" },
      { week: w3, day: "Tors", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w3, day: "Fre", session_name: "Bänkpress – 5/3/1+", details: `Bänkpress: 5×${pct(tm("bänk"), 0.75)}kg, 3×${pct(tm("bänk"), 0.85)}kg, 1+×${pct(tm("bänk"), 0.95)}kg; Rodd 5×10; Triceps pushdown 3×12`, tempo: "75/85/95% av TM" },
      { week: w3, day: "Lör", session_name: "Knäböj – 5/3/1+", details: `Knäböj: 5×${pct(tm("knäböj"), 0.75)}kg, 3×${pct(tm("knäböj"), 0.85)}kg, 1+×${pct(tm("knäböj"), 0.95)}kg; Rumänsk marklyft 5×10; Planka 3×60s`, tempo: "75/85/95% av TM" },
    );

    // Week 4: Deload
    const w4 = base + 4;
    days.push(
      { week: w4, day: "Mån", session_name: "Militärpress – Deload", details: `Militärpress: 5×${pct(tm("press"), 0.40)}kg, 5×${pct(tm("press"), 0.50)}kg, 5×${pct(tm("press"), 0.60)}kg; Lätt assistansarbete`, tempo: "40/50/60% av TM" },
      { week: w4, day: "Tis", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w4, day: "Ons", session_name: "Marklyft – Deload", details: `Marklyft: 5×${pct(tm("marklyft"), 0.40)}kg, 5×${pct(tm("marklyft"), 0.50)}kg, 5×${pct(tm("marklyft"), 0.60)}kg; Lätt assistansarbete`, tempo: "40/50/60% av TM" },
      { week: w4, day: "Tors", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w4, day: "Fre", session_name: "Bänkpress – Deload", details: `Bänkpress: 5×${pct(tm("bänk"), 0.40)}kg, 5×${pct(tm("bänk"), 0.50)}kg, 5×${pct(tm("bänk"), 0.60)}kg; Lätt assistansarbete`, tempo: "40/50/60% av TM" },
      { week: w4, day: "Lör", session_name: "Knäböj – Deload", details: `Knäböj: 5×${pct(tm("knäböj"), 0.40)}kg, 5×${pct(tm("knäböj"), 0.50)}kg, 5×${pct(tm("knäböj"), 0.60)}kg; Lätt assistansarbete`, tempo: "40/50/60% av TM" },
    );
  }

  return days;
}

// ─── Nybörjarprogram – Linjär progression (8v) ──────────────────────────────
function generateBeginner(rms: Record<string, number>): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const pctVal = 0.55 + (w - 1) * 0.035; // 55% → ~80% over 8 weeks
    const p = Math.min(pctVal, 0.82);
    const sq = pct(rms["knäböj"], p);
    const bp = pct(rms["bänk"], p);
    const dl = pct(rms["marklyft"], p);
    const pr = pct(rms["press"], p);

    days.push(
      { week: w, day: "Mån", session_name: "Helkropp A", details: `Knäböj 3×5 @ ${sq}kg; Bänkpress 3×5 @ ${bp}kg; Rodd 3×8`, tempo: `${Math.round(p * 100)}% av 1RM` },
      { week: w, day: "Tis", session_name: "Vila / Kondition", details: "Valfritt: 20–30 min promenad, cykel eller lätt jogg", tempo: "" },
      { week: w, day: "Ons", session_name: "Helkropp B", details: `Knäböj 3×5 @ ${sq}kg; Axelpress 3×5 @ ${pr}kg; Marklyft 1×5 @ ${dl}kg`, tempo: `${Math.round(p * 100)}% av 1RM` },
      { week: w, day: "Tors", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Fre", session_name: "Helkropp A", details: `Knäböj 3×5 @ ${sq}kg; Bänkpress 3×5 @ ${bp}kg; Chins/Latsdrag 3×8`, tempo: `${Math.round(p * 100)}% av 1RM` },
    );
  }
  return days;
}

// ─── Hypertrofi – Överkropp/Underkropp (8v) ─────────────────────────────────
function generateHypertrophy(rms: Record<string, number>): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const p = 0.60 + (w <= 4 ? (w - 1) * 0.025 : (w - 1) * 0.03);
    const pCap = Math.min(p, 0.80);
    const sq = pct(rms["knäböj"], pCap);
    const bp = pct(rms["bänk"], pCap);
    const dl = pct(rms["marklyft"], pCap);
    const pr = pct(rms["press"], pCap);

    days.push(
      { week: w, day: "Mån", session_name: "Överkropp – Styrka", details: `Bänkpress 4×6 @ ${bp}kg; Rodd 4×6; Axelpress 3×8 @ ${pr}kg; Bicepscurl 3×12; Triceps pushdown 3×12`, tempo: `~${Math.round(pCap * 100)}%` },
      { week: w, day: "Tis", session_name: "Underkropp – Styrka", details: `Knäböj 4×6 @ ${sq}kg; Rumänsk marklyft 3×8 @ ${pct(rms["marklyft"], pCap * 0.7)}kg; Benpress 3×10; Vadpress 4×15`, tempo: `~${Math.round(pCap * 100)}%` },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag eller lätt kondition", tempo: "" },
      { week: w, day: "Tors", session_name: "Överkropp – Volym", details: `Incline hantlar 4×10; Kabelrodd 4×10; Sidolyft 4×15; Hammarcurl 3×12; Skallkross 3×12; Face pulls 3×15`, tempo: "Kontrollerat tempo" },
      { week: w, day: "Fre", session_name: "Underkropp – Volym", details: `Frontböj/Goblet squat 3×10 @ ${pct(rms["knäböj"], pCap * 0.6)}kg; Marklyft 3×5 @ ${dl}kg; Bulgarska utfall 3×10/ben; Bencurl 3×12; Hängande benlyft 3×10`, tempo: `~${Math.round(pCap * 100)}%` },
    );
  }
  return days;
}

// ─── Kraftlyft – Tävlingsförberedelse (12v) ─────────────────────────────────
function generatePowerlifting(rms: Record<string, number>): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];

  // Phase 1: Hypertrophy (weeks 1-4) ~65-75%
  for (let w = 1; w <= 4; w++) {
    const p = 0.63 + (w - 1) * 0.03;
    days.push(
      { week: w, day: "Mån", session_name: "Knäböj + Assistans", details: `Knäböj 4×6 @ ${pct(rms["knäböj"], p)}kg; Pausböj 3×4 @ ${pct(rms["knäböj"], p * 0.85)}kg; Benpress 3×10; Bål 3×12`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Tis", session_name: "Bänkpress + Överkropp", details: `Bänkpress 4×6 @ ${pct(rms["bänk"], p)}kg; Close-grip bänk 3×8 @ ${pct(rms["bänk"], p * 0.8)}kg; Rodd 4×8; Sidolyft 3×15`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Tors", session_name: "Marklyft + Ben", details: `Marklyft 4×5 @ ${pct(rms["marklyft"], p)}kg; Rumänsk marklyft 3×8; Bulgarska utfall 3×8/ben; Vadpress 3×15`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Fre", session_name: "Bänk volym + Axlar", details: `Bänkpress 3×8 @ ${pct(rms["bänk"], p * 0.85)}kg; Axelpress 4×8; Chins 4×max; Triceps 3×12`, tempo: "" },
    );
  }

  // Phase 2: Strength (weeks 5-8) ~75-87%
  for (let w = 5; w <= 8; w++) {
    const p = 0.73 + (w - 5) * 0.035;
    days.push(
      { week: w, day: "Mån", session_name: "Knäböj – Tungt", details: `Knäböj 5×3 @ ${pct(rms["knäböj"], p)}kg; Frontböj 3×3 @ ${pct(rms["knäböj"], p * 0.7)}kg; Bål 3×10`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Tis", session_name: "Bänkpress – Tungt", details: `Bänkpress 5×3 @ ${pct(rms["bänk"], p)}kg; Pausbänk 3×2 @ ${pct(rms["bänk"], p * 0.9)}kg; Rodd 4×6`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Tors", session_name: "Marklyft – Tungt", details: `Marklyft 5×2 @ ${pct(rms["marklyft"], p)}kg; Deficit marklyft 3×3 @ ${pct(rms["marklyft"], p * 0.8)}kg; Hyperextension 3×12`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Fre", session_name: "Bänk teknik + Assistans", details: `Bänkpress 4×4 @ ${pct(rms["bänk"], p * 0.85)}kg; Dips 3×max; Latsdrag 3×10; Face pulls 3×15`, tempo: "" },
    );
  }

  // Phase 3: Peaking (weeks 9-10) ~87-95%
  for (let w = 9; w <= 10; w++) {
    const p = 0.85 + (w - 9) * 0.05;
    days.push(
      { week: w, day: "Mån", session_name: "Knäböj – Peaking", details: `Knäböj 4×2 @ ${pct(rms["knäböj"], p)}kg; Pausböj 2×1 @ ${pct(rms["knäböj"], p * 0.95)}kg`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Tis", session_name: "Bänkpress – Peaking", details: `Bänkpress 4×2 @ ${pct(rms["bänk"], p)}kg; Pausbänk 2×1 @ ${pct(rms["bänk"], p * 0.95)}kg`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Tors", session_name: "Marklyft – Peaking", details: `Marklyft 3×2 @ ${pct(rms["marklyft"], p)}kg; Lätt assistans`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Fre", session_name: "Lätt teknik", details: `Bänk 3×3 @ ${pct(rms["bänk"], 0.6)}kg; Knäböj 3×3 @ ${pct(rms["knäböj"], 0.6)}kg – teknikkontroll`, tempo: "60%" },
    );
  }

  // Phase 4: Taper (weeks 11-12)
  for (let w = 11; w <= 12; w++) {
    const p = w === 11 ? 0.80 : 0.60;
    days.push(
      { week: w, day: "Mån", session_name: "Knäböj – Taper", details: `Knäböj ${w === 11 ? "3×2" : "2×2"} @ ${pct(rms["knäböj"], p)}kg`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Tis", session_name: "Bänkpress – Taper", details: `Bänkpress ${w === 11 ? "3×2" : "2×2"} @ ${pct(rms["bänk"], p)}kg`, tempo: `${Math.round(p * 100)}%` },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Tors", session_name: w === 12 ? "Vila" : "Marklyft – Taper", details: w === 12 ? "Full vila inför tävling" : `Marklyft 2×2 @ ${pct(rms["marklyft"], p)}kg`, tempo: w === 12 ? "" : `${Math.round(p * 100)}%` },
      { week: w, day: "Fre", session_name: "Vila", details: w === 12 ? "Tävlingsdag eller vila" : "Vilodag", tempo: "" },
    );
  }

  return days;
}

// ─── Styrka för Nybörjare – Maskiner & Fria vikter (6v) ─────────────────────
function generateMachineStrength(rms: Record<string, number>): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    const p = 0.50 + (w - 1) * 0.04;
    const sq = pct(rms["knäböj"], p);
    const bp = pct(rms["bänk"], p);

    days.push(
      { week: w, day: "Mån", session_name: "Helkropp – Maskin & Fritt", details: `Benpress 3×10; Knäböj 3×8 @ ${sq}kg; Bänkpress 3×8 @ ${bp}kg; Latsdrag 3×10; Axelpress maskin 3×10; Planka 3×30s`, tempo: `~${Math.round(p * 100)}%` },
      { week: w, day: "Ons", session_name: "Helkropp – Maskin & Fritt", details: `Goblet squat 3×10; Bencurl maskin 3×12; Hantelrodd 3×10; Hantelpress 3×10; Sidolyft 3×12; Ab wheel 3×8`, tempo: "" },
      { week: w, day: "Fre", session_name: "Helkropp – Maskin & Fritt", details: `Knäböj 3×8 @ ${sq}kg; Rumänsk marklyft 3×8; Bänkpress 3×8 @ ${bp}kg; Kabelrodd 3×12; Bicepscurl 2×12; Triceps pushdown 2×12`, tempo: `~${Math.round(p * 100)}%` },
    );
  }
  return days;
}

// ─── Löpfokus med profilanpassning ───────────────────────────────────────────
function generateRunningPlan(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  // Progressive long run minutes (with deload week 5)
  const baseLongMinutes = [50, 55, 65, 70, 50, 75, 80, 60];
  // Progressive easy run duration
  const easyRunMin = [35, 38, 40, 42, 35, 45, 45, 40];
  // Progressive threshold duration
  const thresholdMin = [15, 17, 18, 20, 15, 22, 25, 20];
  // Progressive strength reps
  const strengthReps = [8, 8, 10, 10, 8, 10, 12, 10];

  for (let w = 1; w <= 8; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 8);
    const isDeload = w === 5;
    const longMin = profile.max_distance_km
      ? Math.round(baseLongMinutes[w - 1] * Math.min(1, profile.max_distance_km / 15))
      : baseLongMinutes[w - 1];
    const reps = strengthReps[w - 1];

    days.push(
      { week: w, day: "Mån", session_name: "Löpning – Lugn", details: `Löpning — ${easyRunMin[w - 1]} min`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Tis", session_name: "Styrka – Helkropp", details: `Knäböj 3×${reps}; Bänkpress 3×${reps}; Rodd 3×${reps + 2}; Axelpress 3×${reps + 2}; Planka 3×${35 + w * 5}s`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila", details: isDeload ? "Deload-vecka. Vilodag." : "Vilodag. Lätt promenad okej.", tempo: "" },
      { week: w, day: "Tors", session_name: "Löpning – Tröskellopp", details: `Uppvärmning — 15 min\n${thresholdMin[w - 1]} min i tröskeltempo\nNedvarvning — 10 min`, tempo: `${pace.threshold} min/km` },
      { week: w, day: "Fre", session_name: "Styrka – Benstyrka", details: `Marklyft 3×${Math.max(3, 6 - Math.floor(w / 3))}; Benpress 3×${reps + 2}; Hip thrust 3×${reps + 4}; Bencurl 3×12; Core-circuit`, tempo: "" },
      { week: w, day: "Lör", session_name: "Löpning – Långpass", details: `Löpning — ${longMin} min`, tempo: `${pace.long} min/km` },
    );
  }
  return days;
}

// ─── Hemmaträning med anpassning efter dagar & erfarenhet ────────────────────
function generateHomeWorkout(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const daysPerWeek = profile.training_days_per_week || 4;

  // Base reps by experience
  const baseReps = exp === "nybörjare" ? { push: 6, sq: 8, rounds: 3, plank: 25 }
    : exp === "avancerad" ? { push: 12, sq: 16, rounds: 5, plank: 40 }
    : { push: 10, sq: 12, rounds: 4, plank: 35 };

  // Session templates pool – pick based on available days
  const allSessions = (w: number, push: number, sq: number, rounds: number, plank: number, weekBoost: number) => [
    { day: "Mån", session_name: "Styrka – Överkropp", details: `Armhävningar 4×${push}; Diamond push-ups 3×${Math.max(5, push - 4)}; Pike push-ups 3×${push - 2}; Dips (stol) 3×${push - 2}; Planka 3×${plank}s; Superman hold 3×${Math.min(45, 25 + weekBoost * 3)}s`, tempo: `Vecka ${w}/6` },
    { day: "Tis", session_name: "Styrka – Underkropp", details: `Knäböj 4×${sq}; Utfallssteg 3×${Math.round(sq * 0.7)}/ben; Bulgarska utfall (stol) 3×${Math.round(sq * 0.6)}/ben; Hip thrust (golv) 3×${sq}; Vadpress 3×${18 + weekBoost * 2}`, tempo: `Vecka ${w}/6` },
    { day: "Ons", session_name: "HIIT + Core", details: `${rounds} rundor: ${35 + weekBoost * 2}s arbete / ${Math.max(15, 25 - weekBoost * 2)}s vila — Burpees; Mountain climbers; Jump squats; High knees. Vila ${Math.max(60, 120 - weekBoost * 10)}s mellan rundor. Core: Crunches 3×${18 + weekBoost * 2}; Cykelcrunches 3×${14 + weekBoost}; Benlyft 3×${10 + weekBoost}`, tempo: `Vecka ${w}/6` },
    { day: "Tors", session_name: "Helkropp – Volym", details: `Armhävningar 3×max; Knäböj 3×${sq + 5}; Rodd med ryggsäck 3×12; Axelpress (ryggsäck) 3×${8 + weekBoost}; Utfallssteg 2×${8 + weekBoost}/ben; Planka 2×${plank + 10}s`, tempo: `Vecka ${w}/6` },
    { day: "Fre", session_name: "Rörlighet & Core", details: `20 min stretching eller yoga. Fokus på höfter, bröstrygg och axlar. Planka 3×${plank}s; Dead bug 3×10; Sidoplanka 2×${Math.round(plank * 0.6)}s/sida`, tempo: "" },
    { day: "Lör", session_name: "Kondition", details: `${25 + weekBoost * 3} min löpning, cykling eller snabb promenad. Valfri aktivitet med hög puls.`, tempo: "" },
  ];

  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    const weekBoost = w - 1;
    const push = baseReps.push + weekBoost;
    const sq = baseReps.sq + weekBoost * 2;
    const rounds = Math.min(6, baseReps.rounds + Math.floor(weekBoost / 2));
    const plank = baseReps.plank + weekBoost * 5;
    const isDeload = w === 4;

    if (isDeload) {
      // Deload week: lighter sessions, fewer days
      const deloadSessions = [
        { day: "Mån", session_name: "Styrka – Överkropp (lätt)", details: `Armhävningar 3×${Math.round(push * 0.7)}; Pike push-ups 2×${Math.round(push * 0.6)}; Planka 2×${plank}s; Stretching 10 min`, tempo: "Deload" },
        { day: "Ons", session_name: "Styrka – Underkropp (lätt)", details: `Knäböj 3×${Math.round(sq * 0.7)}; Utfallssteg 2×8/ben; Hip thrust (golv) 3×12; Vadpress 2×15`, tempo: "Deload" },
        { day: "Fre", session_name: "Helkropp – Lätt", details: `Armhävningar 2×${Math.round(push * 0.6)}; Knäböj 2×${Math.round(sq * 0.7)}; Planka 2×${plank}s`, tempo: "Deload" },
      ];
      const deloadCount = Math.min(daysPerWeek, deloadSessions.length);
      for (let i = 0; i < deloadCount; i++) {
        days.push({ week: w, ...deloadSessions[i] });
      }
    } else {
      // Pick the right number of sessions from the pool
      const pool = allSessions(w, push, sq, rounds, plank, weekBoost);
      const selected = pool.slice(0, Math.min(daysPerWeek, pool.length));
      for (const s of selected) {
        days.push({ week: w, ...s });
      }
    }
  }
  return days;
}

// ─── Cykling – Uthållighet & Intervaller (8v) ────────────────────────────────
function generateCyclingPlan(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 5;
    const baseMin = exp === "nybörjare" ? 30 : exp === "avancerad" ? 50 : 40;
    const longMin = baseMin + w * 5;
    const intervalMin = isDeload ? 10 : 12 + Math.floor(w / 2) * 2;

    days.push(
      { week: w, day: "Mån", session_name: "Cykling – Lugnt", details: `${baseMin + w * 2} min i lugnt tempo. Fokus på kadens 80–90 rpm.`, tempo: "Zon 2" },
      { week: w, day: "Tis", session_name: "Styrka – Ben & Core", details: `Knäböj 3×${8 + Math.floor(w / 3)}; Utfallssteg 3×10/ben; Bencurl 3×12; Hip thrust 3×12; Planka 3×${30 + w * 5}s`, tempo: "" },
      { week: w, day: "Ons", session_name: isDeload ? "Vila" : "Cykling – Intervaller", details: isDeload ? "Vilodag – deload-vecka" : `15 min uppvärmning; ${Math.floor(intervalMin / 3)}×${3 + Math.floor(w / 3)} min i zon 4 (2 min vila); 10 min nedvarvning`, tempo: isDeload ? "" : "Zon 4" },
      { week: w, day: "Tors", session_name: "Vila / Stretching", details: "Vilodag. 20 min stretching eller yoga.", tempo: "" },
      { week: w, day: "Fre", session_name: "Cykling – Tempokörning", details: `${20 + w * 2} min tempokörning i zon 3. Jämnt och fokuserat.`, tempo: "Zon 3" },
      { week: w, day: "Lör", session_name: "Cykling – Långpass", details: `${isDeload ? Math.round(longMin * 0.7) : longMin} min. Lugnt tempo, bygg uthållighet.`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Simning – Teknik & Uthållighet (6v) ────────────────────────────────────
function generateSwimmingPlan(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  const baseDist = exp === "nybörjare" ? 800 : exp === "avancerad" ? 2000 : 1400;

  for (let w = 1; w <= 6; w++) {
    const dist = baseDist + w * 200;
    const intervalDist = exp === "nybörjare" ? 50 : 100;
    const intervalCount = 4 + Math.floor(w / 2);

    days.push(
      { week: w, day: "Mån", session_name: "Simning – Teknik", details: `200m uppvärmning; 4×${intervalDist}m teknikfokus (crawl); 4×50m kick; 200m nedvarvning. Total: ~${600 + intervalDist * 4}m`, tempo: "Lugnt" },
      { week: w, day: "Tis", session_name: "Styrka – Överkropp & Core", details: `Latsdrag 3×10; Rodd 3×10; Axelpress 3×10; Triceps 3×12; Planka 3×${30 + w * 5}s; Russian twist 3×12`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Tors", session_name: "Simning – Intervaller", details: `300m uppvärmning; ${intervalCount}×${intervalDist}m i hög intensitet (30s vila); 200m nedvarvning`, tempo: "Hög intensitet" },
      { week: w, day: "Fre", session_name: "Styrka – Helkropp", details: `Knäböj 3×10; Marklyft 3×8; Bänkpress 3×10; Chins 3×max; Core-circuit`, tempo: "" },
      { week: w, day: "Lör", session_name: "Simning – Distans", details: `${dist}m sammanhängande simning i jämnt tempo. Fokus uthållighet.`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Kampsport – Styrka & Kondition (8v) ─────────────────────────────────────
function generateMartialArtsPlan(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  const baseRounds = exp === "nybörjare" ? 3 : exp === "avancerad" ? 6 : 4;

  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 5;
    const rounds = isDeload ? baseRounds : baseRounds + Math.floor(w / 2);
    const roundMin = 3;
    const restSec = Math.max(30, 60 - w * 3);

    days.push(
      { week: w, day: "Mån", session_name: "Styrka – Funktionell", details: `Marklyft 4×${isDeload ? 3 : 5}; Knäböj 3×${isDeload ? 5 : 8}; Kettlebell swings 3×15; Pull-ups 3×max; Farmers walk 3×40m`, tempo: "" },
      { week: w, day: "Tis", session_name: "Kondition – Intervaller", details: (() => {
        const runTypes = ["Löpning i uppförsbacke", "Tempointervaller", "Sprintintervaller", "Fartlek", "Trappsprints", "Shuttlerun", "Tempoväxlingar", "Sidoförflyttningar"];
        const runType = runTypes[(w - 1) % runTypes.length];
        return `${rounds} rundor à ${roundMin} min: Skuggboxning/slag+spark-combo. Vila ${restSec}s mellan rundor.\nIntervallöpning: ${runType} ${isDeload ? "3" : Math.min(3 + Math.floor(w / 2), 6)}×${isDeload ? 1 : Math.min(1 + Math.floor(w / 3), 3)} min`;
      })(), tempo: `${roundMin} min rundor` },
      { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "Rörlighetspass 30 min. Höfter, axlar, handleder.", tempo: "" },
      { week: w, day: "Tors", session_name: "Styrka – Explosiv", details: `Box jumps 4×5; Medicinbollskast 3×10; Enbens-knäböj 3×8/ben; Ab wheel 3×10; Planka 3×${35 + w * 5}s`, tempo: "" },
      { week: w, day: "Fre", session_name: "Kondition – HIIT", details: `${rounds} rundor: 30s burpees / 30s mountain climbers / 30s jump squats / ${restSec}s vila. Avsluta med 5 min skipping.`, tempo: "Max intensitet" },
      { week: w, day: "Lör", session_name: "Teknik & Sparring", details: `15 min uppvärmning; ${Math.max(3, rounds - 1)} rundor teknisk sparring/padwork; 10 min stretching`, tempo: "" },
    );
  }
  return days;
}

// ─── Styrka 1 dag/vecka – Helkropp (8v) ─────────────────────────────────────
function generateStrength1Day(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : Math.min(4, 3 + Math.floor(w / 4));
    const reps = isDeload ? 8 : w <= 4 ? 8 : 6;
    days.push({
      week: w, day: "Mån", session_name: isDeload ? "Helkropp – Deload" : "Helkropp – Styrka",
      details: isDeload
        ? `Knäböj 2×8 @ RPE ${r}\nBänkpress 2×8 @ RPE ${r}\nRodd 2×10\nAxelpress 2×10\nPlanka 2×30s`
        : `Knäböj ${sets}×${reps} @ RPE ${r}\nBänkpress ${sets}×${reps} @ RPE ${r}\nRodd ${sets}×${reps + 2}\nAxelpress 3×${reps + 2}\nMarklyft 3×${Math.max(3, reps - 2)} @ RPE ${r}\nBicepscurl 2×12\nTriceps pushdown 2×12\nPlanka 3×${30 + w * 5}s`,
      tempo: isDeload ? "Deload" : `RPE ${r}`,
    });
  }
  return days;
}

// ─── Styrka 2 dagar/vecka – Överkropp/Underkropp (8v) ────────────────────────
function generateStrength2Days(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : Math.min(4, 3 + Math.floor(w / 4));
    const reps = isDeload ? 8 : w <= 4 ? 10 : 8;
    days.push(
      {
        week: w, day: "Mån", session_name: isDeload ? "Överkropp – Deload" : "Överkropp – Styrka",
        details: isDeload
          ? `Bänkpress 2×8 @ RPE ${r}\nRodd 2×10\nAxelpress 2×10\nStretching 10 min`
          : `Bänkpress ${sets}×${reps} @ RPE ${r}\nRodd ${sets}×${reps}\nAxelpress 3×${reps}\nChins 3×max\nSidolyft 3×15\nBicepscurl 3×12\nTriceps pushdown 3×12\nFace pulls 3×15`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Tors", session_name: isDeload ? "Underkropp – Deload" : "Underkropp – Styrka",
        details: isDeload
          ? `Knäböj 2×8 @ RPE ${r}\nRumänsk marklyft 2×8\nPlanka 2×30s`
          : `Knäböj ${sets}×${reps} @ RPE ${r}\nRumänsk marklyft ${sets}×${reps} @ RPE ${r}\nBenpress 3×${reps + 2}\nBencurl 3×12\nHip thrust 3×${reps + 2}\nVadpress 4×15\nHängande benlyft 3×${10 + Math.floor(w / 2)}`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      }
    );
  }
  return days;
}

// ─── Styrka 3 dagar/vecka – Helkropp A/B/C (8v) ─────────────────────────────
function generateStrength3Days(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : Math.min(4, 3 + Math.floor(w / 4));
    const mainReps = isDeload ? 8 : w <= 4 ? 5 : 3;
    const accReps = isDeload ? 10 : 8 + Math.floor(w / 3);
    days.push(
      {
        week: w, day: "Mån", session_name: isDeload ? "Helkropp A – Deload" : "Helkropp A – Knäböj & Press",
        details: isDeload
          ? `Knäböj 2×8 @ RPE ${r}\nBänkpress 2×8 @ RPE ${r}\nRodd 2×10\nPlanka 2×30s`
          : `Knäböj ${sets}×${mainReps} @ RPE ${r}\nBänkpress ${sets}×${mainReps} @ RPE ${r}\nRodd ${sets}×${accReps}\nSidolyft 3×15\nFace pulls 3×15\nPlanka 3×${30 + w * 5}s`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Ons", session_name: isDeload ? "Helkropp B – Deload" : "Helkropp B – Marklyft & Chins",
        details: isDeload
          ? `Marklyft 2×5 @ RPE ${r}\nAxelpress 2×8 @ RPE ${r}\nLatsdrag 2×10`
          : `Marklyft ${sets}×${Math.max(3, mainReps)} @ RPE ${r}\nAxelpress ${sets}×${accReps} @ RPE ${r}\nChins ${sets}×max\nBencurl 3×12\nHip thrust 3×12\nAb wheel 3×${8 + Math.floor(w / 2)}`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Fre", session_name: isDeload ? "Helkropp C – Deload" : "Helkropp C – Volym",
        details: isDeload
          ? `Frontböj/Goblet squat 2×8\nIncline hantelpress 2×10\nStretching 15 min`
          : `Frontböj/Goblet squat 3×${accReps} @ RPE ${(rpe - 1).toFixed(1).replace(".0", "")}\nIncline hantelpress 3×${accReps}\nKabelrodd 3×${accReps + 2}\nBulgarska utfall 3×${accReps}/ben\nBicepscurl 3×12\nTriceps pushdown 3×12\nVadpress 4×15`,
        tempo: isDeload ? "Deload" : `RPE ${(rpe - 1).toFixed(1).replace(".0", "")}`,
      }
    );
  }
  return days;
}

// ─── Styrka 4 dagar/vecka – Överkropp/Underkropp × 2 (8v) ───────────────────
function generateStrength4Days(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const rLow = (rpe - 1).toFixed(1).replace(".0", "");
    const heavySets = isDeload ? 2 : Math.min(5, 3 + Math.floor(w / 3));
    const heavyReps = isDeload ? 8 : w <= 4 ? 5 : 3;
    const volReps = isDeload ? 10 : 10 + Math.floor(w / 3);
    days.push(
      {
        week: w, day: "Mån", session_name: isDeload ? "Överkropp Styrka – Deload" : "Överkropp – Styrka",
        details: isDeload
          ? `Bänkpress 2×8 @ RPE ${r}\nRodd 2×10\nAxelpress 2×10`
          : `Bänkpress ${heavySets}×${heavyReps} @ RPE ${r}\nRodd ${heavySets}×${heavyReps + 2} @ RPE ${r}\nAxelpress 3×${heavyReps + 2} @ RPE ${r}\nChins 3×max\nFace pulls 3×15`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Tis", session_name: isDeload ? "Underkropp Styrka – Deload" : "Underkropp – Styrka",
        details: isDeload
          ? `Knäböj 2×8 @ RPE ${r}\nRumänsk marklyft 2×8\nPlanka 2×30s`
          : `Knäböj ${heavySets}×${heavyReps} @ RPE ${r}\nMarklyft ${heavySets}×${Math.max(2, heavyReps - 1)} @ RPE ${r}\nBenpress 3×${heavyReps + 4}\nBencurl 3×12\nPlanka 3×${30 + w * 5}s`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Tors", session_name: isDeload ? "Överkropp Volym – Deload" : "Överkropp – Volym",
        details: isDeload
          ? `Incline hantelpress 2×10\nKabelrodd 2×10\nSidolyft 2×12`
          : `Incline hantelpress 4×${volReps} @ RPE ${rLow}\nKabelrodd 4×${volReps}\nSidolyft 4×15\nBicepscurl 3×12\nTriceps pushdown 3×12\nSkallkross 3×12`,
        tempo: isDeload ? "Deload" : `RPE ${rLow}`,
      },
      {
        week: w, day: "Fre", session_name: isDeload ? "Underkropp Volym – Deload" : "Underkropp – Volym",
        details: isDeload
          ? `Frontböj 2×8\nHip thrust 2×10\nVadpress 2×15`
          : `Frontböj/Goblet squat 4×${volReps} @ RPE ${rLow}\nHip thrust 4×${volReps}\nBulgarska utfall 3×${volReps}/ben\nVadpress 4×15\nHängande benlyft 3×${10 + Math.floor(w / 2)}`,
        tempo: isDeload ? "Deload" : `RPE ${rLow}`,
      }
    );
  }
  return days;
}

// ─── Styrka 5 dagar/vecka – Push/Pull/Legs/Överkropp/Underkropp (8v) ────────
function generateStrength5Days(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const rLow = (rpe - 1).toFixed(1).replace(".0", "");
    const heavySets = isDeload ? 2 : Math.min(5, 3 + Math.floor(w / 3));
    const heavyReps = isDeload ? 8 : w <= 4 ? 5 : 3;
    const accReps = isDeload ? 10 : 10 + Math.floor(w / 3);
    days.push(
      {
        week: w, day: "Mån", session_name: isDeload ? "Push – Deload" : "Push – Bröst, Axlar & Triceps",
        details: isDeload
          ? `Bänkpress 2×8 @ RPE ${r}\nAxelpress 2×8\nSidolyft 2×12\nTriceps pushdown 2×12`
          : `Bänkpress ${heavySets}×${heavyReps} @ RPE ${r}\nAxelpress ${heavySets}×${heavyReps + 2} @ RPE ${r}\nIncline hantelpress 3×${accReps}\nSidolyft 4×15\nSkallkross 3×12\nTriceps pushdown 3×12\nKabel-flyes 3×15`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Tis", session_name: isDeload ? "Pull – Deload" : "Pull – Rygg & Biceps",
        details: isDeload
          ? `Rodd 2×10\nLatsdrag 2×10\nFace pulls 2×12\nBicepscurl 2×12`
          : `Rodd ${heavySets}×${heavyReps + 2} @ RPE ${r}\nChins ${heavySets}×max\nLatsdrag 3×${accReps}\nFace pulls 3×15\nHammarcurl 3×12\nBicepscurl 3×12\nRear delt flyes 3×15`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Ons", session_name: isDeload ? "Legs – Deload" : "Legs – Knäböj & Marklyft",
        details: isDeload
          ? `Knäböj 2×8 @ RPE ${r}\nRumänsk marklyft 2×8\nBenpress 2×10\nVadpress 2×15`
          : `Knäböj ${heavySets}×${heavyReps} @ RPE ${r}\nMarklyft ${heavySets}×${Math.max(2, heavyReps - 1)} @ RPE ${r}\nBenpress 3×${accReps}\nBencurl 3×12\nVadpress 4×15\nHängande benlyft 3×${10 + Math.floor(w / 2)}`,
        tempo: isDeload ? "Deload" : `RPE ${r}`,
      },
      {
        week: w, day: "Tors", session_name: isDeload ? "Överkropp Volym – Deload" : "Överkropp – Volym & Hypertrofi",
        details: isDeload
          ? `Incline hantelpress 2×10\nKabelrodd 2×10\nSidolyft 2×12`
          : `Incline hantelpress 4×${accReps} @ RPE ${rLow}\nKabelrodd 4×${accReps}\nLateral raise 4×15\nBicepscurl 3×15\nTriceps pushdown 3×15\nFace pulls 3×15\nKabel-flyes 3×${accReps}`,
        tempo: isDeload ? "Deload" : `RPE ${rLow}`,
      },
      {
        week: w, day: "Fre", session_name: isDeload ? "Underkropp Volym – Deload" : "Underkropp – Volym & Hypertrofi",
        details: isDeload
          ? `Frontböj 2×8\nHip thrust 2×10\nVadpress 2×15`
          : `Frontböj/Goblet squat 4×${accReps} @ RPE ${rLow}\nHip thrust 4×${accReps}\nBulgarska utfall 3×${accReps}/ben\nBencurl 3×12\nVadpress 4×20\nAb wheel 3×${8 + Math.floor(w / 2)}`,
        tempo: isDeload ? "Deload" : `RPE ${rLow}`,
      }
    );
  }
  return days;
}

// ─── Seniorträning – Hemma, lätta övningar (6v) ─────────────────────────────
function generateSeniorHomeWorkout(profile: FitnessProfile): TemplatePlanDay[] {
  const daysPerWeek = profile.training_days_per_week || 3;

  const allSessions = (w: number) => {
    const hold = 15 + w * 3; // plank/hold seconds
    const reps = 6 + w;      // base reps, gentle increase
    const chairReps = 8 + w;
    return [
      {
        day: "Mån", session_name: "Balans & Styrka – Underkropp",
        details: `Stol-knäböj ${3}×${chairReps}; Utfallssteg på stället 2×${Math.round(reps * 0.7)}/ben; Vadpress (stående) 3×${chairReps + 4}; Enbensstående balans 2×${hold}s/sida; Sittande bensträck 3×${chairReps}`,
        tempo: `Vecka ${w}/6`,
      },
      {
        day: "Tis", session_name: "Rörlighet & Core",
        details: `Sittande vridning 2×8/sida; Knä-till-bröst (liggande) 2×10; Bäckenlyft 3×${reps}; Dead bug 2×8; Katt/ko-stretch 10 upprepningar; ${Math.min(20, 10 + w * 2)} min lugn stretching`,
        tempo: "",
      },
      {
        day: "Ons", session_name: "Styrka – Överkropp",
        details: `Väggpress (armhävning mot vägg) 3×${reps + 2}; Stolspress (sittande axelpress, lätt eller utan vikt) 3×${reps}; Sittande rodd med band/handduk 3×${reps + 2}; Bicepscurl (vattenflaskor) 2×${reps + 4}; Planka på knä ${2}×${hold}s`,
        tempo: `Vecka ${w}/6`,
      },
      {
        day: "Tors", session_name: "Promenad & Balans",
        details: `${15 + w * 2} min promenad i lugnt tempo; Häl-tå-gång 2×10 steg; Tandemstående 2×${hold}s/sida; Sidosteg 2×10/sida; Stretch 10 min`,
        tempo: "",
      },
      {
        day: "Fre", session_name: "Helkropp – Lätt",
        details: `Stol-knäböj 2×${chairReps}; Väggpress 2×${reps + 2}; Bäckenlyft 2×${reps}; Vadpress 2×${chairReps + 4}; Sittande armlyft 2×${reps}/sida; Stretching 10 min`,
        tempo: `Vecka ${w}/6`,
      },
      {
        day: "Lör", session_name: "Kondition – Lätt",
        details: `${20 + w * 3} min lugn promenad eller lätt cykling. Fokus på att hålla igång utan att bli andfådd.`,
        tempo: "",
      },
    ];
  };

  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    const pool = allSessions(w);
    const selected = pool.slice(0, Math.min(daysPerWeek, pool.length));
    for (const s of selected) {
      days.push({ week: w, ...s });
    }
  }
  return days;
}

// ─── PPL 6 dagar/vecka (8v) ─────────────────────────────────────────────────
function generatePPL6Days(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : Math.min(4, 3 + Math.floor(w / 3));
    const reps = isDeload ? 10 : w <= 4 ? 8 : 6;
    days.push(
      { week: w, day: "Mån", session_name: isDeload ? "Push A – Deload" : "Push A – Tungt", details: isDeload ? `Bänkpress 2×10 @ RPE ${r}\nAxelpress 2×10\nSidolyft 2×15` : `Bänkpress ${sets}×${reps} @ RPE ${r}\nAxelpress ${sets}×${reps + 2} @ RPE ${r}\nIncline hantelpress 3×${reps + 2}\nSidolyft 4×15\nTriceps pushdown 3×12\nSkallkross 3×12`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Tis", session_name: isDeload ? "Pull A – Deload" : "Pull A – Tungt", details: isDeload ? `Rodd 2×10\nLatsdrag 2×10\nBicepscurl 2×12` : `Rodd ${sets}×${reps} @ RPE ${r}\nChins ${sets}×max\nFace pulls 3×15\nHammarcurl 3×12\nBicepscurl 3×12\nRear delt flyes 3×15`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Ons", session_name: isDeload ? "Legs A – Deload" : "Legs A – Tungt", details: isDeload ? `Knäböj 2×8 @ RPE ${r}\nBenpress 2×10\nVadpress 2×15` : `Knäböj ${sets}×${reps} @ RPE ${r}\nRumänsk marklyft ${sets}×${reps + 2} @ RPE ${r}\nBenpress 3×${reps + 4}\nBencurl 3×12\nVadpress 4×15`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Tors", session_name: isDeload ? "Push B – Deload" : "Push B – Volym", details: isDeload ? `Incline hantelpress 2×10\nKabel-flyes 2×12\nSidolyft 2×15` : `Incline hantelpress 4×${reps + 4}\nAxelpress hantlar 3×${reps + 4}\nKabel-flyes 3×15\nSidolyft 4×15\nDips 3×max\nTriceps overhead 3×12`, tempo: isDeload ? "Deload" : `RPE ${(rpe - 1).toFixed(1).replace(".0", "")}` },
      { week: w, day: "Fre", session_name: isDeload ? "Pull B – Deload" : "Pull B – Volym", details: isDeload ? `Kabelrodd 2×10\nLatsdrag 2×10\nBicepscurl 2×12` : `Kabelrodd 4×${reps + 4}\nLatsdrag 4×${reps + 4}\nFace pulls 3×15\nConcentration curl 3×12\nReverse curl 3×12\nShrugs 3×15`, tempo: isDeload ? "Deload" : `RPE ${(rpe - 1).toFixed(1).replace(".0", "")}` },
      { week: w, day: "Lör", session_name: isDeload ? "Legs B – Deload" : "Legs B – Volym", details: isDeload ? `Frontböj 2×8\nHip thrust 2×10\nVadpress 2×15` : `Frontböj 4×${reps + 4}\nHip thrust 4×${reps + 4}\nBulgarska utfall 3×10/ben\nBencurl 3×12\nVadpress 4×20\nHängande benlyft 3×12`, tempo: isDeload ? "Deload" : `RPE ${(rpe - 1).toFixed(1).replace(".0", "")}` },
    );
  }
  return days;
}

// ─── HIIT – Fettförbränning (6v) ────────────────────────────────────────────
function generateHIITFatLoss(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  const baseRounds = exp === "nybörjare" ? 3 : exp === "avancerad" ? 6 : 4;
  for (let w = 1; w <= 6; w++) {
    const isDeload = w === 4;
    const rounds = isDeload ? baseRounds : baseRounds + Math.floor((w - 1) / 2);
    const work = isDeload ? 25 : 30 + w * 2;
    const rest = isDeload ? 30 : Math.max(15, 30 - w * 2);
    days.push(
      { week: w, day: "Mån", session_name: "HIIT – Helkropp", details: `${rounds} rundor: ${work}s arbete / ${rest}s vila\nBurpees; Mountain climbers; Jump squats; High knees\nVila 90s mellan rundor`, tempo: "Max intensitet" },
      { week: w, day: "Tis", session_name: "Styrka – Överkropp", details: `Armhävningar 3×${8 + w}; Rodd med hantlar 3×10; Axelpress 3×10; Planka 3×${30 + w * 5}s; Bicepscurl 2×12`, tempo: "" },
      { week: w, day: "Ons", session_name: "Kondition – Löpintervaller", details: isDeload ? "20 min lugn jogg" : `10 min uppvärmning; ${3 + Math.floor(w / 2)}×${work}s sprint / ${rest + 10}s jogg; 10 min nedvarvning`, tempo: isDeload ? "Lugnt" : "Zon 4–5" },
      { week: w, day: "Tors", session_name: "Vila / Stretching", details: "20 min stretching eller yoga", tempo: "" },
      { week: w, day: "Fre", session_name: "HIIT – Cirkelträning", details: `${rounds} cirklar: Kettlebell swings ${work}s; Box jumps ${work}s; Medicinbollskast ${work}s; Planka ${work}s\nVila ${rest}s mellan övningar, 90s mellan cirklar`, tempo: "Max intensitet" },
      { week: w, day: "Lör", session_name: "Styrka – Underkropp", details: `Knäböj 3×${8 + w}; Utfallssteg 3×10/ben; Hip thrust 3×12; Vadpress 3×15; Hängande benlyft 3×10`, tempo: "" },
    );
  }
  return days;
}

// ─── 5K Nybörjare – Couch to 5K-inspirerad (8v) ────────────────────────────
function generateCouch5K(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  const walkMin = [5, 4, 3, 3, 2, 1, 1, 0];
  const runMin = [1, 2, 3, 4, 5, 7, 10, 15];
  const intervals = [6, 5, 5, 4, 4, 3, 2, 2];
  for (let w = 1; w <= 8; w++) {
    const totalMin = (walkMin[w - 1] + runMin[w - 1]) * intervals[w - 1];
    days.push(
      { week: w, day: "Mån", session_name: "Löpning – Intervaller", details: w <= 6 ? `5 min uppvärmning; ${intervals[w - 1]}×(${runMin[w - 1]} min jogg / ${walkMin[w - 1]} min gång); 5 min nedvarvning\nTotal: ~${totalMin + 10} min` : w === 7 ? "5 min uppvärmning; 20 min sammanhängande jogg; 5 min nedvarvning" : "5 min uppvärmning; 25 min sammanhängande jogg; 5 min nedvarvning", tempo: "Prata-tempo" },
      { week: w, day: "Ons", session_name: "Styrka – Löparstöd", details: `Knäböj 3×${8 + w}; Utfallssteg 2×8/ben; Vadpress 3×15; Bäckenlyft 3×12; Planka 3×${20 + w * 5}s`, tempo: "" },
      { week: w, day: "Fre", session_name: "Löpning – Lugn", details: w <= 4 ? `${15 + w * 3} min gång/jogg i lugnt tempo` : `${20 + w * 2} min sammanhängande lugn jogg`, tempo: "Lugnt – du ska kunna prata" },
    );
  }
  return days;
}

// ─── Halvmaraton – Förberedelse (12v) ───────────────────────────────────────
function generateHalfMarathon(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  const longKm = [10, 12, 14, 12, 16, 14, 18, 16, 20, 18, 14, 21.1];
  for (let w = 1; w <= 12; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 12);
    const dist = profile.max_distance_km ? Math.round(longKm[w - 1] * Math.min(1, profile.max_distance_km / 21)) : longKm[w - 1];
    const isDeload = w === 4 || w === 7 || w === 11;
    const tempoMin = isDeload ? 15 : 15 + Math.floor(w / 2) * 2;
    days.push(
      { week: w, day: "Mån", session_name: "Vila / Promenad", details: "Vilodag eller 20 min promenad", tempo: "" },
      { week: w, day: "Tis", session_name: "Löpning – Lugn", details: `Löpning — ${30 + w} min`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Ons", session_name: "Styrka – Löparben", details: `Knäböj 3×${isDeload ? 8 : 6 + Math.floor(w / 3)}; Hip thrust 3×12; Utfallssteg 3×8/ben; Vadpress 3×15; Planka 3×${30 + w * 3}s`, tempo: "" },
      { week: w, day: "Tors", session_name: "Löpning – Tempo", details: isDeload ? `Löpning — 20 min` : `Uppvärmning — 15 min\n1×${tempoMin} min i tröskeltempo\nNedvarvning — 10 min`, tempo: isDeload ? pace.easy : pace.threshold },
      { week: w, day: "Fre", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Lör", session_name: "Löpning – Lugn kort", details: `Löpning — ${20 + Math.min(w, 8)} min`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Sön", session_name: "Löpning – Långpass", details: `Löpning — ${dist} km`, tempo: `${pace.long} min/km` },
    );
  }
  return days;
}

// ─── Halvmaraton – 6 veckor, 3 pass/vecka ───────────────────────────────────
function generateHalfMarathon6w(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  // Progressive long run: build up to 20 km, then taper
  const longKm = [12, 14, 16, 18, 20, 14];
  // Interval structure per week: sets × minutes
  const intervals: [number, number][] = [[4, 4], [5, 4], [4, 5], [5, 5], [6, 4], [3, 3]];

  for (let w = 1; w <= 6; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 6);
    const dist = profile.max_distance_km
      ? Math.round(longKm[w - 1] * Math.min(1, profile.max_distance_km / 21))
      : longKm[w - 1];
    const isTaper = w === 6;
    const [intSets, intMin] = intervals[w - 1];

    days.push(
      {
        week: w, day: "Tis", session_name: "Löpning – Intervaller",
        details: `Uppvärmning — 15 min\n${intSets}×${intMin} min i tröskeltempo (90 s joggvila)\nNedvarvning — 10 min`,
        tempo: `${pace.threshold} min/km`,
      },
      {
        week: w, day: "Tors", session_name: "Löpning – Lugn",
        details: `Löpning — ${isTaper ? 30 : 35 + w * 2} min`,
        tempo: `${pace.easy} min/km`,
      },
      {
        week: w, day: "Sön", session_name: "Löpning – Långpass",
        details: isTaper
          ? `Löpning — ${dist} km`
          : `Löpning — ${dist} km`,
        tempo: `${pace.long} min/km`,
      },
    );
  }
  return days;
}

// ─── Funktionell Fitness / CrossFit-inspirerad (8v) ─────────────────────────
function generateFunctionalFitness(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  const baseMin = exp === "nybörjare" ? 8 : exp === "avancerad" ? 15 : 12;
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const wodMin = isDeload ? baseMin : baseMin + w;
    const reps = exp === "nybörjare" ? 8 + w : 12 + w;
    days.push(
      { week: w, day: "Mån", session_name: isDeload ? "Styrka – Deload" : "Styrka – Tungt", details: isDeload ? `Knäböj 3×5; Axelpress 3×5; Pull-ups 3×max` : `Knäböj 5×${Math.max(3, 6 - Math.floor(w / 3))}\nAxelpress 5×${Math.max(3, 6 - Math.floor(w / 3))}\nMarklyft 3×${Math.max(2, 5 - Math.floor(w / 3))}\nPull-ups 4×max`, tempo: "" },
      { week: w, day: "Tis", session_name: "WOD – AMRAP", details: `${wodMin} min AMRAP:\n${reps} Kettlebell swings\n${Math.round(reps * 0.7)} Box jumps\n${Math.round(reps * 0.5)} Burpees\nMål: så många rundor som möjligt`, tempo: `${wodMin} min` },
      { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "30 min rörlighet och stretching", tempo: "" },
      { week: w, day: "Tors", session_name: "WOD – For Time", details: isDeload ? `3 rundor:\n10 Armhävningar\n15 Knäböj\n200m löpning` : `5 rundor:\n${reps} Thrusters\n${reps} Pull-ups/Ring rows\n200m löpning\nMål: snabbast möjlig tid`, tempo: "For Time" },
      { week: w, day: "Fre", session_name: "Olympiska lyft + Kondition", details: `Power clean 5×3\nFront squat 4×5\n3 rundor: 10 Push press + 15 Box jumps + 200m rodd/löpning`, tempo: "" },
    );
  }
  return days;
}

// ─── Hinderbanelopp / OCR (8v) ──────────────────────────────────────────────
function generateOCR(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4;
    const gripSec = 20 + w * 5;
    const runMin = exp === "nybörjare" ? 20 + w * 2 : 25 + w * 3;
    days.push(
      { week: w, day: "Mån", session_name: "Styrka – Grepp & Drag", details: `Dead hang ${3}×${gripSec}s; Pull-ups ${3}×max; Farmers walk 3×40m; Rodd 4×8; Kettlebell swings 3×15; Planka 3×${30 + w * 5}s`, tempo: "" },
      { week: w, day: "Tis", session_name: "Löpning – Kuperad terräng", details: isDeload ? "20 min lugn jogg" : `${runMin} min löpning i varierande terräng/lutning`, tempo: "Zon 2–3" },
      { week: w, day: "Ons", session_name: "Vila / Stretching", details: "20 min stretching, fokus höfter och axlar", tempo: "" },
      { week: w, day: "Tors", session_name: "Hinderspecifik – Circuit", details: isDeload ? "Lätt circuit: 3 rundor à 5 övningar" : `${3 + Math.floor(w / 3)} rundor:\nBurpees ×10; Wall climbs ×5; Bear crawl 20m;\nBox jumps ×8; Monkey bars/dead hang ${gripSec}s\nVila 60s mellan rundor`, tempo: "Max intensitet" },
      { week: w, day: "Fre", session_name: "Styrka – Helkropp", details: `Marklyft 4×5; Knäböj 3×8; Axelpress 3×8; Dips 3×max; Sled push/Farmers walk 3×30m`, tempo: "" },
      { week: w, day: "Lör", session_name: "Löpning – Långpass", details: `${isDeload ? 30 : 30 + w * 5} min löpning i lugnt tempo. Bygg uthållighet.`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Bro Split – Kroppsbyggare (8v) ─────────────────────────────────────────
function generateBroSplit(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : 3 + Math.floor(w / 4);
    const reps = isDeload ? 12 : 10 + Math.floor(w / 3);
    days.push(
      { week: w, day: "Mån", session_name: isDeload ? "Bröst – Deload" : "Bröst", details: isDeload ? `Bänkpress 2×10\nIncline hantlar 2×10\nKabel-flyes 2×12` : `Bänkpress ${sets}×${reps} @ RPE ${r}\nIncline hantelpress ${sets}×${reps}\nKabel-flyes 3×15\nDips 3×max\nPec deck 3×15`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Tis", session_name: isDeload ? "Rygg – Deload" : "Rygg", details: isDeload ? `Latsdrag 2×10\nKabelrodd 2×10\nShrugs 2×12` : `Latsdrag ${sets}×${reps}\nKabelrodd ${sets}×${reps}\nEnhandsrodd 3×10\nFace pulls 3×15\nShrugs 3×15\nHyperextension 3×12`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Ons", session_name: isDeload ? "Axlar – Deload" : "Axlar & Bål", details: isDeload ? `Axelpress 2×10\nSidolyft 2×12\nPlanka 2×30s` : `Axelpress ${sets}×${reps} @ RPE ${r}\nSidolyft 4×15\nReverse fly 3×15\nUpright row 3×12\nShrugs 3×15\nHängande benlyft 3×12\nAb wheel 3×10`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Tors", session_name: isDeload ? "Ben – Deload" : "Ben", details: isDeload ? `Knäböj 2×8\nBenpress 2×10\nVadpress 2×15` : `Knäböj ${sets}×${Math.max(6, reps - 2)} @ RPE ${r}\nBenpress ${sets}×${reps}\nRumänsk marklyft 3×10\nBencurl 3×12\nBensträck 3×15\nVadpress 4×20`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Fre", session_name: isDeload ? "Armar – Deload" : "Armar", details: isDeload ? `Bicepscurl 2×12\nTriceps pushdown 2×12\nHammarcurl 2×12` : `Bicepscurl ${sets}×12\nSkallkross ${sets}×12\nHammarcurl 3×12\nTriceps pushdown 3×12\nConcentration curl 3×10\nTriceps overhead 3×12\nUnderarmscurl 3×15`, tempo: isDeload ? "Deload" : `RPE ${r}` },
    );
  }
  return days;
}

// ─── Rygghälsa – Stärk ryggen (6v) ──────────────────────────────────────────
function generateBackHealth(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    const hold = 20 + w * 5;
    const reps = 8 + w;
    days.push(
      { week: w, day: "Mån", session_name: "Core & Stabilitet", details: `Dead bug 3×${reps}; Bird dog 3×${reps}/sida; Planka 3×${hold}s; Sidoplanka 2×${Math.round(hold * 0.6)}s/sida; Bäckenlyft 3×${reps + 4}; Katt/ko-stretch 10 reps`, tempo: "" },
      { week: w, day: "Ons", session_name: "Styrka – Rygg & Höfter", details: `Rodd 3×${reps}; Hyperextension 3×${reps}; Hip thrust 3×${reps + 2}; Face pulls 3×15; Latsdrag 3×${reps + 2}; Pallof press 3×${reps}/sida`, tempo: "" },
      { week: w, day: "Fre", session_name: "Rörlighet & Styrka", details: `Sittande vridning 2×${reps}/sida; Höftböjarstretch 2×30s/sida; Bröstryggsrotation 2×10/sida; Superman hold 3×${hold}s; Knäböj (goblet) 3×${reps}; 15 min stretching`, tempo: "" },
    );
  }
  return days;
}

// ─── Vandring & Bergsförberedelse (8v) ──────────────────────────────────────
function generateHikingPrep(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4;
    const walkMin = isDeload ? 40 : 40 + w * 8;
    const stairMin = isDeload ? 10 : 10 + w * 2;
    days.push(
      { week: w, day: "Mån", session_name: "Styrka – Ben & Core", details: `Knäböj 3×${8 + w}; Utfallssteg med ryggsäck 3×8/ben; Step-ups 3×10/ben; Vadpress 3×15; Planka 3×${30 + w * 5}s; Farmers walk 3×40m`, tempo: "" },
      { week: w, day: "Ons", session_name: "Kondition – Trappmaskin/Backe", details: `${stairMin} min trappmaskin eller backlöpning. ${isDeload ? "Lugnt tempo." : "Successivt ökande intensitet."}`, tempo: isDeload ? "Lugnt" : "Zon 2–3" },
      { week: w, day: "Fre", session_name: "Styrka – Överkropp & Balans", details: `Rodd 3×10; Axelpress 3×10; Pull-ups 3×max; Enbensstående balans 3×30s/sida; Sidosteg med band 3×10/sida; Core-circuit`, tempo: "" },
      { week: w, day: "Lör", session_name: "Vandring – Långpass", details: `${walkMin} min vandring, gärna kuperad terräng.${w >= 5 ? " Bär ryggsäck med 5–10 kg." : ""} Fokus uthållighet.`, tempo: "Lugnt och jämnt" },
    );
  }
  return days;
}

// ─── Calisthenics – Avancerad Kroppsvikt (8v) ───────────────────────────────
function generateCalisthenics(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const reps = exp === "nybörjare" ? 4 + w : exp === "avancerad" ? 8 + w : 6 + w;
    const hold = exp === "nybörjare" ? 10 + w * 3 : exp === "avancerad" ? 20 + w * 5 : 15 + w * 4;
    days.push(
      { week: w, day: "Mån", session_name: isDeload ? "Push – Deload" : "Push – Styrka", details: isDeload ? `Armhävningar 3×${reps}\nDips 2×max\nPike push-ups 2×${Math.round(reps * 0.7)}\nPlanka 2×${hold}s` : `Armhävningar 4×${reps}\nDips 4×max\nPike push-ups 4×${reps}\nDiamond push-ups 3×${Math.max(4, reps - 3)}\nHandstand hold (vägg) 3×${hold}s\nL-sit hold 3×${Math.round(hold * 0.5)}s`, tempo: "" },
      { week: w, day: "Tis", session_name: isDeload ? "Pull – Deload" : "Pull – Styrka", details: isDeload ? `Pull-ups 2×max\nAustralian rows 2×10\nDead hang 2×${hold}s` : `Pull-ups 4×max\nChin-ups 3×max\nAustralian rows 4×${reps + 4}\nDead hang 3×${hold}s\nFront lever progressions 3×${Math.round(hold * 0.4)}s\nBicepscurl (ryggsäck) 3×12`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "30 min stretching, yoga eller lätt promenad", tempo: "" },
      { week: w, day: "Tors", session_name: isDeload ? "Ben – Deload" : "Ben – Styrka", details: isDeload ? `Pistol squat progressions 2×5/ben\nKnäböj 3×12\nBäckenlyft 2×12` : `Pistol squat (progressioner) 4×${Math.max(3, Math.round(reps * 0.5))}/ben\nBulgarska utfall 4×${reps}/ben\nNordic hamstring curl 3×${Math.max(3, reps - 4)}\nExplosiva knäböj 3×${reps}\nVadpress (enbens) 3×15/ben\nHip thrust 3×${reps + 4}`, tempo: "" },
      { week: w, day: "Fre", session_name: isDeload ? "Skills – Deload" : "Skills & Core", details: isDeload ? `Handstand practice 5 min\nPlanka 2×${hold}s\nDead bug 2×10` : `Handstand practice 10 min\nMuscle-up progressioner 5×${Math.max(1, Math.round(reps * 0.3))}\nHuman flag progressioner 3×hold\nPlanche lean 3×${Math.round(hold * 0.5)}s\nDragon flag 3×${Math.max(3, reps - 4)}\nHängande benlyft 3×${reps}`, tempo: "" },
    );
  }
  return days;
}

// ─── Morgonrutin – 30 min snabbpass (6v) ────────────────────────────────────
function generateMorningRoutine(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const daysPerWeek = profile.training_days_per_week || 5;
  const days: TemplatePlanDay[] = [];
  const baseReps = exp === "nybörjare" ? 8 : exp === "avancerad" ? 15 : 12;
  const allSessions = (w: number) => {
    const r = baseReps + w;
    const plank = 25 + w * 5;
    return [
      { day: "Mån", session_name: "30 min – Push & Core", details: `Armhävningar 3×${r}; Dips (stol) 3×${r - 2}; Pike push-ups 3×${Math.max(5, r - 4)}; Planka 3×${plank}s; Mountain climbers 3×${r + 4}; Stretching 3 min`, tempo: "30 min" },
      { day: "Tis", session_name: "30 min – Underkropp", details: `Knäböj 3×${r + 4}; Utfallssteg 3×${r}/ben; Hip thrust 3×${r + 4}; Vadpress 3×20; Sidosteg 2×10/sida; Stretching 3 min`, tempo: "30 min" },
      { day: "Ons", session_name: "30 min – HIIT", details: `4 rundor: 40s arbete / 20s vila\nBurpees; Jump squats; Mountain climbers; High knees; Planka\nVila 60s mellan rundor. Stretching 3 min.`, tempo: "30 min" },
      { day: "Tors", session_name: "30 min – Pull & Core", details: `Australian rows 3×${r}; Superman hold 3×${plank}s; Bird dog 3×${r}/sida; Bicepscurl (ryggsäck) 3×12; Dead bug 3×${r}; Stretching 3 min`, tempo: "30 min" },
      { day: "Fre", session_name: "30 min – Helkropp", details: `Armhävningar 2×${r}; Knäböj 2×${r + 4}; Rodd (ryggsäck) 2×${r}; Utfallssteg 2×${r}/ben; Planka 2×${plank}s; Burpees 2×8; Stretching 3 min`, tempo: "30 min" },
      { day: "Lör", session_name: "30 min – Kondition & Rörlighet", details: `15 min löpning/snabb promenad; 15 min yoga/stretching. Fokus höfter, axlar och bröstrygg.`, tempo: "30 min" },
    ];
  };
  for (let w = 1; w <= 6; w++) {
    const pool = allSessions(w);
    const selected = pool.slice(0, Math.min(daysPerWeek, pool.length));
    for (const s of selected) {
      days.push({ week: w, ...s });
    }
  }
  return days;
}

// ─── Stressreducering – Yoga & Rörlighet (6v) ──────────────────────────────
function generateYogaMobility(profile: FitnessProfile): TemplatePlanDay[] {
  const daysPerWeek = profile.training_days_per_week || 4;
  const days: TemplatePlanDay[] = [];
  const allSessions = (w: number) => {
    const hold = 25 + w * 5;
    return [
      { day: "Mån", session_name: "Yoga – Vinyasa Flow", details: `30 min vinyasa flow. Solhälsning A ×5, Solhälsning B ×3; Stående balanser; Krigarpositioner I, II, III; Nedvarvning i savasana 5 min`, tempo: "" },
      { day: "Tis", session_name: "Rörlighet – Höfter & Rygg", details: `Pigeon pose 2×60s/sida; Djup knäböj-hold ${hold}s; Höftböjarstretch 2×45s/sida; Bröstryggsrotation 2×10/sida; Katt/ko 10 reps; Barnets ställning 60s`, tempo: "" },
      { day: "Ons", session_name: "Styrka – Lätt Core", details: `Dead bug 3×10; Bird dog 3×10/sida; Planka 3×${hold}s; Sidoplanka 2×${Math.round(hold * 0.6)}s/sida; Bäckenlyft 3×12; Superman 3×${Math.round(hold * 0.8)}s`, tempo: "" },
      { day: "Tors", session_name: "Yoga – Yin / Djupstretch", details: `40 min yin yoga. Varje position 3–5 min: Fjäril; Dragon pose; Sphinx; Bananform; Snöring; Savasana 5 min`, tempo: "" },
      { day: "Fre", session_name: "Rörlighet – Axlar & Överkropp", details: `Axelcirklar 2×15; Bröstspenat vägg 2×45s/sida; Thread the needle 2×10/sida; Lat-stretch 2×45s/sida; Nackstretch 2×30s/sida; Armcirklar 2×15`, tempo: "" },
      { day: "Lör", session_name: "Promenad & Meditation", details: `${25 + w * 3} min medveten promenad. 10 min andningsövningar (4-7-8 eller boxandning). Stretching 10 min.`, tempo: "" },
    ];
  };
  for (let w = 1; w <= 6; w++) {
    const pool = allSessions(w);
    const selected = pool.slice(0, Math.min(daysPerWeek, pool.length));
    for (const s of selected) {
      days.push({ week: w, ...s });
    }
  }
  return days;
}

// ─── Triatlon – Sprint (8v) ────────────────────────────────────────────────
function generateSprintTriathlon(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 8);
    const isDeload = w === 4;
    const swimDist = 400 + w * 100;
    const bikeMin = isDeload ? 25 : 25 + w * 3;
    const runMin = isDeload ? 15 : 15 + w * 2;
    days.push(
      { week: w, day: "Mån", session_name: "Simning – Teknik", details: `200m uppvärmning; 4×100m crawl; 4×50m teknikfokus; 200m nedvarvning. Total: ~${swimDist}m`, tempo: "Lugnt" },
      { week: w, day: "Tis", session_name: "Löpning – Tempo", details: isDeload ? "20 min lugn jogg" : `10 min uppvärmning; ${10 + w} min tröskeltempo; 10 min nedvarvning`, tempo: isDeload ? pace.easy : pace.threshold },
      { week: w, day: "Ons", session_name: "Cykling – Uthållighet", details: `${bikeMin} min i zon 2. Fokus kadens 85–95 rpm.`, tempo: "Zon 2" },
      { week: w, day: "Tors", session_name: "Styrka – Helkropp", details: `Knäböj 3×8; Bänkpress 3×8; Rodd 3×10; Planka 3×${30 + w * 5}s; Vadpress 3×15`, tempo: "" },
      { week: w, day: "Fre", session_name: "Vila", details: "Vilodag", tempo: "" },
      { week: w, day: "Lör", session_name: "Brick – Cykel + Löpning", details: isDeload ? "20 min cykel + 10 min jogg" : `${bikeMin} min cykel direkt följt av ${runMin} min löpning. Öva transition.`, tempo: "Zon 2–3" },
      { week: w, day: "Sön", session_name: "Simning – Distans", details: `${isDeload ? swimDist - 200 : swimDist}m sammanhängande simning`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Strongman-inspirerad (8v) ──────────────────────────────────────────────
function generateStrongman(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const baseRpe = exp === "nybörjare" ? 6 : exp === "avancerad" ? 8 : 7;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4 || w === 8;
    const rpe = isDeload ? Math.max(5, baseRpe - 2) : Math.min(9.5, baseRpe + (w - 1) * 0.15);
    const r = rpe.toFixed(1).replace(".0", "");
    const sets = isDeload ? 2 : 3 + Math.floor(w / 3);
    const reps = isDeload ? 5 : Math.max(3, 6 - Math.floor(w / 3));
    days.push(
      { week: w, day: "Mån", session_name: isDeload ? "Pressing – Deload" : "Pressing – Tungt", details: isDeload ? `Axelpress 2×8 @ RPE ${r}\nPush press 2×5\nDips 2×max` : `Axelpress ${sets}×${reps} @ RPE ${r}\nPush press ${sets}×${reps}\nIncline bänk 3×${reps + 4}\nSidolyft 3×15\nTriceps pushdown 3×12`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Tis", session_name: isDeload ? "Marklyft – Deload" : "Marklyft & Carries", details: isDeload ? `Marklyft 2×5 @ RPE ${r}\nFarmers walk 2×30m` : `Marklyft ${sets}×${reps} @ RPE ${r}\nDeficit marklyft 3×${reps + 2}\nFarmers walk 4×40m\nYoke walk (tungt) 3×20m\nShrugs 3×15`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Ons", session_name: "Vila / Kondition", details: isDeload ? "Vilodag" : "20–30 min lätt kondition + stretching", tempo: "" },
      { week: w, day: "Tors", session_name: isDeload ? "Knäböj – Deload" : "Knäböj & Events", details: isDeload ? `Knäböj 2×8 @ RPE ${r}\nBenpress 2×10` : `Knäböj ${sets}×${reps} @ RPE ${r}\nFrontböj 3×${reps + 2}\nSandsäck/Atlas stone 4×3\nSled push/drag 4×20m`, tempo: isDeload ? "Deload" : `RPE ${r}` },
      { week: w, day: "Fre", session_name: isDeload ? "Drag – Deload" : "Drag & Volym", details: isDeload ? `Rodd 2×10\nPull-ups 2×max\nBicepscurl 2×12` : `Rodd ${sets}×${reps + 2} @ RPE ${r}\nPull-ups ${sets}×max\nLatsdrag 3×${reps + 4}\nHammarcurl 3×12\nAb wheel 3×10`, tempo: isDeload ? "Deload" : `RPE ${r}` },
    );
  }
  return days;
}

// ─── Skadeförebyggande – Rehab & Prehab (6v) ───────────────────────────────
function generateRehabPrehab(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    const hold = 20 + w * 5;
    const reps = 8 + w;
    days.push(
      { week: w, day: "Mån", session_name: "Axlar & Överkropp – Prehab", details: `Band pull-aparts 3×${reps + 4}; External rotation 3×${reps}/sida; Face pulls 3×15; Scapula push-ups 3×${reps}; YTWL 2×8; Axelcirklar 2×15`, tempo: "" },
      { week: w, day: "Tis", session_name: "Höfter & Knän – Prehab", details: `Clamshells 3×${reps}/sida; Monster walks 3×10/sida; Enbensstående 3×${hold}s/sida; Terminal knee extensions 3×12; Sidolyft ben 3×${reps}/sida; Knäcirklar 2×10`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila / Promenad", details: `${20 + w * 2} min lugn promenad`, tempo: "" },
      { week: w, day: "Tors", session_name: "Core & Rygg – Stabilitet", details: `Dead bug 3×${reps}; Bird dog 3×${reps}/sida; Pallof press 3×${reps}/sida; Planka 3×${hold}s; Superman 3×${hold}s; McGill curl-up 3×${reps}`, tempo: "" },
      { week: w, day: "Fre", session_name: "Fotled & Balans", details: `Enbensstående (blunda) 3×20s/sida; Bosu-balans 3×30s; Vadpress (enbens) 3×15/sida; Tåhävningar 3×15; Ankelcirklar 2×15/sida; Towel scrunches 3×${reps}`, tempo: "" },
    );
  }
  return days;
}

// ─── Intervallöpning – Fartlek & Tempo (8v) ─────────────────────────────────
function generateIntervalRunning(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const pace = calcPaceForWeek(profile.time_10km_min, w, 8);
    const isDeload = w === 4;
    const intervalCount = isDeload ? 3 : 3 + Math.floor(w / 2);
    const intervalMin = isDeload ? 3 : 2 + Math.floor(w / 3);
    days.push(
      { week: w, day: "Mån", session_name: "Löpning – Lugn", details: `${30 + w * 2} min i lugnt tempo`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Ons", session_name: "Löpning – Fartlek", details: isDeload ? "25 min med 3 lätta fartökningar" : `10 min uppvärmning; ${intervalCount}×${intervalMin} min fartökning (${Math.max(60, 120 - w * 10)}s joggvila); 10 min nedvarvning`, tempo: `Fartökningar: ${pace.threshold}` },
      { week: w, day: "Fre", session_name: "Löpning – Tempo", details: isDeload ? "20 min lugn jogg" : `10 min uppvärmning; ${15 + w * 2} min i tröskeltempo; 10 min nedvarvning`, tempo: `${pace.threshold} min/km` },
      { week: w, day: "Sön", session_name: "Löpning – Långpass", details: `${isDeload ? 35 : 40 + w * 5} min lugnt tempo. Bygg aerob bas.`, tempo: `${pace.long} min/km` },
    );
  }
  return days;
}

// ─── Aktiv Återhämtning – Deload/Återställning (4v) ────────────────────────
function generateActiveRecovery(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 4; w++) {
    const walkMin = 20 + w * 5;
    const hold = 25 + w * 5;
    days.push(
      { week: w, day: "Mån", session_name: "Rörlighet – Helkropp", details: `Dynamisk stretching 10 min; Foam rolling 10 min; Statisk stretching 10 min – fokus problemområden`, tempo: "" },
      { week: w, day: "Tis", session_name: "Lätt Styrka – Core", details: `Dead bug 3×10; Bird dog 3×10/sida; Planka 3×${hold}s; Bäckenlyft 3×12; McGill curl-up 3×10; Stretching 5 min`, tempo: "RPE 4–5" },
      { week: w, day: "Ons", session_name: "Promenad", details: `${walkMin} min promenad i lugnt tempo`, tempo: "" },
      { week: w, day: "Tors", session_name: "Yoga – Lugn", details: `30 min lugn yoga/stretching. Fokus andning och avspänning. Solhälsning ×3; Djupstretch höfter och hamstrings; Savasana 5 min`, tempo: "" },
      { week: w, day: "Fre", session_name: "Lätt Styrka – Helkropp", details: `Goblet squat 2×10; Armhävningar 2×10; Rodd (band/lätt) 2×12; Axelpress (lätt) 2×10; Vadpress 2×15; Stretching 5 min`, tempo: "RPE 4–5" },
    );
  }
  return days;
}

// ─── Fotboll – Säsongsförberedelse (8v) ─────────────────────────────────────
function generateSoccerPrep(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const isDeload = w === 4;
    const sprintCount = isDeload ? 4 : 4 + Math.floor(w / 2);
    const sprintDist = 20 + w * 5;
    const agilityMin = isDeload ? 10 : 10 + w;
    days.push(
      { week: w, day: "Mån", session_name: "Styrka – Explosiv", details: `Knäböj 4×${isDeload ? 8 : Math.max(4, 7 - Math.floor(w / 3))}; Box jumps 3×5; Utfallssteg 3×8/ben; Marklyft 3×5; Planka 3×${30 + w * 5}s`, tempo: "" },
      { week: w, day: "Tis", session_name: "Kondition – Sprint & Agility", details: `15 min uppvärmning; ${sprintCount}×${sprintDist}m sprint (gångvila tillbaka); ${agilityMin} min agility: T-test, zigzag, sidoförflyttningar; 10 min nedvarvning`, tempo: "Max intensitet" },
      { week: w, day: "Ons", session_name: "Vila / Lätt jogg", details: isDeload ? "Vilodag" : "20 min lugn jogg + stretching", tempo: "" },
      { week: w, day: "Tors", session_name: "Styrka – Underkropp & Prehab", details: `Hip thrust 3×12; Hamstring curl 3×12; Clamshells 3×15/sida; Single-leg squat 3×8/ben; Vadpress 3×15; Nordic hamstring curl 3×${Math.max(3, Math.min(8, w))}`, tempo: "" },
      { week: w, day: "Fre", session_name: "Kondition – Intervaller", details: (() => {
        if (isDeload) return "20 min fartlek";
        const runTypes = ["Tempoväxlingar", "Backsprints", "Fartlek med spurter", "Shuttlerun", "Progressiva intervaller", "Pyramidintervaller", "Sidoförflyttningar + sprint", "Tempoökning varje minut"];
        const runType = runTypes[(w - 1) % runTypes.length];
        const count = 3 + Math.floor(w / 2);
        return `${count}×3 min i hög intensitet (90s joggvila).\nSimulerar matchbelastning.\nIntervallöpning: ${runType} ${count}×${Math.min(2 + Math.floor(w / 3), 4)} min`;
      })(), tempo: "Zon 4" },
      { week: w, day: "Lör", session_name: "Uthållighet – Långpass", details: `${isDeload ? 25 : 25 + w * 3} min löpning i lugnt tempo. Fokus aerob bas.`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Trappmaskin & Kondition (6v) ───────────────────────────────────────────
function generateStairClimber(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  const days: TemplatePlanDay[] = [];
  const baseSpm = exp === "nybörjare" ? 50 : exp === "avancerad" ? 80 : 65;
  for (let w = 1; w <= 6; w++) {
    const isDeload = w === 4;
    const steadyMin = isDeload ? 15 : 15 + w * 3;
    const intervalMin = isDeload ? 10 : 10 + w * 2;
    const spm = baseSpm + w * 3;
    days.push(
      { week: w, day: "Mån", session_name: "Trappmaskin – Uthållighet", details: `Stair machine ${steadyMin} min @ ${spm} SPM. Jämnt tempo, fokus andning.`, tempo: `${spm} SPM` },
      { week: w, day: "Tis", session_name: "Styrka – Ben & Rumpa", details: `Knäböj 3×${8 + w}; Hip thrust 3×12; Utfallssteg 3×10/ben; Step-ups 3×10/ben; Vadpress 3×15; Planka 3×${30 + w * 5}s`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila / Promenad", details: "20 min lugn promenad", tempo: "" },
      { week: w, day: "Tors", session_name: "Trappmaskin – Intervaller", details: isDeload ? `15 min lugnt tempo @ ${spm - 10} SPM` : `5 min uppvärmning; ${3 + Math.floor(w / 2)}×2 min @ ${spm + 15} SPM (1 min vila @ ${spm - 15} SPM); 5 min nedvarvning`, tempo: "Intervaller" },
      { week: w, day: "Fre", session_name: "Styrka – Överkropp", details: `Bänkpress 3×10; Rodd 3×10; Axelpress 3×10; Latsdrag 3×10; Bicepscurl 2×12; Triceps pushdown 2×12`, tempo: "" },
      { week: w, day: "Lör", session_name: "Kondition – Valfri", details: `${20 + w * 3} min valfri kondition: löpning, cykling eller simning i lugnt tempo`, tempo: "Zon 2" },
    );
  }
  return days;
}

// ─── Graviditetsträning – Prenatal (12v) ────────────────────────────────────
function generatePrenatal(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 12; w++) {
    const reps = Math.max(6, 12 - Math.floor(w / 4));
    const walkMin = 20 + Math.min(w, 6) * 2;
    const hold = Math.max(15, 30 - w);
    days.push(
      { week: w, day: "Mån", session_name: "Styrka – Helkropp (anpassad)", details: `Goblet squat 3×${reps}; Hip thrust 3×${reps + 2}; Rodd (sittande) 3×${reps + 2}; Axelpress (sittande) 3×${reps}; Bäckenlyft 3×${reps + 4}; Bäckenbottenträning 3×10`, tempo: "Lugnt och kontrollerat" },
      { week: w, day: "Ons", session_name: "Promenad & Rörlighet", details: `${walkMin} min promenad i lugnt tempo; 15 min stretching: höftböjare, bröstrygg, axlar; Bäckenbottenträning 3×10; Djupandning 5 min`, tempo: "" },
      { week: w, day: "Fre", session_name: "Styrka – Core & Stabilitet", details: `Dead bug 3×${reps}; Bird dog 3×${reps}/sida; Sidoplanka (modifierad) 2×${hold}s/sida; Sittande pallof press 3×${reps}; Vadpress 3×15; ${w <= 6 ? `Planka 2×${hold}s` : "Cat/cow 10 reps"}`, tempo: "Lugnt och kontrollerat" },
    );
  }
  return days;
}

// ─── Postpartum – Comeback (8v) ─────────────────────────────────────────────
function generatePostpartum(profile: FitnessProfile): TemplatePlanDay[] {
  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 8; w++) {
    const reps = 6 + w;
    const hold = 15 + w * 3;
    const walkMin = 15 + w * 3;
    days.push(
      { week: w, day: "Mån", session_name: "Bäckenbotten & Core", details: `Bäckenbottenträning 3×${reps + 4}; Dead bug 3×${Math.min(reps, 10)}; Bäckenlyft 3×${reps}; ${w <= 4 ? "Knästående planka" : "Planka"} 3×${hold}s; Djupandning 3×10 andetag`, tempo: "Mycket lugnt" },
      { week: w, day: "Ons", session_name: w <= 3 ? "Promenad" : "Styrka – Lätt Helkropp", details: w <= 3 ? `${walkMin} min lugn promenad. Lyssna på kroppen.` : `Goblet squat 3×${reps}; Hip thrust 3×${reps + 2}; Rodd (lätt) 3×${reps + 2}; Axelpress (lätt) 3×${reps}; Bäckenlyft 3×${reps + 4}`, tempo: w <= 3 ? "" : "RPE 5–6" },
      { week: w, day: "Fre", session_name: "Promenad & Stretching", details: `${walkMin} min promenad; 15 min stretching: höfter, rygg, axlar; Bäckenbottenträning 2×${reps + 4}`, tempo: "" },
    );
  }
  return days;
}

export const planTemplates: TemplatePlan[] = [
  {
    name: "🏋️ Styrka 1 dag/vecka – Helkropp",
    description: "8 veckor, 1 pass/vecka. Maximalt effektivt helkroppspass med alla stora lyft. Perfekt om du har begränsat med tid.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrength1Day,
  },
  {
    name: "🏋️ Styrka 2 dagar/vecka – Överkropp/Underkropp",
    description: "8 veckor, 2 pass/vecka. Optimal split för att hinna träna hela kroppen med god återhämtning.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrength2Days,
  },
  {
    name: "🏋️ Styrka 3 dagar/vecka – Helkropp A/B/C",
    description: "8 veckor, 3 pass/vecka. Tre unika helkroppspass med varierande fokus: styrka, lyft och volym. Optimal frekvens för de flesta.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrength3Days,
  },
  {
    name: "🏋️ Styrka 4 dagar/vecka – Övre/Undre × 2",
    description: "8 veckor, 4 pass/vecka. Två styrkepass och två volympass. Tränar varje muskelgrupp 2× i veckan för snabb progression.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrength4Days,
  },
  {
    name: "🏋️ Styrka 5 dagar/vecka – Push/Pull/Legs + Volym",
    description: "8 veckor, 5 pass/vecka. Push/Pull/Legs följt av överkropp- och underkroppsvolym. Maximal träningsfrekvens och variation.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrength5Days,
  },
  {
    name: "🏋️ PPL 6 dagar/vecka – Push/Pull/Legs × 2",
    description: "8 veckor, 6 pass/vecka. Klassisk PPL-split med tunga och volympass. Maximal frekvens och muskelstimulans.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generatePPL6Days,
  },
  {
    name: "💪 Styrka & Löpning – Kombination",
    description: "12 veckor, 7 pass/vecka. Styrka + tröskellöpning + långpass. Anpassas efter din löpnivå och erfarenhet.",
    weeks: 12,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateOriginalPlan,
  },
  {
    name: "📈 Wendler 5/3/1 – Långsiktig styrka",
    description: "12 veckor (3 cykler). Klassiskt procentbaserat program för att bygga styrka i bänk, knäböj, marklyft och press. Beräknar vikter från din 1RM.",
    weeks: 12,
    category: "styrka",
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generate531,
  },
  {
    name: "🏋️ Kraftlyft – Tävlingsförberedelse",
    description: "12 veckor periodisering: hypertrofi → styrka → peaking → taper. För dig som vill nå nya maxlyft. Alla vikter beräknas från din 1RM.",
    weeks: 12,
    category: "styrka",
    requiredLifts: ["knäböj", "bänk", "marklyft"],
    generateDays: generatePowerlifting,
  },
  {
    name: "💎 Hypertrofi – Muskelbygge",
    description: "8 veckor, 4 pass/vecka. Överkropp/underkropp-split med progressiv belastning. Blandning av styrka och volym för maximal muskeltillväxt.",
    weeks: 8,
    category: "styrka",
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generateHypertrophy,
  },
  {
    name: "🌱 Nybörjare – Linjär progression",
    description: "8 veckor, 3 pass/vecka. Helkroppsträning som ökar gradvis från 55% till 80% av din 1RM. Perfekt för att lära sig grundövningarna.",
    weeks: 8,
    category: "styrka",
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generateBeginner,
  },
  {
    name: "🔰 Kom igång – Maskiner & Fria vikter",
    description: "6 veckor, 3 pass/vecka. Blandning av maskiner och fria vikter. Lämplig om du är helt ny på gymmet.",
    weeks: 6,
    category: "styrka",
    requiredLifts: ["knäböj", "bänk"],
    generateDays: generateMachineStrength,
  },
  {
    name: "💪 Bro Split – Kroppsbyggare",
    description: "8 veckor, 5 pass/vecka. Klassisk split med en muskelgrupp per dag: bröst, rygg, axlar, ben, armar. För maximal isolering och volym.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateBroSplit,
  },
  {
    name: "🦍 Strongman – Styrka & Events",
    description: "8 veckor, 4 pass/vecka. Tungt pressing, marklyft, carries och events. Bygg rå styrka och funktionell kapacitet.",
    weeks: 8,
    category: "styrka",
    requiredLifts: [],
    generateFromProfile: generateStrongman,
  },
  {
    name: "🏠 Hemmaträning – Kroppsvikt",
    description: "6 veckor, 2–6 pass/vecka. Ingen utrustning behövs. Anpassas efter erfarenhet och tillgängliga dagar.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateHomeWorkout,
  },
  {
    name: "🧓 Seniorträning – Hemma",
    description: "6 veckor, 2–6 pass/vecka. Lätta övningar med fokus på balans, rörlighet och styrka. Ingen utrustning behövs. Perfekt för äldre eller nybörjare.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateSeniorHomeWorkout,
  },
  {
    name: "🤸 Calisthenics – Avancerad Kroppsvikt",
    description: "8 veckor, 5 pass/vecka. Handstands, muscle-ups, levers och pistol squats. Bygg imponerande kroppskontroll utan vikter.",
    weeks: 8,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateCalisthenics,
  },
  {
    name: "☀️ Morgonrutin – 30 min snabbpass",
    description: "6 veckor, 2–6 pass/vecka. Varje pass tar max 30 minuter. Ingen utrustning behövs. Perfekt för den som vill träna effektivt på morgonen.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateMorningRoutine,
  },
  {
    name: "🏃 Löpfokus – Distansbygge",
    description: "8 veckor, 3 löppass + 2 styrkepass. Tempo och distanser anpassas efter din löpnivå.",
    weeks: 8,
    category: "löpning",
    requiredLifts: [],
    generateFromProfile: generateRunningPlan,
  },
  {
    name: "🏃 5K Nybörjare – Börja springa",
    description: "8 veckor, 3 pass/vecka. Från gång till 25 min sammanhängande jogg. Inspirerad av Couch to 5K. Perfekt för absoluta nybörjare.",
    weeks: 8,
    category: "löpning",
    requiredLifts: [],
    generateFromProfile: generateCouch5K,
  },
  {
    name: "🏃 Halvmaraton – Förberedelse",
    description: "12 veckor, 4 löppass + styrkepass. Progressiv distansökning upp till 21.1 km. Anpassas efter din löpnivå och max-distans.",
    weeks: 12,
    category: "löpning",
    requiredLifts: [],
    generateFromProfile: generateHalfMarathon,
  },
  {
    name: "🏃 Halvmaraton – 6 veckor",
    description: "6 veckor, 3 löppass/vecka. Kompakt förberedelse för halvmaraton med intervaller, lugna pass och progressiva långpass upp till 20 km.",
    weeks: 6,
    category: "löpning",
    requiredLifts: [],
    generateFromProfile: generateHalfMarathon6w,
  },
  {
    name: "⚡ Intervallöpning – Fartlek & Tempo",
    description: "8 veckor, 4 löppass/vecka. Fokus på fartlekar, tempopass och uthållighet. Bli snabbare genom varierad intensitet.",
    weeks: 8,
    category: "löpning",
    requiredLifts: [],
    generateFromProfile: generateIntervalRunning,
  },
  {
    name: "🚴 Cykling – Uthållighet & Intervaller",
    description: "8 veckor, 4 cykelpass + 1 styrkepass. Bygg uthållighet med långa pass och förbättra effekt med intervaller.",
    weeks: 8,
    category: "cykling",
    requiredLifts: [],
    generateFromProfile: generateCyclingPlan,
  },
  {
    name: "🏊 Simning – Teknik & Distans",
    description: "6 veckor, 3 simpass + 2 styrkepass. Förbättra teknik och bygg distans. Anpassas efter erfarenhet.",
    weeks: 6,
    category: "simning",
    requiredLifts: [],
    generateFromProfile: generateSwimmingPlan,
  },
  {
    name: "🥊 Kampsport – Styrka & Kondition",
    description: "8 veckor, 5 pass/vecka. Funktionell styrka, explosivitet och konditionsintervaller för kampsportare.",
    weeks: 8,
    category: "kampsport",
    requiredLifts: [],
    generateFromProfile: generateMartialArtsPlan,
  },
  {
    name: "🔥 HIIT – Fettförbränning",
    description: "6 veckor, 5 pass/vecka. Högintensiva intervaller, cirkelträning och styrkepass. Maximal kaloriförbränning på kort tid.",
    weeks: 6,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateHIITFatLoss,
  },
  {
    name: "🏔️ Funktionell Fitness – WOD",
    description: "8 veckor, 4 pass/vecka. CrossFit-inspirerat med AMRAP, For Time och olympiska lyft. Bygg allsidig kapacitet.",
    weeks: 8,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateFunctionalFitness,
  },
  {
    name: "🏅 Hinderbanelopp – OCR-förberedelse",
    description: "8 veckor, 5 pass/vecka. Grepp, klättring, löpning och hinderspecifik circuit. Förbered dig för Tough Viking, Toughest och liknande.",
    weeks: 8,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateOCR,
  },
  {
    name: "🏆 Triatlon Sprint – Sim/Cykel/Löp",
    description: "8 veckor, 6 pass/vecka. Simning, cykling och löpning med brick-pass. Förbered dig för din första sprinttriatlon.",
    weeks: 8,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateSprintTriathlon,
  },
  {
    name: "⚽ Fotboll – Säsongsförberedelse",
    description: "8 veckor, 5 pass/vecka. Explosiv styrka, sprint, agility och uthållighet. Perfekt pre-season-förberedelse.",
    weeks: 8,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateSoccerPrep,
  },
  {
    name: "🪜 Trappmaskin & Kondition",
    description: "6 veckor, 5 pass/vecka. Trappmaskin-uthållighet och intervaller kombinerat med styrka. Bygg kondition och benstyrka.",
    weeks: 6,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateStairClimber,
  },
  {
    name: "🧘 Yoga & Rörlighet – Stressreducering",
    description: "6 veckor, 2–6 pass/vecka. Vinyasa, yin yoga, rörlighet och meditation. Minska stress och förbättra flexibilitet.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateYogaMobility,
  },
  {
    name: "🦴 Rygghälsa – Stärk ryggen",
    description: "6 veckor, 3 pass/vecka. Core-stabilitet, ryggstyrkande övningar och rörlighet. Förebygg och lindra ryggbesvär.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateBackHealth,
  },
  {
    name: "🏔️ Vandring – Bergsförberedelse",
    description: "8 veckor, 4 pass/vecka. Benstyrka, trappmaskin och progressiva vandringslångpass. Förbered dig för fjällvandring.",
    weeks: 8,
    category: "kombination",
    requiredLifts: [],
    generateFromProfile: generateHikingPrep,
  },
  {
    name: "🩹 Skadeförebyggande – Prehab",
    description: "6 veckor, 5 pass/vecka. Axelstabilitet, höft/knä-prehab, core och balansträning. Håll kroppen skaderesistent.",
    weeks: 6,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateRehabPrehab,
  },
  {
    name: "🔄 Aktiv Återhämtning – Deload",
    description: "4 veckor, 5 pass/vecka. Lätt styrka, yoga, promenader och rörlighet. Perfekt återhämtningscykel mellan intensiva program.",
    weeks: 4,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generateActiveRecovery,
  },
  {
    name: "🤰 Graviditetsträning – Prenatal",
    description: "12 veckor, 3 pass/vecka. Anpassad styrka, bäckenbottenträning och promenader. Säker träning under graviditet.",
    weeks: 12,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generatePrenatal,
  },
  {
    name: "👶 Postpartum – Comeback",
    description: "8 veckor, 3 pass/vecka. Gradvis återgång till träning efter förlossning. Bäckenbotten, core och lätt styrka.",
    weeks: 8,
    category: "kroppsvikt",
    requiredLifts: [],
    generateFromProfile: generatePostpartum,
  },
];

export const liftLabels: Record<string, string> = {
  "knäböj": "Knäböj",
  "bänk": "Bänkpress",
  "marklyft": "Marklyft",
  "press": "Axelpress / Militärpress",
};
