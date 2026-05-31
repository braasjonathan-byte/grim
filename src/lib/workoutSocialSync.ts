import { supabase } from "@/integrations/supabase/client";

export type SyncedWorkoutComment = {
  id: string;
  target_user_id: string;
  week: number;
  day: string;
  plan_id: string | null;
  author_id: string;
  comment: string;
  created_at: string;
};

export type SyncedWorkoutLike = {
  id: string;
  user_id: string;
  target_user_id: string;
  week: number;
  day: string;
  plan_id: string | null;
  created_at?: string;
};

type WorkoutPost = {
  id: string;
  user_id: string;
  workout_week: number | null;
  workout_day: string | null;
};

export const workoutKey = (week: number, day: string) => `${week}-${day}`;
export const isSocialInteractionId = (id: string) => id.startsWith("social:");
export const stripSocialInteractionId = (id: string) => id.replace(/^social:/, "");

export async function getWorkoutPostId(ownerUserId: string, week: number, day: string) {
  const { data } = await supabase
    .from("social_posts")
    .select("id")
    .eq("user_id", ownerUserId)
    .eq("workout_week", week)
    .eq("workout_day", day)
    .maybeSingle();
  return data?.id ?? null;
}

export async function fetchSocialWorkoutInteractions(ownerUserId: string) {
  const { data: postRows } = await supabase
    .from("social_posts")
    .select("id, user_id, workout_week, workout_day")
    .eq("user_id", ownerUserId);

  const posts = ((postRows || []) as WorkoutPost[]).filter(
    (post) => post.workout_week !== null && !!post.workout_day,
  );
  const postIdByKey: Record<string, string> = {};
  const postById = new Map<string, WorkoutPost>();
  posts.forEach((post) => {
    postById.set(post.id, post);
    postIdByKey[workoutKey(post.workout_week!, post.workout_day!)] = post.id;
  });

  const postIds = posts.map((post) => post.id);
  if (postIds.length === 0) return { comments: [], likes: [], postIdByKey };

  const [{ data: commentRows }, { data: likeRows }] = await Promise.all([
    supabase
      .from("social_post_comments")
      .select("id, post_id, user_id, comment, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    supabase
      .from("social_post_likes")
      .select("id, post_id, user_id, created_at")
      .in("post_id", postIds),
  ]);

  const comments = ((commentRows || []) as any[])
    .map((comment): SyncedWorkoutComment | null => {
      const post = postById.get(comment.post_id);
      if (!post?.workout_day || post.workout_week === null) return null;
      return {
        id: `social:${comment.id}`,
        target_user_id: ownerUserId,
        week: post.workout_week,
        day: post.workout_day,
        plan_id: null,
        author_id: comment.user_id,
        comment: comment.comment,
        created_at: comment.created_at,
      };
    })
    .filter(Boolean) as SyncedWorkoutComment[];

  const likes = ((likeRows || []) as any[])
    .map((like): SyncedWorkoutLike | null => {
      const post = postById.get(like.post_id);
      if (!post?.workout_day || post.workout_week === null) return null;
      return {
        id: `social:${like.id}`,
        user_id: like.user_id,
        target_user_id: ownerUserId,
        week: post.workout_week,
        day: post.workout_day,
        plan_id: null,
        created_at: like.created_at,
      };
    })
    .filter(Boolean) as SyncedWorkoutLike[];

  return { comments, likes, postIdByKey };
}

export function mergeWorkoutComments(
  legacyComments: SyncedWorkoutComment[] = [],
  socialComments: SyncedWorkoutComment[] = [],
) {
  const seen = new Map<string, number>();
  const merged: SyncedWorkoutComment[] = [];
  [...socialComments, ...legacyComments].forEach((comment) => {
    const key = `${comment.target_user_id}|${comment.week}|${comment.day}|${comment.author_id}|${comment.comment.trim().toLowerCase()}`;
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      if (!merged[existingIndex].plan_id && comment.plan_id) {
        merged[existingIndex] = comment;
      }
      return;
    }
    seen.set(key, merged.length);
    merged.push(comment);
  });
  return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function mergeWorkoutLikes(
  legacyLikes: SyncedWorkoutLike[] = [],
  socialLikes: SyncedWorkoutLike[] = [],
) {
  const planLikes = new Map<string, SyncedWorkoutLike>();
  const dayLikes = new Map<string, SyncedWorkoutLike>();
  [...legacyLikes, ...socialLikes].forEach((like) => {
    if (like.plan_id) {
      planLikes.set(`${like.target_user_id}|${like.plan_id}|${like.user_id}`, like);
    } else {
      dayLikes.set(`${like.target_user_id}|${like.week}|${like.day}|${like.user_id}`, like);
    }
  });
  planLikes.forEach((like) => {
    dayLikes.delete(`${like.target_user_id}|${like.week}|${like.day}|${like.user_id}`);
  });
  return [...planLikes.values(), ...dayLikes.values()];
}