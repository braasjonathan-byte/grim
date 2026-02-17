-- Update the award_protein_bar trigger function to only award once per day
CREATE OR REPLACE FUNCTION public.award_protein_bar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.done = true AND (OLD.done IS NULL OR OLD.done = false) THEN
    -- Only award if the workout plan has actual exercises
    IF EXISTS (
      SELECT 1 FROM workout_plans wp
      WHERE wp.user_id = NEW.user_id AND wp.week = NEW.week AND wp.day = NEW.day
      AND wp.details IS NOT NULL AND TRIM(wp.details) != ''
    ) THEN
      -- Only award if user hasn't already been awarded today
      IF NOT EXISTS (
        SELECT 1 FROM workout_completions wc
        WHERE wc.user_id = NEW.user_id
          AND wc.done = true
          AND wc.id != NEW.id
          AND DATE(wc.updated_at) = CURRENT_DATE
          AND EXISTS (
            SELECT 1 FROM workout_plans wp2
            WHERE wp2.user_id = wc.user_id AND wp2.week = wc.week AND wp2.day = wc.day
            AND wp2.details IS NOT NULL AND TRIM(wp2.details) != ''
          )
      ) THEN
        UPDATE profiles SET protein_bars = protein_bars + 1 WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;