import { supabase } from "@/integrations/supabase/client";

interface CompletionLike {
  logged_tempo?: string | null;
  logged_pulse?: number | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, any> | null;
}

interface PlanLike {
  session_name: string;
  details: string;
  tempo?: string | null;
}

const isRunningSession = (name: string) => {
  const n = name.toLowerCase();
  return (
    n.includes("löp") ||
    n.includes("jogg") ||
    n.includes("långpass") ||
    n.includes("tröskel") ||
    n.includes("interval")
  );
};

export function buildWorkoutSummaryCaption(
  plan: PlanLike,
  completion: CompletionLike,
  week: number,
  day: string
): string {
  const lines: string[] = [];
  const dayLabel = (() => {
    const m = day.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) {
      try {
        return new Date(m[1]).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
      } catch {
        return day.replace(/_[a-z0-9]+$/i, "");
      }
    }
    return day.replace(/_[a-z0-9]+$/i, "");
  })();

  const header = week > 0
    ? `🏋️ ${plan.session_name} – Vecka ${week} · ${dayLabel}`
    : `🏋️ ${plan.session_name} · ${dayLabel}`;
  lines.push(header);

  const isRunning = isRunningSession(plan.session_name);
  const stats: string[] = [];
  if (isRunning) {
    if (completion.logged_distance_km) stats.push(`📏 ${completion.logged_distance_km} km`);
    if (completion.logged_tempo) stats.push(`⏱ ${completion.logged_tempo}/km`);
    if (completion.logged_pulse) stats.push(`❤️ ${completion.logged_pulse} bpm`);
  }

  // Strength volume + sets
  let totalVolume = 0;
  let completedSets = 0;
  const setLines: string[] = [];
  const lw = completion.logged_weights || {};
  if (lw && typeof lw === "object") {
    for (const [key, val] of Object.entries(lw)) {
      if (key.startsWith("__sets__") && typeof val === "string") {
        completedSets += val.split("").filter((c) => c === "1").length;
      }
    }
    for (const [key, val] of Object.entries(lw)) {
      if (key.startsWith("__setdata__")) {
        const exName = key.replace("__setdata__", "");
        const setsKey = `__sets__${exName}`;
        const setsStr = (lw[setsKey] as string) || "";
        try {
          const data = typeof val === "string" ? JSON.parse(val) : val;
          if (Array.isArray(data)) {
            const done = data.filter((_: any, i: number) => setsStr[i] === "1");
            if (done.length > 0) {
              done.forEach((s: any) => {
                totalVolume += (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0);
              });
              const repsList = done
                .map((s: any) => {
                  const kg = parseFloat(s.kg) || 0;
                  const reps = parseInt(s.reps) || 0;
                  return kg > 0 ? `${reps}@${kg}kg` : `${reps}`;
                })
                .join(", ");
              setLines.push(`• ${exName}: ${repsList}`);
            }
          }
        } catch {}
      }
    }
  }

  if (!isRunning) {
    if (completedSets > 0) stats.push(`💪 ${completedSets} set`);
    if (totalVolume > 0) {
      const v = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(Math.round(totalVolume));
      stats.push(`🏋️‍♂️ ${v} kg volym`);
    }
  }

  if (stats.length) lines.push(stats.join("  ·  "));
  if (setLines.length) {
    lines.push("");
    lines.push(...setLines.slice(0, 8));
    if (setLines.length > 8) lines.push(`…och ${setLines.length - 8} till`);
  }

  lines.push("");
  lines.push("Elda passet 🔥 eller heja på i kommentarerna!");
  return lines.join("\n");
}

/**
 * Auto-create a "friends" social post summarizing a completed workout.
 * Idempotent: if a post for the same user/week/day already exists, it is updated.
 */
export async function autoShareCompletion(
  userId: string,
  week: number,
  day: string
): Promise<void> {
  try {
    // Gather all plan rows for that day (user may have multiple parts)
    const { data: planRows } = await supabase
      .from("workout_plans")
      .select("session_name, details, tempo")
      .eq("user_id", userId)
      .eq("week", week)
      .eq("day", day);

    if (!planRows || planRows.length === 0) return;
    const validPlans = (planRows as any[]).filter(
      (p) => (p.details || "").trim() && (p.session_name || "").trim()
    );
    if (validPlans.length === 0) return;

    const plan: PlanLike = {
      session_name: validPlans.map((p) => p.session_name).join(" + "),
      details: validPlans.map((p) => p.details).filter(Boolean).join("\n"),
      tempo: validPlans[0].tempo,
    };

    const { data: completion } = await supabase
      .from("workout_completions")
      .select("logged_tempo, logged_pulse, logged_distance_km, logged_weights")
      .eq("user_id", userId)
      .eq("week", week)
      .eq("day", day)
      .maybeSingle();

    const caption = buildWorkoutSummaryCaption(plan, (completion || {}) as any, week, day);

    // Dedupe: look up existing auto-share post
    const { data: existing } = await supabase
      .from("social_posts")
      .select("id")
      .eq("user_id", userId)
      .eq("workout_week", week)
      .eq("workout_day", day)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("social_posts")
        .update({ caption, visibility: "friends" })
        .eq("id", existing.id);
    } else {
      await supabase.from("social_posts").insert({
        user_id: userId,
        caption,
        visibility: "friends",
        workout_week: week,
        workout_day: day,
      });
    }
  } catch {
    // best-effort, swallow
  }
}

export async function removeAutoShareCompletion(
  userId: string,
  week: number,
  day: string
): Promise<void> {
  try {
    await supabase
      .from("social_posts")
      .delete()
      .eq("user_id", userId)
      .eq("workout_week", week)
      .eq("workout_day", day);
  } catch {}
}
