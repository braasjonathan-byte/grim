// App version — auto-generated at build time via Vite define
declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/**
 * Läsbar version för användare. Byggtiden kommer som rå ISO-sträng
 * («2026-11-10T15:23:46Z») – visas som «10 november 2026, 16:23».
 * Andra format (t.ex. «1.0.119» eller «dev») returneras oförändrade.
 */
export function formatAppVersion(raw: string, timeZone?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const date = d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone });
  const time = d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${date}, ${time}`;
}
