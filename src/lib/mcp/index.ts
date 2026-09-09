import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfileTool from "./tools/get-profile";
import listRecentWorkoutsTool from "./tools/list-recent-workouts";
import getWeekPlanTool from "./tools/get-week-plan";
import completeWorkoutTool from "./tools/complete-workout";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "grim",
  title: "Grim",
  version: "0.1.0",
  instructions:
    "Tools for the Grim training app. Read the signed-in user's profile, their planned sessions for a week, their recently completed workouts, and mark a session as completed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, getWeekPlanTool, listRecentWorkoutsTool, completeWorkoutTool],
});
