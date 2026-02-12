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

// ─── Helper: Calculate pace from 10km time ──────────────────────────────────
const calcPace = (time10km: number | null): { easy: string; threshold: string; long: string } => {
  if (!time10km) return { easy: "6:05–6:20", threshold: "5:40–5:35", long: "6:10–6:25" };
  const pacePerKm = time10km / 10; // min/km
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
  const pace = calcPace(profile.time_10km_min);
  const exp = profile.experience_level;

  // Base long run distances for weeks 1-12
  const longRunKm = [14, 15, 16, 17, 14, 18, 18, 19, 20, 16, 14, 10];
  // RPE values (lower for beginners)
  const rpe7 = rpeAdjust(7, exp);
  const rpe8 = rpeAdjust(8, exp);

  const weekPlans: TemplatePlanDay[] = [];
  for (let w = 1; w <= 12; w++) {
    const dist = scaleDistance(longRunKm[w - 1], profile.max_distance_km);
    const isDeload = w === 5 || w >= 10;

    weekPlans.push(
      { week: w, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
      {
        week: w, day: "Tis", session_name: "Styrka överkropp + lätt ben",
        details: isDeload
          ? `Deload: Bänk 3×3 @ RPE ${rpeAdjust(6, exp)}; Lätta böj 2×5 @ RPE ${rpeAdjust(5, exp)}; Rörlighet`
          : `Bänk 5×3 @ RPE ${rpe7}; Lätta böj 3×5 @ RPE ${rpeAdjust(6, exp)}; Rodd/Chins 3×8; Axelpress 3×6`,
        tempo: "RPE enligt text",
      },
      { week: w, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
      {
        week: w, day: "Tors", session_name: "Tröskellöpning",
        details: isDeload
          ? `2×12 min (2 min joggvila) – deload`
          : w <= 4
            ? `3×10 min (2 min joggvila)`
            : `${Math.min(6, 3 + Math.floor((w - 1) / 2))}×${w <= 7 ? "6–8" : "10–12"} min`,
        tempo: pace.threshold,
      },
      {
        week: w, day: "Fre", session_name: "Vila eller lätt jogg",
        details: `${isDeload ? "15–20" : "20–30"} min`,
        tempo: pace.easy,
      },
      {
        week: w, day: "Lör", session_name: "Tung styrka ben + mark",
        details: isDeload
          ? `Deload: Böj 3×3 @ RPE ${rpeAdjust(6, exp)}; Mark 3×2 @ RPE ${rpeAdjust(6, exp)}; Bål 3×10`
          : `Böj 4×3 @ RPE ${rpe7}; Mark 3×3 @ RPE ${rpe7}; Frontböj 3×3 @ RPE ${rpeAdjust(6, exp)}`,
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
  const pace = calcPace(profile.time_10km_min);
  const days: TemplatePlanDay[] = [];
  const baseLongMinutes = [70, 75, 80, 85, 70, 90, 80, 60]; // minutes per week

  for (let w = 1; w <= 8; w++) {
    const longMin = profile.max_distance_km
      ? Math.round(baseLongMinutes[w - 1] * Math.min(1, profile.max_distance_km / 15))
      : baseLongMinutes[w - 1];

    days.push(
      { week: w, day: "Mån", session_name: "Löpning – Lugn", details: `40–50 min i lugnt tempo. Prata-testet: du ska kunna prata.`, tempo: `${pace.easy} min/km` },
      { week: w, day: "Tis", session_name: "Styrka – Helkropp", details: "Knäböj 3×8; Bänkpress 3×8; Rodd 3×10; Axelpress 3×10; Planka 3×45s", tempo: "" },
      { week: w, day: "Ons", session_name: "Vila", details: "Vilodag. Lätt promenad okej.", tempo: "" },
      { week: w, day: "Tors", session_name: "Löpning – Tröskellopp", details: "15 min uppvärmning; 20 min i tröskeltempo; 10 min nedvarvning", tempo: `${pace.threshold} min/km` },
      { week: w, day: "Fre", session_name: "Styrka – Benstyrka", details: "Marklyft 3×5; Benpress 3×10; Hip thrust 3×12; Bencurl 3×12; Core-circuit", tempo: "" },
      { week: w, day: "Lör", session_name: "Löpning – Långpass", details: `${longMin} min i lätt tempo. Bygg uthållighet.`, tempo: `${pace.long} min/km` },
    );
  }
  return days;
}

// ─── Hemmaträning med profilanpassning ───────────────────────────────────────
function generateHomeWorkout(profile: FitnessProfile): TemplatePlanDay[] {
  const exp = profile.experience_level;
  // Adjust volume based on experience
  const reps = exp === "nybörjare" ? { push: 8, sq: 10, rounds: 3 }
    : exp === "avancerad" ? { push: 15, sq: 20, rounds: 5 }
    : { push: 12, sq: 15, rounds: 4 };

  return generateWeeks(6, [
    { day: "Mån", session_name: "Styrka – Överkropp", details: `Armhävningar 4×${reps.push}; Diamond push-ups 3×${Math.max(5, reps.push - 4)}; Pike push-ups 3×${reps.push - 2}; Dips (stol) 3×${reps.push - 2}; Planka 3×45s; Superman hold 3×30s`, tempo: "" },
    { day: "Tis", session_name: "Styrka – Underkropp", details: `Knäböj 4×${reps.sq}; Utfallssteg 3×${Math.round(reps.sq * 0.8)}/ben; Bulgarska utfall (stol) 3×${Math.round(reps.sq * 0.7)}/ben; Hip thrust (golv) 3×${reps.sq}; Vadpress 3×20`, tempo: "" },
    { day: "Ons", session_name: "Vila / Rörlighet", details: "20 min stretching eller yoga. Fokus på höfter, bröstrygg och axlar.", tempo: "" },
    { day: "Tors", session_name: "HIIT + Core", details: `${reps.rounds} rundor: 40s arbete / 20s vila — Burpees; Mountain climbers; Jump squats; High knees. Vila 2 min mellan rundor. Core-finisher: Crunches 3×20; Cykelcrunches 3×15; Benlyft 3×12`, tempo: "" },
    { day: "Fre", session_name: "Helkropp – Volym", details: `Armhävningar 3×max; Knäböj 3×${reps.sq + 5}; Rodd med vattenflaskor/ryggsäck 3×12; Axelpress (ryggsäck) 3×10; Utfallssteg 2×10/ben; Planka 2×60s`, tempo: "" },
  ]);
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
];

export const liftLabels: Record<string, string> = {
  "knäböj": "Knäböj",
  "bänk": "Bänkpress",
  "marklyft": "Marklyft",
  "press": "Axelpress / Militärpress",
};
