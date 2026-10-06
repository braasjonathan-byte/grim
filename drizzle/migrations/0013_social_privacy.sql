DROP TRIGGER IF EXISTS trg_ensure_workout_social_post ON public.workout_completions;
COMMENT ON FUNCTION public.ensure_workout_social_post() IS 'DEPRECATED: workouts are only shared when the user chooses to share';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_share_workouts text NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS default_post_visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS show_on_leaderboard boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_plan_with_friends boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN show_on_leaderboard SET DEFAULT false;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_auto_share_chk CHECK (auto_share_workouts IN ('off','ask','always'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_default_vis_chk CHECK (default_post_visibility IN ('friends','public'));

CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  reported_user_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','inappropriate','harassment','other')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can file reports" ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND reported_user_id <> auth.uid());
CREATE POLICY "Reporters and admins read reports" ON public.post_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.muted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  muted_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.muted_users TO authenticated;
GRANT ALL ON public.muted_users TO service_role;
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own mutes select" ON public.muted_users FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own mutes insert" ON public.muted_users FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND muted_user_id <> auth.uid());
CREATE POLICY "Own mutes delete" ON public.muted_users FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Plans visible to friends only when the owner opts in
CREATE OR REPLACE FUNCTION public.shares_plan_with_friends(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT share_plan_with_friends FROM public.profiles WHERE user_id = _user_id LIMIT 1), false)
$$;
DROP POLICY IF EXISTS "Users can read own and friends plans" ON public.workout_plans;
CREATE POLICY "Users can read own and friends plans" ON public.workout_plans FOR SELECT TO authenticated
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR (
  public.shares_plan_with_friends(user_id) AND EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
    AND ((f.user_id = auth.uid() AND f.friend_id = workout_plans.user_id) OR (f.friend_id = auth.uid() AND f.user_id = workout_plans.user_id)))));

-- Remove the feed post when its workout is deleted
CREATE OR REPLACE FUNCTION public.remove_workout_social_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'workout_plans' AND EXISTS (
    SELECT 1 FROM public.workout_plans WHERE user_id = OLD.user_id AND week = OLD.week AND day = OLD.day
  ) THEN
    RETURN OLD;
  END IF;
  DELETE FROM public.social_posts
   WHERE user_id = OLD.user_id AND workout_week = OLD.week AND workout_day = OLD.day;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_remove_post_on_plan_delete AFTER DELETE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION public.remove_workout_social_post();
CREATE TRIGGER trg_remove_post_on_completion_delete AFTER DELETE ON public.workout_completions
  FOR EACH ROW EXECUTE FUNCTION public.remove_workout_social_post();

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
    AND (p.show_on_leaderboard OR p.user_id = auth.uid())
    AND NOT public.are_blocked(auth.uid(), p.user_id)
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.is_honorary
  HAVING COALESCE(SUM(ac.pass_count), 0) > 0
  ORDER BY done_count DESC;
END;
$function$;