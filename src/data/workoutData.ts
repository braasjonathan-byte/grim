export interface WorkoutDay {
  week: number;
  day: string;
  session: string;
  details: string;
  tempo: string;
  comment: string;
}

export type Profile = "J" | "W";

const parseSchedule = (rows: string[][]): WorkoutDay[] => {
  const days: WorkoutDay[] = [];
  let currentWeek = 0;
  for (const row of rows) {
    if (row[0]) currentWeek = parseInt(row[0]);
    if (!row[1]) continue;
    days.push({
      week: currentWeek,
      day: row[1],
      session: row[2] || "",
      details: row[3] || "",
      tempo: row[4] || "",
      comment: row[5] || "",
    });
  }
  return days;
};

// Page 1 - J's schedule
const jRows: string[][] = [
  ["1","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—","50 min snittpuls 141, hastighet på band 6.3 snitt"],
  ["1","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 7; Lätta böj 3×5 @ RPE 6; Rodd/Chins 3×8; Axelpress 3×6","RPE enligt text",""],
  ["1","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—","40 min crosstrainer steg 2/9 - 140reps/ minut, 150 puls"],
  ["1","Tors","Tröskellöpning","3×10 min (2 min joggvila)","5:45–5:40",""],
  ["1","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["1","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 7; Mark 3×3 @ RPE 7; Frontböj 3×3 @ RPE 6","RPE enligt text",""],
  ["1","Sön","Långpass","14 km","6:05–6:20",""],
  ["2","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["2","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 7–8; Lätta böj 3×5 @ RPE 6; Rodd 4×8","RPE enligt text",""],
  ["2","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["2","Tors","Tröskellöpning","4×8 min (2 min joggvila)","5:45–5:40",""],
  ["2","Fre","Vila eller lätt jogg","20–30 min","6:20–6:40",""],
  ["2","Lör","Tung styrka ben + mark","Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 7; Frontböj 3×3 @ RPE 6","RPE enligt text",""],
  ["2","Sön","Långpass","15 km","6:05–6:20",""],
  ["3","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["3","Tis","Styrka överkropp + lätt ben","Bänk 6×2 @ RPE 8; Lätta böj 3×5 @ RPE 6; Chins 4×AMRAP","RPE enligt text",""],
  ["3","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["3","Tors","Tröskellöpning","4×10 min (2 min joggvila)","5:40–5:35",""],
  ["3","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["3","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 7–8; Enbensutfall 3×8","RPE enligt text",""],
  ["3","Sön","Långpass","16 km","6:00–6:15",""],
  ["4","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["4","Tis","Styrka överkropp + lätt ben","Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%","RPE enligt text",""],
  ["4","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["4","Tors","Tröskellöpning","20 min + 10 min (3 min vila)","5:40–5:35",""],
  ["4","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["4","Lör","Tung styrka ben + mark","Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8; Pausböj 3×2 @ RPE 6–7","RPE enligt text",""],
  ["4","Sön","Långpass","17 km","6:00–6:15",""],
  ["5","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["5","Tis","Styrka överkropp + lätt ben","Deload: Bänk 3×3 @ RPE 6; Lätta böj 2×5 @ RPE 5–6; Rörlighet","RPE enligt text",""],
  ["5","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["5","Tors","Tröskellöpning","2×12 min (2 min joggvila) – deload","5:50–5:45",""],
  ["5","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["5","Lör","Tung styrka ben + mark","Deload: Böj 3×3 @ RPE 6; Mark 3×2 @ RPE 6; Bål 3×10","RPE enligt text",""],
  ["5","Sön","Långpass","14 km","6:05–6:20",""],
  ["6","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["6","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 8; Böj 3×3 @ RPE 6–7; Rodd 4×8","RPE enligt text",""],
  ["6","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["6","Tors","Tröskellöpning","5×6 min (90 s vila)","5:35–5:30",""],
  ["6","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["6","Lör","Tung styrka ben + mark","Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 8; Frontböj 3×2 @ RPE 7","RPE enligt text",""],
  ["6","Sön","Långpass","18 km","5:55–6:10",""],
  ["7","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["7","Tis","Styrka överkropp + lätt ben","Bänk 6×2 @ RPE 8; Axelpress 3×5 @ RPE 7; Chins 4×AMRAP","RPE enligt text",""],
  ["7","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["7","Tors","Tröskellöpning","6×5 min (90 s vila)","5:35–5:30",""],
  ["7","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["7","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 8; Enbensarbete 3×8","RPE enligt text",""],
  ["7","Sön","Långpass","18 km","5:55–6:10",""],
  ["8","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["8","Tis","Styrka överkropp + lätt ben","Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%","RPE enligt text",""],
  ["8","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["8","Tors","Tröskellöpning","3×12 min (2 min joggvila)","5:30–5:25",""],
  ["8","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["8","Lör","Tung styrka ben + mark","Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8.5; Pausböj 3×2 @ RPE 7","RPE enligt text",""],
  ["8","Sön","Långpass","19 km","5:55–6:10",""],
  ["9","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["9","Tis","Styrka överkropp + lätt ben","Bänk tung singel @ RPE 8, sedan 3×3 @ RPE 7; Lätta böj 3×5 @ RPE 6","RPE enligt text",""],
  ["9","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["9","Tors","Tröskellöpning","2×15 min (3 min joggvila)","5:30–5:25",""],
  ["9","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["9","Lör","Tung styrka ben + mark","Böj 4×2 @ RPE 8.5; Mark 4×1 @ RPE 8.5; Bål 3×10","RPE enligt text",""],
  ["9","Sön","Långpass","20 km","5:55–6:10",""],
  ["10","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["10","Tis","Styrka överkropp + lätt ben","Taper: Bänk 3×3 @ RPE 7; Lätta böj 2×5 @ RPE 6","RPE enligt text",""],
  ["10","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["10","Tors","Tröskellöpning","4×6 min (90 s vila) – taper","5:35–5:30",""],
  ["10","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["10","Lör","Tung styrka ben + mark","Taper: Böj 3×2 @ RPE 7; Mark 3×1 @ RPE 7; Lätta hopp/koord","RPE enligt text",""],
  ["10","Sön","Långpass","16 km","6:05–6:20",""],
  ["11","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["11","Tis","Styrka överkropp + lätt ben","Taper: Bänk 2×3 @ RPE 6–7; Rörlighet","RPE enligt text",""],
  ["11","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["11","Tors","Tröskellöpning","3×6 min (90 s vila) – taper","5:40–5:35",""],
  ["11","Fre","Vila eller lätt jogg","15–20 min","6:20–6:40",""],
  ["11","Lör","Tung styrka ben + mark","Taper: Böj 2×2 @ RPE 6–7; Mark 2×1 @ RPE 6–7; Bål 2×8","RPE enligt text",""],
  ["11","Sön","Långpass","14 km","6:10–6:25",""],
  ["12","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["12","Tis","Styrka överkropp + lätt ben","Tävlingsvecka: Bänk 2×2 @ RPE 6 (valfritt), rörlighet","RPE enligt text",""],
  ["12","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["12","Tors","Tröskellöpning","10–15 min lätt fartkänsla – tävlingsvecka","5:40–5:35",""],
  ["12","Fre","Vila eller lätt jogg","10–15 min","6:20–6:40",""],
  ["12","Lör","Tung styrka ben + mark","Tävlingsvecka: Lätt böj 2×3 @ RPE 6 – ingen tung mark","RPE enligt text",""],
  ["12","Sön","Långpass","10 km","6:15–6:30",""],
];

// Page 2 - W's schedule
const wRows: string[][] = [
  ["1","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—","Hastighet på band 6.8, sprang ca 25 min, Puls oklar"],
  ["1","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 7; Lätta böj 3×5 @ RPE 6; Rodd/Chins 3×8; Axelpress 3×6","RPE enligt text","S50; B30; C45~; A30 (i Smithmasin)"],
  ["1","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["1","Tors","Tröskellöpning","3×10 min (2 min joggvila)","5:45–5:40",""],
  ["1","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["1","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 7; Mark 3×3 @ RPE 7; Frontböj 3×3 @ RPE 6","RPE enligt text",""],
  ["1","Sön","Långpass","14 km","6:05–6:20",""],
  ["2","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["2","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 7–8; Lätta böj 3×5 @ RPE 6; Rodd 4×8","RPE enligt text",""],
  ["2","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["2","Tors","Tröskellöpning","4×8 min (2 min joggvila)","5:45–5:40",""],
  ["2","Fre","Vila eller lätt jogg","20–30 min","6:20–6:40",""],
  ["2","Lör","Tung styrka ben + mark","Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 7; Frontböj 3×3 @ RPE 6","RPE enligt text",""],
  ["2","Sön","Långpass","15 km","6:05–6:20",""],
  ["3","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["3","Tis","Styrka överkropp + lätt ben","Bänk 6×2 @ RPE 8; Lätta böj 3×5 @ RPE 6; Chins 4×AMRAP","RPE enligt text",""],
  ["3","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["3","Tors","Tröskellöpning","4×10 min (2 min joggvila)","5:40–5:35",""],
  ["3","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["3","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 7–8; Enbensutfall 3×8","RPE enligt text",""],
  ["3","Sön","Långpass","16 km","6:00–6:15",""],
  ["4","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["4","Tis","Styrka överkropp + lätt ben","Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%","RPE enligt text",""],
  ["4","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["4","Tors","Tröskellöpning","20 min + 10 min (3 min vila)","5:40–5:35",""],
  ["4","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["4","Lör","Tung styrka ben + mark","Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8; Pausböj 3×2 @ RPE 6–7","RPE enligt text",""],
  ["4","Sön","Långpass","17 km","6:00–6:15",""],
  ["5","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["5","Tis","Styrka överkropp + lätt ben","Deload: Bänk 3×3 @ RPE 6; Lätta böj 2×5 @ RPE 5–6; Rörlighet","RPE enligt text",""],
  ["5","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["5","Tors","Tröskellöpning","2×12 min (2 min joggvila) – deload","5:50–5:45",""],
  ["5","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["5","Lör","Tung styrka ben + mark","Deload: Böj 3×3 @ RPE 6; Mark 3×2 @ RPE 6; Bål 3×10","RPE enligt text",""],
  ["5","Sön","Långpass","14 km","6:05–6:20",""],
  ["6","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["6","Tis","Styrka överkropp + lätt ben","Bänk 5×3 @ RPE 8; Böj 3×3 @ RPE 6–7; Rodd 4×8","RPE enligt text",""],
  ["6","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["6","Tors","Tröskellöpning","5×6 min (90 s vila)","5:35–5:30",""],
  ["6","Fre","Vila eller lätt jogg","25–30 min","6:20–6:40",""],
  ["6","Lör","Tung styrka ben + mark","Böj 5×2 @ RPE 8; Mark 4×2 @ RPE 8; Frontböj 3×2 @ RPE 7","RPE enligt text",""],
  ["6","Sön","Långpass","18 km","5:55–6:10",""],
  ["7","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["7","Tis","Styrka överkropp + lätt ben","Bänk 6×2 @ RPE 8; Axelpress 3×5 @ RPE 7; Chins 4×AMRAP","RPE enligt text",""],
  ["7","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["7","Tors","Tröskellöpning","6×5 min (90 s vila)","5:35–5:30",""],
  ["7","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["7","Lör","Tung styrka ben + mark","Böj 4×3 @ RPE 8; Mark 3×3 @ RPE 8; Enbensarbete 3×8","RPE enligt text",""],
  ["7","Sön","Långpass","18 km","5:55–6:10",""],
  ["8","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["8","Tis","Styrka överkropp + lätt ben","Bänk 4×4 @ RPE 8; Pausbänk 3×2 @ RPE 7; Böj teknik 3×5 @ 55%","RPE enligt text",""],
  ["8","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["8","Tors","Tröskellöpning","3×12 min (2 min joggvila)","5:30–5:25",""],
  ["8","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["8","Lör","Tung styrka ben + mark","Böj 3×2 @ RPE 8.5; Mark 5×1 @ RPE 8.5; Pausböj 3×2 @ RPE 7","RPE enligt text",""],
  ["8","Sön","Långpass","19 km","5:55–6:10",""],
  ["9","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["9","Tis","Styrka överkropp + lätt ben","Bänk tung singel @ RPE 8, sedan 3×3 @ RPE 7; Lätta böj 3×5 @ RPE 6","RPE enligt text",""],
  ["9","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["9","Tors","Tröskellöpning","2×15 min (3 min joggvila)","5:30–5:25",""],
  ["9","Fre","Vila eller lätt jogg","25–35 min","6:20–6:40",""],
  ["9","Lör","Tung styrka ben + mark","Böj 4×2 @ RPE 8.5; Mark 4×1 @ RPE 8.5; Bål 3×10","RPE enligt text",""],
  ["9","Sön","Långpass","20 km","5:55–6:10",""],
  ["10","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["10","Tis","Styrka överkropp + lätt ben","Taper: Bänk 3×3 @ RPE 7; Lätta böj 2×5 @ RPE 6","RPE enligt text",""],
  ["10","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["10","Tors","Tröskellöpning","4×6 min (90 s vila) – taper","5:35–5:30",""],
  ["10","Fre","Vila eller lätt jogg","20–25 min","6:20–6:40",""],
  ["10","Lör","Tung styrka ben + mark","Taper: Böj 3×2 @ RPE 7; Mark 3×1 @ RPE 7; Lätta hopp/koord","RPE enligt text",""],
  ["10","Sön","Långpass","16 km","6:05–6:20",""],
  ["11","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["11","Tis","Styrka överkropp + lätt ben","Taper: Bänk 2×3 @ RPE 6–7; Rörlighet","RPE enligt text",""],
  ["11","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["11","Tors","Tröskellöpning","3×6 min (90 s vila) – taper","5:40–5:35",""],
  ["11","Fre","Vila eller lätt jogg","15–20 min","6:20–6:40",""],
  ["11","Lör","Tung styrka ben + mark","Taper: Böj 2×2 @ RPE 6–7; Mark 2×1 @ RPE 6–7; Bål 2×8","RPE enligt text",""],
  ["11","Sön","Långpass","14 km","6:10–6:25",""],
  ["12","Mån","Vila / promenad","10–30 min lätt gång eller full vila","—",""],
  ["12","Tis","Styrka överkropp + lätt ben","Tävlingsvecka: Bänk 2×2 @ RPE 6 (valfritt), rörlighet","RPE enligt text",""],
  ["12","Ons","Återhämtning / lätt cykel","20–30 min cykel + rörlighet 10 min","—",""],
  ["12","Tors","Tröskellöpning","10–15 min lätt fartkänsla – tävlingsvecka","5:40–5:35",""],
  ["12","Fre","Vila eller lätt jogg","10–15 min","6:20–6:40",""],
  ["12","Lör","Tung styrka ben + mark","Tävlingsvecka: Lätt böj 2×3 @ RPE 6 – ingen tung mark","RPE enligt text",""],
  ["12","Sön","Långpass","10 km","6:15–6:30",""],
];

export const schedules: Record<Profile, WorkoutDay[]> = {
  J: parseSchedule(jRows),
  W: parseSchedule(wRows),
};

export const getWeeks = (profile: Profile): number[] => {
  const weeks = new Set(schedules[profile].map((d) => d.week));
  return Array.from(weeks).sort((a, b) => a - b);
};

export const getWeekDays = (profile: Profile, week: number): WorkoutDay[] => {
  return schedules[profile].filter((d) => d.week === week);
};

// Completion tracking with localStorage
const STORAGE_KEY = "workout-tracker-completions";

export interface CompletionData {
  done: boolean;
  userComment: string;
}

type CompletionMap = Record<string, CompletionData>;

const getKey = (profile: Profile, week: number, day: string) =>
  `${profile}-${week}-${day}`;

export const getCompletions = (): CompletionMap => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

export const getCompletion = (
  profile: Profile,
  week: number,
  day: string
): CompletionData => {
  const map = getCompletions();
  return map[getKey(profile, week, day)] || { done: false, userComment: "" };
};

export const setCompletion = (
  profile: Profile,
  week: number,
  day: string,
  data: CompletionData
) => {
  const map = getCompletions();
  map[getKey(profile, week, day)] = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const getWeekProgress = (profile: Profile, week: number): number => {
  const days = getWeekDays(profile, week);
  const completions = getCompletions();
  const done = days.filter(
    (d) => completions[getKey(profile, week, d.day)]?.done
  ).length;
  return days.length > 0 ? Math.round((done / days.length) * 100) : 0;
};
