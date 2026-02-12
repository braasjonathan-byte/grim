export interface TemplatePlan {
  name: string;
  description: string;
  weeks: number;
  days: { week: number; day: string; session_name: string; details: string; tempo: string }[];
}

const generateWeeks = (
  weekCount: number,
  dayTemplates: { day: string; session_name: string; details: string; tempo: string }[]
) => {
  const days: TemplatePlan["days"] = [];
  for (let w = 1; w <= weekCount; w++) {
    for (const d of dayTemplates) {
      days.push({ week: w, ...d });
    }
  }
  return days;
};

// Original J/W plan from Excel — each week has unique programming
const originalPlanDays: TemplatePlan["days"] = [
  // Week 1
  { week: 1, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 1, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 7; Lätta böj 3×5 @ RPE 6; Rodd/Chins 3×8; Axelpress 3×6", tempo: "RPE enligt text" },
  { week: 1, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 1, day: "Tors", session_name: "Tröskellöpning", details: "3×10 min (2 min joggvila)", tempo: "5:45–5:40" },
  { week: 1, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 1, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 7; Mark 3×3 @ RPE 7; Frontböj 3×3 @ RPE 6", tempo: "RPE enligt text" },
  { week: 1, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:05–6:20" },

  // Week 2
  { week: 2, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 2, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 7–8; Lätta böj 3×5 @ RPE 6; Rodd 4×8", tempo: "RPE enligt text" },
  { week: 2, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 2, day: "Tors", session_name: "Tröskellöpning", details: "4×8 min (2 min joggvila)", tempo: "5:45–5:40" },
  { week: 2, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–30 min", tempo: "6:20–6:40" },
  { week: 2, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 7; Frontböj 3×3 @ RPE 6", tempo: "RPE enligt text" },
  { week: 2, day: "Sön", session_name: "Långpass", details: "15 km", tempo: "6:05–6:20" },

  // Week 3
  { week: 3, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 3, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 6×2 @ RPE 8; Lätta böj 3×5 @ RPE 6; Chins 4×AMRAP", tempo: "RPE enligt text" },
  { week: 3, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 3, day: "Tors", session_name: "Tröskellöpning", details: "4×10 min (2 min joggvila)", tempo: "5:40–5:35" },
  { week: 3, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 3, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 7–8; Enbensutfall 3×8", tempo: "RPE enligt text" },
  { week: 3, day: "Sön", session_name: "Långpass", details: "16 km", tempo: "6:00–6:15" },

  // Week 4
  { week: 4, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 4, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%", tempo: "RPE enligt text" },
  { week: 4, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 4, day: "Tors", session_name: "Tröskellöpning", details: "20 min + 10 min (3 min vila)", tempo: "5:40–5:35" },
  { week: 4, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 4, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8; Pausböj 3×2 @ RPE 6–7", tempo: "RPE enligt text" },
  { week: 4, day: "Sön", session_name: "Långpass", details: "17 km", tempo: "6:00–6:15" },

  // Week 5
  { week: 5, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 5, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Deload: Bänk 3×3 @ RPE 6; Lätta böj 2×5 @ RPE 5–6; Rörlighet", tempo: "RPE enligt text" },
  { week: 5, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 5, day: "Tors", session_name: "Tröskellöpning", details: "2×12 min (2 min joggvila) – deload", tempo: "5:50–5:45" },
  { week: 5, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 5, day: "Lör", session_name: "Tung styrka ben + mark", details: "Deload: Böj 3×3 @ RPE 6; Mark 3×2 @ RPE 6; Bål 3×10", tempo: "RPE enligt text" },
  { week: 5, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:05–6:20" },

  // Week 6
  { week: 6, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 6, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 5×3 @ RPE 8; Böj 3×3 @ RPE 6–7; Rodd 4×8", tempo: "RPE enligt text" },
  { week: 6, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 6, day: "Tors", session_name: "Tröskellöpning", details: "5×6 min (90 s vila)", tempo: "5:35–5:30" },
  { week: 6, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–30 min", tempo: "6:20–6:40" },
  { week: 6, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 8; Frontböj 3×2 @ RPE 7", tempo: "RPE enligt text" },
  { week: 6, day: "Sön", session_name: "Långpass", details: "18 km", tempo: "5:55–6:10" },

  // Week 7
  { week: 7, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 7, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 6×2 @ RPE 8; Axelpress 3×5 @ RPE 7; Chins 4×AMRAP", tempo: "RPE enligt text" },
  { week: 7, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 7, day: "Tors", session_name: "Tröskellöpning", details: "6×5 min (90 s vila)", tempo: "5:35–5:30" },
  { week: 7, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 7, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 8; Enbensarbete 3×8", tempo: "RPE enligt text" },
  { week: 7, day: "Sön", session_name: "Långpass", details: "18 km", tempo: "5:55–6:10" },

  // Week 8
  { week: 8, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 8, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%", tempo: "RPE enligt text" },
  { week: 8, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 8, day: "Tors", session_name: "Tröskellöpning", details: "3×12 min (2 min joggvila)", tempo: "5:30–5:25" },
  { week: 8, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 8, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8.5; Pausböj 3×2 @ RPE 7", tempo: "RPE enligt text" },
  { week: 8, day: "Sön", session_name: "Långpass", details: "19 km", tempo: "5:55–6:10" },

  // Week 9
  { week: 9, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 9, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Bänk tung singel @ RPE 8, sedan 3×3 @ RPE 7; Lätta böj 3×5 @ RPE 6", tempo: "RPE enligt text" },
  { week: 9, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 9, day: "Tors", session_name: "Tröskellöpning", details: "2×15 min (3 min joggvila)", tempo: "5:30–5:25" },
  { week: 9, day: "Fre", session_name: "Vila eller lätt jogg", details: "25–35 min", tempo: "6:20–6:40" },
  { week: 9, day: "Lör", session_name: "Tung styrka ben + mark", details: "Böj 4×2 @ RPE 8.5; Mark 4×1 @ RPE 8.5; Bål 3×10", tempo: "RPE enligt text" },
  { week: 9, day: "Sön", session_name: "Långpass", details: "20 km", tempo: "5:55–6:10" },

  // Week 10
  { week: 10, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 10, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Taper: Bänk 3×3 @ RPE 7; Lätta böj 2×5 @ RPE 6", tempo: "RPE enligt text" },
  { week: 10, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 10, day: "Tors", session_name: "Tröskellöpning", details: "4×6 min (90 s vila) – taper", tempo: "5:35–5:30" },
  { week: 10, day: "Fre", session_name: "Vila eller lätt jogg", details: "20–25 min", tempo: "6:20–6:40" },
  { week: 10, day: "Lör", session_name: "Tung styrka ben + mark", details: "Taper: Böj 3×2 @ RPE 7; Mark 3×1 @ RPE 7; Lätta hopp/koord", tempo: "RPE enligt text" },
  { week: 10, day: "Sön", session_name: "Långpass", details: "16 km", tempo: "6:05–6:20" },

  // Week 11
  { week: 11, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 11, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Taper: Bänk 2×3 @ RPE 6–7; Rörlighet", tempo: "RPE enligt text" },
  { week: 11, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 11, day: "Tors", session_name: "Tröskellöpning", details: "3×6 min (90 s vila) – taper", tempo: "5:40–5:35" },
  { week: 11, day: "Fre", session_name: "Vila eller lätt jogg", details: "15–20 min", tempo: "6:20–6:40" },
  { week: 11, day: "Lör", session_name: "Tung styrka ben + mark", details: "Taper: Böj 2×2 @ RPE 6–7; Mark 2×1 @ RPE 6–7; Bål 2×8", tempo: "RPE enligt text" },
  { week: 11, day: "Sön", session_name: "Långpass", details: "14 km", tempo: "6:10–6:25" },

  // Week 12
  { week: 12, day: "Mån", session_name: "Vila / promenad", details: "10–30 min lätt gång eller full vila", tempo: "—" },
  { week: 12, day: "Tis", session_name: "Styrka överkropp + lätt ben", details: "Tävlingsvecka: Bänk 2×2 @ RPE 6 (valfritt), rörlighet", tempo: "RPE enligt text" },
  { week: 12, day: "Ons", session_name: "Återhämtning / lätt cykel", details: "20–30 min cykel + rörlighet 10 min", tempo: "—" },
  { week: 12, day: "Tors", session_name: "Tröskellöpning", details: "10–15 min lätt fartkänsla – tävlingsvecka", tempo: "5:40–5:35" },
  { week: 12, day: "Fre", session_name: "Vila eller lätt jogg", details: "10–15 min", tempo: "6:20–6:40" },
  { week: 12, day: "Lör", session_name: "Tung styrka ben + mark", details: "Tävlingsvecka: Lätt böj 2×3 @ RPE 6 (mån/tis om du vill) – ingen tung mark", tempo: "RPE enligt text" },
  { week: 12, day: "Sön", session_name: "Långpass", details: "10 km", tempo: "6:15–6:30" },
];

export const planTemplates: TemplatePlan[] = [
  {
    name: "💪 Styrka & Löpning (12 veckor)",
    description: "7 pass/vecka: Styrka överkropp, tung ben+mark, tröskellöpning, långpass + vila/återhämtning. Progressiv periodisering med deload och taper.",
    weeks: 12,
    days: originalPlanDays,
  },
  {
    name: "🏃 Löpfokus (8 veckor)",
    description: "3 löppass + 2 styrkepass per vecka. Bygga löpkapacitet med stödjande styrketräning.",
    weeks: 8,
    days: generateWeeks(8, [
      { day: "Mån", session_name: "Löpning – Lugn", details: "40–50 min i lugnt tempo. Prata-testet: du ska kunna prata.", tempo: "5:30–6:00 min/km" },
      { day: "Tis", session_name: "Styrka – Helkropp", details: "Knäböj 3×8; Bänkpress 3×8; Rodd 3×10; Axelpress 3×10; Planka 3×45s", tempo: "" },
      { day: "Ons", session_name: "Vila", details: "Vilodag. Lätt promenad okej.", tempo: "" },
      { day: "Tors", session_name: "Löpning – Tröskellopp", details: "15 min uppvärmning; 20 min i tröskeltempo; 10 min nedvarvning", tempo: "4:50–5:10 min/km" },
      { day: "Fre", session_name: "Styrka – Benstyrka", details: "Marklyft 3×5; Benpress 3×10; Hip thrust 3×12; Bencurl 3×12; Core-circuit", tempo: "" },
      { day: "Lör", session_name: "Löpning – Långpass", details: "70–90 min i lätt tempo. Bygg uthållighet.", tempo: "5:40–6:15 min/km" },
    ]),
  },
  {
    name: "🏋️ Ren Styrka (6 veckor)",
    description: "4 styrkepass per vecka. Push/Pull/Ben-split för maximal styrka.",
    weeks: 6,
    days: generateWeeks(6, [
      { day: "Mån", session_name: "Push – Bröst & Axlar", details: "Bänkpress 5×5; Axelpress 4×6; Incline hantelpress 3×8; Sidolyft 3×15; Dips 3×max", tempo: "" },
      { day: "Tis", session_name: "Pull – Rygg & Biceps", details: "Marklyft 5×3; Skivstångsrodd 4×6; Chins 3×max; Face pulls 3×15; Hammarcurl 3×12", tempo: "" },
      { day: "Ons", session_name: "Vila", details: "Vilodag", tempo: "" },
      { day: "Tors", session_name: "Ben – Knäböj-fokus", details: "Knäböj 5×5; Frontböj 3×6; Bulgarska utfall 3×8/ben; Benextension 3×12; Vadpress 4×15", tempo: "" },
      { day: "Fre", session_name: "Överkropp – Volume", details: "Close-grip bänk 4×8; Latsdrag 4×10; Hantelflyes 3×12; Preacher curl 3×10; Skallkross 3×10", tempo: "" },
    ]),
  },
];
