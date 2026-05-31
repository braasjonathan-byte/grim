ALTER TABLE public.workout_likes
ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workout_likes_plan_id
ON public.workout_likes(plan_id)
WHERE plan_id IS NOT NULL;