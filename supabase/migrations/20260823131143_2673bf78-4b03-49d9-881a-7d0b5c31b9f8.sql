ALTER TABLE public.custom_exercises
  ADD COLUMN IF NOT EXISTS cardio_modes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cardio_dist_unit text,
  ADD COLUMN IF NOT EXISTS track_pulse boolean NOT NULL DEFAULT true;