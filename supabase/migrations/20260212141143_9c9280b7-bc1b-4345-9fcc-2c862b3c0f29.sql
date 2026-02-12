
-- Add workout logging columns to workout_completions
ALTER TABLE public.workout_completions
  ADD COLUMN logged_tempo text DEFAULT NULL,
  ADD COLUMN logged_pulse integer DEFAULT NULL,
  ADD COLUMN logged_distance_km numeric DEFAULT NULL,
  ADD COLUMN logged_weights jsonb DEFAULT NULL;

-- logged_tempo: e.g. "5:30 min/km"
-- logged_pulse: average heart rate
-- logged_distance_km: distance in km
-- logged_weights: e.g. {"Bänkpress": 80, "Knäböj": 100} - actual weights used
