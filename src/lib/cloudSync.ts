import { supabase } from "@/integrations/supabase/client";
import type { Profile, CompletionData } from "@/data/workoutData";

// Fetch all completions for a profile from the cloud
export const fetchCompletions = async (
  profile: Profile
): Promise<Record<string, CompletionData>> => {
  const { data, error } = await supabase
    .from("workout_completions")
    .select("*")
    .eq("profile", profile);

  if (error) {
    console.error("Error fetching completions:", error);
    return {};
  }

  const map: Record<string, CompletionData> = {};
  for (const row of data || []) {
    const key = `${row.profile}-${row.week}-${row.day}`;
    map[key] = { done: row.done, userComment: row.user_comment || "" };
  }
  return map;
};

// Upsert a single completion to the cloud
export const upsertCompletion = async (
  profile: Profile,
  week: number,
  day: string,
  data: CompletionData
) => {
  const { error } = await supabase
    .from("workout_completions")
    .upsert(
      {
        profile,
        week,
        day,
        done: data.done,
        user_comment: data.userComment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile,week,day" }
    );

  if (error) {
    console.error("Error upserting completion:", error);
  }
};

// Get completion from local cache
const CACHE_KEY = (profile: Profile) => `workout-cloud-cache-${profile}`;

export const getCachedCompletions = (
  profile: Profile
): Record<string, CompletionData> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY(profile)) || "{}");
  } catch {
    return {};
  }
};

export const setCachedCompletions = (
  profile: Profile,
  data: Record<string, CompletionData>
) => {
  localStorage.setItem(CACHE_KEY(profile), JSON.stringify(data));
};

export const getCompletionFromCache = (
  profile: Profile,
  week: number,
  day: string
): CompletionData => {
  const map = getCachedCompletions(profile);
  const key = `${profile}-${week}-${day}`;
  return map[key] || { done: false, userComment: "" };
};

export const updateCompletionInCache = (
  profile: Profile,
  week: number,
  day: string,
  data: CompletionData
) => {
  const map = getCachedCompletions(profile);
  const key = `${profile}-${week}-${day}`;
  map[key] = data;
  setCachedCompletions(profile, map);
};

export const getWeekProgressFromCache = (
  profile: Profile,
  week: number,
  days: { day: string }[]
): number => {
  const map = getCachedCompletions(profile);
  const done = days.filter(
    (d) => map[`${profile}-${week}-${d.day}`]?.done
  ).length;
  return days.length > 0 ? Math.round((done / days.length) * 100) : 0;
};
