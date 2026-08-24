ALTER TABLE public.workout_likes
  DROP CONSTRAINT IF EXISTS workout_likes_plan_id_fkey;

ALTER TABLE public.workout_likes
  ADD CONSTRAINT workout_likes_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.workout_plans(id)
  ON DELETE CASCADE;