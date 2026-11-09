CREATE OR REPLACE FUNCTION public.validate_profile_max_heart_rate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.max_heart_rate IS NOT NULL AND (NEW.max_heart_rate < 80 OR NEW.max_heart_rate > 230) THEN
    RAISE EXCEPTION 'Maxpuls måste vara mellan 80 och 230 bpm';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_max_heart_rate_trigger ON public.profiles;

CREATE TRIGGER validate_profile_max_heart_rate_trigger
BEFORE INSERT OR UPDATE OF max_heart_rate ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_max_heart_rate();