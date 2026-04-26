DROP POLICY IF EXISTS "Users can view their own Strava connection" ON public.strava_connections;
DROP POLICY IF EXISTS "Users can delete their own Strava connection" ON public.strava_connections;

CREATE POLICY "Users can delete their own Strava connection"
ON public.strava_connections
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_my_strava_connection()
RETURNS TABLE(
  connected boolean,
  athlete_firstname text,
  athlete_lastname text,
  athlete_username text,
  athlete_profile_url text,
  last_synced_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    true AS connected,
    sc.athlete_firstname,
    sc.athlete_lastname,
    sc.athlete_username,
    sc.athlete_profile_url,
    sc.last_synced_at,
    sc.updated_at
  FROM public.strava_connections sc
  WHERE sc.user_id = auth.uid()
  LIMIT 1;
$$;