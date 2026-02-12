-- Add fitness profile columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN max_distance_km numeric DEFAULT NULL,
ADD COLUMN time_10km_min numeric DEFAULT NULL,
ADD COLUMN experience_level text DEFAULT NULL,
ADD COLUMN training_days_per_week integer DEFAULT NULL;
