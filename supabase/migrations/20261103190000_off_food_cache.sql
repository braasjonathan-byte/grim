-- Open Food Facts → foods: cache vid sök/skanning + bulkimport av svenska produkter.
-- OFF-rader: nutrition_source = 'off', group_name = 'Märkesvara', barcode unik.
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS off_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS foods_barcode_uniq ON public.foods (barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS foods_off_name_uniq ON public.foods (lower(name)) WHERE nutrition_source = 'off';
CREATE INDEX IF NOT EXISTS foods_nutrition_source_idx ON public.foods (nutrition_source);

-- Kvalitetsfilter: energi + protein/fett/kolhydrater rimliga och energin stämmer ungefär med makron.
CREATE OR REPLACE FUNCTION public.off_food_ok(p_name text, p_kcal numeric, p_p numeric, p_f numeric, p_c numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_name IS NOT NULL AND length(btrim(p_name)) BETWEEN 2 AND 160
    AND p_kcal IS NOT NULL AND p_kcal > 0 AND p_kcal <= 900
    AND p_p IS NOT NULL AND p_f IS NOT NULL AND p_c IS NOT NULL
    AND p_p BETWEEN 0 AND 100 AND p_f BETWEEN 0 AND 100 AND p_c BETWEEN 0 AND 100
    AND (p_p + p_f + p_c) BETWEEN 0.5 AND 101
    AND abs((4*p_p + 4*p_c + 9*p_f) - p_kcal) <= greatest(40, 0.35 * p_kcal)
$$;

-- Cacha en OFF-produkt (anropas av nutrition-search/-barcode med användarens JWT).
-- Hoppar över dubbletter på streckkod eller namn. Returnerar foods.id eller null.
CREATE OR REPLACE FUNCTION public.cache_off_food(
  p_barcode text, p_name text, p_brand text,
  p_kcal numeric, p_protein numeric, p_fat numeric, p_carbs numeric,
  p_fiber numeric DEFAULT 0, p_sugar numeric DEFAULT NULL, p_nova integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RETURN NULL;
  END IF;
  IF p_barcode IS NULL OR p_barcode !~ '^\d{6,14}$' THEN RETURN NULL; END IF;
  IF NOT public.off_food_ok(p_name, p_kcal, p_protein, p_fat, p_carbs) THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM public.foods WHERE barcode = p_barcode;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT id INTO v_id FROM public.foods WHERE nutrition_source = 'off' AND lower(name) = lower(btrim(p_name));
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.foods (name, group_name, kcal, protein_g, fat_g, carbs_g, fiber_g, sugar_g, nova_group, nutrition_source, barcode, brand, off_synced_at)
  VALUES (btrim(p_name), 'Märkesvara', round(p_kcal, 1), round(p_protein, 1), round(p_fat, 1), round(p_carbs, 1),
          round(greatest(coalesce(p_fiber, 0), 0), 1), round(p_sugar, 1), p_nova, 'off', p_barcode, nullif(btrim(p_brand), ''), now())
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.cache_off_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cache_off_food(text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, integer) TO authenticated, service_role;
