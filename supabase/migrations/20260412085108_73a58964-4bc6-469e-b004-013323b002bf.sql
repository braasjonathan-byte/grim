
CREATE OR REPLACE FUNCTION public.get_leaderboard(filter_year integer, filter_month integer DEFAULT NULL)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text, done_count bigint, is_honorary boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  
  RETURN QUERY
  WITH active_completions AS (
    SELECT 
      wc.user_id,
      wc.id,
      CASE 
        WHEN wc.week = 0 AND wc.day ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(wc.day from '^\d{4}-\d{2}-\d{2}')::date
        WHEN wc.done THEN
          (wc.updated_at AT TIME ZONE 'UTC')::date
        WHEN wc.week > 0 AND p2.plan_start_date IS NOT NULL THEN
          p2.plan_start_date + ((wc.week - 1) * 7 + COALESCE(('{"Mån":0,"Tis":1,"Ons":2,"Tors":3,"Fre":4,"Lör":5,"Sön":6}'::jsonb->>wc.day)::int, 0)) * interval '1 day'
        ELSE
          (wc.updated_at AT TIME ZONE 'UTC')::date
      END AS completion_date
    FROM workout_completions wc
    JOIN profiles p2 ON p2.user_id = wc.user_id
    WHERE wc.done = true
      AND (
        wc.logged_distance_km IS NOT NULL
        OR wc.logged_tempo IS NOT NULL
        OR wc.logged_pulse IS NOT NULL
        OR (wc.logged_weights IS NOT NULL AND wc.logged_weights::text != '{}')
        OR EXISTS (
          SELECT 1 FROM workout_plans wp
          WHERE wp.user_id = wc.user_id AND wp.week = wc.week AND wp.day = wc.day
          AND wp.details IS NOT NULL AND TRIM(wp.details) != ''
        )
      )
  ),
  archived_completions AS (
    SELECT 
      ap.user_id,
      gen_random_uuid() AS id,
      CASE
        WHEN (c->>'week')::int = 0 AND (c->>'day') ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(c->>'day' from '^\d{4}-\d{2}-\d{2}')::date
        WHEN c->>'updated_at' IS NOT NULL THEN
          ((c->>'updated_at')::timestamptz AT TIME ZONE 'UTC')::date
        ELSE
          ap.archived_at::date
      END AS completion_date
    FROM archived_plans ap,
         jsonb_array_elements(ap.completion_data) c
    WHERE (c->>'done')::boolean = true
      AND (
        c->>'logged_distance_km' IS NOT NULL
        OR c->>'logged_tempo' IS NOT NULL
        OR c->>'logged_pulse' IS NOT NULL
        OR (c->>'logged_weights' IS NOT NULL AND c->>'logged_weights' != '{}')
        OR TRUE
      )
  ),
  all_completions AS (
    SELECT * FROM active_completions
    UNION ALL
    SELECT * FROM archived_completions
  )
  SELECT 
    p.user_id,
    p.nickname,
    p.avatar_url,
    COUNT(ac.id) AS done_count,
    p.is_honorary
  FROM profiles p
  JOIN all_completions ac ON ac.user_id = p.user_id
  WHERE EXTRACT(YEAR FROM ac.completion_date) = filter_year
    AND (filter_month IS NULL OR EXTRACT(MONTH FROM ac.completion_date) = filter_month)
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COUNT(ac.id) > 0
  ORDER BY done_count DESC;
END;
$$;
