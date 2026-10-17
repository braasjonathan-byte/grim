CREATE OR REPLACE FUNCTION public.admin_rescale_recipe_food_units(p_food_id uuid, p_vol_ratio numeric, p_piece_ratio numeric)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; new_ings jsonb; tk numeric; tp numeric; tf numeric; tc numeric; n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF COALESCE(p_vol_ratio,1) <= 0 OR COALESCE(p_piece_ratio,1) <= 0 THEN RAISE EXCEPTION 'invalid ratio'; END IF;
  FOR r IN SELECT id, servings, ingredients FROM public.recipes
           WHERE ingredients @> jsonb_build_array(jsonb_build_object('id', p_food_id::text, 'source', 'food')) LOOP
    SELECT jsonb_agg(CASE
        WHEN e->>'id' = p_food_id::text AND e->>'source' = 'food'
             AND ((lower(e->>'unit') IN ('dl','ml','msk','tsk') AND COALESCE(p_vol_ratio,1) <> 1)
               OR (lower(e->>'unit') = 'st' AND COALESCE(p_piece_ratio,1) <> 1)) THEN
          (SELECT e || jsonb_build_object(
             'kcal', round(COALESCE((e->>'kcal')::numeric,0) * k, 2),
             'protein_g', round(COALESCE((e->>'protein_g')::numeric,0) * k, 2),
             'fat_g', round(COALESCE((e->>'fat_g')::numeric,0) * k, 2),
             'carbs_g', round(COALESCE((e->>'carbs_g')::numeric,0) * k, 2),
             'fiber_g', round(COALESCE((e->>'fiber_g')::numeric,0) * k, 2))
           FROM (SELECT CASE WHEN lower(e->>'unit') = 'st' THEN COALESCE(p_piece_ratio,1) ELSE COALESCE(p_vol_ratio,1) END AS k) kk)
        ELSE e END ORDER BY ord)
    INTO new_ings FROM jsonb_array_elements(r.ingredients) WITH ORDINALITY AS t(e, ord);
    IF new_ings IS NOT DISTINCT FROM r.ingredients THEN CONTINUE; END IF;
    SELECT COALESCE(sum((e->>'kcal')::numeric),0), COALESCE(sum((e->>'protein_g')::numeric),0),
           COALESCE(sum((e->>'fat_g')::numeric),0), COALESCE(sum((e->>'carbs_g')::numeric),0)
      INTO tk, tp, tf, tc FROM jsonb_array_elements(new_ings) e;
    UPDATE public.recipes SET ingredients = new_ings,
      kcal_per_serving = round(tk / GREATEST(r.servings,1), 1),
      protein_g_per_serving = round(tp / GREATEST(r.servings,1), 1),
      fat_g_per_serving = round(tf / GREATEST(r.servings,1), 1),
      carbs_g_per_serving = round(tc / GREATEST(r.servings,1), 1),
      updated_at = now()
    WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_rescale_recipe_food_units(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rescale_recipe_food_units(uuid, numeric, numeric) TO authenticated;