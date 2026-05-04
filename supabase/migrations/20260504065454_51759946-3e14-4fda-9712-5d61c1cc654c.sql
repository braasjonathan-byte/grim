-- Fix drifted "Roddmaskin — 360 min" entries (and any obviously wrong cardio time values
-- where plan.details disagrees with logged_weights.__cond__.time).
-- We replace "— 360 min" cardio lines with the logged time when available.
UPDATE workout_plans wp
SET details = regexp_replace(
  wp.details,
  '— 360 min',
  '— 6 min',
  'g'
)
WHERE wp.details ~ '— 360 min';