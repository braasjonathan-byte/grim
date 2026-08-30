import { supabase } from "@/integrations/supabase/client";

export interface PlanRowInput {
  user_id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string;
  created_at?: string;
}

/**
 * Persist a full plan (week > 0) for a user.
 *
 * Previously rows were inserted in chunks with no error handling, so a single
 * failing chunk (typically a unique-conflict on user_id/week/day with the plan
 * being replaced) silently dropped the first weeks of the plan – users ended up
 * with e.g. week 8-20 instead of 1-20. We now upsert on the unique key and
 * throw if any chunk fails, so the caller can surface the error.
 */
export async function replacePlanRows(userId: string, rows: PlanRowInput[]): Promise<void> {
  // Clear any existing plan rows (week > 0). Single workouts (week = 0) are kept.
  const { error: delError } = await supabase
    .from("workout_plans")
    .delete()
    .eq("user_id", userId)
    .gt("week", 0);
  if (delError) throw delError;

  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from("workout_plans")
      .upsert(rows.slice(i, i + 50), { onConflict: "user_id,week,day" });
    if (error) throw error;
  }

  // Verify that every planned week actually landed in the database.
  const expectedWeeks = new Set(rows.map(r => r.week));
  const { data: saved } = await supabase
    .from("workout_plans")
    .select("week")
    .eq("user_id", userId)
    .gt("week", 0);
  const savedWeeks = new Set((saved || []).map(r => r.week as number));
  const missing = [...expectedWeeks].filter(w => !savedWeeks.has(w));
  if (missing.length > 0) {
    // Retry the missing weeks once before giving up.
    const retryRows = rows.filter(r => missing.includes(r.week));
    for (let i = 0; i < retryRows.length; i += 50) {
      const { error } = await supabase
        .from("workout_plans")
        .upsert(retryRows.slice(i, i + 50), { onConflict: "user_id,week,day" });
      if (error) throw error;
    }
  }
}
