
CREATE TABLE public.tool_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tool_layout ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated can read layout"
  ON public.tool_layout FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage layout"
  ON public.tool_layout FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.tool_layout (section_order) VALUES ('[]'::jsonb);
