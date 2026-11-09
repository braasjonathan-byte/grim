-- Strava export: auto-export setting + export log (prevents duplicates and re-import).
ALTER TABLE public.strava_connections
  ADD COLUMN IF NOT EXISTS auto_export boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.strava_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  completion_id uuid NOT NULL UNIQUE,
  upload_id bigint,
  strava_activity_id bigint,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strava_exports_user_idx ON public.strava_exports (user_id, strava_activity_id);

ALTER TABLE public.strava_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Backend can manage Strava exports" ON public.strava_exports;
CREATE POLICY "Backend can manage Strava exports" ON public.strava_exports
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own Strava exports" ON public.strava_exports;
CREATE POLICY "Users can view their own Strava exports" ON public.strava_exports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Export settings for the signed-in user (no tokens exposed).
CREATE OR REPLACE FUNCTION public.get_my_strava_export_settings()
RETURNS TABLE(connected boolean, can_write boolean, auto_export boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT true,
         coalesce(sc.scope, '') ~ '(^|[ ,])activity:write([ ,]|$)',
         sc.auto_export
  FROM public.strava_connections sc
  WHERE sc.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_my_strava_auto_export(enabled boolean)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.strava_connections SET auto_export = enabled, updated_at = now()
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_strava_export_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_strava_auto_export(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_strava_export_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_strava_auto_export(boolean) TO authenticated;
