CREATE OR REPLACE FUNCTION public.admin_merge_exercises(p_from text[], p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_to text := btrim(p_to);
  v_from_lower text[];
  v_to_lower text;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_pattern text;
  rec record;
  merged_weights jsonb;
  wk_key text;
  wk_val jsonb;
  new_details text;
  line text;
  out_lines text[];
  arr jsonb;
  plan_obj jsonb;
  new_plan jsonb;
  v_target_exists boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can merge exercises';
  END IF;
  IF v_to IS NULL OR v_to = '' THEN
    RAISE EXCEPTION 'Target name required';
  END IF;
  IF p_from IS NULL OR array_length(p_from, 1) IS NULL THEN
    RAISE EXCEPTION 'Source names required';
  END IF;

  v_to_lower := lower(v_to);
  SELECT array_agg(DISTINCT lower(btrim(x))) INTO v_from_lower FROM unnest(p_from) x WHERE btrim(x) <> '';

  SELECT '(?i)(' || string_agg(regexp_replace(x, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g'), '|') || ')'
    INTO v_pattern
    FROM unnest(p_from) x WHERE btrim(x) <> '';

  -- custom_exercises (UNIQUE on lower(name))
  SELECT EXISTS(SELECT 1 FROM custom_exercises WHERE lower(name) = v_to_lower) INTO v_target_exists;
  IF v_target_exists THEN
    -- Target row exists: delete ALL source duplicates
    DELETE FROM custom_exercises
     WHERE lower(name) = ANY(v_from_lower) AND lower(name) <> v_to_lower;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('custom_exercises_deleted', v_n);
  ELSE
    -- No target row: keep the "best" source row (most fields filled), delete others, rename keeper
    WITH ranked AS (
      SELECT id, row_number() OVER (
        ORDER BY (CASE WHEN secondary_muscles <> '[]'::jsonb OR array_length(submuscles,1) IS NOT NULL THEN 0 ELSE 1 END),
                 created_at ASC
      ) AS rn
      FROM custom_exercises WHERE lower(name) = ANY(v_from_lower)
    )
    DELETE FROM custom_exercises WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('custom_exercises_deleted', v_n);
    UPDATE custom_exercises SET name = v_to WHERE lower(name) = ANY(v_from_lower) AND name <> v_to;
  END IF;
  -- Normalize casing of target
  UPDATE custom_exercises SET name = v_to WHERE lower(name) = v_to_lower AND name <> v_to;

  -- pr_overrides
  UPDATE pr_overrides SET exercise = v_to
   WHERE lower(exercise) = ANY(v_from_lower) AND lower(exercise) <> v_to_lower;
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY weight DESC NULLS LAST, updated_at DESC) rn
    FROM pr_overrides WHERE lower(exercise) = v_to_lower
  )
  DELETE FROM pr_overrides WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
  UPDATE pr_overrides SET exercise = v_to WHERE lower(exercise) = v_to_lower AND exercise <> v_to;

  -- pr_stars
  UPDATE pr_stars SET exercise = v_to
   WHERE lower(exercise) = ANY(v_from_lower) AND lower(exercise) <> v_to_lower;
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at ASC) rn
    FROM pr_stars WHERE lower(exercise) = v_to_lower
  )
  DELETE FROM pr_stars WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
  UPDATE pr_stars SET exercise = v_to WHERE lower(exercise) = v_to_lower AND exercise <> v_to;

  -- pr_goals
  UPDATE pr_goals SET exercise = v_to
   WHERE lower(exercise) = ANY(v_from_lower) AND lower(exercise) <> v_to_lower;
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) rn
    FROM pr_goals WHERE lower(exercise) = v_to_lower
  )
  DELETE FROM pr_goals WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
  UPDATE pr_goals SET exercise = v_to WHERE lower(exercise) = v_to_lower AND exercise <> v_to;

  -- exercise_muscle_overrides
  SELECT EXISTS(SELECT 1 FROM exercise_muscle_overrides WHERE lower(exercise_name) = v_to_lower) INTO v_target_exists;
  IF v_target_exists THEN
    DELETE FROM exercise_muscle_overrides
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  ELSE
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY updated_at DESC) rn
      FROM exercise_muscle_overrides WHERE lower(exercise_name) = ANY(v_from_lower)
    )
    DELETE FROM exercise_muscle_overrides WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    UPDATE exercise_muscle_overrides SET exercise_name = v_to
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  END IF;
  UPDATE exercise_muscle_overrides SET exercise_name = v_to
   WHERE lower(exercise_name) = v_to_lower AND exercise_name <> v_to;

  -- exercise_gif_mappings
  SELECT EXISTS(SELECT 1 FROM exercise_gif_mappings WHERE lower(exercise_name) = v_to_lower) INTO v_target_exists;
  IF v_target_exists THEN
    DELETE FROM exercise_gif_mappings
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  ELSE
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY updated_at DESC) rn
      FROM exercise_gif_mappings WHERE lower(exercise_name) = ANY(v_from_lower)
    )
    DELETE FROM exercise_gif_mappings WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    UPDATE exercise_gif_mappings SET exercise_name = v_to
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  END IF;
  UPDATE exercise_gif_mappings SET exercise_name = v_to
   WHERE lower(exercise_name) = v_to_lower AND exercise_name <> v_to;

  -- exercise_description_reports
  SELECT EXISTS(SELECT 1 FROM exercise_description_reports WHERE lower(exercise_name) = v_to_lower) INTO v_target_exists;
  IF v_target_exists THEN
    DELETE FROM exercise_description_reports
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  ELSE
    UPDATE exercise_description_reports SET exercise_name = v_to
     WHERE lower(exercise_name) = ANY(v_from_lower) AND lower(exercise_name) <> v_to_lower;
  END IF;

  -- workout_completions.logged_weights
  v_n := 0;
  FOR rec IN
    SELECT wc.id, wc.logged_weights FROM workout_completions wc
     WHERE wc.logged_weights IS NOT NULL
       AND wc.logged_weights::text <> '{}'
       AND EXISTS (
         SELECT 1 FROM jsonb_object_keys(wc.logged_weights) AS okeys(key_name)
          WHERE lower(okeys.key_name) = ANY(v_from_lower)
       )
  LOOP
    merged_weights := '{}'::jsonb;
    arr := '[]'::jsonb;
    FOR wk_key, wk_val IN SELECT key, value FROM jsonb_each(rec.logged_weights) LOOP
      IF lower(wk_key) = ANY(v_from_lower) OR lower(wk_key) = v_to_lower THEN
        IF jsonb_typeof(wk_val) = 'array' THEN
          arr := arr || wk_val;
        ELSE
          arr := arr || jsonb_build_array(wk_val);
        END IF;
      ELSE
        merged_weights := merged_weights || jsonb_build_object(wk_key, wk_val);
      END IF;
    END LOOP;
    IF jsonb_array_length(arr) > 0 THEN
      merged_weights := merged_weights || jsonb_build_object(v_to, arr);
    END IF;
    UPDATE workout_completions SET logged_weights = merged_weights WHERE id = rec.id;
    v_n := v_n + 1;
  END LOOP;
  v_counts := v_counts || jsonb_build_object('completions_updated', v_n);

  -- workout_plans.details
  v_n := 0;
  FOR rec IN SELECT id, details FROM workout_plans WHERE details IS NOT NULL AND details ~* v_pattern LOOP
    out_lines := ARRAY[]::text[];
    FOREACH line IN ARRAY string_to_array(rec.details, E'\n') LOOP
      out_lines := out_lines || regexp_replace(line, v_pattern, v_to, 'gi');
    END LOOP;
    new_details := array_to_string(out_lines, E'\n');
    IF new_details IS DISTINCT FROM rec.details THEN
      UPDATE workout_plans SET details = new_details WHERE id = rec.id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_counts := v_counts || jsonb_build_object('workout_plans_updated', v_n);

  -- saved_workouts.details
  v_n := 0;
  FOR rec IN SELECT id, details FROM saved_workouts WHERE details IS NOT NULL AND details ~* v_pattern LOOP
    out_lines := ARRAY[]::text[];
    FOREACH line IN ARRAY string_to_array(rec.details, E'\n') LOOP
      out_lines := out_lines || regexp_replace(line, v_pattern, v_to, 'gi');
    END LOOP;
    new_details := array_to_string(out_lines, E'\n');
    IF new_details IS DISTINCT FROM rec.details THEN
      UPDATE saved_workouts SET details = new_details WHERE id = rec.id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_counts := v_counts || jsonb_build_object('saved_workouts_updated', v_n);

  -- archived_plans.plan_data
  v_n := 0;
  FOR rec IN SELECT id, plan_data FROM archived_plans WHERE plan_data::text ~* v_pattern LOOP
    new_plan := '[]'::jsonb;
    FOR plan_obj IN SELECT value FROM jsonb_array_elements(rec.plan_data) LOOP
      IF plan_obj ? 'details' AND jsonb_typeof(plan_obj->'details') = 'string' THEN
        out_lines := ARRAY[]::text[];
        FOREACH line IN ARRAY string_to_array(plan_obj->>'details', E'\n') LOOP
          out_lines := out_lines || regexp_replace(line, v_pattern, v_to, 'gi');
        END LOOP;
        plan_obj := jsonb_set(plan_obj, '{details}', to_jsonb(array_to_string(out_lines, E'\n')));
      END IF;
      new_plan := new_plan || jsonb_build_array(plan_obj);
    END LOOP;
    IF new_plan IS DISTINCT FROM rec.plan_data THEN
      UPDATE archived_plans SET plan_data = new_plan WHERE id = rec.id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  v_counts := v_counts || jsonb_build_object('archived_plans_updated', v_n);

  RETURN v_counts;
END;
$function$;