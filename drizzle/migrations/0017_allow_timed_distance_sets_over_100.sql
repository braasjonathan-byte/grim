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
      -- reps-fältet håller även sekunder (planka/cirkel) och meter (farmers walk/sled): gräns 36000.
      IF t ~ '^-?\d+(\.\d+)?$' AND (t::numeric < 0 OR t::numeric > 36000) THEN n := n + 1; END IF;
    END LOOP;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.validate_workout_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.count_implausible_sets(NEW.logged_weights) >
     (CASE WHEN TG_OP = 'UPDATE' THEN public.count_implausible_sets(OLD.logged_weights) ELSE 0 END) THEN
    RAISE EXCEPTION 'Ogiltigt värde: vikt per set 0–500 kg, reps/sek/m 0–36000.' USING ERRCODE = '23514';
  END IF;
  IF NEW.logged_distance_km IS NOT NULL AND (NEW.logged_distance_km < 0 OR NEW.logged_distance_km > 300)
     AND (TG_OP = 'INSERT' OR NEW.logged_distance_km IS DISTINCT FROM OLD.logged_distance_km) THEN
    RAISE EXCEPTION 'Ogiltig distans: 0–300 km.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;