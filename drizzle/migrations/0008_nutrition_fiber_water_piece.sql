ALTER TABLE public.meal_logs ADD COLUMN fiber_g numeric NOT NULL DEFAULT 0;
ALTER TABLE public.nutrition_goals ADD COLUMN fiber_g integer;
ALTER TABLE public.nutrition_goals ADD COLUMN water_goal_ml integer NOT NULL DEFAULT 2000;
ALTER TABLE public.foods ADD COLUMN default_piece_weight_g numeric;

CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  amount_ml integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own water select" ON public.water_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own water insert" ON public.water_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own water update" ON public.water_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own water delete" ON public.water_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);