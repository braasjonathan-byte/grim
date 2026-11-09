ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_heart_rate smallint;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_max_heart_rate_range
  CHECK (max_heart_rate IS NULL OR max_heart_rate BETWEEN 80 AND 230);

COMMENT ON COLUMN public.profiles.max_heart_rate IS 'User-entered maximum heart rate in bpm; drives heart-rate zones for new and historical workouts.';