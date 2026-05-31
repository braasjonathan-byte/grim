
-- Triathlon plan tables
CREATE TABLE public.triathlon_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text NOT NULL DEFAULT 'duration',
  duration_weeks integer,
  race_date date,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  swim_level text NOT NULL DEFAULT 'beginner',
  bike_level text NOT NULL DEFAULT 'beginner',
  run_level text NOT NULL DEFAULT 'beginner',
  swim_km_week numeric NOT NULL DEFAULT 0,
  bike_km_week numeric NOT NULL DEFAULT 0,
  run_km_week numeric NOT NULL DEFAULT 0,
  sessions_per_week integer NOT NULL DEFAULT 4,
  long_session_days text[] NOT NULL DEFAULT ARRAY['Lör','Sön']::text[],
  include_strength boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triathlon_plans TO authenticated;
GRANT ALL ON public.triathlon_plans TO service_role;
ALTER TABLE public.triathlon_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own triathlon plans" ON public.triathlon_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER triathlon_plans_updated_at
  BEFORE UPDATE ON public.triathlon_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.triathlon_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.triathlon_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_date date NOT NULL,
  week integer NOT NULL DEFAULT 1,
  day_of_week text NOT NULL DEFAULT 'Mån',
  discipline text NOT NULL DEFAULT 'rest',
  duration_min integer NOT NULL DEFAULT 0,
  distance_km numeric NOT NULL DEFAULT 0,
  intensity text NOT NULL DEFAULT 'RPE 5',
  description text NOT NULL DEFAULT '',
  is_long_session boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triathlon_sessions TO authenticated;
GRANT ALL ON public.triathlon_sessions TO service_role;
ALTER TABLE public.triathlon_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own triathlon sessions" ON public.triathlon_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_triathlon_sessions_user_date ON public.triathlon_sessions(user_id, session_date);

CREATE TRIGGER triathlon_sessions_updated_at
  BEFORE UPDATE ON public.triathlon_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.triathlon_session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.triathlon_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  felt text NOT NULL DEFAULT 'good',
  had_pain boolean NOT NULL DEFAULT false,
  pain_area text,
  pain_level integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triathlon_session_logs TO authenticated;
GRANT ALL ON public.triathlon_session_logs TO service_role;
ALTER TABLE public.triathlon_session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own triathlon logs" ON public.triathlon_session_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
