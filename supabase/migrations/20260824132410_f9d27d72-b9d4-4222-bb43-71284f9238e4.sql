CREATE OR REPLACE FUNCTION public.archive_current_workouts(p_include_singles boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_data jsonb;
  v_completion_data jsonb;
  v_single_data jsonb;
  v_single_completion_data jsonb;
  v_plan_start_date date;
  v_named_count integer := 0;
  v_week_count integer := 0;
  v_plan_count integer := 0;
  v_single_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  SELECT plan_start_date
    INTO v_plan_start_date
    FROM public.profiles
   WHERE user_id = v_user_id;

  SELECT
    COALESCE(jsonb_agg(to_jsonb(wp) ORDER BY wp.week, wp.day, wp.created_at), '[]'::jsonb),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE btrim(COALESCE(wp.session_name, '')) <> '')::integer,
    COUNT(DISTINCT wp.week)::integer
  INTO v_plan_data, v_plan_count, v_named_count, v_week_count
  FROM public.workout_plans wp
  WHERE wp.user_id = v_user_id
    AND wp.week > 0;

  SELECT COALESCE(jsonb_agg(to_jsonb(wc) ORDER BY wc.week, wc.day, wc.updated_at), '[]'::jsonb)
    INTO v_completion_data
    FROM public.workout_completions wc
   WHERE wc.user_id = v_user_id
     AND wc.week > 0;

  IF v_plan_count > 0 THEN
    INSERT INTO public.archived_plans (
      user_id, plan_name, plan_data, completion_data, plan_start_date
    ) VALUES (
      v_user_id,
      CASE
        WHEN v_named_count > 0 THEN format('Schema (%s pass, %s veckor)', v_named_count, v_week_count)
        ELSE 'Schema'
      END,
      v_plan_data,
      v_completion_data,
      v_plan_start_date
    );
  END IF;

  IF p_include_singles THEN
    SELECT
      COALESCE(jsonb_agg(to_jsonb(wp) ORDER BY wp.day, wp.created_at), '[]'::jsonb),
      COUNT(*)::integer
    INTO v_single_data, v_single_count
    FROM public.workout_plans wp
    WHERE wp.user_id = v_user_id
      AND wp.week = 0;

    SELECT COALESCE(jsonb_agg(to_jsonb(wc) ORDER BY wc.day, wc.updated_at), '[]'::jsonb)
      INTO v_single_completion_data
      FROM public.workout_completions wc
     WHERE wc.user_id = v_user_id
       AND wc.week = 0;

    IF v_single_count > 0 THEN
      INSERT INTO public.archived_plans (
        user_id, plan_name, plan_data, completion_data, plan_start_date
      ) VALUES (
        v_user_id,
        format('Enskilda pass (%s pass)', v_single_count),
        v_single_data,
        v_single_completion_data,
        NULL
      );
    END IF;
  END IF;

  DELETE FROM public.workout_completions
   WHERE user_id = v_user_id
     AND (p_include_singles OR week > 0);

  DELETE FROM public.workout_plans
   WHERE user_id = v_user_id
     AND (p_include_singles OR week > 0);

  UPDATE public.profiles
     SET plan_start_date = NULL,
         plan_start_calibrated = false
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'plan_count', v_plan_count,
    'single_count', v_single_count,
    'archived', (v_plan_count + v_single_count) > 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_current_workouts(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_current_workouts(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.archive_current_workouts(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_current_workouts(boolean) TO service_role;