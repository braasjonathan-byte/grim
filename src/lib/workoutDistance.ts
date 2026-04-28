type LoggedWeights = Record<string, unknown> | null | undefined;

const CYCLING_KEYWORDS = /cykel|motioncykel|spinning|crosstrainer/i;
const RUNNING_KEYWORDS = /löpning|löp|jogg|sprint|intervall|intervaller|långpass|distanslöpning|promenad|gång|tröskel/i;
const RUN_SEGMENT_KEYWORDS = /uppvärmning|nedvarvning|avjogg|joggvila|jogg|promenad|gång/i;

const getPlanText = (rawInput: string): string => {
  if (!rawInput.trim().startsWith("{")) return rawInput;
  try {
    const parsed = JSON.parse(rawInput);
    if (parsed && typeof parsed === "object") {
      return [parsed.sessionName, parsed.details, parsed.tempo].filter(Boolean).join("\n");
    }
  } catch {
    
  }
  return rawInput;
};

const getPlanParts = (rawInput?: string | null): { details: string; tempo: string } => {
  if (!rawInput) return { details: "", tempo: "" };
  if (!rawInput.trim().startsWith("{")) return { details: rawInput, tempo: "" };
  try {
    const parsed = JSON.parse(rawInput);
    if (parsed && typeof parsed === "object") {
      return { details: String(parsed.details || ""), tempo: String(parsed.tempo || "") };
    }
  } catch {
    
  }
  return { details: rawInput, tempo: "" };
};

const isRunningPlan = (planDetails?: string | null): boolean => {
  if (!planDetails) return true;
  const text = getPlanText(planDetails);
  if (CYCLING_KEYWORDS.test(text)) return false;
  return RUNNING_KEYWORDS.test(text) || RUN_SEGMENT_KEYWORDS.test(text);
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const parseMinPerKm = (tempo: string): number => {
  const normalized = String(tempo || "").trim();
  if (!normalized) return 0;

  const tempoMatch = normalized.match(/([\d:.,]+)\s*(?:min\/km|\/km)/i);
  const raw = (tempoMatch ? tempoMatch[1] : normalized).replace(",", ":");

  if (!tempoMatch && !/^(\d+)[:\.](\d+)$/.test(raw) && !/^(\d+)$/.test(raw)) {
    return 0;
  }

  const pair = raw.match(/^(\d+)[:\.](\d+)$/);
  const single = raw.match(/^(\d+)$/);

  if (pair) return (parseInt(pair[1]) * 60 + parseInt(pair[2])) / 60;
  if (single) return parseInt(single[1]);
  return 0;
};

const getDistanceFromTimeAndTempo = (time: unknown, tempo: unknown): number => {
  const minutes = toNumber(time);
  const minPerKm = parseMinPerKm(String(tempo ?? ""));

  if (minutes <= 0 || minPerKm <= 0) return 0;
  return minutes / minPerKm;
};

const parseConditioningPayload = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const getIntervalDistanceKm = (interval: unknown): number => {
  if (!interval || typeof interval !== "object" || Array.isArray(interval)) return 0;

  const intervalData = interval as Record<string, unknown>;
  const directDistance = toNumber(intervalData.dist ?? intervalData.distance);
  if (directDistance > 0) return directDistance;

  return getDistanceFromTimeAndTempo(intervalData.time, intervalData.tempo);
};

const getConditioningDistanceKm = (loggedWeights: LoggedWeights): number => {
  if (!loggedWeights || typeof loggedWeights !== "object" || Array.isArray(loggedWeights)) {
    return 0;
  }

  let total = 0;

  for (const [key, value] of Object.entries(loggedWeights)) {
    if (!key.startsWith("__cond__")) continue;

    const data = parseConditioningPayload(value);
    if (!data) continue;

    const intervals = Array.isArray(data.intervals) ? data.intervals : [];
    const intervalTotal = intervals.reduce((sum, interval) => sum + getIntervalDistanceKm(interval), 0);

    if (intervalTotal > 0) {
      total += intervalTotal;
      continue;
    }

    const directDistance = toNumber(data.dist ?? data.distance);
    if (directDistance > 0) {
      total += directDistance;
      continue;
    }

    total += getDistanceFromTimeAndTempo(data.time, data.tempo);
  }

  return total;
};

const getCompletedIntervalSetDistanceKm = (loggedWeights: LoggedWeights, planDetails?: string | null): number => {
  if (!loggedWeights || typeof loggedWeights !== "object" || Array.isArray(loggedWeights)) return 0;

  const planTempo = getPlanParts(planDetails).tempo;
  let total = 0;

  for (const [key, value] of Object.entries(loggedWeights)) {
    if (!key.startsWith("__sets__interval_") || typeof value !== "string" || !value.includes("1")) continue;

    const line = key.replace("__sets__interval_", "");
    const rawConditioning = (loggedWeights as Record<string, unknown>)[`__cond__${line}`];
    const conditioningData = parseConditioningPayload(rawConditioning);
    const intervals = Array.isArray(conditioningData?.intervals) ? conditioningData.intervals : [];
    const intervalMatch = line.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*min/i);
    const fallbackTime = intervalMatch ? intervalMatch[2] : "";
    const fallbackTempo = String(conditioningData?.tempo || line.match(/([\d:.,]+)\s*(?:min\/km|\/km)/i)?.[1] || planTempo || "");

    for (let index = 0; index < value.length; index += 1) {
      if (value[index] !== "1") continue;
      const interval = parseConditioningPayload(intervals[index]) || {};
      total += getIntervalDistanceKm({
        time: interval.time || fallbackTime,
        tempo: interval.tempo || fallbackTempo,
        dist: interval.dist ?? interval.distance,
      });
    }
  }

  return total;
};

export const extractDistanceFromDetails = (rawInput: string): number => {
  const { details, tempo: fallbackTempo } = getPlanParts(rawInput);

  const fallbackMinPerKm = parseMinPerKm(fallbackTempo);
  let loggedTotal = 0;
  const lines = details.split(/[;\n]/).map((segment) => segment.trim()).filter(Boolean);

  for (const line of lines) {
    if (CYCLING_KEYWORDS.test(line)) continue;

    const dashMatch = line.match(/^(.+?)\s*—\s*(.+)$/);
    if (dashMatch) {
      const name = dashMatch[1].trim();
      const info = dashMatch[2];
      const distMatch = info.match(/([\d.,]+)\s*km(?!\/)/);

      if (distMatch) {
        loggedTotal += toNumber(distMatch[1]);
        continue;
      }

      const timeMatch = info.match(/(\d+(?:[.,]\d+)?)\s*min/i);
      const minPerKm = parseMinPerKm(info) || fallbackMinPerKm;

      if (timeMatch && minPerKm > 0 && (RUNNING_KEYWORDS.test(name) || RUN_SEGMENT_KEYWORDS.test(name))) {
        loggedTotal += toNumber(timeMatch[1]) / minPerKm;
      }
      continue;
    }

    if (RUNNING_KEYWORDS.test(line)) {
      const directDist = line.match(/([\d.,]+)\s*km(?!\/)/);
      if (directDist) {
        loggedTotal += toNumber(directDist[1]);
        continue;
      }
    }

    const intervalMatch = line.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*min/i);
    if (intervalMatch && fallbackMinPerKm > 0) {
      loggedTotal += (toNumber(intervalMatch[1]) * toNumber(intervalMatch[2])) / fallbackMinPerKm;
      continue;
    }

    const segmentTimeMatch = line.match(/(\d+(?:[.,]\d+)?)\s*min/i);
    if (segmentTimeMatch && fallbackMinPerKm > 0 && RUN_SEGMENT_KEYWORDS.test(line)) {
      loggedTotal += toNumber(segmentTimeMatch[1]) / fallbackMinPerKm;
    }
  }

  return loggedTotal;
};

export const getWorkoutDistanceKm = ({
  loggedDistanceKm,
  loggedWeights,
  planDetails,
}: {
  loggedDistanceKm: unknown;
  loggedWeights: LoggedWeights;
  planDetails?: string | null;
}): number => {
  if (!isRunningPlan(planDetails)) return 0;

  const directDistance = toNumber(loggedDistanceKm);
  if (directDistance > 0) return directDistance;

  const completedIntervalSetDistance = getCompletedIntervalSetDistanceKm(loggedWeights, planDetails);
  if (completedIntervalSetDistance > 0) return completedIntervalSetDistance;

  const conditioningDistance = getConditioningDistanceKm(loggedWeights);
  if (conditioningDistance > 0) return conditioningDistance;

  return planDetails ? extractDistanceFromDetails(planDetails) : 0;
};