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

export const toSavedIntervalRows = (rows: IntervalRow[]) => rows.map((row) => {
  const time = intervalRowTimeMinutes(row);
  return {
    time: time > 0 ? formatIntervalMinutes(time) : "",
    tempo: row.tempo,
    dist: row.distance,
  };
});

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
