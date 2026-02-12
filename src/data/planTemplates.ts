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

export const planTemplates: TemplatePlan[] = [
  {
    name: "💪 Styrka & Löpning (12 veckor)",
    description: "4 styrkepass + 2 löppass per vecka. Fokus på att bygga styrka i bänk, knäböj och marklyft med löpning för kondition.",
    weeks: 12,
    days: generateWeeks(12, [
      {
        day: "Mån",
        session_name: "Styrka – Överkropp Push",
        details: "Bänkpress 5×3 @ RPE 7; Incline hantelpress 3×8; Sidolyft 3×12; Triceps pushdown 3×10; Face pulls 3×15",
        tempo: "",
      },
      {
        day: "Tis",
        session_name: "Löpning – Intervaller",
        details: "10 min uppvärmning; 8×400m med 90s vila; 10 min nedvarvning",
        tempo: "Mål: 1:40–1:50 per 400m",
      },
      {
        day: "Ons",
        session_name: "Styrka – Underkropp",
        details: "Knäböj 5×3 @ RPE 7; Rumänsk marklyft 3×8; Bulgarska utfall 3×10/ben; Bencurl 3×12; Vadpress 3×15",
        tempo: "",
      },
      {
        day: "Tors",
        session_name: "Vila / Rörlighet",
        details: "Valfritt: Lätt promenad, stretching, foam rolling",
        tempo: "",
      },
      {
        day: "Fre",
        session_name: "Styrka – Överkropp Pull",
        details: "Skivstångsrodd 5×3 @ RPE 7; Chins 3×max; Latsdrag 3×10; Bicepscurl 3×12; Hängande benlyft 3×10",
        tempo: "",
      },
      {
        day: "Lör",
        session_name: "Löpning – Långpass",
        details: "60–90 min lugnt tempo. Fokus på distans, inte fart.",
        tempo: "Mål: 5:30–6:00 min/km",
      },
    ]),
  },
  {
    name: "🏃 Löpfokus (8 veckor)",
    description: "3 löppass + 2 styrkepass per vecka. Bygga löpkapacitet med stödjande styrketräning.",
    weeks: 8,
    days: generateWeeks(8, [
      {
        day: "Mån",
        session_name: "Löpning – Lugn",
        details: "40–50 min i lugnt tempo. Prata-testet: du ska kunna prata.",
        tempo: "Mål: 5:30–6:00 min/km",
      },
      {
        day: "Tis",
        session_name: "Styrka – Helkropp",
        details: "Knäböj 3×8; Bänkpress 3×8; Rodd 3×10; Axelpress 3×10; Planka 3×45s",
        tempo: "",
      },
      {
        day: "Ons",
        session_name: "Vila",
        details: "Vilodag. Lätt promenad okej.",
        tempo: "",
      },
      {
        day: "Tors",
        session_name: "Löpning – Tröskellopp",
        details: "15 min uppvärmning; 20 min i tröskeltempo; 10 min nedvarvning",
        tempo: "Mål: 4:50–5:10 min/km",
      },
      {
        day: "Fre",
        session_name: "Styrka – Benstyrka",
        details: "Marklyft 3×5; Benpress 3×10; Hip thrust 3×12; Bencurl 3×12; Core-circuit",
        tempo: "",
      },
      {
        day: "Lör",
        session_name: "Löpning – Långpass",
        details: "70–90 min i lätt tempo. Bygg uthållighet.",
        tempo: "Mål: 5:40–6:15 min/km",
      },
    ]),
  },
  {
    name: "🏋️ Ren Styrka (6 veckor)",
    description: "4 styrkepass per vecka. Push/Pull/Ben-split för maximal styrka.",
    weeks: 6,
    days: generateWeeks(6, [
      {
        day: "Mån",
        session_name: "Push – Bröst & Axlar",
        details: "Bänkpress 5×5; Axelpress 4×6; Incline hantelpress 3×8; Sidolyft 3×15; Dips 3×max",
        tempo: "",
      },
      {
        day: "Tis",
        session_name: "Pull – Rygg & Biceps",
        details: "Marklyft 5×3; Skivstångsrodd 4×6; Chins 3×max; Face pulls 3×15; Hammarcurl 3×12",
        tempo: "",
      },
      {
        day: "Ons",
        session_name: "Vila",
        details: "Vilodag",
        tempo: "",
      },
      {
        day: "Tors",
        session_name: "Ben – Knäböj-fokus",
        details: "Knäböj 5×5; Frontböj 3×6; Bulgarska utfall 3×8/ben; Benextension 3×12; Vadpress 4×15",
        tempo: "",
      },
      {
        day: "Fre",
        session_name: "Överkropp – Volume",
        details: "Close-grip bänk 4×8; Latsdrag 4×10; Hantelflyes 3×12; Preacher curl 3×10; Skallkross 3×10",
        tempo: "",
      },
    ]),
  },
];
