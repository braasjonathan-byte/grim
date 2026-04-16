
CREATE TABLE public.ready_workout_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_label TEXT NOT NULL,
  workout_name TEXT NOT NULL,
  is_circuit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_label, workout_name)
);

ALTER TABLE public.ready_workout_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read workout config"
ON public.ready_workout_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage workout config"
ON public.ready_workout_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deny anon access"
ON public.ready_workout_config
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
