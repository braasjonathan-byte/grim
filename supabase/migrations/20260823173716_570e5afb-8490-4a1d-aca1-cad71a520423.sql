CREATE TABLE public.weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  pass_count integer NOT NULL DEFAULT 0,
  total_tons numeric NOT NULL DEFAULT 0,
  total_distance_km numeric NOT NULL DEFAULT 0,
  pr_count integer NOT NULL DEFAULT 0,
  prev_tons numeric NOT NULL DEFAULT 0,
  prev_pass_count integer NOT NULL DEFAULT 0,
  prev_distance_km numeric NOT NULL DEFAULT 0,
  summary text NOT NULL DEFAULT '',
  sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly reports"
ON public.weekly_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX weekly_reports_user_created_idx ON public.weekly_reports (user_id, week_start DESC);