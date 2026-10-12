import type { IntervalRow } from "@/components/IntervalRowsEditor";

export const toTitleCase = (str: string): string =>
  str.replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());

export const normalizeTempoInput = (value: string): string => {
  const raw = value.trim();
  if (!raw || raw.includes(":")) return raw;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return raw;
  const minPerKm = parseFloat(raw.replace(",", "."));
  if (!isFinite(minPerKm) || minPerKm <= 0) return raw;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const intervalRowTimeMinutes = (row: Pick<IntervalRow, "h" | "m" | "s">): number => {
  const h = parseInt(row.h) || 0;
  const m = parseInt(row.m) || 0;
  const s = parseInt(row.s) || 0;
  return h * 60 + m + s / 60;
};

export const formatIntervalMinutes = (minutes: number): string => {
  const rounded = Math.round(minutes * 1000) / 1000;
  return String(rounded);
};

const parseIntervalTempoMinPerKm = (tempo: string): number => {
  const trimmed = String(tempo || "").trim();
  if (!trimmed) return NaN;
  const colon = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colon) return parseInt(colon[1]) + parseInt(colon[2]) / 60;
  const n = parseFloat(trimmed.replace(",", "."));
  return isFinite(n) ? n : NaN;
};

/**
 * Räknar fram tid (minuter) för en intervallrad som saknar tid men har
 * distans + tempo ifyllt (tid = distans × tempo). Rör inte rader som redan
 * har en tid, och rör inte rader som saknar både distans och tempo.
 */
export const deriveIntervalRowTime = (row: IntervalRow): IntervalRow => {
  if (intervalRowTimeMinutes(row) > 0) return row;
  const dist = parseFloat(String(row.distance || "").replace(",", "."));
  const tempo = parseIntervalTempoMinPerKm(row.tempo);
  if (!isFinite(dist) || dist <= 0 || !isFinite(tempo) || tempo <= 0) return row;
  const totalMin = dist * tempo;
  const totalSec = Math.round(totalMin * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    ...row,
    h: h > 0 ? String(h) : "",
    m: String(m),
    s: s > 0 ? String(s) : "",
  };
};

/** Formaterar minuter (kan vara decimaltal) som "mm:ss", t.ex. 30.5 → "30:30". */
export const formatMinutesAsClock = (minutes: number): string => {
  if (!isFinite(minutes) || minutes <= 0) return "0:00";
  const totalSec = Math.round(minutes * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const toSavedIntervalRows = (rows: IntervalRow[]) => rows.map((row) => {
  const derived = deriveIntervalRowTime(row);
  const time = intervalRowTimeMinutes(derived);
  return {
    time: time > 0 ? formatIntervalMinutes(time) : "",
    tempo: derived.tempo,
    dist: derived.distance,
  };
});

/**
 * Totalsummerar ett intervallpass: arbetstid (summan av radernas tid),
 * total tid inklusive vila mellan intervallerna ((antal-1) × vila), samt
 * total distans. Vilan läggs INTE in i tempot/pace, bara i totaltiden.
 */
export const computeIntervalSessionTotals = (
  rows: IntervalRow[],
  restMin: string | number,
): { workTimeMin: number; totalTimeMin: number; totalDistanceKm: number } => {
  const derivedRows = rows.map(deriveIntervalRowTime);
  let workTimeMin = 0;
  let totalDistanceKm = 0;
  for (const row of derivedRows) {
    const t = intervalRowTimeMinutes(row);
    if (t > 0) workTimeMin += t;
    const d = parseFloat(String(row.distance || "").replace(",", "."));
    if (isFinite(d) && d > 0) totalDistanceKm += d;
  }
  const rest = parseFloat(String(restMin || "").replace(",", "."));
  const restTotal = isFinite(rest) && rest > 0 ? rest * Math.max(derivedRows.length - 1, 0) : 0;
  return {
    workTimeMin,
    totalTimeMin: workTimeMin > 0 ? workTimeMin + restTotal : 0,
    totalDistanceKm,
  };
};

/**
 * Rensar tempo-/farts-inmatning medan användaren skriver.
 * För pace-enheter (min/km, min/100m …) tolkas punkt/komma som kolon (mm:ss)
 * så att det numeriska tangentbordets "." fungerar som ":".
 * För fart-enheter (km/h, mph …) behålls decimaler istället.
 */
export const sanitizePaceInput = (value: string, isPace = true): string => {
  if (!isPace) {
    let out = value.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
    const first = out.indexOf(".");
    if (first !== -1) {
      out = out.slice(0, first + 1) + out.slice(first + 1).replace(/\./g, "");
    }
    return out;
  }
  let out = value.replace(/[.,]/g, ":").replace(/[^0-9:]/g, "");
  const first = out.indexOf(":");
  if (first !== -1) {
    out = out.slice(0, first + 1) + out.slice(first + 1).replace(/:/g, "");
  }
  return out;
};

/** Plockar ut tempo (min/km) ur en fritextsträng, t.ex. "5:30 min/km" eller "5:30/km". */
export const parsePlanTempoText = (text?: string | null): string => {
  if (!text) return "";
  const m = String(text).match(/(\d{1,2})[:.](\d{1,2})\s*(?:min)?\s*\/\s*km/i)
    || String(text).match(/(\d{1,2})[:.](\d{1,2})/);
  if (!m) return "";
  return `${parseInt(m[1])}:${m[2].padStart(2, "0")}`;
};

/**
 * Ser till att planerade konditionspass alltid har tid, distans OCH tempo:
 * saknas ett av värdena räknas det fram ur de två andra.
 * time = minuter, dist = km, tempo = min/km ("m:ss").
 */
export const derivePlanCardioValues = (
  time: string,
  dist: string,
  tempo: string,
  tempoFallback?: string | null,
): { time: string; dist: string; tempo: string } => {
  let t = parseFloat(String(time).replace(",", "."));
  let d = parseFloat(String(dist).replace(",", "."));
  let tempoStr = tempo || "";
  if (!tempoStr) tempoStr = parsePlanTempoText(tempoFallback);

  const tempoMin = (() => {
    const m = String(tempoStr).trim().match(/^(\d+)[:.](\d{1,2})$/);
    if (m) return parseInt(m[1]) + parseInt(m[2]) / 60;
    const n = parseFloat(String(tempoStr).replace(",", "."));
    return isFinite(n) && n > 0 ? n : NaN;
  })();

  const fmt = (minPerKm: number) => {
    const mn = Math.floor(minPerKm);
    const sc = Math.round((minPerKm - mn) * 60);
    return `${mn}:${sc.toString().padStart(2, "0")}`;
  };

  const hasT = isFinite(t) && t > 0;
  const hasD = isFinite(d) && d > 0;
  const hasP = isFinite(tempoMin) && tempoMin > 0;

  if (hasT && hasD && !hasP) tempoStr = fmt(t / d);
  else if (hasT && hasP && !hasD) d = Math.round((t / tempoMin) * 100) / 100;
  else if (hasD && hasP && !hasT) t = Math.round(tempoMin * d * 100) / 100;
  else if (hasP && !tempo) tempoStr = fmt(tempoMin);

  return {
    time: isFinite(t) && t > 0 ? String(t) : "",
    dist: isFinite(d) && d > 0 ? String(d) : "",
    tempo: tempoStr,
  };
};

/**
 * Bygger en parsningsbar etikett för ett intervallpass, t.ex.
 * "4×2 min, vila 2 min @ 35 km/h". Enhets-suffixet avgör vilket cardioMode
 * (kmh/watt/minkm) som ska återskapas vid parsning.
 */
export const buildConditioningIntervalLabel = (
  count: number,
  durationMin: string,
  restMin?: string,
  mode?: "kmh" | "watt" | "minkm" | string | null,
  value?: string,
): string => {
  let out = durationMin && durationMin.trim() ? `${count}×${durationMin.trim()} min` : `${count} intervaller`;
  if (restMin && restMin.trim()) out += `, vila ${restMin.trim()} min`;
  if (value && value.trim() && mode) {
    const suffix = mode === "kmh" ? " km/h" : mode === "watt" ? " W" : "/km";
    out += ` @ ${value.trim()}${suffix}`;
  }
  return out;
};

export interface ParsedConditioningInterval {
  count: number;
  durationMin: number;
  restMin: string;
  mode: "kmh" | "watt" | "minkm" | null;
  value: string;
}

/** Tolkar en etikett byggd av {@link buildConditioningIntervalLabel}. */
export const parseConditioningIntervalLabel = (text: string): ParsedConditioningInterval | null => {
  const m = String(text || "").match(
    /(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*min(?:\s*[,(]\s*(?:(\d+(?:[.,]\d+)?)\s*(?:min\s*)?(?:jogg)?vila|vila\s*(\d+(?:[.,]\d+)?)\s*min))?(?:.*?@\s*([\d:.,]+)\s*(km\/h|W\b|\/km))?/i
  );
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const durationMin = parseFloat(m[2].replace(",", "."));
  const restMin = m[3] || m[4] || "";
  let mode: ParsedConditioningInterval["mode"] = null;
  let value = "";
  if (m[6]) {
    value = m[5];
    if (/km\/h/i.test(m[6])) mode = "kmh";
    else if (/W/i.test(m[6])) mode = "watt";
    else mode = "minkm";
  }
  return { count, durationMin, restMin, mode, value };
};
