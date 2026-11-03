-- Smarta push: opt-out-flagga + kvällscron för notify-smart (logga-om-tomt / streak-hot).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS smart_push boolean NOT NULL DEFAULT true;

DO $do$
DECLARE
  v_secret text;
  v_base text := 'https://gnhbkevtoajzdpsengki.supabase.co/functions/v1/';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduaGJrZXZ0b2FqemRwc2VuZ2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTAzMjksImV4cCI6MjA4NjQ2NjMyOX0.2vlSd4r9YYomabcemqVUHmf7V6sR4knQNbdywXomAmw';
BEGIN
  SELECT secret INTO v_secret FROM public.cron_secrets WHERE name = 'cron';
  PERFORM cron.unschedule('notify-smart-evening') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-smart-evening');
  -- 18:30 UTC = 19:30 vintertid / 20:30 sommartid i Sverige
  PERFORM cron.schedule(
    'notify-smart-evening',
    '30 18 * * *',
    format(
      $q$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$q$,
      v_base || 'notify-smart',
      json_build_object('Content-Type', 'application/json', 'apikey', v_anon, 'Authorization', 'Bearer ' || v_anon, 'x-cron-secret', v_secret)::text
    )
  );
END
$do$;
