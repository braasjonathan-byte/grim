CREATE TABLE public.nutrition_preferences (
 user_id uuid PRIMARY KEY,
 simple_view boolean NOT NULL DEFAULT true,
 meal_allocation jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_preferences TO authenticated;
GRANT ALL ON public.nutrition_preferences TO service_role;
ALTER TABLE public.nutrition_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own nutrition preferences" ON public.nutrition_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.nutrition_complete_days (
 user_id uuid NOT NULL,
 log_date date NOT NULL,
 PRIMARY KEY (user_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_complete_days TO authenticated;
GRANT ALL ON public.nutrition_complete_days TO service_role;
ALTER TABLE public.nutrition_complete_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own complete nutrition days" ON public.nutrition_complete_days FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE FUNCTION public.validate_nutrition_allocation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry record; kcal_sum numeric := 0; protein_sum numeric := 0; k numeric; p numeric;
BEGIN
 IF jsonb_typeof(NEW.meal_allocation) <> 'object' THEN RAISE EXCEPTION 'Invalid meal allocation'; END IF;
 FOR entry IN SELECT * FROM jsonb_each(NEW.meal_allocation) LOOP
  k := (entry.value->>'kcal')::numeric; p := (entry.value->>'protein')::numeric;
  IF k IS NULL OR p IS NULL OR k < 0 OR k > 100 OR p < 0 OR p > 100 OR k <> trunc(k) OR p <> trunc(p) THEN RAISE EXCEPTION 'Meal shares must be whole percentages between 0 and 100'; END IF;
  kcal_sum := kcal_sum + k; protein_sum := protein_sum + p;
 END LOOP;
 IF NEW.meal_allocation <> '{}'::jsonb AND (kcal_sum <> 100 OR protein_sum <> 100) THEN RAISE EXCEPTION 'Meal shares must each total 100 percent'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_nutrition_allocation BEFORE INSERT OR UPDATE ON public.nutrition_preferences FOR EACH ROW EXECUTE FUNCTION public.validate_nutrition_allocation();
ALTER TABLE public.meal_logs ADD COLUMN nutrition_source text;
ALTER TABLE public.custom_foods ADD COLUMN nutrition_source text;
ALTER TABLE public.foods ADD COLUMN nutrition_source text;