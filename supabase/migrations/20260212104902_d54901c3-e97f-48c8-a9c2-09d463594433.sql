
-- Comments on friends' workout days
CREATE TABLE public.workout_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  week integer NOT NULL,
  day text NOT NULL,
  author_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on workouts they're involved in (as target or author)
CREATE POLICY "Users can read relevant comments"
  ON public.workout_comments FOR SELECT
  USING (auth.uid() = target_user_id OR auth.uid() = author_id);

-- Authenticated users can insert comments
CREATE POLICY "Users can add comments"
  ON public.workout_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.workout_comments FOR DELETE
  USING (auth.uid() = author_id);
