// GPS voice announcement settings
const KEY_MIN = "gymberget_gps_voice_interval_min";
const KEY_KM = "gymberget_gps_voice_interval_km";

export const getGpsVoiceIntervalMin = (): number => {
  const raw = localStorage.getItem(KEY_MIN);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const setGpsVoiceIntervalMin = (min: number): void => {
  localStorage.setItem(KEY_MIN, String(min));
};

export const getGpsVoiceIntervalKm = (): number => {
  const raw = localStorage.getItem(KEY_KM);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const setGpsVoiceIntervalKm = (km: number): void => {
  localStorage.setItem(KEY_KM, String(km));
};

const fmtPace = (secPerKm: number): string => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m} minuter ${s} sekunder per kilometer`;
};

export type PaceSegment = { label: string; secPerKm: number };

export const speakPace = (
  distanceKm: number,
  elapsedSec: number,
  segment?: PaceSegment | null,
): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (distanceKm <= 0.01) return;
  const avgSecPerKm = elapsedSec / distanceKm;
  const km = Math.round(distanceKm * 10) / 10;
  const parts: string[] = [];
  parts.push(`Snittempo ${fmtPace(avgSecPerKm)}.`);
  if (segment && segment.secPerKm > 0) {
    parts.push(`${segment.label} ${fmtPace(segment.secPerKm)}.`);
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
