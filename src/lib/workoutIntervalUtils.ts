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
 * Rensar tempo-inmatning medan användaren skriver: punkt/komma tolkas som
 * kolon (mm:ss) så att det numeriska tangentbordets "." fungerar som ":".
 */
export const sanitizePaceInput = (value: string): string => {
  let out = value.replace(/[.,]/g, ":").replace(/[^0-9:]/g, "");
  const first = out.indexOf(":");
  if (first !== -1) {
    out = out.slice(0, first + 1) + out.slice(first + 1).replace(/:/g, "");
  }
  return out;
};
