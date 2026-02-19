
-- Add custom_instructions column to exercise_gif_mappings
ALTER TABLE public.exercise_gif_mappings
ADD COLUMN custom_instructions jsonb DEFAULT NULL;

COMMENT ON COLUMN public.exercise_gif_mappings.custom_instructions IS 'Admin-written instructions as a JSON array of strings, overrides ExerciseDB/AI instructions when present';
