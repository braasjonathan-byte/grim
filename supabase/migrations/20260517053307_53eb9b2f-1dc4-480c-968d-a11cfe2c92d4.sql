-- Partial unique index so we can dedupe workout-linked posts
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_workout_unique
  ON public.social_posts (user_id, workout_week, workout_day)
  WHERE workout_week IS NOT NULL AND workout_day IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_workout_social_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caption text;
BEGIN
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
  ELSIF NEW.done = false AND TG_OP = 'UPDATE' AND OLD.done = true THEN
    DELETE FROM public.social_posts
      WHERE user_id = NEW.user_id
        AND workout_week = NEW.week
        AND workout_day = NEW.day;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_workout_social_post ON public.workout_completions;
CREATE TRIGGER trg_ensure_workout_social_post
AFTER INSERT OR UPDATE OF done ON public.workout_completions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_workout_social_post();