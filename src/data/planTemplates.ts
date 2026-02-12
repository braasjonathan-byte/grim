export interface TemplatePlan {
  name: string;
  description: string;
  weeks: number;
  /** Which 1RM lifts this program needs. Empty = RPE-based / no calc needed */
  requiredLifts: string[];
  /** Function that generates days given 1RM values. If not provided, uses static `days` */
  generateDays?: (rms: Record<string, number>) => TemplatePlanDay[];
  days?: TemplatePlanDay[];
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

// ─── Original J/W plan (RPE-based, no 1RM needed) ───────────────────────────
const originalPlanDays: TemplatePlanDay[] = [
  { week: 1, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 1, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 7; Lätta böj 3×5 @ RPE 6; Rodd/Chins 3×8; Axelpress 3×6", tempo: "RPE enligt text" },
  { week: 1, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 1, day: "Tors", session_name: "Tröskellöpning", details: "3×10 min (2 min joggvila)", tempo: "5:45–5:40" },
  { week: 1, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 1, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 7; Mark 3×3 @ RPE 7; Frontböj 3×3 @ RPE 6", tempo: "RPE enligt text" },
  { week: 1, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:05–6:20" },
  { week: 2, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 2, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 7–8; Lätta böj 3×5 @ RPE 6; Rodd 4×8", tempo: "RPE enligt text" },
  { week: 2, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 2, day: "Tors", session_name: "Tröskellöpning", details: "4×8 min (2 min joggvila)", tempo: "5:45–5:40" },
  { week: 2, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–30 min", tempo: "6:20–6:40" },
  { week: 2, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 7; Frontböj 3×3 @ RPE 6", tempo: "RPE enligt text" },
  { week: 2, day: "Sön", session_name: "Långpass", details: "15 km", tempo: "6:05–6:20" },
  { week: 3, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 3, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 6×2 @ RPE 8; Lätta böj 3×5 @ RPE 6; Chins 4×AMRAP", tempo: "RPE enligt text" },
  { week: 3, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 3, day: "Tors", session_name: "Tröskellöpning", details: "4×10 min (2 min joggvila)", tempo: "5:40–5:35" },
  { week: 3, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 3, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 7–8; Enbensutfall 3×8", tempo: "RPE enligt text" },
  { week: 3, day: "Sön", session_name: "Långpass", details: "16 km", tempo: "6:00–6:15" },
  { week: 4, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 4, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%", tempo: "RPE enligt text" },
  { week: 4, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 4, day: "Tors", session_name: "Tröskellöpning", details: "20 min + 10 min (3 min vila)", tempo: "5:40–5:35" },
  { week: 4, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 4, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8; Pausböj 3×2 @ RPE 6–7", tempo: "RPE enligt text" },
  { week: 4, day: "Sön", session_name: "Långpass", details: "17 km", tempo: "6:00–6:15" },
  { week: 5, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 5, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Deload: Bänk 3×3 @ RPE 6; Lätta böj 2×5 @ RPE 5–6; Rörlighet", tempo: "RPE enligt text" },
  { week: 5, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 5, day: "Tors", session_name: "Tröskellöpning", details: "2×12 min (2 min joggvila) – deload", tempo: "5:50–5:45" },
  { week: 5, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 5, day: "Lör", session_name: "Tung styrka ben + mark", details: "Deload: Böj 3×3 @ RPE 6; Mark 3×2 @ RPE 6; Bål 3×10", tempo: "RPE enligt text" },
  { week: 5, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:05–6:20" },
  { week: 6, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 6, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 8; Böj 3×3 @ RPE 6–7; Rodd 4×8", tempo: "RPE enligt text" },
  { week: 6, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 6, day: "Tors", session_name: "Tröskellöpning", details: "5×6 min (90 s vila)", tempo: "5:35–5:30" },
  { week: 6, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 6, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 8; Frontböj 3×2 @ RPE 7", tempo: "RPE enligt text" },
  { week: 6, day: "Sön", session_name: "Långpass", details: "18 km", tempo: "5:55–6:10" },
  { week: 7, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 7, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 6×2 @ RPE 8; Axelpress 3×5 @ RPE 7; Chins 4×AMRAP", tempo: "RPE enligt text" },
  { week: 7, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 7, day: "Tors", session_name: "Tröskellöpning", details: "6×5 min (90 s vila)", tempo: "5:35–5:30" },
  { week: 7, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 7, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 8; Enbensarbete 3×8", tempo: "RPE enligt text" },
  { week: 7, day: "Sön", session_name: "Långpass", details: "18 km", tempo: "5:55–6:10" },
  { week: 8, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 8, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%", tempo: "RPE enligt text" },
  { week: 8, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 8, day: "Tors", session_name: "Tröskellöpning", details: "3×12 min (2 min joggvila)", tempo: "5:30–5:25" },
  { week: 8, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 8, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8.5; Pausböj 3×2 @ RPE 7", tempo: "RPE enligt text" },
  { week: 8, day: "Sön", session_name: "Långpass", details: "19 km", tempo: "5:55–6:10" },
  { week: 9, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 9, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk tung singel @ RPE 8, sedan 3×3 @ RPE 7; Lätta böj 3×5 @ RPE 6", tempo: "RPE enligt text" },
  { week: 9, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 9, day: "Tors", session_name: "Tröskellöpning", details: "2×15 min (3 min joggvila)", tempo: "5:30–5:25" },
  { week: 9, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 9, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×2 @ RPE 8.5; Mark 4×1 @ RPE 8.5; Bål 3×10", tempo: "RPE enligt text" },
  { week: 9, day: "Sön", session_name: "Långpass", details: "20 km", tempo: "5:55–6:10" },
  { week: 10, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 10, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Taper: Bänk 3×3 @ RPE 7; Lätta böj 2×5 @ RPE 6", tempo: "RPE enligt text" },
  { week: 10, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 10, day: "Tors", session_name: "Tröskellöpning", details: "4×6 min (90 s vila) – taper", tempo: "5:35–5:30" },
  { week: 10, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 10, day: "Lör", session_name: "Tung styrka ben + mark", details: "Taper: Böj 3×2 @ RPE 7; Mark 3×1 @ RPE 7; Lätta hopp/koord", tempo: "RPE enligt text" },
  { week: 10, day: "Sön", session_name: "Långpass", details: "16 km", tempo: "6:05–6:20" },
  { week: 11, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 11, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Taper: Bänk 2×3 @ RPE 6–7; Rörlighet", tempo: "RPE enligt text" },
  { week: 11, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 11, day: "Tors", session_name: "Tröskellöpning", details: "3×6 min (90 s vila) – taper", tempo: "5:40–5:35" },
  { week: 11, day: "Fre", session_name: "Vila eller lätt jogg", details: "15–20 min", tempo: "6:20–6:40" },
  { week: 11, day: "Lör", session_name: "Tung styrka ben + mark", details: "Taper: Böj 2×2 @ RPE 6–7; Mark 2×1 @ RPE 6–7; Bål 2×8", tempo: "RPE enligt text" },
  { week: 11, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:10–6:25" },
  { week: 12, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 12, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Tävlingsvecka: Bänk 2×2 @ RPE 6 (valfritt), rörlighet", tempo: "RPE enligt text" },
  { week: 12, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 12, day: "Tors", session_name: "Tröskellöpning", details: "10–15 min lätt fartkänsla – tävlingsvecka", tempo: "5:40–5:35" },
  { week: 12, day: "Fre", session_name: "Vila eller lätt jogg", details: "10–15 min", tempo: "6:20–6:40" },
  { week: 12, day: "Lör", session_name: "Tung styrka ben + mark", details: "Tävlingsvecka: Lätt böj 2×3 @ RPE 6 (mån/tis om du vill) – ingen tung mark", tempo: "RPE enligt text" },
  { week: 12, day: "Sön", session_name: "Långpass", details: "10 km", tempo: "6:15–6:30" },
];

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

export const planTemplates: TemplatePlan[] = [
  {
    name: "💪 Styrka & Löpning – Kombination",
    description: "12 veckor, 7 pass/vecka. Styrka + tröskellöpning + långpass. Progressiv periodisering med deload och taper. RPE-baserat.",
    weeks: 12,
    requiredLifts: [],
    days: originalPlanDays,
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
    name: "🏃 Löpfokus – Distansbygge",
    description: "8 veckor, 3 löppass + 2 styrkepass. Bygga löpkapacitet med stödjande styrketräning.",
    weeks: 8,
    requiredLifts: [],
    days: generateWeeks(8, [
      { day: "Mån", session_name: "Löpning – Lugn", details: "40–50 min i lugnt tempo. Prata-testet: du ska kunna prata.", tempo: "5:30–6:00 min/km" },
      { day: "Tis", session_name: "Styrka – Helkropp", details: "Knäböj 3×8; Bänkpress 3×8; Rodd 3×10; Axelpress 3×10; Planka 3×45s", tempo: "" },
      { day: "Ons", session_name: "Vila", details: "Vilodag. Lätt promenad okej.", tempo: "" },
      { day: "Tors", session_name: "Löpning – Tröskellopp", details: "15 min uppvärmning; 20 min i tröskeltempo; 10 min nedvarvning", tempo: "4:50–5:10 min/km" },
      { day: "Fre", session_name: "Styrka – Benstyrka", details: "Marklyft 3×5; Benpress 3×10; Hip thrust 3×12; Bencurl 3×12; Core-circuit", tempo: "" },
      { day: "Lör", session_name: "Löpning – Långpass", details: "70–90 min i lätt tempo. Bygg uthållighet.", tempo: "5:40–6:15 min/km" },
    ]),
  },
];

export const liftLabels: Record<string, string> = {
  "knäböj": "Knäböj",
  "bänk": "Bänkpress",
  "marklyft": "Marklyft",
  "press": "Axelpress / Militärpress",
};
