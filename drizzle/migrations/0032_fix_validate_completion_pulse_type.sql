CREATE OR REPLACE FUNCTION public.validate_completion_values()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Speglar gränserna i src/lib/inputValidation.ts (cardioDistanceKm, pulseBpm).
  IF NEW.logged_distance_km IS NOT NULL THEN
    IF NEW.logged_distance_km < 0 OR NEW.logged_distance_km > 300 THEN
      RAISE EXCEPTION 'Orimlig distans: % km (tillåtet 0-300)', NEW.logged_distance_km;
    END IF;
  END IF;
  IF NEW.logged_pulse IS NOT NULL THEN
    IF NEW.logged_pulse < 30 OR NEW.logged_pulse > 220 THEN
      RAISE EXCEPTION 'Orimlig puls: % (tillåtet 30-220 bpm)', NEW.logged_pulse;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;