
CREATE OR REPLACE FUNCTION public.get_leaderboard(filter_year int, filter_month int DEFAULT NULL)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text, done_count bigint, is_honorary boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH day_offsets AS (
    SELECT * FROM (VALUES
      ('Mån',0),('Tis',1),('Ons',2),('Tors',3),('Tor',3),
      ('Fre',4),('Lör',5),('Sön',6),
      ('Måndag',0),('Tisdag',1),('Onsdag',2),('Torsdag',3),
      ('Fredag',4),('Lördag',5),('Söndag',6)
    ) AS t(day_name, offset_val)
  ),
  active_completions AS (
    SELECT
      wc.user_id AS c_user_id,
      wc.id AS c_id,
      CASE
        WHEN wc.week = 0 AND wc.day ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(wc.day from '^\d{4}-\d{2}-\d{2}')::date
        WHEN prof.plan_start_date IS NOT NULL AND wc.week > 0 THEN
          (
            -- Calculate Monday of the plan_start_date week, then add week/day offsets
            prof.plan_start_date - EXTRACT(ISODOW FROM prof.plan_start_date)::int + 1
            + ((wc.week - 1) * 7)
            + COALESCE(d.offset_val, 0)
          )
        ELSE
          (wc.updated_at AT TIME ZONE 'UTC')::date
      END AS completion_date,
      GREATEST(
        1,
        (
          SELECT COUNT(*)::int FROM workout_plans wp
          WHERE wp.user_id = wc.user_id
            AND wp.week = wc.week
            AND wp.day = wc.day
            AND wp.details IS NOT NULL
            AND TRIM(wp.details) != ''
        )
      ) AS pass_count
    FROM workout_completions wc
    JOIN profiles prof ON prof.user_id = wc.user_id
    LEFT JOIN day_offsets d ON d.day_name = wc.day
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
      ap.user_id AS c_user_id,
      gen_random_uuid() AS c_id,
      CASE
        WHEN (c->>'week')::int = 0 AND (c->>'day') ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(c->>'day' from '^\d{4}-\d{2}-\d{2}')::date
        WHEN ap.plan_start_date IS NOT NULL AND (c->>'week')::int > 0 THEN
          ap.plan_start_date + (
            ((c->>'week')::int - 1) * 7
            + COALESCE(('{"Mån":0,"Tis":1,"Ons":2,"Tors":3,"Fre":4,"Lör":5,"Sön":6}'::jsonb->>(c->>'day'))::int, 0)
          )
        WHEN c->>'updated_at' IS NOT NULL THEN
          ((c->>'updated_at')::timestamptz AT TIME ZONE 'UTC')::date
        ELSE
          ap.archived_at::date
      END AS completion_date,
      GREATEST(
        1,
        (
          SELECT COUNT(*)::int FROM jsonb_array_elements(ap.plan_data) p
          WHERE (p->>'week')::int = (c->>'week')::int
            AND (p->>'day') = (c->>'day')
            AND COALESCE(p->>'details', '') <> ''
            AND TRIM(p->>'details') <> ''
        )
      ) AS pass_count
    FROM archived_plans ap,
         jsonb_array_elements(ap.completion_data) c
    WHERE (c->>'done')::boolean = true
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
    COALESCE(SUM(ac.pass_count), 0)::bigint AS done_count,
    p.is_honorary
  FROM profiles p
  JOIN all_completions ac ON ac.c_user_id = p.user_id
  WHERE EXTRACT(YEAR FROM ac.completion_date) = filter_year
    AND (filter_month IS NULL OR EXTRACT(MONTH FROM ac.completion_date) = filter_month)
    AND p.nickname !~* '^test\d+$'
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COALESCE(SUM(ac.pass_count), 0) > 0
  ORDER BY done_count DESC;
END;
$$;
