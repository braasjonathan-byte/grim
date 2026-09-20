ALTER TABLE public.health_daily
  ADD COLUMN IF NOT EXISTS sleep_minutes integer NOT NULL DEFAULT 0;