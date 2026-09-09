import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_week_plan",
  title: "Get training plan for a week",
  description:
    "Get the signed-in user's planned Grim sessions for a given week number, with session names and exercise details.",
  inputSchema: {
    week: z.number().int().min(1).max(104).describe("Week number in the training plan."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ week }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("workout_plans")
      .select("week, day, session_name, details, tempo, is_circuit")
      .eq("user_id", ctx.getUserId()!)
      .eq("week", week)
      .order("day", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: rows.length ? JSON.stringify(rows, null, 2) : `No plan found for week ${week}.`,
        },
      ],
      structuredContent: { week, sessions: rows },
    };
  },
});
