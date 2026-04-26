ALTER TABLE public.strava_connections
ADD COLUMN IF NOT EXISTS last_sync_attempt_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_sync_imported_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
ADD COLUMN IF NOT EXISTS total_imported_activities INTEGER NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_my_strava_connection();

CREATE OR REPLACE FUNCTION public.get_my_strava_connection()
RETURNS TABLE(
  connected boolean,
  athlete_firstname text,
  athlete_lastname text,
  athlete_username text,
  athlete_profile_url text,
  last_synced_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_sync_attempt_at timestamp with time zone,
  last_sync_imported_count integer,
  last_sync_error text,
  total_imported_activities integer
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
    sc.updated_at,
    sc.last_sync_attempt_at,
    sc.last_sync_imported_count,
    sc.last_sync_error,
    sc.total_imported_activities
  FROM public.strava_connections sc
  WHERE sc.user_id = auth.uid()
  LIMIT 1;
$$;