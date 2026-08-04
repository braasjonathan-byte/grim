/**
 * Presentationslager för konditionsövningar: vilka tempo-/effektenheter som är
 * relevanta per sport, hur fält ska heta och hur värden ska visas.
 *
 * Innehåller INGEN beräknings- eller sparlogik – bara enheter, etiketter och
 * formatering så att alla vyer (loggkort, dialog, intervalltabell) ser likadana ut.
 */

export type CardioMode =
  | "minkm"
  | "kmh"
  | "watt"
  | "min100m"
  | "min500m"
  | "spm"
  | "kcal"
  | "level";

export type CardioDistUnit = "km" | "m" | null;

const re = {
  swim: /simning|simma|sim\b/i,
  row: /roddmaskin|^rodd|ski\s*erg|skierg/i,
  paddle: /paddling|kajak|kanot/i,
  bike: /cykling|cykel|cykla|spinning|motionscykel/i,
  airbike: /airbike|air\s*bike|fanbike|assault\s*bike/i,
  cross: /crosstrainer|arc\s*trainer/i,
  stair: /trappmaskin|stair\s*machine|stairclimber|skillmill/i,
  jumprope: /hopprep|jump\s*rope/i,
  walk: /promenad|vandring|(?<![-\wåäö])gång(?![-\wåäö])/i,
  ski: /skidåkning|skidor|längdskid|skridsko/i,
};

/** Tillgängliga enheter per sport. Första posten är standardvalet. */
export function getCardioModes(name: string): CardioMode[] {
  const n = name || "";
  if (re.swim.test(n)) return ["min100m", "minkm", "kmh"];
  if (re.row.test(n)) return ["min500m", "watt", "minkm", "kmh"];
  if (re.paddle.test(n)) return ["kmh", "minkm", "min500m"];
  if (re.airbike.test(n)) return ["watt", "kcal", "kmh"];
  if (re.cross.test(n)) return ["kmh", "level", "minkm", "watt"];
  if (re.stair.test(n)) return ["spm", "kmh"];
  if (re.jumprope.test(n)) return ["spm"];
  if (re.bike.test(n)) return ["kmh", "minkm", "watt"];
  if (re.ski.test(n)) return ["kmh", "minkm"];
  if (re.walk.test(n)) return ["minkm", "kmh"];
  // Löpning, tröskellöpning, långpass, löpband m.fl.
  return ["minkm", "kmh"];
}

/** Distansenhet för sporten. `null` = distans är inte relevant (t.ex. hopprep). */
export function getCardioDistUnit(name: string): CardioDistUnit {
  const n = name || "";
  if (re.jumprope.test(n)) return null;
  if (re.swim.test(n)) return "m";
  if (re.stair.test(n)) return null;
  return "km";
}

/** Kort etikett i enhetsväljaren. */
export function modeLabel(mode: CardioMode): string {
  switch (mode) {
    case "kmh": return "km/h";
    case "minkm": return "min/km";
    case "watt": return "Watt";
    case "min100m": return "min/100m";
    case "min500m": return "min/500m";
    case "spm": return "spm";
    case "kcal": return "kcal";
    case "level": return "Nivå";
  }
}

/** Etikett ovanför inmatningsfältet, t.ex. "Tempo (min/500m)". */
export function modeFieldLabel(mode: CardioMode, name = ""): string {
  switch (mode) {
    case "kmh": return "Hastighet (km/h)";
    case "watt": return "Effekt (W)";
    case "kcal": return "Kalorier (kcal)";
    case "level": return "Motstånd (nivå)";
    case "spm":
      return re.jumprope.test(name) ? "Frekvens (hopp/min)" : "Frekvens (steg/min)";
    default: return `Tempo (${modeLabel(mode)})`;
  }
}

/** Suffix som visas efter värdet i sammanfattningar. */
export function modeDisplaySuffix(mode: CardioMode): string {
  switch (mode) {
    case "kmh": return " km/h";
    case "watt": return " W";
    case "kcal": return " kcal";
    case "level": return "";
    case "spm": return " spm";
    case "min100m": return "/100m";
    case "min500m": return "/500m";
    default: return "/km";
  }
}

export function modePlaceholder(mode: CardioMode): string {
  switch (mode) {
    case "kmh": return "t.ex. 25";
    case "watt": return "t.ex. 180";
    case "kcal": return "t.ex. 120";
    case "level": return "t.ex. 8";
    case "spm": return "t.ex. 120";
    case "min100m": return "t.ex. 1:50";
    case "min500m": return "t.ex. 2:00";
    default: return "t.ex. 5:30";
  }
}

/** True när enheten uttrycks som tid per distans (mm:ss). */
export function isPaceMode(mode: CardioMode): boolean {
  return mode === "minkm" || mode === "min100m" || mode === "min500m";
}

/** True när enheten hänger ihop med tid/distans (kan auto-beräknas). */
export function isLinkedMode(mode: CardioMode): boolean {
  return isPaceMode(mode) || mode === "kmh";
}

/**
 * Visar tempo i korrekt tidsformat: "5.47" och "5,47" → "5:47".
 * Övriga enheter (km/h, watt …) lämnas orörda.
 */
export function formatPaceDisplay(value: string | number | null | undefined, mode: CardioMode = "minkm"): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (!isPaceMode(mode)) return raw;
  if (/^\d+:\d{1,2}$/.test(raw)) {
    const [m, s] = raw.split(":");
    return `${parseInt(m, 10)}:${s.padStart(2, "0")}`;
  }
  const m = raw.match(/^(\d+)[.,](\d{1,2})$/);
  if (m) return `${parseInt(m[1], 10)}:${m[2].padEnd(2, "0")}`;
  if (/^\d+$/.test(raw)) return `${raw}:00`;
  return raw;
}

/** Formaterar decimalminuter till mm:ss (används för tempovisning). */
export function formatMinutesAsClock(minutes: number): string {
  if (!isFinite(minutes) || minutes <= 0) return "";
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
