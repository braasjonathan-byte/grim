
-- 1. Replace is_jonne() with has_role() in get_suggestion_nicknames
CREATE OR REPLACE FUNCTION public.get_suggestion_nicknames(user_ids text[])
RETURNS TABLE(user_id text, nickname text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN QUERY
    SELECT p.user_id::text, p.nickname
    FROM profiles p
    WHERE p.user_id::text = ANY(user_ids)
      AND p.user_id = auth.uid();
  ELSE
    RETURN QUERY
    SELECT p.user_id::text, p.nickname
    FROM profiles p
    WHERE p.user_id::text = ANY(user_ids);
  END IF;
END;
$$;

-- 2. Create rate limiting table for password reset
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  nickname_attempted text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  locked_until timestamp with time zone
);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- Deny all access - only service role (edge functions) can access
CREATE POLICY "Deny all access to reset attempts"
ON public.password_reset_attempts
FOR ALL
USING (false)
WITH CHECK (false);

-- 3. Fix workout_plans SELECT - restrict to own + friends + admins
DROP POLICY IF EXISTS "Users can read own and friends plans" ON public.workout_plans;

CREATE POLICY "Users can read own and friends plans"
ON public.workout_plans
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = auth.uid() AND f.friend_id = workout_plans.user_id)
      OR (f.friend_id = auth.uid() AND f.user_id = workout_plans.user_id)
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
