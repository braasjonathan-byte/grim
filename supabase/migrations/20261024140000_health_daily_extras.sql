-- GRIM_HC_EXTRAS: fler dygnsvärden från Health Connect / Apple Health.
-- Alla kolumner är frivilliga (NULL = ingen data eller ingen behörighet).
ALTER TABLE public.health_daily
  ADD COLUMN IF NOT EXISTS total_calories integer,
  ADD COLUMN IF NOT EXISTS distance_m integer,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS avg_heart_rate smallint,
  ADD COLUMN IF NOT EXISTS min_heart_rate smallint,
  ADD COLUMN IF NOT EXISTS max_heart_rate smallint,
  ADD COLUMN IF NOT EXISTS resting_heart_rate smallint;

-- Rimlighetskontroller så trasig data från en klocka inte förstör statistiken.
ALTER TABLE public.health_daily
  DROP CONSTRAINT IF EXISTS health_daily_extras_sane;
ALTER TABLE public.health_daily
  ADD CONSTRAINT health_daily_extras_sane CHECK (
    (total_calories IS NULL OR total_calories BETWEEN 0 AND 30000)
    AND (distance_m IS NULL OR distance_m BETWEEN 0 AND 1000000)
    AND (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 400)
    AND (avg_heart_rate IS NULL OR avg_heart_rate BETWEEN 20 AND 250)
    AND (min_heart_rate IS NULL OR min_heart_rate BETWEEN 20 AND 250)
    AND (max_heart_rate IS NULL OR max_heart_rate BETWEEN 20 AND 250)
    AND (resting_heart_rate IS NULL OR resting_heart_rate BETWEEN 20 AND 250)
  );
