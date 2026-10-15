CREATE OR REPLACE FUNCTION public.sync_recipes_on_food_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; new_ings jsonb; tk numeric; tp numeric; tf numeric; tc numeric;
BEGIN
  IF OLD.kcal IS NOT DISTINCT FROM NEW.kcal AND OLD.protein_g IS NOT DISTINCT FROM NEW.protein_g
     AND OLD.fat_g IS NOT DISTINCT FROM NEW.fat_g AND OLD.carbs_g IS NOT DISTINCT FROM NEW.carbs_g
     AND OLD.fiber_g IS NOT DISTINCT FROM NEW.fiber_g THEN RETURN NEW; END IF;
  IF COALESCE(OLD.kcal,0) <= 0 THEN RETURN NEW; END IF;
  FOR r IN SELECT id, servings, ingredients FROM public.recipes
           WHERE ingredients @> jsonb_build_array(jsonb_build_object('id', NEW.id::text, 'source', 'food')) LOOP
    SELECT jsonb_agg(CASE WHEN e->>'id' = NEW.id::text AND e->>'source' = 'food' AND (e->>'kcal')::numeric > 0 THEN
        e || jsonb_build_object(
          'kcal', round(((e->>'kcal')::numeric * 100 / OLD.kcal) * NEW.kcal / 100, 2),
          'protein_g', round(((e->>'kcal')::numeric * 100 / OLD.kcal) * NEW.protein_g / 100, 2),
          'fat_g', round(((e->>'kcal')::numeric * 100 / OLD.kcal) * NEW.fat_g / 100, 2),
          'carbs_g', round(((e->>'kcal')::numeric * 100 / OLD.kcal) * NEW.carbs_g / 100, 2),
          'fiber_g', round(((e->>'kcal')::numeric * 100 / OLD.kcal) * COALESCE(NEW.fiber_g,0) / 100, 2))
      ELSE e END ORDER BY ord)
    INTO new_ings FROM jsonb_array_elements(r.ingredients) WITH ORDINALITY AS t(e, ord);
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
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_recipes_on_food_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_recipes_on_food_update ON public.foods;
CREATE TRIGGER trg_sync_recipes_on_food_update AFTER UPDATE ON public.foods
FOR EACH ROW EXECUTE FUNCTION public.sync_recipes_on_food_update();