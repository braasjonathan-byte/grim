import type { AchievementDefinition } from "@/lib/achievements";

export interface WorkoutViewProps {
  userId: string;
  isAdmin?: boolean;
  isHonorary?: boolean;
  onBack?: () => void;
  adminViewNickname?: string;
}

export interface PlanDay {
  id: string;
  week: number;
  day: string;
  session_name: string;
  details: string;
  tempo: string | null;
  is_circuit?: boolean;
}

export interface Completion {
  week: number;
  day: string;
  done: boolean;
  skipped: boolean;
  user_comment: string;
  logged_tempo?: string | null;
  logged_pulse?: number | null;
  logged_distance_km?: number | null;
  logged_weights?: Record<string, number> | null;
}

export interface FriendComment {
  id: string;
  author_id: string;
  target_user_id: string;
  week: number;
  day: string;
  plan_id: string | null;
  comment: string;
  created_at: string;
}

// Decide whether a friend comment belongs to a given plan day.
// Comments saved with a plan_id stick to that exact plan row.
// Comments matched only by (week, day) must also have been written on/after
// the current plan's start date — otherwise old comments from a previous
// plan cycle would leak onto the same week/day slot in a brand-new plan.
export const matchesPlanDay = (
  c: FriendComment,
  plan: { id: string; week: number; day: string },
  planStartDate: string | null,
): boolean => {
  if (c.plan_id === plan.id) return true;
  return false;
};

export const matchesPlanLike = (
  like: { week: number; day: string; plan_id?: string | null },
  plan: { id: string; week: number; day: string },
): boolean => {
  if (like.plan_id) return like.plan_id === plan.id;
  return false;
};

export interface AchievementToastState {
  achievements: AchievementDefinition[];
}

export interface CustomExercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  created_by: string;
  is_bodyweight_exercise?: boolean;
  is_time_based?: boolean;
}
