
-- Table for admin-managed exercise-to-GIF mappings
CREATE TABLE public.exercise_gif_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name text NOT NULL,
  exercise_name_lower text GENERATED ALWAYS AS (LOWER(exercise_name)) STORED,
  exercisedb_name text NOT NULL,
  gif_url text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(exercise_name_lower)
);

-- Enable RLS
ALTER TABLE public.exercise_gif_mappings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read mappings (needed by the edge function via service role, and UI)
CREATE POLICY "Authenticated users can read mappings"
ON public.exercise_gif_mappings FOR SELECT
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert mappings"
ON public.exercise_gif_mappings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update mappings"
ON public.exercise_gif_mappings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete mappings"
ON public.exercise_gif_mappings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Deny anon
CREATE POLICY "Deny anon access"
ON public.exercise_gif_mappings FOR ALL
USING (false)
WITH CHECK (false);

-- Trigger for updated_at
CREATE TRIGGER update_exercise_gif_mappings_updated_at
BEFORE UPDATE ON public.exercise_gif_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
