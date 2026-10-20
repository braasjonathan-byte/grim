import type { AppSettings } from "@/lib/appSettings";

export const FEATURES = [
  { id: "ai_food", label: "AI-kost", hint: "Beskriv dagen och skanna näring" },
  { id: "ai_workout", label: "AI-pass", hint: "Läs av ett pass från en skärmdump" },
  { id: "form_check", label: "Formkoll", hint: "Filma teknik under Verktyg" },
  { id: "barcode", label: "Streckkod", hint: "Skanna livsmedel" },
  { id: "voice_food", label: "Röstlogg", hint: "Logga mat med rösten" },
  { id: "strava", label: "Strava", hint: "Koppla och synka. Av som standard" },
  { id: "gps", label: "GPS", hint: "Spåra distans under kondition" },
  { id: "social", label: "Socialt", hint: "Fliken Social" },
  { id: "chat", label: "Chatt", hint: "Chatt under Social" },
  { id: "triathlon", label: "Triathlon", hint: "Triathlonplan i planväljaren" },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];
export type Audience = "all" | "honorary" | "off";

export type FeatureFlagMap = Partial<Record<FeatureId, Audience>>;

const AUDIENCES = new Set<Audience>(["all", "honorary", "off"]);

export function normalizeFeatureFlags(value: unknown): FeatureFlagMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: FeatureFlagMap = {};
  for (const feature of FEATURES) {
    const audience = (value as Record<string, unknown>)[feature.id];
    if (typeof audience === "string" && AUDIENCES.has(audience as Audience)) out[feature.id] = audience as Audience;
  }
  return out;
}

/** Utan sparad flagga gäller samma regler som appen har idag. */
export function resolveAudience(settings: Pick<AppSettings, "feature_flags" | "ai_food_for_all">, id: FeatureId): Audience {
  const explicit = settings.feature_flags?.[id];
  if (explicit) return explicit;
  if (id === "ai_food") return settings.ai_food_for_all ? "all" : "honorary";
  if (id === "ai_workout") return "honorary";
  if (id === "strava") return "off";
  return "all";
}

export function resolvedFlags(settings: Pick<AppSettings, "feature_flags" | "ai_food_for_all">): Record<FeatureId, Audience> {
  return Object.fromEntries(FEATURES.map((feature) => [feature.id, resolveAudience(settings, feature.id)])) as Record<FeatureId, Audience>;
}

export function canUseFeature(
  settings: Pick<AppSettings, "feature_flags" | "ai_food_for_all">,
  id: FeatureId,
  who: { isHonorary?: boolean; isAdmin?: boolean } = {},
): boolean {
  const audience = resolveAudience(settings, id);
  if (audience === "off") return false;
  if (audience === "all") return true;
  return Boolean(who.isHonorary || who.isAdmin);
}

/** Appversionen är byggtiden (ISO). Tom gräns eller "dev" tvingar ingen omladdning. */
export function needsForceUpdate(appVersion: string, after: string): boolean {
  const min = Date.parse(after.trim());
  const build = Date.parse(appVersion);
  if (!Number.isFinite(min) || !Number.isFinite(build)) return false;
  return build < min;
}
