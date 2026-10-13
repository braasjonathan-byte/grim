CREATE OR REPLACE FUNCTION public.validate_body_weight_log() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.weight_kg < 30 OR NEW.weight_kg > 300 THEN RAISE EXCEPTION 'Vikten måste vara mellan 30 och 300 kg'; END IF;
  RETURN NEW;
END $$;