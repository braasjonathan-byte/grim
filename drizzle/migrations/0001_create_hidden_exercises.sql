CREATE TABLE public.hidden_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name text NOT NULL,
  exercise_name_lower text GENERATED ALWAYS AS (lower(exercise_name)) STORED,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hidden_exercises_name_lower_key ON public.hidden_exercises (exercise_name_lower);

GRANT SELECT ON public.hidden_exercises TO anon;
GRANT SELECT, INSERT, DELETE ON public.hidden_exercises TO authenticated;
GRANT ALL ON public.hidden_exercises TO service_role;

ALTER TABLE public.hidden_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hidden exercises"
ON public.hidden_exercises FOR SELECT USING (true);

CREATE POLICY "Admins can hide exercises"
ON public.hidden_exercises FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can unhide exercises"
ON public.hidden_exercises FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));