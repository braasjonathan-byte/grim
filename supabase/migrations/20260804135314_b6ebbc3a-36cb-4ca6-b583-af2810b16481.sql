CREATE TABLE public.saved_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT 'running',
  distance_km NUMERIC NOT NULL,
  elevation_gain_m NUMERIC,
  elevation_loss_m NUMERIC,
  paved_ratio NUMERIC,
  surfaces TEXT[] NOT NULL DEFAULT '{}',
  points JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_routes TO authenticated;
GRANT ALL ON public.saved_routes TO service_role;

ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved routes"
ON public.saved_routes FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX saved_routes_user_idx ON public.saved_routes (user_id, created_at DESC);

CREATE TRIGGER update_saved_routes_updated_at
BEFORE UPDATE ON public.saved_routes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();