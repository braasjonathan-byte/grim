
CREATE OR REPLACE FUNCTION public.get_inactive_users_for_nudge(cutoff_date timestamptz)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT wc.user_id
  FROM workout_completions wc
  WHERE wc.done = true
  GROUP BY wc.user_id
  HAVING MAX(wc.updated_at) < cutoff_date
    AND MAX(wc.updated_at) > cutoff_date - interval '1 day'
$$;
