CREATE TABLE public.food_portion_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name_lower text NOT NULL,
  grams numeric NOT NULL,
  times integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name_lower)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_portion_memory TO authenticated;
GRANT ALL ON public.food_portion_memory TO service_role;
ALTER TABLE public.food_portion_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own portion memory" ON public.food_portion_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.validate_portion_memory() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.grams <= 0 OR NEW.grams > 5000 THEN RAISE EXCEPTION 'Ogiltig mängd'; END IF;
  IF length(NEW.name_lower) > 120 THEN RAISE EXCEPTION 'För långt namn'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER validate_portion_memory BEFORE INSERT OR UPDATE ON public.food_portion_memory
  FOR EACH ROW EXECUTE FUNCTION public.validate_portion_memory();