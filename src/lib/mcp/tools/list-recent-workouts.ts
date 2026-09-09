import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_recent_workouts",
  title: "List recent workouts",
  description:
    "List the signed-in user's most recently completed Grim workouts, including week, day, distance, pace and pulse.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many workouts to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("workout_completions")
      .select("week, day, done, skipped, logged_distance_km, logged_tempo, logged_pulse, user_comment, updated_at")
      .eq("user_id", ctx.getUserId()!)
      .eq("done", true)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : "No completed workouts found.",
        },
      ],
      structuredContent: { workouts: rows },
    };
  },
});
