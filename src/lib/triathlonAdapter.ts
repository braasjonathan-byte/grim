import { supabase } from "@/integrations/supabase/client";

export interface AdaptInput {
  userId: string;
  felt: "easy" | "good" | "hard" | "too_hard";
  hadPain: boolean;
  painArea?: string | null;
  painLevel?: number | null;
  fromDate: string; // YYYY-MM-DD
}

const LOWER_BODY = ["knän", "knee", "vad", "shins", "smalben", "fot", "feet", "höft", "hip", "akilles"];
const UPPER_BODY = ["axel", "shoulder", "arm", "nacke", "neck", "rygg", "back"];

/**
 * Adjusts upcoming triathlon sessions based on feedback.
 * Returns number of sessions modified.
 */
export async function adaptUpcomingSessions(input: AdaptInput): Promise<number> {
  const { userId, felt, hadPain, painArea, painLevel, fromDate } = input;

  const tooHard = felt === "too_hard";
  const highPain = hadPain && (painLevel ?? 0) >= 7;
  const anyTrigger = tooHard || hadPain;
  if (!anyTrigger) return 0;

  // Window: next 7 days
  const fromD = new Date(fromDate + "T00:00:00Z");
  const toD = new Date(fromD);
  toD.setUTCDate(toD.getUTCDate() + 7);
  const toDate = toD.toISOString().slice(0, 10);

  const { data: sessions, error } = await supabase
    .from("triathlon_sessions")
    .select("id, discipline, duration_min, distance_km, intensity, description, session_date")
    .eq("user_id", userId)
    .gte("session_date", fromDate)
    .lte("session_date", toDate)
    .eq("completed", false)
    .order("session_date", { ascending: true });

  if (error || !sessions) return 0;

  const areaLower = (painArea || "").toLowerCase();
  const isLower = LOWER_BODY.some(k => areaLower.includes(k));
  const isUpper = UPPER_BODY.some(k => areaLower.includes(k));

  let modified = 0;
  let restInserted = 0;

  for (const s of sessions) {
    const updates: Record<string, any> = {};

    // High pain → first 2 non-rest sessions become rest
    if (highPain && restInserted < 2 && s.discipline !== "rest") {
      updates.discipline = "rest";
      updates.duration_min = 0;
      updates.distance_km = 0;
      updates.intensity = "Vila";
      updates.description = "Anpassad vilodag pga rapporterad smärta. Lyssna på kroppen.";
      restInserted++;
    } else if (hadPain && isLower && s.discipline === "run") {
      // Lower-body pain: swap run → swim
      updates.discipline = "swim";
      updates.distance_km = Math.max(0.8, (s.distance_km || 0) * 0.4);
      updates.duration_min = Math.max(20, Math.round((s.duration_min || 30) * 0.7));
      updates.intensity = "RPE 3-4 – mycket lätt";
      updates.description = "Lågbelastande simning istället för löpning (knä/ben-skydd).";
    } else if (hadPain && isUpper && s.discipline === "swim") {
      // Upper-body pain: swap swim → easy bike
      updates.discipline = "bike";
      updates.duration_min = Math.max(20, Math.round((s.duration_min || 30) * 0.8));
      updates.distance_km = Math.max(8, (s.distance_km || 0) * 0.8);
      updates.intensity = "RPE 3-4 – mycket lätt";
      updates.description = "Lätt cykling istället för simning (skuldra-skydd).";
    } else if (tooHard && s.discipline !== "rest") {
      // Too hard → reduce volume 30%, drop intensity
      updates.duration_min = Math.max(15, Math.round((s.duration_min || 30) * 0.7));
      updates.distance_km = Math.round((s.distance_km || 0) * 0.7 * 10) / 10;
      updates.intensity = "RPE 4 – lätt (anpassad)";
      updates.description = (s.description || "") + " (Volym sänkt 30%.)";
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("triathlon_sessions")
        .update(updates)
        .eq("id", s.id);
      if (!upErr) modified++;
    }
  }

  return modified;
}
