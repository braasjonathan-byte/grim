ALTER TABLE public.exercise_unit_overrides
  ADD COLUMN IF NOT EXISTS weighted_bodyweight boolean DEFAULT NULL;