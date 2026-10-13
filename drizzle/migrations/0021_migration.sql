CREATE TABLE public.body_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL,
  weight_kg numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);
ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_weight_logs TO authenticated;
CREATE POLICY "own weight select" ON public.body_weight_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own weight insert" ON public.body_weight_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own weight update" ON public.body_weight_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own weight delete" ON public.body_weight_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.validate_body_weight_log() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.weight_kg < 20 OR NEW.weight_kg > 400 THEN RAISE EXCEPTION 'Vikten måste vara mellan 20 och 400 kg'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_body_weight_log BEFORE INSERT OR UPDATE ON public.body_weight_logs FOR EACH ROW EXECUTE FUNCTION public.validate_body_weight_log();