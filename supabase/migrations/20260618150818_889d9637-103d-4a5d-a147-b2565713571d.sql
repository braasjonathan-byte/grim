CREATE TABLE public.meal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_templates TO authenticated;
GRANT ALL ON public.meal_templates TO service_role;

ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own meal templates"
  ON public.meal_templates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_meal_templates_updated_at
  BEFORE UPDATE ON public.meal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meal_templates_user_id ON public.meal_templates(user_id);

-- Workout cheers (Fas 3.1)
CREATE TABLE public.workout_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT '💪',
  workout_week integer,
  workout_day text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.workout_cheers TO authenticated;
GRANT ALL ON public.workout_cheers TO service_role;

ALTER TABLE public.workout_cheers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated who is a friend can insert a cheer
CREATE POLICY "Friends can send cheers"
  ON public.workout_cheers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id <> to_user_id
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.user_id = from_user_id AND f.friend_id = to_user_id)
          OR (f.user_id = to_user_id AND f.friend_id = from_user_id))
    )
  );

-- Sender and recipient can read
CREATE POLICY "Participants can read cheers"
  ON public.workout_cheers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Sender can delete their own
CREATE POLICY "Sender can delete cheer"
  ON public.workout_cheers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

CREATE INDEX idx_workout_cheers_to_user_id ON public.workout_cheers(to_user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_cheers;
ALTER TABLE public.workout_cheers REPLICA IDENTITY FULL;