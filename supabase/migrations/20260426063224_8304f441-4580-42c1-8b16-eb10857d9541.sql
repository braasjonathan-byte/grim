CREATE TABLE public.strava_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  strava_athlete_id BIGINT NOT NULL UNIQUE,
  athlete_firstname TEXT,
  athlete_lastname TEXT,
  athlete_username TEXT,
  athlete_profile_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scope TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Strava connection"
ON public.strava_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Strava connection"
ON public.strava_connections
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Backend can manage Strava connections"
ON public.strava_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_strava_connections_updated_at
BEFORE UPDATE ON public.strava_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.strava_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  redirect_origin TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.strava_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backend can manage Strava OAuth states"
ON public.strava_oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_strava_oauth_states_state ON public.strava_oauth_states(state);
CREATE INDEX idx_strava_oauth_states_expires_at ON public.strava_oauth_states(expires_at);