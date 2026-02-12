
-- Shared exercise library: exercises added by any user are visible to all
CREATE TABLE public.custom_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'styrka',
  muscle_group text NOT NULL DEFAULT 'Helkropp',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;

-- Everyone can read all custom exercises
CREATE POLICY "Anyone can read custom exercises"
  ON public.custom_exercises FOR SELECT
  USING (true);

-- Authenticated users can add exercises
CREATE POLICY "Users can add exercises"
  ON public.custom_exercises FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only creator can delete their own exercises
CREATE POLICY "Users can delete own exercises"
  ON public.custom_exercises FOR DELETE
  USING (auth.uid() = created_by);
