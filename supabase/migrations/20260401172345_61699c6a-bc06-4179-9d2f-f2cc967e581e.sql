
-- Fix 1: workout_reminders - drop the overly permissive public SELECT policy and replace with service_role only
DROP POLICY IF EXISTS "Service role full access reminders" ON public.workout_reminders;
CREATE POLICY "Service role full access reminders"
  ON public.workout_reminders
  FOR SELECT
  TO service_role
  USING (true);

-- Fix 2: security_answers - add SELECT policy for users to read their own answers
CREATE POLICY "Users can read own security answers"
  ON public.security_answers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
