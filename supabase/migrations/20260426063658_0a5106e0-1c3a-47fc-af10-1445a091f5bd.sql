CREATE TABLE public.strava_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strava_activity_id BIGINT NOT NULL,
  name TEXT,
  activity_type TEXT,
  sport_type TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  distance_km NUMERIC,
  moving_time_seconds INTEGER,
  elapsed_time_seconds INTEGER,
  average_speed_mps NUMERIC,
  average_heartrate NUMERIC,
  max_heartrate NUMERIC,
  workout_completion_id UUID,
  raw_activity JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, strava_activity_id)
);

ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Strava activities"
ON public.strava_activities
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Backend can manage Strava activities"
ON public.strava_activities
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_strava_activities_user_start_date ON public.strava_activities(user_id, start_date DESC);
CREATE INDEX idx_strava_activities_completion ON public.strava_activities(workout_completion_id);

CREATE TRIGGER update_strava_activities_updated_at
BEFORE UPDATE ON public.strava_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_completions_user_week_day_unique
ON public.workout_completions(user_id, week, day);