CREATE TABLE public.health_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  steps integer NOT NULL DEFAULT 0,
  active_calories integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'health',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_daily TO authenticated;
GRANT ALL ON public.health_daily TO service_role;

ALTER TABLE public.health_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health data" ON public.health_daily
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own health data" ON public.health_daily
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own health data" ON public.health_daily
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own health data" ON public.health_daily
  FOR DELETE TO authenticated USING (auth.uid() = user_id);