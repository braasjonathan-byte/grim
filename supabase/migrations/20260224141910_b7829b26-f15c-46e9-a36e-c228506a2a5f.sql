
-- Drop old policies
DROP POLICY IF EXISTS "Deny all client access" ON public.notification_log;
DROP POLICY IF EXISTS "Service role full access" ON public.notification_log;

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access"
ON public.notification_log
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Users can read their own notification logs
CREATE POLICY "Users can read own notification logs"
ON public.notification_log
FOR SELECT
USING (auth.uid() = user_id);

-- Friends can read notification logs
CREATE POLICY "Friends can read notification logs"
ON public.notification_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = auth.uid() AND f.friend_id = notification_log.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = notification_log.user_id)
      )
  )
);

-- Admins can read all notification logs
CREATE POLICY "Admins can read all notification logs"
ON public.notification_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
