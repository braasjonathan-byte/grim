CREATE OR REPLACE FUNCTION public.get_leaderboard(filter_year integer, filter_month integer DEFAULT NULL::integer)
 RETURNS TABLE(user_id uuid, nickname text, avatar_url text, done_count bigint, is_honorary boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH active_completions AS (
    SELECT
      wc.user_id AS c_user_id,
      CASE
        WHEN wc.week = 0 AND wc.day ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(wc.day from '^\d{4}-\d{2}-\d{2}')::date
        ELSE
          COALESCE(
            (SELECT CASE WHEN s.d > CURRENT_DATE THEN NULL ELSE s.d END FROM (
              SELECT (
                prof.plan_start_date - EXTRACT(ISODOW FROM prof.plan_start_date)::int + 1
                + ((wc.week - 1) * 7)
                + COALESCE((
                  '{"Mån":0,"Tis":1,"Ons":2,"Tors":3,"Tor":3,"Fre":4,"Lör":5,"Sön":6,"Måndag":0,"Tisdag":1,"Onsdag":2,"Torsdag":3,"Fredag":4,"Lördag":5,"Söndag":6}'::jsonb
                  ->> regexp_replace(wc.day, '_[a-z0-9]+$', '', 'i')
                )::int, 0)
              ) AS d
              WHERE prof.plan_start_date IS NOT NULL AND wc.week > 0
            ) s),
            (wc.updated_at AT TIME ZONE 'UTC')::date
          )
      END AS completion_date,
      1 AS pass_count
    FROM workout_completions wc
    JOIN profiles prof ON prof.user_id = wc.user_id
    WHERE wc.done = true
      AND (
        wc.logged_distance_km IS NOT NULL
        OR wc.logged_tempo IS NOT NULL
        OR wc.logged_pulse IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE(wc.logged_weights, '{}'::jsonb)) kv
          WHERE (kv.key LIKE '\_\_sets\_\_%' AND kv.value LIKE '%1%')
             OR (kv.key LIKE '\_\_cond\_done\_\_%' AND kv.value = '1')
             OR (kv.key LIKE '\_\_cond\_\_%' AND COALESCE(kv.value, '') NOT IN ('', '{}'))
             OR (kv.key LIKE '\_\_setdata\_\_%' AND kv.value ~ '"(reps|kg|time)"\s*:\s*"?[1-9]')
        )
      )
  ),
  archived_completions AS (
    SELECT
      ap.user_id AS c_user_id,
      CASE
        WHEN (c->>'week')::int = 0 AND (c->>'day') ~ '^\d{4}-\d{2}-\d{2}' THEN
          substring(c->>'day' from '^\d{4}-\d{2}-\d{2}')::date
        ELSE
          COALESCE(
            (SELECT CASE WHEN s.d > CURRENT_DATE THEN NULL ELSE s.d END FROM (
              SELECT (
                ap.plan_start_date - EXTRACT(ISODOW FROM ap.plan_start_date)::int + 1
                + (((c->>'week')::int - 1) * 7)
                + COALESCE((
                  '{"Mån":0,"Tis":1,"Ons":2,"Tors":3,"Tor":3,"Fre":4,"Lör":5,"Sön":6,"Måndag":0,"Tisdag":1,"Onsdag":2,"Torsdag":3,"Fredag":4,"Lördag":5,"Söndag":6}'::jsonb
                  ->> regexp_replace(c->>'day', '_[a-z0-9]+$', '', 'i')
                )::int, 0)
              ) AS d
              WHERE ap.plan_start_date IS NOT NULL AND (c->>'week')::int > 0
            ) s),
            ((c->>'updated_at')::timestamptz AT TIME ZONE 'UTC')::date,
            ap.archived_at::date
          )
      END AS completion_date,
      1 AS pass_count
    FROM archived_plans ap,
         jsonb_array_elements(ap.completion_data) c
    WHERE (c->>'done')::boolean = true
      AND (
        COALESCE(c->>'logged_distance_km', '') <> ''
        OR COALESCE(c->>'logged_tempo', '') <> ''
        OR COALESCE(c->>'logged_pulse', '') <> ''
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE(c->'logged_weights', '{}'::jsonb)) kv
          WHERE (kv.key LIKE '\_\_sets\_\_%' AND kv.value LIKE '%1%')
             OR (kv.key LIKE '\_\_cond\_done\_\_%' AND kv.value = '1')
             OR (kv.key LIKE '\_\_cond\_\_%' AND COALESCE(kv.value, '') NOT IN ('', '{}'))
             OR (kv.key LIKE '\_\_setdata\_\_%' AND kv.value ~ '"(reps|kg|time)"\s*:\s*"?[1-9]')
        )
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
    COALESCE(SUM(ac.pass_count), 0)::bigint AS done_count,
    p.is_honorary
  FROM profiles p
  JOIN all_completions ac ON ac.c_user_id = p.user_id
  WHERE ac.completion_date IS NOT NULL
    AND EXTRACT(YEAR FROM ac.completion_date) = filter_year
    AND (filter_month IS NULL OR EXTRACT(MONTH FROM ac.completion_date) = filter_month)
    AND p.nickname !~* '^test\d+$'
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COALESCE(SUM(ac.pass_count), 0) > 0
  ORDER BY done_count DESC;
END;
$function$;