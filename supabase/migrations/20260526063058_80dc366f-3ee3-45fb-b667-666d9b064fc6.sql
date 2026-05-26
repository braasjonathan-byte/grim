CREATE OR REPLACE FUNCTION public.ensure_workout_social_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caption text;
BEGIN
  -- Only act when the row transitions to done. Do NOT delete on un-mark:
  -- the first auto-shared post should remain the single source of truth.
  IF NEW.done = true AND (TG_OP = 'INSERT' OR OLD.done IS DISTINCT FROM true) THEN
    SELECT '🏋️ ' || string_agg(wp.session_name, ' + ')
      INTO v_caption
      FROM public.workout_plans wp
      WHERE wp.user_id = NEW.user_id
        AND wp.week = NEW.week
        AND wp.day = NEW.day
        AND wp.details IS NOT NULL
        AND TRIM(wp.details) <> ''
        AND wp.session_name IS NOT NULL
        AND TRIM(wp.session_name) <> '';

    IF v_caption IS NOT NULL THEN
      INSERT INTO public.social_posts (user_id, caption, visibility, workout_week, workout_day)
      VALUES (NEW.user_id, v_caption, 'friends', NEW.week, NEW.day)
      ON CONFLICT (user_id, workout_week, workout_day)
      WHERE workout_week IS NOT NULL AND workout_day IS NOT NULL
      DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;