// GPS voice announcement settings
const KEY = "gymberget_gps_voice_interval_min";

export const GPS_VOICE_INTERVALS = [
  { value: 0, label: "Av" },
  { value: 1, label: "Varje minut" },
  { value: 2, label: "Var 2:a minut" },
  { value: 5, label: "Var 5:e minut" },
  { value: 10, label: "Var 10:e minut" },
] as const;

export const getGpsVoiceIntervalMin = (): number => {
  const raw = localStorage.getItem(KEY);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const setGpsVoiceIntervalMin = (min: number): void => {
  localStorage.setItem(KEY, String(min));
};

const fmtPace = (secPerKm: number): string => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m} minuter ${s} sekunder per kilometer`;
};

export const speakPace = (
  distanceKm: number,
  elapsedSec: number,
  lastKmSec?: number | null,
): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (distanceKm <= 0.01) return;
  const avgSecPerKm = elapsedSec / distanceKm;
  const km = Math.round(distanceKm * 10) / 10;
  const parts: string[] = [];
  parts.push(`Snittempo ${fmtPace(avgSecPerKm)}.`);
  if (lastKmSec != null && lastKmSec > 0) {
    parts.push(`Senaste kilometer ${fmtPace(lastKmSec)}.`);
  }
  parts.push(`Distans ${km.toString().replace(".", " komma ")} kilometer.`);
  try {
    const u = new SpeechSynthesisUtterance(parts.join(" "));
    u.lang = "sv-SE";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
};
