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
  // Always show cardio metrics if they exist (gäller även cykel/simning/brick)
  if (completion.logged_distance_km) stats.push(`📏 ${completion.logged_distance_km} km`);
  if (completion.logged_tempo) stats.push(`⏱ ${completion.logged_tempo}/km`);
  if (completion.logged_pulse) stats.push(`❤️ ${completion.logged_pulse} bpm`);

  // Strength volume + sets + per-exercise breakdown
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
              const normalized = done.map((s: any) => ({
                kg: parseFloat(s.kg) || 0,
                reps: parseInt(s.reps) || 0,
              }));
              const hasWeight = normalized.some((s) => s.kg > 0);
              let repsList: string;
              if (!hasWeight) {
                repsList = normalized.map((s) => String(s.reps)).join(", ");
              } else {
                const groups: { reps: number; kg: number; count: number }[] = [];
                for (const s of normalized) {
                  const last = groups[groups.length - 1];
                  if (last && last.reps === s.reps && last.kg === s.kg) {
                    last.count++;
                  } else {
                    groups.push({ reps: s.reps, kg: s.kg, count: 1 });
                  }
                }
                repsList = groups
                  .map((g) => {
                    const base = g.kg > 0 ? `${g.reps}@${g.kg}kg` : `${g.reps}`;
                    return g.count > 1 ? `${g.count}x${base}` : base;
                  })
                  .join(", ");
              }
              setLines.push(`• ${exName}: ${repsList}`);
            }
          }
        } catch {}
      }
    }
  }

  if (completedSets > 0) stats.push(`💪 ${completedSets} set`);
  if (totalVolume > 0) {
    const v = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : String(Math.round(totalVolume));
    stats.push(`🏋️‍♂️ ${v} kg volym`);
  }

  if (stats.length) lines.push(stats.join("  ·  "));

  // Per-exercise breakdown så alla får samma detaljnivå
  if (setLines.length) {
    lines.push("");
    lines.push(...setLines);
  }

  // Visa det inplanerade upplägget om inga loggade set finns (cykel/löppass etc.)
  if (setLines.length === 0 && plan.details && plan.details.trim()) {
    const planLines = plan.details
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (planLines.length) {
      lines.push("");
      planLines.forEach((l) => lines.push(`• ${l}`));
    }
  }

  lines.push("");
  lines.push("Elda passet 🔥 eller heja på i kommentarerna!");
  return lines.join("\n");
}

/**
 * Build a caption for a completed workout without writing to the database.
 * Used to pre-fill the share-prompt dialog so the user can edit before publishing.
 */
export async function previewWorkoutCaption(
  userId: string,
  week: number,
  day: string
): Promise<string | null> {
  try {
    const { data: planRows } = await supabase
      .from("workout_plans")
      .select("session_name, details, tempo")
      .eq("user_id", userId)
      .eq("week", week)
      .eq("day", day);

    let validPlans = ((planRows || []) as any[]).filter(
      (p) => (p.session_name || "").trim() || (p.details || "").trim()
    );
    if (validPlans.length === 0) {
      // Last-resort fallback: still allow sharing with a generic name
      validPlans = [{ session_name: "Pass", details: "", tempo: null }];
    }

    const plan: PlanLike = {
      session_name: validPlans.map((p) => p.session_name || "Pass").filter(Boolean).join(" + ") || "Pass",
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

    return buildWorkoutSummaryCaption(plan, (completion || {}) as any, week, day);
  } catch {
    return null;
  }
}

/**
 * Create or update a "friends" social post for a completed workout.
 * Accepts an optional caption override (used when the user edits the text in the dialog).
 * Idempotent: if a post for the same user/week/day already exists, it is updated.
 */
export async function autoShareCompletion(
  userId: string,
  week: number,
  day: string,
  captionOverride?: string
): Promise<void> {
  try {
    let caption = captionOverride;
    if (!caption) {
      const preview = await previewWorkoutCaption(userId, week, day);
      if (!preview) return;
      caption = preview;
    }

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
      const { error } = await supabase.from("social_posts").upsert(
        {
          user_id: userId,
          caption,
          visibility: "friends",
          workout_week: week,
          workout_day: day,
        },
        { onConflict: "user_id,workout_week,workout_day", ignoreDuplicates: true }
      );
      if (!error) {
        supabase.functions
          .invoke("notify-social-post", { body: { caption, visibility: "friends" } })
          .catch(() => {});
      }
    }
  } catch {
    // best-effort
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
