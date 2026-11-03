import type { FitnessProfile, TemplatePlan, TemplatePlanDay } from "@/data/planTemplates";

/**
 * Fler scheman så det finns något för alla nivåer, 2–6 dagar och hemma/gym.
 * Gemensam blockstruktur: ackumulering (v1–3) → intensifiering (v5–7), deload v4 och v8.
 * Dubbel progression: nå toppen av repsintervallet i alla set → höj vikten nästa pass
 * (appen föreslår "+2,5 kg" automatiskt utifrån loggen).
 */
type Ex = { name: string; sets: number; reps: string; main?: boolean };
type Session = { day: string; name: string; ex: Ex[] };

const baseRpe = (p?: FitnessProfile) => (p?.experience_level === "nybörjare" ? 6.5 : p?.experience_level === "avancerad" ? 8 : 7);
const fmtR = (n: number) => n.toFixed(1).replace(".0", "");

/** Bygger veckor med deload v4/v8, RPE-stegring och en extra set i intensifieringsblocket. */
export function buildBlockProgram(sessions: Session[], profile?: FitnessProfile, weeks = 8): TemplatePlanDay[] {
  const out: TemplatePlanDay[] = [];
  const b = baseRpe(profile);
  for (let w = 1; w <= weeks; w++) {
    const deload = w % 4 === 0;
    const block2 = w > 4;
    const rpe = deload ? Math.max(5, b - 2) : Math.min(9, b + ((w - 1) % 4) * 0.5);
    for (const s of sessions) {
      const lines = s.ex.map((e) => {
        // Planparsern förstår ett repsvärde: använd intervallets botten som mål.
        // Dubbel progression: klarar du toppen (+4 reps) i alla set → höj vikten.
        const reps = e.reps.replace(/(\d+)–\d+/, "$1");
        const sets = deload ? Math.max(1, Math.ceil(e.sets / 2)) : e.sets + (block2 && e.main ? 1 : 0);
        return e.main ? `${e.name} ${sets}×${reps} @ RPE ${fmtR(rpe)}` : `${e.name} ${sets}×${reps}`;
      });
      out.push({
        week: w, day: s.day,
        session_name: deload ? `${s.name} – Deload` : s.name,
        details: lines.join("\n"),
        tempo: deload ? "Deload – halva volymen, lätta vikter" : `RPE ${fmtR(rpe)} · dubbel progression: bygg reps, höj vikten när alla set klaras med marginal`,
      });
    }
  }
  return out;
}

const DB_FULL_3: Session[] = [
  { day: "Mån", name: "Hantlar Helkropp A", ex: [
    { name: "Goblet squat", sets: 3, reps: "8–12", main: true }, { name: "Hantelpress golv", sets: 3, reps: "8–12", main: true },
    { name: "Enarmsrodd hantel", sets: 3, reps: "10–12" }, { name: "Rumänsk marklyft hantlar", sets: 3, reps: "10–12" }, { name: "Planka", sets: 3, reps: "30–45s" } ] },
  { day: "Ons", name: "Hantlar Helkropp B", ex: [
    { name: "Bulgarska utfall", sets: 3, reps: "8–12/ben", main: true }, { name: "Axelpress hantlar", sets: 3, reps: "8–12", main: true },
    { name: "Armhävningar", sets: 3, reps: "max" }, { name: "Höftlyft hantel", sets: 3, reps: "12–15" }, { name: "Bicepscurl", sets: 2, reps: "12–15" } ] },
  { day: "Fre", name: "Hantlar Helkropp C", ex: [
    { name: "Hantel-marklyft", sets: 3, reps: "8–10", main: true }, { name: "Lutande hantelpress", sets: 3, reps: "8–12", main: true },
    { name: "Hantelrodd böjd", sets: 3, reps: "10–12" }, { name: "Utfallssteg", sets: 3, reps: "10/ben" }, { name: "Sidolyft", sets: 3, reps: "12–20" }, { name: "Dead bug", sets: 3, reps: "10/sida" } ] },
];

const DB_UL_4: Session[] = [
  { day: "Mån", name: "Hantlar Överkropp A", ex: [
    { name: "Hantelpress golv", sets: 4, reps: "6–10", main: true }, { name: "Enarmsrodd hantel", sets: 4, reps: "8–12", main: true },
    { name: "Axelpress hantlar", sets: 3, reps: "8–12" }, { name: "Bicepscurl", sets: 3, reps: "10–15" }, { name: "Skallkross hantlar", sets: 3, reps: "10–15" } ] },
  { day: "Tis", name: "Hantlar Underkropp A", ex: [
    { name: "Goblet squat", sets: 4, reps: "8–12", main: true }, { name: "Rumänsk marklyft hantlar", sets: 4, reps: "8–12", main: true },
    { name: "Bulgarska utfall", sets: 3, reps: "10/ben" }, { name: "Vadpress", sets: 3, reps: "15–20" } ] },
  { day: "Tors", name: "Hantlar Överkropp B", ex: [
    { name: "Lutande hantelpress", sets: 4, reps: "8–12", main: true }, { name: "Hantelrodd böjd", sets: 4, reps: "8–12", main: true },
    { name: "Sidolyft", sets: 4, reps: "12–20" }, { name: "Armhävningar", sets: 2, reps: "max" }, { name: "Hammarcurl", sets: 3, reps: "10–15" } ] },
  { day: "Fre", name: "Hantlar Underkropp B", ex: [
    { name: "Hantel-marklyft", sets: 4, reps: "6–10", main: true }, { name: "Step-ups", sets: 3, reps: "10/ben", main: true },
    { name: "Höftlyft hantel", sets: 3, reps: "10–15" }, { name: "Planka", sets: 3, reps: "45s" } ] },
];

const PPL_3: Session[] = [
  { day: "Mån", name: "Push", ex: [
    { name: "Bänkpress", sets: 3, reps: "6–10", main: true }, { name: "Axelpress", sets: 3, reps: "8–12", main: true },
    { name: "Lutande hantelpress", sets: 3, reps: "10–12" }, { name: "Sidolyft", sets: 3, reps: "12–20" }, { name: "Triceps pushdown", sets: 3, reps: "10–15" } ] },
  { day: "Ons", name: "Pull", ex: [
    { name: "Rodd", sets: 3, reps: "6–10", main: true }, { name: "Latsdrag", sets: 3, reps: "8–12", main: true },
    { name: "Face pulls", sets: 3, reps: "15" }, { name: "Bicepscurl", sets: 3, reps: "10–15" }, { name: "Hammarcurl", sets: 2, reps: "12" } ] },
  { day: "Fre", name: "Legs", ex: [
    { name: "Knäböj", sets: 3, reps: "5–8", main: true }, { name: "Rumänsk marklyft", sets: 3, reps: "8–10", main: true },
    { name: "Benpress", sets: 3, reps: "10–15" }, { name: "Bencurl", sets: 3, reps: "10–15" }, { name: "Vadpress", sets: 3, reps: "15–20" } ] },
];

const GLUTES_4: Session[] = [
  { day: "Mån", name: "Ben & Glutes – Tungt", ex: [
    { name: "Hip thrust", sets: 4, reps: "6–10", main: true }, { name: "Knäböj", sets: 3, reps: "6–10", main: true },
    { name: "Rumänsk marklyft", sets: 3, reps: "8–12" }, { name: "Abduktor maskin", sets: 3, reps: "15–20" } ] },
  { day: "Tis", name: "Överkropp", ex: [
    { name: "Latsdrag", sets: 3, reps: "8–12", main: true }, { name: "Axelpress hantlar", sets: 3, reps: "8–12", main: true },
    { name: "Kabelrodd", sets: 3, reps: "10–12" }, { name: "Sidolyft", sets: 3, reps: "12–20" }, { name: "Triceps pushdown", sets: 2, reps: "12–15" } ] },
  { day: "Tors", name: "Ben & Glutes – Volym", ex: [
    { name: "Bulgarska utfall", sets: 3, reps: "8–12/ben", main: true }, { name: "Benpress", sets: 3, reps: "10–15", main: true },
    { name: "Glute kickback kabel", sets: 3, reps: "12–15/ben" }, { name: "Bencurl", sets: 3, reps: "10–15" }, { name: "Vadpress", sets: 3, reps: "15–20" } ] },
  { day: "Lör", name: "Helkropp + Bål", ex: [
    { name: "Marklyft", sets: 3, reps: "5–8", main: true }, { name: "Hantelpress", sets: 3, reps: "8–12" },
    { name: "Hip thrust singel ben", sets: 3, reps: "10–12/ben" }, { name: "Pallof press", sets: 3, reps: "12/sida" } ] },
];

const ADV_5: Session[] = [
  { day: "Mån", name: "Överkropp – Styrka", ex: [
    { name: "Bänkpress", sets: 4, reps: "4–6", main: true }, { name: "Rodd", sets: 4, reps: "6–8", main: true },
    { name: "Axelpress", sets: 3, reps: "6–8" }, { name: "Chins", sets: 3, reps: "6–10" } ] },
  { day: "Tis", name: "Underkropp – Styrka", ex: [
    { name: "Knäböj", sets: 4, reps: "4–6", main: true }, { name: "Rumänsk marklyft", sets: 3, reps: "6–8", main: true },
    { name: "Benpress", sets: 3, reps: "8–12" }, { name: "Vadpress", sets: 4, reps: "10–15" } ] },
  { day: "Tors", name: "Push – Hypertrofi", ex: [
    { name: "Lutande hantelpress", sets: 4, reps: "8–12", main: true }, { name: "Axelpress hantlar", sets: 3, reps: "10–12" },
    { name: "Kabel-flyes", sets: 3, reps: "12–15" }, { name: "Sidolyft", sets: 4, reps: "15–20" }, { name: "Triceps overhead", sets: 3, reps: "10–15" } ] },
  { day: "Fre", name: "Pull – Hypertrofi", ex: [
    { name: "Latsdrag", sets: 4, reps: "8–12", main: true }, { name: "Kabelrodd", sets: 4, reps: "10–12" },
    { name: "Face pulls", sets: 3, reps: "15–20" }, { name: "Bicepscurl", sets: 3, reps: "10–15" }, { name: "Hammarcurl", sets: 3, reps: "10–15" } ] },
  { day: "Lör", name: "Legs – Hypertrofi", ex: [
    { name: "Frontböj", sets: 3, reps: "6–10", main: true }, { name: "Hip thrust", sets: 3, reps: "8–12" },
    { name: "Bulgarska utfall", sets: 3, reps: "10/ben" }, { name: "Bencurl", sets: 4, reps: "10–15" }, { name: "Hängande benlyft", sets: 3, reps: "10–15" } ] },
];

const MINIMAL_2: Session[] = [
  { day: "Tis", name: "Helkropp A (45 min)", ex: [
    { name: "Knäböj", sets: 3, reps: "6–10", main: true }, { name: "Bänkpress", sets: 3, reps: "6–10", main: true },
    { name: "Latsdrag", sets: 3, reps: "8–12" }, { name: "Planka", sets: 2, reps: "45s" } ] },
  { day: "Fre", name: "Helkropp B (45 min)", ex: [
    { name: "Marklyft", sets: 3, reps: "5–8", main: true }, { name: "Axelpress", sets: 3, reps: "6–10", main: true },
    { name: "Kabelrodd", sets: 3, reps: "8–12" }, { name: "Utfallssteg", sets: 2, reps: "10/ben" } ] },
];

export const extraPlanTemplates: TemplatePlan[] = [
  {
    name: "⏱️ Minimalist – 2 pass/vecka, 45 min",
    description: "8 veckor, 2 pass/vecka. Helkropp A/B med basövningar och dubbel progression. Deload v.4 och v.8. För dig med lite tid – alla nivåer.",
    weeks: 8, category: "styrka", requiredLifts: [], isBeginnerFriendly: true,
    level: "alla", daysPerWeek: 2, equipment: "gym",
    generateFromProfile: (p) => buildBlockProgram(MINIMAL_2, p),
  },
  {
    name: "🏠 Hantlar hemma – Helkropp 3 dagar",
    description: "8 veckor, 3 pass/vecka. Bara hantlar (och golv). Helkropp A/B/C med dubbel progression och deload v.4/v.8. Nybörjare–medel.",
    weeks: 8, category: "styrka", requiredLifts: [], isBeginnerFriendly: true,
    level: "nybörjare", daysPerWeek: 3, equipment: "hantlar",
    generateFromProfile: (p) => buildBlockProgram(DB_FULL_3, p),
  },
  {
    name: "🏠 Hantlar hemma – Överkropp/Underkropp 4 dagar",
    description: "8 veckor, 4 pass/vecka. Upper/lower med bara hantlar. Två block (volym → intensitet) med deload. Medel.",
    weeks: 8, category: "styrka", requiredLifts: [],
    level: "medel", daysPerWeek: 4, equipment: "hantlar",
    generateFromProfile: (p) => buildBlockProgram(DB_UL_4, p),
  },
  {
    name: "🔁 PPL 3 dagar – Push/Pull/Legs",
    description: "8 veckor, 3 pass/vecka. Klassisk PPL en gång per vecka – bra steg från helkropp. Dubbel progression, deload v.4/v.8. Nybörjare–medel.",
    weeks: 8, category: "styrka", requiredLifts: [], isBeginnerFriendly: true,
    level: "nybörjare", daysPerWeek: 3, equipment: "gym",
    generateFromProfile: (p) => buildBlockProgram(PPL_3, p),
  },
  {
    name: "🍑 Ben & Glutes – 4 dagar",
    description: "8 veckor, 4 pass/vecka. Fokus på säte och ben (hip thrust, knäböj, RDL, utfall) + ett överkroppspass. Block med deload. Medel.",
    weeks: 8, category: "styrka", requiredLifts: [],
    level: "medel", daysPerWeek: 4, equipment: "gym",
    generateFromProfile: (p) => buildBlockProgram(GLUTES_4, p),
  },
  {
    name: "🧱 Avancerad – Power/Hypertrofi 5 dagar (12 v)",
    description: "12 veckor, 5 pass/vecka. Upper/lower-styrka + PPL-hypertrofi (PHUL/PHAT-stil). Tre 4-veckorsblock med stigande RPE, extra set i senare block och deload var 4:e vecka. Avancerad.",
    weeks: 12, category: "styrka", requiredLifts: [],
    level: "avancerad", daysPerWeek: 5, equipment: "gym",
    generateFromProfile: (p) => buildBlockProgram(ADV_5, p, 12),
  },
];
