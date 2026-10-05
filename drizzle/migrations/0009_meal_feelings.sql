CREATE TABLE public.meal_feelings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  meal_type text NOT NULL,
  feeling text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date, meal_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_feelings TO authenticated;
GRANT ALL ON public.meal_feelings TO service_role;
ALTER TABLE public.meal_feelings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own meal feelings" ON public.meal_feelings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);