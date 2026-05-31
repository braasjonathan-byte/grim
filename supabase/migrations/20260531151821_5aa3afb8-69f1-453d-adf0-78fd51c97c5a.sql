ALTER TABLE public.workout_likes
DROP CONSTRAINT IF EXISTS workout_likes_user_id_target_user_id_week_day_key;

CREATE UNIQUE INDEX IF NOT EXISTS workout_likes_unique_plan
ON public.workout_likes(user_id, target_user_id, plan_id)
WHERE plan_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workout_likes_unique_day_without_plan
ON public.workout_likes(user_id, target_user_id, week, day)
WHERE plan_id IS NULL;