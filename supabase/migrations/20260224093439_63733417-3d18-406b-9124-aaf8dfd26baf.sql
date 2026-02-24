
-- Table to deduplicate push notifications (one per workout per type)
CREATE TABLE public.notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week integer NOT NULL,
  day text NOT NULL,
  type text NOT NULL DEFAULT 'completion',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, week, day, type)
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Only service role needs access (edge functions use service role)
CREATE POLICY "Deny all client access" ON public.notification_log FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Service role full access" ON public.notification_log FOR ALL USING (true) WITH CHECK (true);
