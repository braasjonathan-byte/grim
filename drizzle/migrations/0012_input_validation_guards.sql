CREATE OR REPLACE FUNCTION public.count_implausible_sets(lw jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE k text; v jsonb; arr jsonb; el jsonb; n int := 0; t text;
BEGIN
  IF lw IS NULL OR jsonb_typeof(lw) <> 'object' THEN RETURN 0; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(lw) LOOP
    IF left(k, 11) <> '__setdata__' THEN CONTINUE; END IF;
    BEGIN
      IF jsonb_typeof(v) = 'string' THEN arr := (v #>> '{}')::jsonb; ELSE arr := v; END IF;
    EXCEPTION WHEN others THEN CONTINUE; END;
    IF arr IS NULL OR jsonb_typeof(arr) <> 'array' THEN CONTINUE; END IF;
    FOR el IN SELECT * FROM jsonb_array_elements(arr) LOOP
      IF jsonb_typeof(el) <> 'object' THEN CONTINUE; END IF;
      t := replace(coalesce(el->>'kg', ''), ',', '.');
      IF t ~ '^-?\d+(\.\d+)?$' AND (t::numeric < 0 OR t::numeric > 500) THEN n := n + 1; CONTINUE; END IF;
      t := replace(coalesce(el->>'reps', ''), ',', '.');
      IF t ~ '^-?\d+(\.\d+)?$' AND (t::numeric < 0 OR t::numeric > 100) THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.validate_workout_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Endast nya ogiltiga värden avvisas; befintliga gamla värden blockerar inte annan redigering.
  IF public.count_implausible_sets(NEW.logged_weights) >
     (CASE WHEN TG_OP = 'UPDATE' THEN public.count_implausible_sets(OLD.logged_weights) ELSE 0 END) THEN
    RAISE EXCEPTION 'Ogiltigt värde: vikt per set 0–500 kg, reps 0–100.' USING ERRCODE = '23514';
  END IF;
  IF NEW.logged_distance_km IS NOT NULL AND (NEW.logged_distance_km < 0 OR NEW.logged_distance_km > 300)
     AND (TG_OP = 'INSERT' OR NEW.logged_distance_km IS DISTINCT FROM OLD.logged_distance_km) THEN
    RAISE EXCEPTION 'Ogiltig distans: 0–300 km.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_workout_completion ON public.workout_completions;
CREATE TRIGGER trg_validate_workout_completion BEFORE INSERT OR UPDATE ON public.workout_completions
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_completion();

CREATE OR REPLACE FUNCTION public.validate_meal_log()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.amount IS NOT DISTINCT FROM OLD.amount AND NEW.kcal IS NOT DISTINCT FROM OLD.kcal
     AND NEW.protein_g IS NOT DISTINCT FROM OLD.protein_g AND NEW.fat_g IS NOT DISTINCT FROM OLD.fat_g
     AND NEW.carbs_g IS NOT DISTINCT FROM OLD.carbs_g THEN
    RETURN NEW;
  END IF;
  IF NEW.amount <= 0 OR (NEW.unit = 'g' AND (NEW.amount < 1 OR NEW.amount > 5000)) THEN
    RAISE EXCEPTION 'Ogiltig mängd: 1–5000 g.' USING ERRCODE = '23514';
  END IF;
  IF NEW.kcal < 0 OR NEW.kcal > 45000 OR NEW.protein_g < 0 OR NEW.fat_g < 0 OR NEW.carbs_g < 0 OR coalesce(NEW.fiber_g, 0) < 0 THEN
    RAISE EXCEPTION 'Negativa eller orimliga näringsvärden går inte att spara.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_meal_log ON public.meal_logs;
CREATE TRIGGER trg_validate_meal_log BEFORE INSERT OR UPDATE ON public.meal_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_meal_log();

CREATE OR REPLACE FUNCTION public.validate_nutrition_goals()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.daily_kcal IS NOT DISTINCT FROM OLD.daily_kcal AND NEW.protein_g IS NOT DISTINCT FROM OLD.protein_g
     AND NEW.fat_g IS NOT DISTINCT FROM OLD.fat_g AND NEW.carbs_g IS NOT DISTINCT FROM OLD.carbs_g
     AND NEW.fiber_g IS NOT DISTINCT FROM OLD.fiber_g THEN
    RETURN NEW;
  END IF;
  IF NEW.daily_kcal < 1000 OR NEW.daily_kcal > 6000 OR NEW.protein_g < 0 OR NEW.protein_g > 400
     OR NEW.fat_g < 0 OR NEW.fat_g > 300 OR NEW.carbs_g < 0 OR NEW.carbs_g > 1000
     OR (NEW.fiber_g IS NOT NULL AND (NEW.fiber_g < 0 OR NEW.fiber_g > 100)) THEN
    RAISE EXCEPTION 'Ogiltigt kostmål.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_nutrition_goals ON public.nutrition_goals;
CREATE TRIGGER trg_validate_nutrition_goals BEFORE INSERT OR UPDATE ON public.nutrition_goals
FOR EACH ROW EXECUTE FUNCTION public.validate_nutrition_goals();

CREATE OR REPLACE FUNCTION public.validate_custom_food()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.kcal IS NOT DISTINCT FROM OLD.kcal AND NEW.protein_g IS NOT DISTINCT FROM OLD.protein_g
     AND NEW.fat_g IS NOT DISTINCT FROM OLD.fat_g AND NEW.carbs_g IS NOT DISTINCT FROM OLD.carbs_g THEN
    RETURN NEW;
  END IF;
  IF NEW.kcal < 0 OR NEW.kcal > 900 OR NEW.protein_g < 0 OR NEW.protein_g > 100 OR NEW.fat_g < 0 OR NEW.fat_g > 100
     OR NEW.carbs_g < 0 OR NEW.carbs_g > 100 OR coalesce(NEW.fiber_g, 0) < 0 OR coalesce(NEW.fiber_g, 0) > 100
     OR (NEW.protein_g + NEW.fat_g + NEW.carbs_g) > 100.5 THEN
    RAISE EXCEPTION 'Ogiltiga näringsvärden per 100 g.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_custom_food ON public.custom_foods;
CREATE TRIGGER trg_validate_custom_food BEFORE INSERT OR UPDATE ON public.custom_foods
FOR EACH ROW EXECUTE FUNCTION public.validate_custom_food();

CREATE OR REPLACE FUNCTION public.validate_profile_body()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.weight_kg IS NOT NULL AND (NEW.weight_kg < 30 OR NEW.weight_kg > 300)
     AND (TG_OP = 'INSERT' OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg) THEN
    RAISE EXCEPTION 'Ogiltig kroppsvikt: 30–300 kg.' USING ERRCODE = '23514';
  END IF;
  IF NEW.height_cm IS NOT NULL AND (NEW.height_cm < 100 OR NEW.height_cm > 250)
     AND (TG_OP = 'INSERT' OR NEW.height_cm IS DISTINCT FROM OLD.height_cm) THEN
    RAISE EXCEPTION 'Ogiltig längd: 100–250 cm.' USING ERRCODE = '23514';
  END IF;
  IF NEW.age IS NOT NULL AND (NEW.age < 13 OR NEW.age > 100)
     AND (TG_OP = 'INSERT' OR NEW.age IS DISTINCT FROM OLD.age) THEN
    RAISE EXCEPTION 'Ogiltig ålder: 13–100 år.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_profile_body ON public.profiles;
CREATE TRIGGER trg_validate_profile_body BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_body();

-- Låter användaren låsa igen sina egna volym-/repsbaserade märken som bara låstes upp av orimliga värden.
CREATE OR REPLACE FUNCTION public.relock_achievements(p_ids text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  DELETE FROM public.user_achievements
  WHERE user_id = auth.uid()
    AND achievement_id = ANY(p_ids)
    AND (achievement_id LIKE 'ton-%' OR achievement_id LIKE 'tonpass-%' OR achievement_id LIKE 'reps-%');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.relock_achievements(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relock_achievements(text[]) TO authenticated;