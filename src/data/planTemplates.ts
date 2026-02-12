export interface FitnessProfile {
  max_distance_km: number | null;
  time_10km_min: number | null;
  experience_level: string | null;
  training_days_per_week: number | null;
}

export interface TemplatePlan {
  name: string;
  description: string;
  weeks: number;
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
          ? `2×12 min (2 min joggvila) – deload`
          : `${thresholdSets}×${thresholdMin} min (${thresholdRest})`,
        tempo: pace.threshold,
      },
      {
        week: w, day: "Fre", session_name: "Vila eller lätt jogg",
        details: `${isDeload ? "15–20" : `${20 + Math.min(10, w)}–${30 + Math.min(5, w)}`} min`,
        tempo: pace.easy,
      },
      {
        week: w, day: "Lör", session_name: "Tung styrka ben + mark",
        details: isDeload
          ? `Deload: Böj 3×3 @ RPE ${rpe(5.5)}; Mark 3×2 @ RPE ${rpe(5.5)}; Bål 3×10`
          : `Böj ${squatSets}×${squatReps} @ RPE ${rpe(7)}; Mark ${Math.min(5, 3 + Math.floor(w / 3))}×${squatReps} @ RPE ${rpe(7)}; ${w <= 6 ? `Frontböj 3×3 @ RPE ${rpe(6)}` : `Enbensarbete 3×8`}`,
        tempo: "RPE enligt text",
      },
      { week: w, day: "Sön", session_name: "Långpass", details: `${dist} km`, tempo: pace.long },
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
      { week: w, day: "Mån", session_name: "Löpning – Lugn", details: `${easyRunMin[w - 1]}–${easyRunMin[w - 1] + 10} min i lugnt tempo. Prata-testet: du ska kunna prata.`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Tis", session_name: "Styrka – Helkropp", details: `Knäböj 3×${reps}; Bänkpress 3×${reps}; Rodd 3×${reps + 2}; Axelpress 3×${reps + 2}; Planka 3×${35 + w * 5}s`, tempo: "" },
      { week: w, day: "Ons", session_name: "Vila", details: isDeload ? "Deload-vecka. Vilodag." : "Vilodag. Lätt promenad okej.", tempo: "" },
      { week: w, day: "Tors", session_name: "Löpning – Tröskellopp", details: `15 min uppvärmning; ${thresholdMin[w - 1]} min i tröskeltempo; 10 min nedvarvning`, tempo: `${pace.threshold} min/km` },
      { week: w, day: "Fre", session_name: "Styrka – Benstyrka", details: `Marklyft 3×${Math.max(3, 6 - Math.floor(w / 3))}; Benpress 3×${reps + 2}; Hip thrust 3×${reps + 4}; Bencurl 3×12; Core-circuit`, tempo: "" },
      { week: w, day: "Lör", session_name: "Löpning – Långpass", details: `${longMin} min i lätt tempo. Bygg uthållighet.`, tempo: `${pace.long} min/km` },
    );
  }
  return days;
}

// ─── Hemmaträning med progressiv ökning ──────────────────────────────────────
function generateHomeWorkout(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  // Base reps by experience
  const baseReps = exp === "nybörjare" ? { push: 6, sq: 8, rounds: 3, plank: 25 }
    : exp === "avancerad" ? { push: 12, sq: 16, rounds: 5, plank: 40 }
    : { push: 10, sq: 12, rounds: 4, plank: 35 };

  const days: TemplatePlanDay[] = [];
  for (let w = 1; w <= 6; w++) {
    // Progressive increase: ~10-15% more reps/duration per week
    const weekBoost = w - 1;
    const push = baseReps.push + weekBoost;
    const sq = baseReps.sq + weekBoost * 2;
    const rounds = Math.min(6, baseReps.rounds + Math.floor(weekBoost / 2));
    const plank = baseReps.plank + weekBoost * 5;
    const isDeload = w === 4; // Light week mid-program

    if (isDeload) {
      days.push(
        { week: w, day: "Mån", session_name: "Styrka – Överkropp (lätt)", details: `Armhävningar 3×${Math.round(push * 0.7)}; Pike push-ups 2×${Math.round(push * 0.6)}; Planka 2×${plank}s; Stretching 10 min`, tempo: "Deload" },
        { week: w, day: "Tis", session_name: "Styrka – Underkropp (lätt)", details: `Knäböj 3×${Math.round(sq * 0.7)}; Utfallssteg 2×8/ben; Hip thrust (golv) 3×12; Vadpress 2×15`, tempo: "Deload" },
        { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "25 min stretching eller yoga. Fokus på höfter, bröstrygg och axlar.", tempo: "" },
        { week: w, day: "Tors", session_name: "Lätt rörelse", details: "30 min promenad eller lätt yoga. Aktiv återhämtning.", tempo: "Deload" },
        { week: w, day: "Fre", session_name: "Helkropp – Lätt", details: `Armhävningar 2×${Math.round(push * 0.6)}; Knäböj 2×${Math.round(sq * 0.7)}; Planka 2×${plank}s`, tempo: "Deload" },
      );
    } else {
      days.push(
        { week: w, day: "Mån", session_name: "Styrka – Överkropp", details: `Armhävningar 4×${push}; Diamond push-ups 3×${Math.max(5, push - 4)}; Pike push-ups 3×${push - 2}; Dips (stol) 3×${push - 2}; Planka 3×${plank}s; Superman hold 3×${Math.min(45, 25 + weekBoost * 3)}s`, tempo: `Vecka ${w}/6` },
        { week: w, day: "Tis", session_name: "Styrka – Underkropp", details: `Knäböj 4×${sq}; Utfallssteg 3×${Math.round(sq * 0.7)}/ben; Bulgarska utfall (stol) 3×${Math.round(sq * 0.6)}/ben; Hip thrust (golv) 3×${sq}; Vadpress 3×${18 + weekBoost * 2}`, tempo: `Vecka ${w}/6` },
        { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "20 min stretching eller yoga. Fokus på höfter, bröstrygg och axlar.", tempo: "" },
        { week: w, day: "Tors", session_name: "HIIT + Core", details: `${rounds} rundor: ${35 + weekBoost * 2}s arbete / ${Math.max(15, 25 - weekBoost * 2)}s vila — Burpees; Mountain climbers; Jump squats; High knees. Vila ${Math.max(60, 120 - weekBoost * 10)}s mellan rundor. Core: Crunches 3×${18 + weekBoost * 2}; Cykelcrunches 3×${14 + weekBoost}; Benlyft 3×${10 + weekBoost}`, tempo: `Vecka ${w}/6` },
        { week: w, day: "Fre", session_name: "Helkropp – Volym", details: `Armhävningar 3×max; Knäböj 3×${sq + 5}; Rodd med ryggsäck ${3 + Math.floor(weekBoost / 2)}×12; Axelpress (ryggsäck) 3×${8 + weekBoost}; Utfallssteg 2×${8 + weekBoost}/ben; Planka 2×${plank + 10}s`, tempo: `Vecka ${w}/6` },
      );
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
      { week: w, day: "Tis", session_name: "Kondition – Intervaller", details: `${rounds} rundor à ${roundMin} min: Skuggboxning/slag+spark-combo. Vila ${restSec}s mellan rundor.`, tempo: `${roundMin} min rundor` },
      { week: w, day: "Ons", session_name: "Vila / Rörlighet", details: "Rörlighetspass 30 min. Höfter, axlar, handleder.", tempo: "" },
      { week: w, day: "Tors", session_name: "Styrka – Explosiv", details: `Box jumps 4×5; Medicinbollskast 3×10; Enbens-knäböj 3×8/ben; Ab wheel 3×10; Planka 3×${35 + w * 5}s`, tempo: "" },
      { week: w, day: "Fre", session_name: "Kondition – HIIT", details: `${rounds} rundor: 30s burpees / 30s mountain climbers / 30s jump squats / ${restSec}s vila. Avsluta med 5 min skipping.`, tempo: "Max intensitet" },
      { week: w, day: "Lör", session_name: "Teknik & Sparring", details: `15 min uppvärmning; ${Math.max(3, rounds - 1)} rundor teknisk sparring/padwork; 10 min stretching`, tempo: "" },
    );
  }
  return days;
}

export const planTemplates: TemplatePlan[] = [
  {
    name: "💪 Styrka & Löpning – Kombination",
    description: "12 veckor, 7 pass/vecka. Styrka + tröskellöpning + långpass. Anpassas efter din löpnivå och erfarenhet.",
    weeks: 12,
    requiredLifts: [],
    generateFromProfile: generateOriginalPlan,
  },
  {
    name: "📈 Wendler 5/3/1 – Långsiktig styrka",
    description: "12 veckor (3 cykler). Klassiskt procentbaserat program för att bygga styrka i bänk, knäböj, marklyft och press. Beräknar vikter från din 1RM.",
    weeks: 12,
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generate531,
  },
  {
    name: "🏋️ Kraftlyft – Tävlingsförberedelse",
    description: "12 veckor periodisering: hypertrofi → styrka → peaking → taper. För dig som vill nå nya maxlyft. Alla vikter beräknas från din 1RM.",
    weeks: 12,
    requiredLifts: ["knäböj", "bänk", "marklyft"],
    generateDays: generatePowerlifting,
  },
  {
    name: "💎 Hypertrofi – Muskelbygge",
    description: "8 veckor, 4 pass/vecka. Överkropp/underkropp-split med progressiv belastning. Blandning av styrka och volym för maximal muskeltillväxt.",
    weeks: 8,
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generateHypertrophy,
  },
  {
    name: "🌱 Nybörjare – Linjär progression",
    description: "8 veckor, 3 pass/vecka. Helkroppsträning som ökar gradvis från 55% till 80% av din 1RM. Perfekt för att lära sig grundövningarna.",
    weeks: 8,
    requiredLifts: ["knäböj", "bänk", "marklyft", "press"],
    generateDays: generateBeginner,
  },
  {
    name: "🔰 Kom igång – Maskiner & Fria vikter",
    description: "6 veckor, 3 pass/vecka. Blandning av maskiner och fria vikter. Lämplig om du är helt ny på gymmet.",
    weeks: 6,
    requiredLifts: ["knäböj", "bänk"],
    generateDays: generateMachineStrength,
  },
  {
    name: "🏠 Hemmaträning – Kroppsvikt",
    description: "6 veckor, 4 pass/vecka. Ingen utrustning behövs. Anpassas efter din erfarenhetsnivå.",
    weeks: 6,
    requiredLifts: [],
    generateFromProfile: generateHomeWorkout,
  },
  {
    name: "🏃 Löpfokus – Distansbygge",
    description: "8 veckor, 3 löppass + 2 styrkepass. Tempo och distanser anpassas efter din löpnivå.",
    weeks: 8,
    requiredLifts: [],
    generateFromProfile: generateRunningPlan,
  },
  {
    name: "🚴 Cykling – Uthållighet & Intervaller",
    description: "8 veckor, 4 cykelpass + 1 styrkepass. Bygg uthållighet med långa pass och förbättra effekt med intervaller.",
    weeks: 8,
    requiredLifts: [],
    generateFromProfile: generateCyclingPlan,
  },
  {
    name: "🏊 Simning – Teknik & Distans",
    description: "6 veckor, 3 simpass + 2 styrkepass. Förbättra teknik och bygg distans. Anpassas efter erfarenhet.",
    weeks: 6,
    requiredLifts: [],
    generateFromProfile: generateSwimmingPlan,
  },
  {
    name: "🥊 Kampsport – Styrka & Kondition",
    description: "8 veckor, 5 pass/vecka. Funktionell styrka, explosivitet och konditionsintervaller för kampsportare.",
    weeks: 8,
    requiredLifts: [],
    generateFromProfile: generateMartialArtsPlan,
  },
];

export const liftLabels: Record<string, string> = {
  "knäböj": "Knäböj",
  "bänk": "Bänkpress",
  "marklyft": "Marklyft",
  "press": "Axelpress / Militärpress",
};
