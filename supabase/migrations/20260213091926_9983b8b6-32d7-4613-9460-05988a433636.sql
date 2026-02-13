
CREATE POLICY "Admins can delete suggestions"
ON public.suggestions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
