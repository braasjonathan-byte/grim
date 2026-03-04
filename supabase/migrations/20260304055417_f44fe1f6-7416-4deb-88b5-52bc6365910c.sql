
-- Add a timezone-safe date column for plan start
ALTER TABLE public.profiles ADD COLUMN plan_start_date date;

-- Backfill for Jessica (and any other calibrated users)
UPDATE public.profiles 
SET plan_start_date = (
  SELECT (MIN(wp.created_at) AT TIME ZONE 'Europe/Stockholm')::date
  FROM workout_plans wp 
  WHERE wp.user_id = profiles.user_id AND wp.week > 0
)
WHERE plan_start_calibrated = true;
