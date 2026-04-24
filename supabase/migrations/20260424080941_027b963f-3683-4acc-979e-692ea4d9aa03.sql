
ALTER TABLE public.custom_exercises
  ADD COLUMN IF NOT EXISTS submuscles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.exercise_muscle_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name text NOT NULL UNIQUE,
  exercise_name_lower text GENERATED ALWAYS AS (lower(exercise_name)) STORED,
  muscle_group text,
  submuscles text[] NOT NULL DEFAULT '{}',
  secondary_muscles jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_muscle_overrides_lower
  ON public.exercise_muscle_overrides (exercise_name_lower);

ALTER TABLE public.exercise_muscle_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read overrides"
  ON public.exercise_muscle_overrides FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert overrides"
  ON public.exercise_muscle_overrides FOR INSERT
  TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update overrides"
  ON public.exercise_muscle_overrides FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete overrides"
  ON public.exercise_muscle_overrides FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anon overrides"
  ON public.exercise_muscle_overrides FOR ALL
  TO anon USING (false) WITH CHECK (false);

CREATE TRIGGER update_exercise_muscle_overrides_updated_at
  BEFORE UPDATE ON public.exercise_muscle_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
