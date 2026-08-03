
-- 1. Cron secret store (service-role only)
CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all client access to cron_secrets"
  ON public.cron_secrets FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.cron_secrets (name, secret)
VALUES ('cron', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- 2. profiles: prevent privilege / currency self-escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_honorary IS NOT DISTINCT FROM (SELECT p.is_honorary FROM public.profiles p WHERE p.user_id = auth.uid())
    AND protein_bars IS NOT DISTINCT FROM (SELECT p.protein_bars FROM public.profiles p WHERE p.user_id = auth.uid())
    AND referred_by IS NOT DISTINCT FROM (SELECT p.referred_by FROM public.profiles p WHERE p.user_id = auth.uid())
    AND referral_code IS NOT DISTINCT FROM (SELECT p.referral_code FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 3. event_groups: no spoofing is_auto
DROP POLICY IF EXISTS "Authenticated can create groups" ON public.event_groups;
CREATE POLICY "Authenticated can create groups"
  ON public.event_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND is_auto = false);

-- 4. Post visibility helper (invoker rights -> reuses social_posts RLS)
CREATE OR REPLACE FUNCTION public.can_view_post(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = _post_id)
$$;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can view post images" ON public.social_post_images;
CREATE POLICY "Viewers of a post can view its images"
  ON public.social_post_images FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Authenticated can read comments" ON public.social_post_comments;
CREATE POLICY "Viewers of a post can read its comments"
  ON public.social_post_comments FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

DROP POLICY IF EXISTS "Authenticated can read likes" ON public.social_post_likes;
CREATE POLICY "Viewers of a post can read its likes"
  ON public.social_post_likes FOR SELECT TO authenticated
  USING (public.can_view_post(post_id));

-- 5. suggestions: only author + admin
DROP POLICY IF EXISTS "Authenticated users can read all suggestions" ON public.suggestions;
CREATE POLICY "Users read own suggestions, admins read all"
  ON public.suggestions FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR has_role(auth.uid(), 'admin'::app_role));

-- 6. Cron jobs now send the shared secret header
DO $do$
DECLARE
  v_secret text;
  v_base text := 'https://gnhbkevtoajzdpsengki.supabase.co/functions/v1/';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaGJrZXZ0b2FqemRwc2VuZ2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTAzMjksImV4cCI6MjA4NjQ2NjMyOX0.2vlSd4r9YYomabcemqVUHmf7V6sR4knQNbdywXomAmw';
  j record;
BEGIN
  SELECT secret INTO v_secret FROM public.cron_secrets WHERE name = 'cron';

  FOR j IN
    SELECT * FROM (VALUES
      ('workout-reminder-check', 'notify-reminder', '*/5 * * * *'),
      ('notify-inactive-users', 'notify-inactive', '0 10 * * *'),
      ('purge-deleted-accounts-daily', 'purge-deleted-accounts', '0 3 * * *'),
      ('weekly-report-sunday', 'weekly-report', '0 17 * * 0'),
      ('notify-incomplete-workout-15min', 'notify-incomplete-workout', '*/15 * * * *')
    ) AS t(jobname, fn, sched)
  LOOP
    PERFORM cron.unschedule(j.jobname) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j.jobname);
    PERFORM cron.schedule(
      j.jobname,
      j.sched,
      format(
        $q$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$q$,
        v_base || j.fn,
        json_build_object(
          'Content-Type', 'application/json',
          'apikey', v_anon,
          'Authorization', 'Bearer ' || v_anon,
          'x-cron-secret', v_secret
        )::text
      )
    );
  END LOOP;
END
$do$;
