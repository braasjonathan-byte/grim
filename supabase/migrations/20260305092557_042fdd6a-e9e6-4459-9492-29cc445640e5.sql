
ALTER TABLE public.suggestions ADD COLUMN handled_at timestamptz DEFAULT NULL;
ALTER TABLE public.suggestions ADD COLUMN handled_by uuid DEFAULT NULL;

-- Allow admins to update suggestions (for marking as handled)
CREATE POLICY "Admins can update suggestions"
  ON public.suggestions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
