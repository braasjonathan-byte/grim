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

export const speakPace = (distanceKm: number, elapsedSec: number): void => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (distanceKm <= 0.01) return;
  const paceSecPerKm = elapsedSec / distanceKm;
  const pm = Math.floor(paceSecPerKm / 60);
  const ps = Math.round(paceSecPerKm % 60);
  const km = Math.round(distanceKm * 10) / 10;
  const text = `Tempo ${pm} minuter ${ps} sekunder per kilometer. Distans ${km.toString().replace(".", " komma ")} kilometer.`;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "sv-SE";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
};
