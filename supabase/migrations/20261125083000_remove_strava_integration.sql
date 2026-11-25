-- Ta bort den direkta Strava-integrationen (Health Connect ersätter den).
-- Redan importerade pass ligger i workout_plans/workout_completions och rörs inte
-- (dag-nycklar med _strava_ och logged_weights.__strava_calories visas som vanligt).
-- Idempotent: kan köras flera gånger.

-- 1) Schemalagd synk (pg_cron) mot edge-funktionen strava-sync.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'strava-sync-every-15-minutes' OR command ILIKE '%/functions/v1/strava-%';
  END IF;
END $$;

-- 2) RPC-funktioner för koppling/export.
DROP FUNCTION IF EXISTS public.get_my_strava_connection();
DROP FUNCTION IF EXISTS public.get_my_strava_export_settings();
DROP FUNCTION IF EXISTS public.set_my_strava_auto_export(boolean);

-- 3) Tabeller (RLS-policyer, index och updated_at-triggers följer med).
DROP TABLE IF EXISTS public.strava_exports;
DROP TABLE IF EXISTS public.strava_activities;
DROP TABLE IF EXISTS public.strava_oauth_states;
DROP TABLE IF EXISTS public.strava_connections;

-- 4) Ev. Strava-nycklar i den privata konfigurationen.
DELETE FROM public.app_private_config WHERE key ILIKE 'STRAVA\_%';
