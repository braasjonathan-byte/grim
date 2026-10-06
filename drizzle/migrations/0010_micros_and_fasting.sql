ALTER TABLE public.meal_logs ADD COLUMN iron_mg numeric, ADD COLUMN calcium_mg numeric, ADD COLUMN vitamin_d_ug numeric, ADD COLUMN vitamin_c_mg numeric, ADD COLUMN vitamin_b12_ug numeric, ADD COLUMN magnesium_mg numeric, ADD COLUMN potassium_mg numeric, ADD COLUMN sodium_mg numeric;
ALTER TABLE public.foods ADD COLUMN iron_mg numeric, ADD COLUMN calcium_mg numeric, ADD COLUMN vitamin_d_ug numeric, ADD COLUMN vitamin_c_mg numeric, ADD COLUMN vitamin_b12_ug numeric, ADD COLUMN magnesium_mg numeric, ADD COLUMN potassium_mg numeric, ADD COLUMN sodium_mg numeric;
ALTER TABLE public.custom_foods ADD COLUMN iron_mg numeric, ADD COLUMN calcium_mg numeric, ADD COLUMN vitamin_d_ug numeric, ADD COLUMN vitamin_c_mg numeric, ADD COLUMN vitamin_b12_ug numeric, ADD COLUMN magnesium_mg numeric, ADD COLUMN potassium_mg numeric, ADD COLUMN sodium_mg numeric;
ALTER TABLE public.nutrition_goals ADD COLUMN iron_mg numeric, ADD COLUMN calcium_mg numeric, ADD COLUMN vitamin_d_ug numeric, ADD COLUMN vitamin_c_mg numeric, ADD COLUMN vitamin_b12_ug numeric, ADD COLUMN magnesium_mg numeric, ADD COLUMN potassium_mg numeric, ADD COLUMN sodium_mg numeric;
ALTER TABLE public.profiles ADD COLUMN fasting_widget_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE public.fasting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  schedule_type text NOT NULL DEFAULT '16:8',
  target_hours numeric NOT NULL DEFAULT 16,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fasting_sessions TO authenticated;
GRANT ALL ON public.fasting_sessions TO service_role;
ALTER TABLE public.fasting_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own fasting select" ON public.fasting_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own fasting insert" ON public.fasting_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own fasting update" ON public.fasting_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own fasting delete" ON public.fasting_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX fasting_sessions_user_start_idx ON public.fasting_sessions (user_id, start_time DESC);