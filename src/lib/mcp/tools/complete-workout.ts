import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_workout",
  title: "Mark a workout as completed",
  description:
    "Mark a Grim session for a given week and day as completed for the signed-in user, optionally with distance, pace, pulse and a comment.",
  inputSchema: {
    week: z.number().int().min(1).max(104).describe("Week number in the training plan."),
    day: z.string().trim().min(1).describe("Day identifier used in the plan, e.g. 'Måndag'."),
    distance_km: z.number().min(0).max(1000).optional().describe("Logged distance in kilometres."),
    tempo: z.string().trim().optional().describe("Logged pace, e.g. '5:30'."),
    pulse: z.number().int().min(20).max(250).optional().describe("Average pulse in bpm."),
    comment: z.string().trim().max(500).optional().describe("Short note about the session."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ week, day, distance_km, tempo, pulse, comment }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("workout_completions")
      .upsert(
        {
          user_id: ctx.getUserId()!,
          week,
          day,
          done: true,
          skipped: false,
          logged_distance_km: distance_km ?? null,
          logged_tempo: tempo ?? null,
          logged_pulse: pulse ?? null,
          user_comment: comment ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week,day" },
      )
      .select();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Marked week ${week}, ${day} as completed.` }],
      structuredContent: { completion: data?.[0] ?? null },
    };
  },
});
