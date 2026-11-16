// Allowlist of origins the app is served from; anything else falls back to production.
export const DEFAULT_APP_ORIGIN = "https://grim.lovable.app";
const ALLOWED = [
  /^https:\/\/grim\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
  /^https?:\/\/localhost(:\d+)?$/,
];
export function isAllowedAppOrigin(origin: string | null | undefined): origin is string {
  return !!origin && ALLOWED.some((r) => r.test(origin));
}
export function allowedOrigin(origin: string | null | undefined): string {
  return isAllowedAppOrigin(origin) ? origin : DEFAULT_APP_ORIGIN;
}
