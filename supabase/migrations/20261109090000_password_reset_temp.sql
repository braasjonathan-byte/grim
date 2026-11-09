-- "Glömt lösenord": temporary passwords (hash only) + rate-limit events.
-- Service role only; no client access.

CREATE TABLE IF NOT EXISTS public.password_reset_temp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_reset_temp_user_idx ON public.password_reset_temp (user_id);
ALTER TABLE public.password_reset_temp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_temp FROM anon, authenticated;
COMMENT ON TABLE public.password_reset_temp IS 'Bcrypt hashes of temporary passwords from forgot-password. Service role only (edge functions forgot-password / temp-password-login).';

CREATE TABLE IF NOT EXISTS public.password_reset_rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_rate_events_bucket_idx ON public.password_reset_rate_events (bucket, created_at DESC);
ALTER TABLE public.password_reset_rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_rate_events FROM anon, authenticated;

-- Called by the client after a successful forced password change:
-- clears the must-change flag and removes all temp passwords for the caller.
CREATE OR REPLACE FUNCTION public.complete_forced_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.password_reset_temp WHERE user_id = auth.uid();
  UPDATE public.profiles SET must_change_password = false WHERE user_id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.complete_forced_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_forced_password_change() TO authenticated;

-- Housekeeping: drop expired temp rows and old rate events daily.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('password-reset-cleanup')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'password-reset-cleanup');
    PERFORM cron.schedule(
      'password-reset-cleanup',
      '17 3 * * *',
      $cron$
        DELETE FROM public.password_reset_temp WHERE expires_at < now() - interval '1 day' OR used_at < now() - interval '1 day';
        DELETE FROM public.password_reset_rate_events WHERE created_at < now() - interval '1 day';
      $cron$
    );
  END IF;
END $$;
