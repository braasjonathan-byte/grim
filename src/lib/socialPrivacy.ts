import { supabase } from "@/integrations/supabase/client";

export type AutoShareMode = "off" | "ask" | "always";
export type PostVisibility = "friends" | "public";

export interface PrivacySettings {
  auto_share_workouts: AutoShareMode;
  default_post_visibility: PostVisibility;
  show_on_leaderboard: boolean;
  share_plan_with_friends: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  auto_share_workouts: "ask",
  default_post_visibility: "friends",
  show_on_leaderboard: false,
  share_plan_with_friends: false,
};

export async function loadPrivacySettings(userId: string): Promise<PrivacySettings> {
  const { data } = await supabase
    .from("profiles")
    .select("auto_share_workouts, default_post_visibility, show_on_leaderboard, share_plan_with_friends")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_PRIVACY;
  return {
    auto_share_workouts: (["off", "ask", "always"].includes((data as any).auto_share_workouts)
      ? (data as any).auto_share_workouts : "ask") as AutoShareMode,
    default_post_visibility: (data as any).default_post_visibility === "public" ? "public" : "friends",
    show_on_leaderboard: !!(data as any).show_on_leaderboard,
    share_plan_with_friends: !!(data as any).share_plan_with_friends,
  };
}

export async function savePrivacySetting(userId: string, patch: Partial<PrivacySettings>) {
  const { error } = await supabase.from("profiles").update(patch as any).eq("user_id", userId);
  return !error;
}

/** Same blocking as the profile modal: removes any friendship and stores a block row. */
export async function blockUser(me: string, other: string): Promise<string | null> {
  await supabase.from("friendships").delete().or(
    `and(user_id.eq.${me},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${me})`,
  );
  const { error } = await supabase.from("friendships").insert({
    user_id: me,
    friend_id: other,
    status: "blocked",
    blocked_by: me,
  } as any);
  return error ? error.message : null;
}

export async function unblockUser(me: string, other: string) {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("status", "blocked")
    .eq("blocked_by", me)
    .or(`and(user_id.eq.${me},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${me})`);
  return !error;
}

export async function muteUser(me: string, other: string) {
  const { error } = await supabase.from("muted_users").insert({ user_id: me, muted_user_id: other });
  return !error || error.code === "23505";
}

export async function unmuteUser(me: string, other: string) {
  const { error } = await supabase.from("muted_users").delete().eq("user_id", me).eq("muted_user_id", other);
  return !error;
}

export async function loadMutedIds(me: string): Promise<Set<string>> {
  const { data } = await supabase.from("muted_users").select("muted_user_id").eq("user_id", me);
  return new Set((data || []).map((r: any) => r.muted_user_id));
}

export const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Olämpligt innehåll" },
  { value: "harassment", label: "Trakasserier" },
  { value: "other", label: "Annat" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export async function submitReport(params: {
  reporterId: string;
  reportedUserId: string;
  postId?: string | null;
  reason: ReportReason;
  details?: string;
}) {
  const details = (params.details || "").trim().slice(0, 500);
  const { error } = await supabase.from("post_reports").insert({
    reporter_id: params.reporterId,
    reported_user_id: params.reportedUserId,
    post_id: params.postId ?? null,
    reason: params.reason,
    details: details || null,
  });
  return !error;
}
