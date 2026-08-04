import { formatUtcDate, getPlanDayDateValue } from "@/lib/workoutDayUtils";

// Compute date for a plan week/day given a plan start date
export const getPlanDayDate = (planStart: string | null, week: number, dayAbbr: string): string | null => {
  if (week <= 0) return null;
  if (!planStart) {
    // Fallback: show week + day abbreviation when no start date is set
    return `v${week} ${dayAbbr}`;
  }
  const targetDate = getPlanDayDateValue(planStart, week, dayAbbr);
  if (!targetDate) return null;
  return formatUtcDate(targetDate);
};

// Estimate calories burned for a workout based on exercises, weight, gender, and pulse
export const estimateCalories = (
  details: string,
  loggedWeights: Record<string, any> | null,
  loggedPulse: number | null,
  weightKg: number,
  gender: string | null,
  age: number | null
): number => {
  const stravaCalories = Number((loggedWeights as any)?.__strava_calories);
  if (Number.isFinite(stravaCalories) && stravaCalories > 0) {
    return Math.round(stravaCalories);
  }

  const lines = details.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  const condRegex = /\d+\s*min|\d+\s*km|\/km|löpning|roddmaskin|cykel|cykling|simning|jogg|promenad|(?<![-\w])gång(?![-\w])|intervallträning|stair\s*machine|trappmaskin/i;

  // Pick MET value for activity name
  const metFor = (name: string): number => {
    const n = name.toLowerCase();
    if (/löpning|jogg|spring|run/.test(n)) return 9.8;       // ~10 km/h running
    if (/cykl|cykel|bike|cycling/.test(n)) return 7.5;       // moderate cycling
    if (/simning|swim/.test(n)) return 7.0;
    if (/rodd|row/.test(n)) return 7.0;
    if (/promenad|walk|(?<![-\w])gång(?![-\w])/.test(n)) return 3.8;
    if (/trapp|stair/.test(n)) return 8.8;
    if (/intervall/.test(n)) return 9.0;
    return 7.0;
  };

  // Kcal/min from MET: kcal = MET * 3.5 * kg / 200
  const metKcalPerMin = (met: number) => (met * 3.5 * weightKg) / 200;

  let totalKcal = 0;
  let strengthMinutes = 0;
  let totalCondMin = 0;
  const condKeysHandled: string[] = [];

  // 1) Sum each logged conditioning entry independently
  if (loggedWeights) {
    for (const [k, v] of Object.entries(loggedWeights)) {
      if (!k.startsWith('__cond__')) continue;
      try {
        const data = typeof v === 'string' ? JSON.parse(v) : v;
        const t = parseFloat(data?.time);
        const dist = parseFloat(data?.dist);
        const name = k.replace(/^__cond__/, '').replace(/_\d+$/, '');
        condKeysHandled.push(name.toLowerCase());
        const isRun = /löpning|jogg|spring|run/i.test(name);
        let kcal = 0;
        if (isRun && dist > 0) {
          kcal = 1.036 * weightKg * dist;
        } else if (t > 0) {
          kcal = metKcalPerMin(metFor(name)) * t;
        }
        if (kcal > 0) totalKcal += kcal;
        if (t > 0) totalCondMin += t;
      } catch {}
    }
  }

  // 2) Walk details lines for non-logged conditioning + strength
  for (const line of lines) {
    if (condRegex.test(line)) {
      const nameMatch = line.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s/\-]+)/);
      const lname = (nameMatch?.[1] || '').trim().toLowerCase();
      if (lname && condKeysHandled.some(k => k.includes(lname) || lname.includes(k))) continue;

      const timeMatch = line.match(/(\d+(?:[.,]\d+)?)\s*min/i);
      const distMatch = line.match(/(\d+(?:[.,]\d+)?)\s*km(?!\/)/i);
      const t = timeMatch ? parseFloat(timeMatch[1].replace(',', '.')) : 0;
      const d = distMatch ? parseFloat(distMatch[1].replace(',', '.')) : 0;
      const isRun = /löpning|jogg|spring|run/i.test(line);
      if (isRun && d > 0) {
        totalKcal += 1.036 * weightKg * d;
      } else if (t > 0) {
        totalKcal += metKcalPerMin(metFor(line)) * t;
      } else {
        totalKcal += metKcalPerMin(metFor(line)) * 10;
      }
      continue;
    }
    const setsMatch = line.match(/(\d+)\s*[×x]\s*(\d+)/i);
    if (setsMatch) {
      strengthMinutes += parseInt(setsMatch[1]) * 1.5;
    } else {
      strengthMinutes += 2;
    }
  }

  if (strengthMinutes > 0) {
    totalKcal += metKcalPerMin(5.0) * strengthMinutes;
  }

  // 4) Optional HR-based override (only when session is purely cardio)
  if (loggedPulse && loggedPulse > 0 && loggedPulse < 250 && age && totalCondMin > 0 && strengthMinutes === 0) {
    let kcalPerMin: number;
    if (gender === 'male') {
      kcalPerMin = (-55.0969 + 0.6309 * loggedPulse + 0.1988 * weightKg + 0.2017 * age) / 4.184;
    } else {
      kcalPerMin = (-20.4022 + 0.4472 * loggedPulse - 0.1263 * weightKg + 0.074 * age) / 4.184;
    }
    if (kcalPerMin > 0) {
      const hrKcal = kcalPerMin * totalCondMin;
      totalKcal = Math.max(totalKcal, hrKcal);
    }
  }

  if (totalKcal <= 0) return 0;
  return Math.round(Math.min(totalKcal, 3000));
};
